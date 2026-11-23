from datetime import timedelta
from secrets import token_urlsafe

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import TokenLifetimes
from app.core.security import (
    create_access_token,
    hash_refresh_token,
    invalid_credentials,
    normalize_email,
    verify_password,
)
from app.models import RefreshToken, User
from app.schemas.auth import TokenPair
from app.services.database import utc_now


async def authenticate(db: AsyncSession, email: str, password: str) -> User:
    users = (
        await db.scalars(select(User).where(func.lower(User.email) == normalize_email(email)).limit(2))
    ).all()
    user = users[0] if len(users) == 1 else None
    valid = await run_in_threadpool(verify_password, password, user.password_hash if user else None)
    if not valid or user is None or not user.is_active:
        raise invalid_credentials()
    return user


async def issue_tokens(db: AsyncSession, user: User, *, replace_refresh_token: str | None = None) -> TokenPair:
    try:
        lifetimes = await run_in_threadpool(TokenLifetimes)
    except ValidationError as error:
        raise HTTPException(503, "Token lifetimes are unavailable") from error
    access_minutes = lifetimes.jwt_access_token_ttl_minutes
    refresh_minutes = lifetimes.jwt_refresh_token_ttl_minutes
    access_token = create_access_token(user.id, access_minutes)
    if replace_refresh_token:
        previous = await find_refresh_token(db, replace_refresh_token)
        if previous and previous.revoked_at is None:
            previous.revoked_at = utc_now()
    refresh_token = token_urlsafe(48)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(refresh_token),
            expires_at=utc_now() + timedelta(minutes=refresh_minutes),
        )
    )
    await db.commit()
    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=access_minutes,
        refresh_expires_in=refresh_minutes,
    )


async def find_refresh_token(db: AsyncSession, token: str) -> RefreshToken | None:
    return await db.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == hash_refresh_token(token))
        .with_for_update()
    )


async def rotate_tokens(db: AsyncSession, token: str) -> TokenPair:
    stored = await find_refresh_token(db, token)
    now = utc_now()
    if stored is None or stored.revoked_at is not None or stored.expires_at <= now:
        raise invalid_credentials()
    user = await db.get(User, stored.user_id)
    if user is None or not user.is_active:
        raise invalid_credentials()
    stored.revoked_at = now
    return await issue_tokens(db, user)


async def revoke_token(db: AsyncSession, token: str) -> None:
    stored = await find_refresh_token(db, token)
    if stored is not None and stored.revoked_at is None:
        stored.revoked_at = utc_now()
        await db.commit()
