from typing import Annotated, Literal
from uuid import UUID

from pydantic import EmailStr, Field, SecretStr, StringConstraints

from app.schemas.common import FromDatabase, Input, ISTDateTime, Name


OrganizationRole = Literal["owner", "admin", "member"]
ProjectRole = Literal["admin", "member", "viewer"]
MIN_INITIAL_PASSWORD_LENGTH = 8
Slug = Annotated[str, StringConstraints(min_length=1, max_length=100, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")]


class UserRead(FromDatabase):
    id: UUID
    email: str
    name: str
    is_active: bool
    created_at: ISTDateTime
    updated_at: ISTDateTime


class NameUpdate(Input):
    name: Name


class OrganizationCreate(NameUpdate):
    slug: Slug


class OrganizationRead(FromDatabase):
    id: UUID
    name: str
    slug: str
    created_at: ISTDateTime


class OrganizationMemberWrite(Input):
    role: OrganizationRole


class ExistingAccount(OrganizationMemberWrite):
    mode: Literal["existing"]
    email: Annotated[EmailStr, Field(max_length=255)]


class NewAccount(OrganizationMemberWrite):
    mode: Literal["create"]
    email: Annotated[EmailStr, Field(max_length=255)]
    name: Name
    password: Annotated[SecretStr, Field(min_length=MIN_INITIAL_PASSWORD_LENGTH, max_length=1024)]


OrganizationMemberAdd = Annotated[ExistingAccount | NewAccount, Field(discriminator="mode")]


class ProjectMemberWrite(Input):
    role: ProjectRole


class MemberRead(FromDatabase):
    user_id: UUID
    name: str
    email: str
    role: str
    joined_at: ISTDateTime


class ProjectCreate(Input):
    name: Name
    key: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50, pattern=r"^[A-Za-z][A-Za-z0-9]*$")
    ]
    description: Annotated[str, Field(max_length=1000)] | None = None


class ProjectUpdate(Input):
    name: Name | None = None
    description: Annotated[str, Field(max_length=1000)] | None = None


class ProjectRead(FromDatabase):
    id: UUID
    organization_id: UUID
    name: str
    key: str
    description: str | None
    created_by: UUID | None
    created_at: ISTDateTime
    updated_at: ISTDateTime
