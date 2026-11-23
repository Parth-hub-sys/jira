from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.dependencies import CurrentUser, Database, Page
from app.models import Organization, OrganizationMember
from app.schemas.organizations import (
    MemberRead, NameUpdate, OrganizationCreate, OrganizationMemberAdd, OrganizationMemberWrite, OrganizationRead,
)
from app.services.access import organization_access
from app.services.database import handle_unique_conflict
from app.services.organizations import (
    add_organization_member, organization_members, put_organization_member, remove_organization_member,
)


router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=list[OrganizationRead])
async def list_organizations(user: CurrentUser, db: Database, page: Page):
    query = (
        select(Organization)
        .join(OrganizationMember, OrganizationMember.organization_id == Organization.id)
        .where(OrganizationMember.user_id == user.id)
        .order_by(Organization.name, Organization.id)
    )
    return (await db.scalars(page.apply(query))).all()


@router.post("", status_code=201, response_model=OrganizationRead)
async def create_organization(payload: OrganizationCreate, user: CurrentUser, db: Database):
    owner = await db.scalar(select(OrganizationMember.user_id).where(
        OrganizationMember.user_id == user.id, OrganizationMember.role == "owner"
    ).limit(1))
    if owner is None:
        raise HTTPException(403, "An organization owner account is required")
    organization = Organization(name=payload.name, slug=payload.slug)
    async with handle_unique_conflict(db, "This organization slug is already in use"):
        db.add(organization)
        await db.flush()
        db.add(OrganizationMember(organization_id=organization.id, user_id=user.id, role="owner"))
        await db.commit()
    return organization


@router.get("/{org_id}", response_model=OrganizationRead)
async def get_organization(org_id: UUID, user: CurrentUser, db: Database):
    organization, _ = await organization_access(db, org_id, user.id)
    return organization


@router.patch("/{org_id}", response_model=OrganizationRead)
async def update_organization(org_id: UUID, payload: NameUpdate, user: CurrentUser, db: Database):
    organization, _ = await organization_access(db, org_id, user.id, manage=True)
    organization.name = payload.name
    await db.commit()
    return organization


@router.get("/{org_id}/members", response_model=list[MemberRead])
async def list_organization_members(org_id: UUID, user: CurrentUser, db: Database, page: Page):
    await organization_access(db, org_id, user.id)
    return await organization_members(db, org_id, page)


@router.put("/{org_id}/members/{user_id}")
async def upsert_organization_member(
    org_id: UUID, user_id: UUID, payload: OrganizationMemberWrite, user: CurrentUser, db: Database
) -> MemberRead:
    return await put_organization_member(db, org_id, user.id, user_id, payload.role)


@router.post("/{org_id}/members", status_code=201)
async def add_member(org_id: UUID, payload: OrganizationMemberAdd, user: CurrentUser, db: Database) -> MemberRead:
    return await add_organization_member(db, org_id, user.id, payload)


@router.delete("/{org_id}/members/{user_id}", status_code=204)
async def delete_organization_member(org_id: UUID, user_id: UUID, user: CurrentUser, db: Database) -> None:
    await remove_organization_member(db, org_id, user.id, user_id)
