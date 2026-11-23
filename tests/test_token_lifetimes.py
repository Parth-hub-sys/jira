from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import uuid4

import jwt
import pytest
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_issue_tokens_uses_lifetimes_from_dotenv(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/jira_test")
    from pydantic import SecretStr, ValidationError

    with monkeypatch.context() as initial_environment:
        initial_environment.setenv("JWT_ACCESS_TOKEN_TTL_MINUTES", "15")
        initial_environment.setenv("JWT_REFRESH_TOKEN_TTL_MINUTES", "10080")
        from app.core.config import TokenLifetimes, settings

    from app.models import User
    from app.services import auth

    monkeypatch.delenv("JWT_ACCESS_TOKEN_TTL_MINUTES", raising=False)
    monkeypatch.delenv("JWT_REFRESH_TOKEN_TTL_MINUTES", raising=False)
    monkeypatch.chdir(tmp_path)
    dotenv = tmp_path / ".env"
    with pytest.raises(ValidationError) as missing:
        TokenLifetimes()
    assert {error["loc"][0] for error in missing.value.errors()} == {
        "jwt_access_token_ttl_minutes", "jwt_refresh_token_ttl_minutes",
    }

    key = "test-signing-key-for-token-lifetime-check"
    monkeypatch.setattr(settings, "jwt_secret", SecretStr(key))
    now = datetime.now(UTC)
    monkeypatch.setattr(auth, "utc_now", lambda: now)
    db = AsyncMock(spec=AsyncSession)
    user = User(id=uuid4())

    for access_minutes, refresh_minutes in ((2, 60), (3, 90)):
        dotenv.write_text(
            f"JWT_ACCESS_TOKEN_TTL_MINUTES={access_minutes}\n"
            f"JWT_REFRESH_TOKEN_TTL_MINUTES={refresh_minutes}\n"
        )
        pair = await auth.issue_tokens(db, user)
        claims = jwt.decode(pair.access_token, key, algorithms=["HS256"])
        assert pair.expires_in == access_minutes
        assert pair.refresh_expires_in == refresh_minutes
        assert claims["exp"] - claims["iat"] == access_minutes * 60
        stored_token = db.add.call_args.args[0]
        assert stored_token.expires_at == now + timedelta(minutes=refresh_minutes)
