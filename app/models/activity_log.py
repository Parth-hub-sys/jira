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

class activity_log(Base):
    __tablename__ = "activity_logs"

    id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key = True,
        default = uuid.uuid4
    )
    actor_id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable = False
    )
    action : Mapped[str] = mapped_column(
        String(50),
        nullable = False
    )
    entity_type : Mapped[str] = mapped_column(
        String(50),
        nullable = False
    )
    entity_id : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable = False
    )

    details : Mapped[str] = mapped_column(
        String(500),
        nullable = True
    )
    
    created_at : Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable = False,
        default = datetime.utcnow
    )