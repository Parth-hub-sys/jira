from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import Input


class Login(Input):
    email: EmailStr
    password: Annotated[str, Field(min_length=1, max_length=1024)]


class Refresh(Input):
    refresh_token: Annotated[str, Field(min_length=1, max_length=512)]


class BrowserTokenPair(Input):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="Access token lifetime in minutes.")
    refresh_expires_in: int = Field(description="Refresh token lifetime in minutes.")


class TokenPair(BrowserTokenPair):
    refresh_token: str


class AuthError(BaseModel):
    detail: str
