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

class Label(Base):
    __tablename__ = "labels"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_labels_project_name"),)

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
    name : Mapped[str] = mapped_column(
        String(50),
        nullable = False
    )
