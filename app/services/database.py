from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


def utc_now() -> datetime:
    return datetime.now(UTC)


@asynccontextmanager
async def handle_unique_conflict(db: AsyncSession, conflict_message: str):
    try:
        yield
    except IntegrityError as error:
        await db.rollback()
        if getattr(error.orig, "sqlstate", None) == "23505":
            raise HTTPException(409, conflict_message) from error
        raise
