from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import access_token_user_id, invalid_credentials
from app.db.session import get_db
from app.models import User
from app.schemas.common import Pagination


Database = Annotated[AsyncSession, Depends(get_db)]
Page = Annotated[Pagination, Depends()]
bearer = HTTPBearer(auto_error=False)


async def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: Database,
) -> User:
    if credentials is None:
        raise invalid_credentials()
    user = await db.get(User, access_token_user_id(credentials.credentials))
    if user is None or not user.is_active:
        raise invalid_credentials()
    return user


CurrentUser = Annotated[User, Depends(current_user)]
