from datetime import datetime

import uuid
from sqlalchemy import(
    UUID,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
)

from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

class Comment(Base):
    __tablename__ = "comments"

    id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key = True,
        default = uuid.uuid4
    )

    task_id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable = False
    )

    user_id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable = False
    )

    body : Mapped[str] = mapped_column(
        String(500),
        nullable = False
    )

    created_at : Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(datetime.timezone.utc),
        nullable=False
    )