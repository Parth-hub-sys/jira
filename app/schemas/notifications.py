from json import JSONDecodeError, loads
from typing import Literal
from uuid import UUID

from pydantic import field_validator

from app.schemas.common import FromDatabase, Input, ISTDateTime


class NotificationUpdate(Input):
    read: Literal[True] = True


class NotificationRead(FromDatabase):
    id: UUID
    type: str
    payload: dict | str
    read_at: ISTDateTime | None
    created_at: ISTDateTime

    @field_validator("payload", mode="before")
    @classmethod
    def decode_payload(cls, value):
        if isinstance(value, str):
            try:
                decoded = loads(value)
            except JSONDecodeError:
                return value
            if isinstance(decoded, dict):
                return decoded
        return value
