from json import dumps
from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, Database, Page
from app.models import Label, TaskLabel
from app.schemas.tasks import LabelRead, LabelWrite, TaskLabelsWrite
from app.services.access import project_access, task_access
from app.services.database import handle_unique_conflict, utc_now
from app.services.tasks import record_activity


router = APIRouter(tags=["labels"])
LABEL_CONFLICT = "A label with this name already exists in the project"


async def get_label(db: AsyncSession, project_id: UUID, label_id: UUID) -> Label:
    label = await db.scalar(select(Label).where(Label.project_id == project_id, Label.id == label_id))
    if label is None:
        raise HTTPException(404, "Label not found")
    return label


@router.get("/projects/{project_id}/labels", response_model=list[LabelRead])
async def list_labels(project_id: UUID, user: CurrentUser, db: Database, page: Page):
    await project_access(db, project_id, user.id)
    query = select(Label).where(Label.project_id == project_id).order_by(Label.name, Label.id)
    return (await db.scalars(page.apply(query))).all()


@router.post("/projects/{project_id}/labels", status_code=201, response_model=LabelRead)
async def create_label(project_id: UUID, payload: LabelWrite, user: CurrentUser, db: Database):
    await project_access(db, project_id, user.id, manage=True)
    label = Label(project_id=project_id, name=payload.name)
    async with handle_unique_conflict(db, LABEL_CONFLICT):
        db.add(label)
        await db.commit()
    return label


@router.patch("/projects/{project_id}/labels/{label_id}", response_model=LabelRead)
async def update_label(project_id: UUID, label_id: UUID, payload: LabelWrite, user: CurrentUser, db: Database):
    await project_access(db, project_id, user.id, manage=True)
    label = await get_label(db, project_id, label_id)
    async with handle_unique_conflict(db, LABEL_CONFLICT):
        label.name = payload.name
        await db.commit()
    return label


@router.delete("/projects/{project_id}/labels/{label_id}", status_code=204)
async def delete_label(project_id: UUID, label_id: UUID, user: CurrentUser, db: Database) -> None:
    await project_access(db, project_id, user.id, manage=True)
    label = await get_label(db, project_id, label_id)
    await db.delete(label)
    await db.commit()


@router.put("/tasks/{task_id}/labels", response_model=list[LabelRead])
async def replace_task_labels(task_id: UUID, payload: TaskLabelsWrite, user: CurrentUser, db: Database):
    task, access = await task_access(db, task_id, user.id, write=True)
    labels = (
        await db.scalars(
            select(Label)
            .where(Label.project_id == access.project.id, Label.id.in_(payload.label_ids))
            .order_by(Label.name, Label.id)
        )
    ).all()
    if len(labels) != len(payload.label_ids):
        raise HTTPException(422, "Every label must belong to the task's project")
    existing = set(await db.scalars(select(TaskLabel.label_id).where(TaskLabel.task_id == task.id)))
    removed = existing - payload.label_ids
    added = payload.label_ids - existing
    if removed:
        await db.execute(delete(TaskLabel).where(TaskLabel.task_id == task.id, TaskLabel.label_id.in_(removed)))
    if added or removed:
        db.add_all(TaskLabel(task_id=task.id, label_id=label_id) for label_id in added)
        task.updated_at = utc_now()
        # Record counts to fit the legacy 500-character activity field.
        record_activity(db, user.id, task.id, "task.labels_updated", dumps({"added": len(added), "removed": len(removed)}))
        await db.commit()
    return labels
