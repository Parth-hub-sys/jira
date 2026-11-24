from collections.abc import Iterable, Sequence
from json import dumps
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import OrganizationMember, Project, ProjectMember, Task, User, activity_log, notification
from app.schemas.tasks import TaskCreate, TaskRead, TaskStatus, TaskUpdate
from app.services.access import ORGANIZATION_MANAGERS, PROJECT_WRITERS
from app.services.database import utc_now
from app.services.notification_events import signal_notifications


TRANSITIONS = {
    "pending": {"in_progress"},
    "in_progress": {"pending", "done"},
    "done": {"in_progress"},
}


def record_activity(
    db: AsyncSession, actor_id: UUID, task_id: UUID, action: str, details: str | None = None
) -> None:
    db.add(activity_log(actor_id=actor_id, entity_type="task", entity_id=task_id, action=action, details=details))


async def validate_assignee(db: AsyncSession, project: Project, user_id: UUID | None) -> None:
    if user_id is None:
        return
    assignment = await db.scalar(
        select(ProjectMember.user_id)
        .join(User, User.id == ProjectMember.user_id)
        .join(OrganizationMember, OrganizationMember.user_id == User.id)
        .where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user_id,
            ProjectMember.role.in_(PROJECT_WRITERS),
            OrganizationMember.organization_id == project.organization_id,
            User.is_active.is_(True),
        )
    )
    if assignment is None:
        raise HTTPException(422, "Assignee must be an active project member with write access")


async def notify_task_users(
    db: AsyncSession,
    project: Project,
    task: Task,
    actor_id: UUID,
    recipients: Iterable[UUID | None],
    event: str,
) -> None:
    recipient_ids = {recipient for recipient in recipients if recipient is not None and recipient != actor_id}
    if not recipient_ids:
        return
    eligible = (await db.scalars(
        select(User.id)
        .join(OrganizationMember, OrganizationMember.user_id == User.id)
        .outerjoin(ProjectMember, and_(ProjectMember.user_id == User.id, ProjectMember.project_id == project.id))
        .where(
            User.id.in_(recipient_ids),
            User.is_active.is_(True),
            OrganizationMember.organization_id == project.organization_id,
            or_(OrganizationMember.role.in_(ORGANIZATION_MANAGERS), ProjectMember.user_id.is_not(None)),
        )
    )).all()
    link = {"task_id": str(task.id), "project_id": str(project.id), "organization_id": str(project.organization_id)}
    payload = dumps({**link, "task_title": task.title}, ensure_ascii=False)
    if len(payload) > 500:
        payload = dumps(link)
    db.add_all(notification(user_id=user_id, type=event, payload=payload) for user_id in eligible)
    await signal_notifications(db, eligible)


async def create_task(db: AsyncSession, project: Project, actor_id: UUID, payload: TaskCreate) -> TaskRead:
    await validate_assignee(db, project, payload.assignee_id)
    task = Task(
        project_id=project.id,
        reporter_id=actor_id,
        number=project.next_task_number,
        **payload.model_dump(),
    )
    project.next_task_number += 1
    db.add(task)
    await db.flush()
    record_activity(db, actor_id, task.id, "task.created")
    await notify_task_users(db, project, task, actor_id, [task.assignee_id], "task.assigned")
    await db.commit()
    return TaskRead.from_task(task, project.key)


async def update_task(
    db: AsyncSession, project: Project, task: Task, actor_id: UUID, payload: TaskUpdate
) -> TaskRead:
    changes = payload.model_dump(exclude_unset=True)
    if any(field in changes and changes[field] is None for field in ("title", "priority")):
        raise HTTPException(422, "Task title and priority cannot be null")
    changed_fields = {field: value for field, value in changes.items() if getattr(task, field) != value}
    if "assignee_id" in changed_fields:
        await validate_assignee(db, project, payload.assignee_id)
    if changed_fields:
        for field, value in changed_fields.items():
            setattr(task, field, value)
        task.updated_at = utc_now()
        record_activity(db, actor_id, task.id, "task.updated", dumps({"fields": sorted(changed_fields)}))
        if "assignee_id" in changed_fields:
            await notify_task_users(db, project, task, actor_id, [task.assignee_id], "task.assigned")
    if changed_fields:
        await db.commit()
    return TaskRead.from_task(task, project.key)


async def transition_task(
    db: AsyncSession, project: Project, task: Task, actor_id: UUID, status: TaskStatus
) -> TaskRead:
    if task.status == status:
        return TaskRead.from_task(task, project.key)
    if status not in TRANSITIONS.get(task.status, {"pending"}):
        raise HTTPException(409, f"Cannot move a task from {task.status} to {status}")
    previous = task.status
    task.status = status
    task.updated_at = utc_now()
    record_activity(db, actor_id, task.id, "task.transitioned", dumps({"from": previous, "to": status}))
    await db.commit()
    return TaskRead.from_task(task, project.key)


async def clear_assignments(
    db: AsyncSession, project_ids: Sequence[UUID], user_id: UUID, actor_id: UUID
) -> None:
    task_ids = await db.scalars(
        update(Task)
        .where(Task.project_id.in_(project_ids), Task.assignee_id == user_id)
        .values(assignee_id=None, updated_at=utc_now())
        .returning(Task.id)
    )
    for task_id in task_ids:
        record_activity(db, actor_id, task_id, "task.unassigned", dumps({"previous_assignee_id": str(user_id)}))
