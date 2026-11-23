from fastapi import APIRouter

from app.api.dependencies import CurrentUser, Database
from app.schemas.organizations import NameUpdate, UserRead
from app.services.database import utc_now


router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def get_self(user: CurrentUser):
    return user


@router.patch("/me", response_model=UserRead)
async def update_self(payload: NameUpdate, user: CurrentUser, db: Database):
    user.name = payload.name
    user.updated_at = utc_now()
    await db.commit()
    return user
