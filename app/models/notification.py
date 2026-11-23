from datetime import datetime, timezone

import uuid
from sqlalchemy import(
    UUID,
    DateTime,
    ForeignKey,
    String,
    Index,
)

from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_created", "user_id", "created_at"),)

    id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key = True,
        default = uuid.uuid4
    )
    user_id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable = False
    )

    type : Mapped[str] = mapped_column(
        String(50),
        nullable = False
    )

    payload : Mapped[str] = mapped_column(
        String(500),
        nullable = False
    )

    read_at : Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable = True
    )


    created_at : Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable = False,
        default=lambda: datetime.now(timezone.utc),
    )
