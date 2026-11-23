from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Query
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, PlainSerializer, StringConstraints
from sqlalchemy import Select


Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
IST = timezone(timedelta(hours=5, minutes=30), name="IST")


def to_ist(value: datetime) -> datetime:
    return value.astimezone(IST)


ISTDateTime = Annotated[
    AwareDatetime,
    PlainSerializer(to_ist, return_type=datetime, when_used="json"),
    Field(description="Timestamp in India Standard Time (UTC+05:30)."),
]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FromDatabase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Pagination:
    def __init__(
        self,
        limit: Annotated[int, Query(ge=1, le=100)] = 50,
        offset: Annotated[int, Query(ge=0)] = 0,
    ) -> None:
        self.limit = limit
        self.offset = offset

    def apply(self, statement: Select) -> Select:
        return statement.limit(self.limit).offset(self.offset)
