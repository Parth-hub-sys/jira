from datetime import UTC, datetime
from uuid import uuid4

import httpx
import pytest


@pytest.mark.asyncio
async def test_user_profile_formats_timestamps_in_ist(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/jira_test")
    monkeypatch.setenv("JWT_ACCESS_TOKEN_TTL_MINUTES", "15")
    monkeypatch.setenv("JWT_REFRESH_TOKEN_TTL_MINUTES", "10080")
    from app.api.dependencies import current_user
    from app.models import User
    from main import app

    created_at = datetime(2026, 11, 23, 23, 45, tzinfo=UTC)
    updated_at = datetime(2026, 11, 24, 2, 30, tzinfo=UTC)
    user = User(
        id=uuid4(),
        email="member@example.com",
        name="Member",
        is_active=True,
        created_at=created_at,
        updated_at=updated_at,
    )

    async def get_current_user():
        return user

    monkeypatch.setitem(app.dependency_overrides, current_user, get_current_user)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/users/me")

    assert response.status_code == 200
    profile = response.json()
    assert profile["created_at"] == "2026-11-24T05:15:00+05:30"
    assert profile["updated_at"] == "2026-11-24T08:00:00+05:30"
    assert datetime.fromisoformat(profile["created_at"]) == created_at
    assert datetime.fromisoformat(profile["updated_at"]) == updated_at
