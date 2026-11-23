import asyncio
import os
from uuid import uuid4

import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


PASSWORD = "test-password-for-local-users"


def migrate(connection, revision="head"):
    config = Config("alembic.ini")
    config.attributes["connection"] = connection
    command.upgrade(config, revision)


@pytest_asyncio.fixture(loop_scope="function")
async def test_schema(monkeypatch):
    url = os.getenv("JIRA_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set JIRA_TEST_DATABASE_URL to run PostgreSQL integration tests")
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("JWT_ACCESS_TOKEN_TTL_MINUTES", "15")
    monkeypatch.setenv("JWT_REFRESH_TOKEN_TTL_MINUTES", "10080")
    url = make_url(url).set(drivername="postgresql+asyncpg")
    schema = f"jira_test_{uuid4().hex}"
    admin = create_async_engine(url)
    async with admin.begin() as connection:
        await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database = create_async_engine(url, connect_args={"server_settings": {"search_path": schema}})
    try:
        yield database
    finally:
        await database.dispose()
        async with admin.begin() as connection:
            await connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        await admin.dispose()


@pytest_asyncio.fixture(loop_scope="function")
async def api(test_schema, monkeypatch):
    from pydantic import SecretStr

    from app.core.config import settings
    from app.core.security import password_hasher
    from app.db.session import get_db
    from main import app
    from scripts import provision_user

    async with test_schema.begin() as connection:
        await connection.run_sync(migrate)
    sessions = async_sessionmaker(test_schema, expire_on_commit=False)
    monkeypatch.setattr(provision_user, "SessionLocal", sessions)
    monkeypatch.setattr(settings, "jwt_secret", SecretStr("test-key-for-local-integration-tests-only"))
    password_hash = password_hasher.hash(PASSWORD)
    owner, org = await provision_user.provision_user(
        "owner@example.com", "Owner", password_hash, "company", "Company", "owner"
    )
    worker, _ = await provision_user.provision_user(
        "worker@example.com", "Worker", password_hash, "company", None, "member"
    )
    outsider, _ = await provision_user.provision_user(
        "outsider@example.com", "Outsider", password_hash, "other", "Other", "owner"
    )

    async def database_override():
        async with sessions() as session:
            yield session

    monkeypatch.setitem(app.dependency_overrides, get_db, database_override)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test/api/v1/") as client:
        yield client, str(org.id), str(owner.id), str(worker.id), str(outsider.id)


async def request(client, method, path, expected, *, token=None, **kwargs):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    response = await client.request(method, path, headers=headers, **kwargs)
    assert response.status_code == expected, response.text
    return response.json() if response.content else None


async def login(client, email):
    return await request(client, "POST", "auth/login", 200, json={"email": email, "password": PASSWORD})


@pytest.mark.asyncio
async def test_owner_creates_organization_and_adds_accounts(api):
    client, _, owner_id, _, outsider_id = api
    owner = (await login(client, "owner@example.com"))["access_token"]
    worker = (await login(client, "worker@example.com"))["access_token"]
    values = {"name": "Product Studio", "slug": "product-studio"}
    await request(client, "POST", "organizations", 403, token=worker, json=values)
    organization = await request(client, "POST", "organizations", 201, token=owner, json=values)
    await request(client, "POST", "organizations", 409, token=owner, json=values)
    members = f"organizations/{organization['id']}/members"
    assert {row["user_id"]: row["role"] for row in await request(client, "GET", members, 200, token=owner)} == {
        owner_id: "owner",
    }

    existing = {"mode": "existing", "email": "OUTSIDER@example.com", "role": "admin"}
    await request(client, "POST", members, 404, token=worker, json=existing)
    added = await request(client, "POST", members, 201, token=owner, json=existing)
    assert added["user_id"] == outsider_id
    await request(client, "POST", members, 409, token=owner, json={**existing, "role": "member"})
    admin = (await login(client, "outsider@example.com"))["access_token"]

    credentials = {"email": "new-hire@example.com", "password": "Q3-test!"}
    account = {"mode": "create", "name": "New Hire", "role": "member", **credentials}
    await request(client, "POST", members, 403, token=admin, json={**account, "role": "owner"})
    bad_password = "shortQA"
    response = await client.post(members, headers={"Authorization": f"Bearer {admin}"}, json={**account, "password": bad_password})
    assert response.status_code == 422 and bad_password not in response.text
    record = await request(client, "POST", members, 201, token=admin, json=account)
    assert record["role"] == "member" and "password" not in record and "password_hash" not in record
    await request(client, "POST", members, 409, token=admin, json={**account, "password": "different-test-password"})
    session = await request(client, "POST", "auth/login", 200, json=credentials)
    projects = await request(client, "GET", "organizations", 200, token=session["access_token"])
    assert [item["id"] for item in projects] == [organization["id"]]


