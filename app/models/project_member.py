from datetime import datetime , timezone
import uuid

from sqlalchemy import (
    UUID,
    DateTime,
    ForeignKey,
    String,

)

from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class ProjectMember(Base):
    __tablename__ = "project_members"

    project_id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid = True),
        ForeignKey("projects.id", ondelete = "CASCADE"),
        primary_key = True
    )
    user_id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid = True),
        ForeignKey("users.id", ondelete = "CASCADE"),
        primary_key = True
    )
    role : Mapped[str] = mapped_column(
        String(50),
        nullable = False
    )
    joined_at : Mapped[datetime] = mapped_column(
        DateTime(timezone = True),
        default = lambda: datetime.now(timezone.utc),
        nullable = False
    )
