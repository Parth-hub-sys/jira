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


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

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
    token_hash : Mapped[str] = mapped_column(
        String(255),
        nullable = False,
        unique = True
    )
    expires_at : Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable = False
    )

    revoked_at : Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable = True
    )