@pytest.mark.asyncio
async def test_project_workflow(api):
    client, org_id, owner_id, worker_id, outsider_id = api
    owner = (await login(client, "OWNER@example.com"))["access_token"]
    worker = (await login(client, "worker@example.com"))["access_token"]
    outsider = (await login(client, "outsider@example.com"))["access_token"]

    await request(client, "GET", "users/me", 401)
    profile = await request(client, "GET", "users/me", 200, token=owner)
    assert profile["id"] == owner_id and "password_hash" not in profile
    await request(client, "PATCH", "users/me", 200, token=owner, json={"name": "Team Owner"})
    org_path = f"organizations/{org_id}"
    assert [org["id"] for org in await request(client, "GET", "organizations", 200, token=owner)] == [org_id]
    await request(client, "GET", org_path, 404, token=outsider)
    await request(client, "GET", org_path, 200, token=worker)
    await request(client, "PATCH", org_path, 403, token=worker, json={"name": "Other"})
    await request(client, "PATCH", org_path, 200, token=owner, json={"name": "Engineering"})
    await request(client, "GET", org_path + "/members", 200, token=owner)
    await request(client, "PUT", f"{org_path}/members/{outsider_id}", 200, token=owner, json={"role": "member"})
    await request(client, "DELETE", f"{org_path}/members/{owner_id}", 409, token=owner)

    projects = org_path + "/projects"
    project = await request(client, "POST", projects, 201, token=owner, json={"name": "Engineering", "key": "eng"})
    assert project["key"] == "ENG" and project["created_by"] == owner_id
    await request(client, "POST", projects, 409, token=owner, json={"name": "Duplicate", "key": "ENG"})
    assert not await request(client, "GET", projects, 200, token=worker)
    project_path = f"projects/{project['id']}"
    await request(client, "GET", project_path, 404, token=worker)
    await request(client, "GET", project_path, 200, token=owner)
    await request(client, "PATCH", project_path, 200, token=owner, json={"description": "Delivery"})
    await request(client, "GET", project_path + "/members", 200, token=owner)
    project_member = f"{project_path}/members/{worker_id}"
    await request(client, "PUT", project_member, 200, token=owner, json={"role": "viewer"})
    await request(client, "GET", project_path, 200, token=worker)
    task_list = project_path + "/tasks"
    payload = {"title": "Implement 100% coverage", "assignee_id": worker_id, "priority": "high"}
    await request(client, "POST", task_list, 403, token=worker, json=payload)
    await request(client, "POST", task_list, 422, token=owner, json=payload)
    await request(client, "PUT", project_member, 200, token=owner, json={"role": "member"})
    task = await request(client, "POST", task_list, 201, token=owner, json={"title": "Draft task"})
    assert task["key"] == "ENG-1" and task["assignee_id"] is None
    concurrent = await asyncio.gather(
        request(client, "POST", task_list, 201, token=owner, json={"title": "Second"}),
        request(client, "POST", task_list, 201, token=worker, json={"title": "Third"}),
    )
    assert {row["key"] for row in concurrent} == {"ENG-2", "ENG-3"}
    task_path = f"tasks/{task['id']}"
    await request(client, "GET", task_path, 404, token=outsider)
    updated = await request(client, "PATCH", task_path, 200, token=owner, json=payload)
    assert updated["assignee_id"] == worker_id
    filtered = await request(
        client, "GET", task_list, 200, token=worker, params={"q": "100%", "status": "pending", "priority": "high"}
    )
    assert [row["id"] for row in filtered] == [task["id"]]
    await request(client, "POST", task_path + "/transitions", 409, token=worker, json={"status": "done"})
    for status in ("in_progress", "done", "done"):
        row = await request(client, "POST", task_path + "/transitions", 200, token=worker, json={"status": status})
        assert row["status"] == status

    comments = task_path + "/comments"
    comment = await request(client, "POST", comments, 201, token=worker, json={"body": "Ready for review"})
    assert comment["author_id"] == worker_id and "user_id" not in comment
    comment_path = f"{comments}/{comment['id']}"
    await request(client, "PATCH", comment_path, 403, token=owner, json={"body": "Wrong author"})
    await request(client, "PATCH", comment_path, 200, token=worker, json={"body": "Reviewed"})
    assert (await request(client, "GET", comments, 200, token=owner))[0]["body"] == "Reviewed"
    await request(client, "DELETE", comment_path, 204, token=owner)

    labels = project_path + "/labels"
    label = await request(client, "POST", labels, 201, token=owner, json={"name": "backend"})
    await request(client, "POST", labels, 409, token=owner, json={"name": "backend"})
    await request(client, "GET", labels, 200, token=worker)
    label_path = f"{labels}/{label['id']}"
    await request(client, "PATCH", label_path, 200, token=owner, json={"name": "api"})
    await request(client, "PUT", task_path + "/labels", 422, token=worker, json={"label_ids": [str(uuid4())]})
    await request(client, "PUT", task_path + "/labels", 200, token=worker, json={"label_ids": [label["id"]]})
    assert (await request(client, "GET", task_path, 200, token=worker))["label_ids"] == [label["id"]]
    await request(client, "DELETE", label_path, 204, token=owner)
    assert not (await request(client, "GET", task_path, 200, token=worker))["label_ids"]
    actions = [event["action"] for event in await request(client, "GET", task_path + "/activity", 200, token=worker)]
    assert actions.count("task.transitioned") == 2 and "task.labels_updated" in actions

    notices = await request(client, "GET", "notifications", 200, token=worker, params={"unread": "true"})
    assert notices[0]["type"] == "task.assigned"
    assert notices[0]["payload"] == {
        "task_id": task["id"],
        "project_id": project["id"],
        "organization_id": org_id,
        "task_title": updated["title"],
    }
    comment_notices = await request(client, "GET", "notifications", 200, token=owner, params={"unread": "true"})
    assert comment_notices[0]["type"] == "task.commented"
    assert comment_notices[0]["payload"] == notices[0]["payload"]
    notice = f"notifications/{notices[0]['id']}"
    await request(client, "PATCH", notice, 404, token=outsider)
    read = await request(client, "PATCH", notice, 200, token=worker)
    assert read["read_at"] is not None
    assert (await request(client, "PATCH", notice, 200, token=worker))["read_at"] == read["read_at"]
    assert not await request(client, "GET", "notifications", 200, token=worker, params={"unread": "true"})
    await request(client, "DELETE", project_member, 204, token=owner)
    assert (await request(client, "GET", task_path, 200, token=owner))["assignee_id"] is None
    await request(client, "PUT", project_member, 200, token=owner, json={"role": "member"})
    await request(client, "PATCH", task_path, 200, token=owner, json={"assignee_id": worker_id})
    await request(client, "DELETE", f"{org_path}/members/{worker_id}", 204, token=owner)
    await request(client, "GET", task_path, 404, token=worker)
    assert (await request(client, "GET", task_path, 200, token=owner))["assignee_id"] is None


