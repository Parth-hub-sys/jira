import uuid


from datetime import datetime

from sqlalchemy import (
    BigInteger,
    UUID,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        UniqueConstraint("project_id", "number", name="uq_tasks_project_number"),
        Index("ix_tasks_project_status", "project_id", "status"),
    )
    number: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    

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


    description : Mapped[str | None] = mapped_column(
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


    reporter_id : Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable = True
    )

    assignee_id : Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable = True
    )

    due_at : Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable = True
    )
