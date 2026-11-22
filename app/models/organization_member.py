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


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "user_id",
            name = "uq_organization_member_organization_id_user_id"

        ),
    )

    organization_id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        primary_key = True
    )

    user_id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key = True
    )

    role : Mapped[str] = mapped_column(
        String(50),
        nullable = False
    )

    joined_at : Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False

    )

    