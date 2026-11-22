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

class TaskLabel(Base):
    __tablename__ = "task_labels"

    task_id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        primary_key = True,
        nullable = False
    )
    label_id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("labels.id", ondelete="CASCADE"),
        primary_key = True,
        nullable = False
    )