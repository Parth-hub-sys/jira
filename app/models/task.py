import uuid


from datetime import datetime, timezone

from sqlalchemy import (
    UUID,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

class Task(Base):
    __tablename__ = "tasks"

    

    id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key = True,
        default = uuid.uuid4

    )
    project_id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable = False
    )
    title : Mapped[str] = mapped_column(
        String(100),
        nullable = False
    )


    description : Mapped[str] = mapped_column(
        String(500),
        nullable = True
    )

    status : Mapped[str] = mapped_column(

        String(50),
        nullable = False,
        default = "pending"
    )

    priority : Mapped[str] = mapped_column(
        String(50),
        nullable = False,
        default = "medium"

    )


    reporter_id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable = True
    )

    assignee_id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable = True
    )

    due_at : Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable = True
    )