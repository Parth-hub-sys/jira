from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.security import normalize_email, password_hasher
from app.models import OrganizationMember, Project, ProjectMember, User
from app.schemas.common import Pagination
from app.schemas.organizations import MemberRead, NewAccount, OrganizationMemberAdd, OrganizationRole, ProjectRole
from app.services.access import ORGANIZATION_MANAGERS, organization_access, project_access
from app.services.tasks import clear_assignments
from app.services.database import handle_unique_conflict


async def organization_members(db: AsyncSession, org_id: UUID, page: Pagination):
    query = (
        select(User.id.label("user_id"), User.name, User.email, OrganizationMember.role, OrganizationMember.joined_at)
        .join(OrganizationMember, OrganizationMember.user_id == User.id)
        .where(OrganizationMember.organization_id == org_id)
        .order_by(User.name, User.id)
    )
    return (await db.execute(page.apply(query))).all()


async def project_members(db: AsyncSession, project_id: UUID, page: Pagination):
    query = (
        select(User.id.label("user_id"), User.name, User.email, ProjectMember.role, ProjectMember.joined_at)
        .join(ProjectMember, ProjectMember.user_id == User.id)
        .where(ProjectMember.project_id == project_id)
        .order_by(User.name, User.id)
    )
    return (await db.execute(page.apply(query))).all()


async def active_user(db: AsyncSession, user_id: UUID) -> User:
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(404, "Active user not found")
    return user


async def check_owner_change(
    db: AsyncSession,
    actor: OrganizationMember,
    member: OrganizationMember | None,
    new_role: OrganizationRole | None,
) -> None:
    if actor.role != "owner" and (new_role == "owner" or (member and member.role == "owner")):
        raise HTTPException(403, "Only an owner can change organization ownership")
    if member and member.role == "owner" and new_role != "owner":
        owner_count = await db.scalar(
            select(func.count())
            .select_from(OrganizationMember)
            .where(OrganizationMember.organization_id == member.organization_id, OrganizationMember.role == "owner")
        )
        if owner_count <= 1:
            raise HTTPException(409, "The organization must retain an owner")


async def put_organization_member(
    db: AsyncSession, org_id: UUID, actor_id: UUID, user_id: UUID, role: OrganizationRole
) -> MemberRead:
    _, actor = await organization_access(db, org_id, actor_id, manage=True)
    user = await active_user(db, user_id)
    member = await db.get(OrganizationMember, (org_id, user_id))
    await check_owner_change(db, actor, member, role)
    if member is None:
        member = OrganizationMember(organization_id=org_id, user_id=user_id, role=role)
        db.add(member)
    else:
        member.role = role
    await db.commit()
    return MemberRead(user_id=user.id, name=user.name, email=user.email, role=role, joined_at=member.joined_at)


async def add_organization_member(
    db: AsyncSession, org_id: UUID, actor_id: UUID, payload: OrganizationMemberAdd
) -> MemberRead:
    _, actor = await organization_access(db, org_id, actor_id, manage=True)
    await check_owner_change(db, actor, None, payload.role)
    email = normalize_email(payload.email)
    user = await db.scalar(select(User).where(func.lower(User.email) == email))
    if isinstance(payload, NewAccount):
        if user is not None:
            raise HTTPException(409, "This email already has an account.")
        hashed = await run_in_threadpool(password_hasher.hash, payload.password.get_secret_value())
        user = User(email=email, name=payload.name, password_hash=hashed)
        async with handle_unique_conflict(db, "This email already has an account."):
            db.add(user)
            await db.flush()
    elif user is None or not user.is_active:
        raise HTTPException(404, "Active account not found. Check the email or create an account.")

    if await db.get(OrganizationMember, (org_id, user.id)) is not None:
        raise HTTPException(409, "This account is already a member. Use Manage to change their role.")
    member = OrganizationMember(organization_id=org_id, user_id=user.id, role=payload.role)
    db.add(member)
    await db.commit()
    return MemberRead(user_id=user.id, name=user.name, email=user.email, role=member.role, joined_at=member.joined_at)


async def remove_organization_member(db: AsyncSession, org_id: UUID, actor_id: UUID, user_id: UUID) -> None:
    _, actor = await organization_access(db, org_id, actor_id, manage=True)
    member = await db.get(OrganizationMember, (org_id, user_id))
    if member is None:
        return
    await check_owner_change(db, actor, member, None)
    project_ids = (
        await db.scalars(
            select(Project.id)
            .where(Project.organization_id == org_id)
            .order_by(Project.id)
            .with_for_update(key_share=True)
        )
    ).all()
    if project_ids:
        await db.execute(delete(ProjectMember).where(
            ProjectMember.project_id.in_(project_ids), ProjectMember.user_id == user_id
        ))
        await clear_assignments(db, project_ids, user_id, actor_id)
    await db.delete(member)
    await db.commit()


async def put_project_member(
    db: AsyncSession, project_id: UUID, actor_id: UUID, user_id: UUID, role: ProjectRole
) -> MemberRead:
    access = await project_access(db, project_id, actor_id, manage=True)
    user = await active_user(db, user_id)
    org_member = await db.get(OrganizationMember, (access.project.organization_id, user_id))
    if org_member is None:
        raise HTTPException(422, "Project members must belong to the organization")
    member = await db.get(ProjectMember, (project_id, user_id))
    if member is None:
        member = ProjectMember(project_id=project_id, user_id=user_id, role=role)
        db.add(member)
    else:
        member.role = role
    if role == "viewer":
        await clear_assignments(db, [project_id], user_id, actor_id)
    await db.commit()
    return MemberRead(user_id=user.id, name=user.name, email=user.email, role=role, joined_at=member.joined_at)


async def remove_project_member(db: AsyncSession, project_id: UUID, actor_id: UUID, user_id: UUID) -> None:
    await project_access(db, project_id, actor_id, manage=True)
    member = await db.get(ProjectMember, (project_id, user_id))
    if member is None:
        return
    await clear_assignments(db, [project_id], user_id, actor_id)
    await db.delete(member)
    await db.commit()


def visible_projects(org_id: UUID, member: OrganizationMember):
    query = select(Project).where(Project.organization_id == org_id)
    if member.role not in ORGANIZATION_MANAGERS:
        query = query.join(ProjectMember, ProjectMember.project_id == Project.id).where(
            ProjectMember.user_id == member.user_id
        )
    return query.order_by(Project.name, Project.id)