@pytest.mark.asyncio
async def test_refresh_is_single_use_and_logout_revokes(api):
    client, *_ = api
    await request(client, "POST", "auth/login", 401, json={"email": "owner@example.com", "password": "wrong"})
    pair = await login(client, "owner@example.com")
    old_token = {"refresh_token": pair["refresh_token"]}
    attempts = await asyncio.gather(
        client.post("auth/refresh", json=old_token),
        client.post("auth/refresh", json=old_token),
    )
    assert sorted(response.status_code for response in attempts) == [200, 401]
    new_pair = next(response.json() for response in attempts if response.status_code == 200)
    await request(client, "GET", "users/me", 200, token=new_pair["access_token"])
    new_token = {"refresh_token": new_pair["refresh_token"]}
    await request(client, "POST", "auth/logout", 204, json=new_token)
    await request(client, "POST", "auth/refresh", 401, json=new_token)


@pytest.mark.asyncio
async def test_browser_session_cookie_rotates_and_logout_revokes(api):
    client, *_ = api
    client.base_url = client.base_url.copy_with(scheme="https")
    headers = {"X-Auth-Mode": "cookie", "Sec-Fetch-Site": "same-origin"}
    login = await client.post(
        "auth/login", headers=headers, json={"email": "owner@example.com", "password": PASSWORD}
    )
    assert login.status_code == 200
    assert "refresh_token" not in login.json()
    assert login.headers["cache-control"] == "no-store"
    cookie_header = login.headers["set-cookie"].lower()
    for attribute in ("httponly", "secure", "samesite=strict", "path=/api/v1/auth"):
        assert attribute in cookie_header
    previous = client.cookies.get("fluztech_refresh")
    assert previous
    await request(client, "GET", "users/me", 200, token=login.json()["access_token"])

    blocked = await client.post("auth/refresh", headers={**headers, "Sec-Fetch-Site": "cross-site"})
    assert blocked.status_code == 403
    refreshed = await client.post("auth/refresh", headers=headers)
    assert refreshed.status_code == 200
    assert "refresh_token" not in refreshed.json()
    current = client.cookies.get("fluztech_refresh")
    assert current and current != previous
    await request(client, "POST", "auth/refresh", 401, json={"refresh_token": previous})

    logout = await client.post("auth/logout", headers=headers)
    assert logout.status_code == 204
    assert "max-age=0" in logout.headers["set-cookie"].lower()
    assert client.cookies.get("fluztech_refresh") is None
    assert (await client.post("auth/refresh", headers=headers)).status_code == 401
    await request(client, "POST", "auth/refresh", 401, json={"refresh_token": current})


