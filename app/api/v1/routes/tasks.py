from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import or_, select

from app.api.dependencies import CurrentUser, Database, Page
from app.models import Task, activity_log
from app.schemas.tasks import ActivityRead, Priority, TaskCreate, TaskRead, TaskStatus, TaskUpdate, Transition
from app.services import tasks
from app.services.access import project_access, task_access


router = APIRouter(tags=["tasks"])


@router.get("/projects/{project_id}/tasks")
async def list_tasks(
    project_id: UUID,
    user: CurrentUser,
    db: Database,
    page: Page,
    status: TaskStatus | None = None,
    assignee_id: UUID | None = None,
    priority: Priority | None = None,
    q: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
) -> list[TaskRead]:
    access = await project_access(db, project_id, user.id)
    query = select(Task).where(Task.project_id == project_id)
    if status is not None:
        query = query.where(Task.status == status)
    if assignee_id is not None:
        query = query.where(Task.assignee_id == assignee_id)
    if priority is not None:
        query = query.where(Task.priority == priority)
    if q is not None:
        query = query.where(or_(Task.title.icontains(q, autoescape=True), Task.description.icontains(q, autoescape=True)))
    entries = (await db.scalars(page.apply(query.order_by(Task.number.desc())))).all()
    return [TaskRead.from_task(task, access.project.key) for task in entries]


@router.post("/projects/{project_id}/tasks", status_code=201)
async def create_task(project_id: UUID, payload: TaskCreate, user: CurrentUser, db: Database) -> TaskRead:
    access = await project_access(db, project_id, user.id, write=True)
    return await tasks.create_task(db, access.project, user.id, payload)


@router.get("/tasks/{task_id}")
async def get_task(task_id: UUID, user: CurrentUser, db: Database) -> TaskRead:
    task, access = await task_access(db, task_id, user.id)
    return TaskRead.from_task(task, access.project.key)


@router.patch("/tasks/{task_id}")
async def update_task(task_id: UUID, payload: TaskUpdate, user: CurrentUser, db: Database) -> TaskRead:
    task, access = await task_access(db, task_id, user.id, write=True)
    return await tasks.update_task(db, access.project, task, user.id, payload)


@router.post("/tasks/{task_id}/transitions")
async def transition_task(task_id: UUID, payload: Transition, user: CurrentUser, db: Database) -> TaskRead:
    task, access = await task_access(db, task_id, user.id, write=True)
    return await tasks.transition_task(db, access.project, task, user.id, payload.status)


@router.get("/tasks/{task_id}/activity", response_model=list[ActivityRead])
async def list_task_activity(task_id: UUID, user: CurrentUser, db: Database, page: Page):
    await task_access(db, task_id, user.id)
    query = (
        select(activity_log)
        .where(activity_log.entity_type == "task", activity_log.entity_id == task_id)
        .order_by(activity_log.created_at.desc(), activity_log.id.desc())
    )
    return (await db.scalars(page.apply(query))).all()
