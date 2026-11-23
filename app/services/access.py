from dataclasses import dataclass
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Organization, OrganizationMember, Project, ProjectMember, Task


ORGANIZATION_MANAGERS = {"owner", "admin"}
PROJECT_WRITERS = {"admin", "member"}


@dataclass(frozen=True)
class ProjectAccess:
    project: Project
    role: str


async def organization_access(
    db: AsyncSession,
    org_id: UUID,
    user_id: UUID,
    *,
    manage: bool = False,
) -> tuple[Organization, OrganizationMember]:
    statement = select(Organization).where(
        Organization.id == org_id,
        select(OrganizationMember.user_id)
        .where(OrganizationMember.organization_id == org_id, OrganizationMember.user_id == user_id)
        .exists(),
    )
    if manage:
        statement = statement.with_for_update(key_share=True)
    org = await db.scalar(statement)
    member = await db.get(OrganizationMember, (org_id, user_id))
    if org is None or member is None:
        raise HTTPException(404, "Organization not found")
    if manage and member.role not in ORGANIZATION_MANAGERS:
        raise HTTPException(403, "Organization admin access required")
    return org, member


async def project_access(
    db: AsyncSession,
    project_id: UUID,
    user_id: UUID,
    *,
    write: bool = False,
    manage: bool = False,
) -> ProjectAccess:
    statement = select(Project).where(
        Project.id == project_id,
        select(OrganizationMember.user_id)
        .where(OrganizationMember.organization_id == Project.organization_id, OrganizationMember.user_id == user_id)
        .exists(),
    )
    if write or manage:
        statement = statement.with_for_update(key_share=True)
    project = await db.scalar(statement)
    if project is None:
        raise HTTPException(404, "Project not found")
    org_member = await db.get(OrganizationMember, (project.organization_id, user_id))
    if org_member is None:
        raise HTTPException(404, "Project not found")
    role = "admin"
    if org_member.role not in ORGANIZATION_MANAGERS:
        member = await db.get(ProjectMember, (project_id, user_id))
        if member is None:
            raise HTTPException(404, "Project not found")
        role = member.role
    if manage and role != "admin":
        raise HTTPException(403, "Project admin access required")
    if write and role not in PROJECT_WRITERS:
        raise HTTPException(403, "Project write access required")
    return ProjectAccess(project, role)


async def task_access(
    db: AsyncSession, task_id: UUID, user_id: UUID, *, write: bool = False
) -> tuple[Task, ProjectAccess]:
    project_id = await db.scalar(select(Task.project_id).where(Task.id == task_id))
    if project_id is None:
        raise HTTPException(404, "Task not found")
    try:
        access = await project_access(db, project_id, user_id, write=write)
    except HTTPException as error:
        if error.status_code == 404:
            raise HTTPException(404, "Task not found") from error
        raise
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")
    return task, access
