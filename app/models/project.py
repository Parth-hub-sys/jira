import uuid

from datetime import datetime , timezone

from sqlalchemy import (
    UUID,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
)

from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

class Project(Base):
    __tablename__ = "projects"

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "key",
            name="uq_project_organization_id_key"
        ),
    )

    id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid = True),
        primary_key = True,
        default = uuid.uuid4
    )

    organization_id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid = True),
        ForeignKey("organizations.id", ondelete = "CASCADE"),
        nullable = False
    )

    created_at : Mapped[datetime] = mapped_column(
        DateTime(timezone = True),
        default = lambda: datetime.now(timezone.utc),
        nullable = False
    )
    name : Mapped[str] = mapped_column(
        String(255),
        nullable = False
    )
    key : Mapped[str] = mapped_column(
        String(50),
        nullable = False,
        index = True
    )


    description : Mapped[str] = mapped_column(
        String(1000),

        nullable = True

    )



