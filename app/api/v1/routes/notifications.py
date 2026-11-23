from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.dependencies import CurrentUser, Database, Page
from app.models import notification as Notification
from app.schemas.notifications import NotificationRead, NotificationUpdate
from app.services.database import utc_now


router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationRead])
async def list_notifications(user: CurrentUser, db: Database, page: Page, unread: bool = False):
    query = select(Notification).where(Notification.user_id == user.id)
    if unread:
        query = query.where(Notification.read_at.is_(None))
    return (await db.scalars(page.apply(query.order_by(Notification.created_at.desc(), Notification.id.desc())))).all()


@router.patch("/{notification_id}", response_model=NotificationRead)
async def mark_notification_read(
    notification_id: UUID, user: CurrentUser, db: Database, payload: NotificationUpdate | None = None
):
    entry = await db.scalar(
        select(Notification)
        .where(Notification.id == notification_id, Notification.user_id == user.id)
        .with_for_update(key_share=True)
    )
    if entry is None:
        raise HTTPException(404, "Notification not found")
    if entry.read_at is None:
        entry.read_at = utc_now()
        await db.commit()
    return entry
