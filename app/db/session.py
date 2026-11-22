from collections.abc import AsyncIterator

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import settings

database_url = make_url(settings.database_url)

if database_url.drivername == "postgresql":
    database_url = database_url.set(drivername="postgresql+asyncpg")

engine = create_async_engine(database_url, echo=True)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session