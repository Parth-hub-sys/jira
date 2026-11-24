from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, Database, Page, bearer
from app.core.security import access_token_identity, invalid_credentials
from app.db.session import get_db
from app.models import User, notification as Notification
from app.schemas.notifications import NotificationBulkRead, NotificationBulkUpdate, NotificationRead, NotificationUpdate
from app.services.database import utc_now
from app.services.notification_events import signal_notifications


router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationRead])
async def list_notifications(user: CurrentUser, db: Database, page: Page, unread: bool = False):
    query = select(Notification).where(Notification.user_id == user.id)
    if unread:
        query = query.where(Notification.read_at.is_(None))
    return (await db.scalars(page.apply(query.order_by(Notification.created_at.desc(), Notification.id.desc())))).all()


@router.get("/stream", response_class=StreamingResponse, responses={200: {"content": {"text/event-stream": {}}}})
async def stream_notifications(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: Annotated[AsyncSession, Depends(get_db, scope="function")],
):
    if credentials is None:
        raise invalid_credentials()
    user_id, expires_at = access_token_identity(credentials.credentials)
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise invalid_credentials()
    events = request.app.state.notification_events
    if not events.connected:
        raise HTTPException(503, "Notification stream is temporarily unavailable")
    return StreamingResponse(
        events.stream(user_id, expires_at),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@router.patch("/read-all", response_model=NotificationBulkRead)
async def mark_all_notifications_read(
    user: CurrentUser, db: Database, payload: NotificationBulkUpdate | None = None,
):
    read_at = utc_now()
    result = await db.scalars(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .values(read_at=read_at)
        .returning(Notification.id)
    )
    ids = list(result)
    if ids:
        await signal_notifications(db, [user.id], payload.operation_id if payload else None)
        await db.commit()
    return NotificationBulkRead(notification_ids=ids, updated_count=len(ids), read_at=read_at)


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
        await signal_notifications(db, [user.id])
        await db.commit()
    return entry