@pytest.mark.asyncio
async def test_migration_preserves_legacy_tasks_and_label_links(test_schema):
    org_id, project_id, task_id, first_label, second_label = [uuid4() for _ in range(5)]
    async with test_schema.begin() as connection:
        await connection.run_sync(migrate, "212290482558")
        await connection.execute(
            text("INSERT INTO organizations (id, name, slug, created_at) VALUES (:id, 'Org', 'org', now())"),
            {"id": org_id},
        )
        await connection.execute(
            text(
                "INSERT INTO projects (id, organization_id, created_at, name, key)"
                " VALUES (:id, :org_id, now(), 'Engineering', 'ENG')"
            ),
            {"id": project_id, "org_id": org_id},
        )
        await connection.execute(
            text(
                "INSERT INTO tasks (id, project_id, title, status, priority)"
                " VALUES (:id, :project_id, 'Legacy task', 'pending', 'medium')"
            ),
            {"id": task_id, "project_id": project_id},
        )
        await connection.execute(
            text("INSERT INTO labels (id, project_id, name) VALUES (:id, :project_id, 'backend')"),
            [{"id": label_id, "project_id": project_id} for label_id in (first_label, second_label)],
        )
        await connection.execute(
            text("INSERT INTO task_labels (task_id, label_id) VALUES (:task_id, :label_id)"),
            {"task_id": task_id, "label_id": second_label},
        )
        await connection.run_sync(migrate)
        assert (await connection.execute(text("SELECT id, number FROM tasks"))).one() == (task_id, 1)
        assert await connection.scalar(text("SELECT next_task_number FROM projects")) == 2
        assert set(await connection.scalars(text("SELECT name FROM labels"))) == {"backend", "backend (2)"}
        assert await connection.scalar(text("SELECT label_id FROM task_labels")) == second_label
