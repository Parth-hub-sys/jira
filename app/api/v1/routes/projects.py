from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException
from app.api.dependencies import CurrentUser, Database, Page
from app.models import Project, ProjectMember
from app.schemas.organizations import MemberRead, ProjectCreate, ProjectMemberWrite, ProjectRead, ProjectUpdate
from app.services.access import organization_access, project_access
from app.services.database import handle_unique_conflict, utc_now
from app.services.organizations import project_members, put_project_member, remove_project_member, visible_projects


router = APIRouter(tags=["projects"])


@router.get("/organizations/{org_id}/projects", response_model=list[ProjectRead])
async def list_projects(org_id: UUID, user: CurrentUser, db: Database, page: Page):
    _, member = await organization_access(db, org_id, user.id)
    return (await db.scalars(page.apply(visible_projects(org_id, member)))).all()


@router.post("/organizations/{org_id}/projects", status_code=201, response_model=ProjectRead)
async def create_project(org_id: UUID, payload: ProjectCreate, user: CurrentUser, db: Database):
    await organization_access(db, org_id, user.id, manage=True)
    project_id = uuid4()
    project = Project(
        id=project_id,
        organization_id=org_id,
        created_by=user.id,
        name=payload.name,
        key=f"P{project_id.hex[:12].upper()}",
        description=payload.description,
    )
    async with handle_unique_conflict(db, "Could not allocate a project reference. Try creating the project again."):
        db.add(project)
        await db.flush()
        db.add(ProjectMember(project_id=project.id, user_id=user.id, role="admin"))
        await db.commit()
    return project


@router.get("/projects/{project_id}", response_model=ProjectRead)
async def get_project(project_id: UUID, user: CurrentUser, db: Database):
    return (await project_access(db, project_id, user.id)).project


@router.patch("/projects/{project_id}", response_model=ProjectRead)
async def update_project(project_id: UUID, payload: ProjectUpdate, user: CurrentUser, db: Database):
    project = (await project_access(db, project_id, user.id, manage=True)).project
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes and payload.name is None:
        raise HTTPException(422, "Project name cannot be null")
    if changes:
        for field, value in changes.items():
            setattr(project, field, value)
        project.updated_at = utc_now()
        await db.commit()
    return project


@router.get("/projects/{project_id}/members", response_model=list[MemberRead])
async def list_project_members(project_id: UUID, user: CurrentUser, db: Database, page: Page):
    await project_access(db, project_id, user.id)
    return await project_members(db, project_id, page)


@router.put("/projects/{project_id}/members/{user_id}")
async def upsert_project_member(
    project_id: UUID, user_id: UUID, payload: ProjectMemberWrite, user: CurrentUser, db: Database
) -> MemberRead:
    return await put_project_member(db, project_id, user.id, user_id, payload.role)


@router.delete("/projects/{project_id}/members/{user_id}", status_code=204)
async def delete_project_member(project_id: UUID, user_id: UUID, user: CurrentUser, db: Database) -> None:
    await remove_project_member(db, project_id, user.id, user_id)
