from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, Database, Page
from app.models import Comment
from app.schemas.tasks import CommentRead, CommentWrite
from app.services.access import task_access
from app.services.tasks import notify_task_users


router = APIRouter(prefix="/tasks/{task_id}/comments", tags=["comments"])


async def get_comment(db: AsyncSession, task_id: UUID, comment_id: UUID) -> Comment:
    comment = await db.scalar(select(Comment).where(Comment.id == comment_id, Comment.task_id == task_id))
    if comment is None:
        raise HTTPException(404, "Comment not found")
    return comment


@router.get("", response_model=list[CommentRead])
async def list_comments(task_id: UUID, user: CurrentUser, db: Database, page: Page):
    await task_access(db, task_id, user.id)
    query = select(Comment).where(Comment.task_id == task_id).order_by(Comment.created_at, Comment.id)
    return (await db.scalars(page.apply(query))).all()


@router.post("", status_code=201, response_model=CommentRead)
async def create_comment(task_id: UUID, payload: CommentWrite, user: CurrentUser, db: Database):
    task, access = await task_access(db, task_id, user.id, write=True)
    comment = Comment(task_id=task_id, user_id=user.id, body=payload.body)
    db.add(comment)
    await notify_task_users(db, access.project, task, user.id, [task.reporter_id, task.assignee_id], "task.commented")
    await db.commit()
    return comment


@router.patch("/{comment_id}", response_model=CommentRead)
async def update_comment(
    task_id: UUID, comment_id: UUID, payload: CommentWrite, user: CurrentUser, db: Database
):
    await task_access(db, task_id, user.id, write=True)
    comment = await get_comment(db, task_id, comment_id)
    if comment.user_id != user.id:
        raise HTTPException(403, "Only the comment author can edit it")
    comment.body = payload.body
    await db.commit()
    return comment


@router.delete("/{comment_id}", status_code=204)
async def delete_comment(task_id: UUID, comment_id: UUID, user: CurrentUser, db: Database) -> None:
    _, access = await task_access(db, task_id, user.id, write=True)
    comment = await get_comment(db, task_id, comment_id)
    if comment.user_id != user.id and access.role != "admin":
        raise HTTPException(403, "Only the comment author or a project admin can delete it")
    await db.delete(comment)
    await db.commit()
