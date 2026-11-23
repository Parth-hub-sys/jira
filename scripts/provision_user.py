"""Provision a local user and their organization membership."""

import argparse
import asyncio
from getpass import getpass

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.security import normalize_email, password_hasher
from app.db.session import SessionLocal
from app.models import Organization, OrganizationMember, User
from app.schemas.common import Name
from app.schemas.organizations import MIN_INITIAL_PASSWORD_LENGTH, OrganizationRole, Slug


async def provision_user(
    email: str,
    name: str,
    hashed_password: str,
    org_slug: str,
    org_name: str | None,
    role: OrganizationRole,
) -> tuple[User, Organization]:
    async with SessionLocal.begin() as db:
        organization = await db.scalar(select(Organization).where(Organization.slug == org_slug))
        if organization is None:
            if org_name is None or role != "owner":
                raise ValueError("To create an organization, set --organization-name and --role owner")
            organization = Organization(slug=org_slug, name=org_name)
            db.add(organization)
        elif org_name is not None:
            raise ValueError("This organization already exists. Omit --organization-name")
        email_match = select(User.id).where(func.lower(User.email) == email).exists()
        if await db.scalar(select(email_match)):
            raise ValueError("This email is already registered. Add existing users through the membership API")
        user = User(email=email, name=name, password_hash=hashed_password)
        db.add(user)
        await db.flush()
        db.add(OrganizationMember(organization_id=organization.id, user_id=user.id, role=role))
    return user, organization


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--organization", required=True, help="Organization slug")
    parser.add_argument("--organization-name", help="Name to use when creating the organization")
    parser.add_argument("--role", choices=("owner", "admin", "member"), default="member")
    args = parser.parse_args()
    try:
        email = normalize_email(TypeAdapter(EmailStr).validate_python(args.email))
        if len(email) > 255:
            raise ValueError("Email must be at most 255 characters")
        name = TypeAdapter(Name).validate_python(args.name)
        org_slug = TypeAdapter(Slug).validate_python(args.organization)
        org_name = TypeAdapter(Name | None).validate_python(args.organization_name)
        password = getpass("Initial password: ")
        if not MIN_INITIAL_PASSWORD_LENGTH <= len(password) <= 1024:
            raise ValueError(f"Password must contain between {MIN_INITIAL_PASSWORD_LENGTH} and 1024 characters")
        if password != getpass("Confirm password: "):
            raise ValueError("Passwords do not match")
        user, organization = asyncio.run(
            provision_user(email, name, password_hasher.hash(password), org_slug, org_name, args.role)
        )
    except (ValidationError, ValueError) as error:
        parser.error(str(error))
    except IntegrityError as error:
        if getattr(error.orig, "sqlstate", None) == "23505":
            parser.error("The organization slug or email was created concurrently. Retry with a different value")
        raise
    print(f"Provisioned {user.id} in {organization.slug} ({organization.id})")


if __name__ == "__main__":
    main()
