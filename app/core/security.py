from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe
from uuid import UUID

import jwt
from fastapi import HTTPException
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

from app.core.config import settings


ISSUER = "jira-api"
password_hasher = PasswordHash.recommended()
DUMMY_HASH = password_hasher.hash(token_urlsafe())


def verify_password(password: str, hashed_password: str | None) -> bool:
    try:
        valid = password_hasher.verify(password, hashed_password or DUMMY_HASH)
    except (UnknownHashError, ValueError):
        return False
    return hashed_password is not None and valid


def normalize_email(email: str) -> str:
    return email.strip().lower()


def jwt_key() -> str:
    key = settings.jwt_secret.get_secret_value() if settings.jwt_secret else ""
    if len(key.encode()) < 32:
        raise HTTPException(503, "Authentication is unavailable")
    return key


def create_access_token(user_id: UUID, lifetime_minutes: int) -> str:
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=lifetime_minutes)
    return jwt.encode(
        {"sub": str(user_id), "iss": ISSUER, "iat": now, "exp": expires_at},
        jwt_key(),
        algorithm="HS256",
    )


def invalid_credentials() -> HTTPException:
    return HTTPException(401, "Invalid credentials", headers={"WWW-Authenticate": "Bearer"})


def access_token_identity(token: str) -> tuple[UUID, int]:
    try:
        payload = jwt.decode(
            token, jwt_key(), algorithms=["HS256"], issuer=ISSUER,
            options={"require": ["sub", "iss", "iat", "exp"]},
        )
        return UUID(payload["sub"]), int(payload["exp"])
    except (jwt.InvalidTokenError, ValueError) as error:
        raise invalid_credentials() from error


def access_token_user_id(token: str) -> UUID:
    return access_token_identity(token)[0]


def hash_refresh_token(token: str) -> str:
    return sha256(token.encode()).hexdigest()
