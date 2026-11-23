from typing import Annotated, Literal
from uuid import UUID

from pydantic import AliasChoices, AwareDatetime, Field, StringConstraints

from app.models import Task
from app.schemas.common import FromDatabase, Input, ISTDateTime


TaskStatus = Literal["pending", "in_progress", "done"]
Priority = Literal["low", "medium", "high", "urgent"]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Description = Annotated[str, Field(max_length=500)]


class TaskCreate(Input):
    title: Title
    description: Description | None = None
    priority: Priority = "medium"
    assignee_id: UUID | None = None
    due_at: AwareDatetime | None = None


class TaskUpdate(Input):
    title: Title | None = None
    description: Description | None = None
    priority: Priority | None = None
    assignee_id: UUID | None = None
    due_at: AwareDatetime | None = None


class Transition(Input):
    status: TaskStatus


class TaskRecord(FromDatabase):
    id: UUID
    project_id: UUID
    number: int
    title: str
    description: str | None
    status: str
    priority: str
    reporter_id: UUID | None
    assignee_id: UUID | None
    due_at: ISTDateTime | None
    created_at: ISTDateTime
    updated_at: ISTDateTime


class TaskRead(TaskRecord):
    key: str
    label_ids: list[UUID]

    @classmethod
    def from_task(cls, task: Task, project_key: str, label_ids: list[UUID]) -> "TaskRead":
        return cls(
            **TaskRecord.model_validate(task).model_dump(),
            key=f"{project_key}-{task.number}",
            label_ids=label_ids,
        )


class CommentWrite(Input):
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class CommentRead(FromDatabase):
    id: UUID
    task_id: UUID
    author_id: UUID = Field(validation_alias=AliasChoices("author_id", "user_id"))
    body: str
    created_at: ISTDateTime


class LabelWrite(Input):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]


class LabelRead(FromDatabase):
    id: UUID
    project_id: UUID
    name: str


class TaskLabelsWrite(Input):
    label_ids: Annotated[set[UUID], Field(max_length=100)]


class ActivityRead(FromDatabase):
    id: UUID
    actor_id: UUID
    action: str
    entity_type: str
    entity_id: UUID
    details: str | None
    created_at: ISTDateTime
