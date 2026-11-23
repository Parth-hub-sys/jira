from typing import Annotated, Literal

from fastapi import Header, HTTPException, Request, Response

from app.core.config import settings
from app.schemas.auth import BrowserTokenPair, TokenPair


COOKIE_NAME = "fluztech_refresh"
COOKIE_PATH = "/api/v1/auth"
AuthMode = Annotated[Literal["cookie"] | None, Header(alias="X-Auth-Mode")]


def browser_refresh_token(request: Request) -> str | None:
    # Browsers can send this custom header with cookies through the same-origin API.
    fetch_site = request.headers.get("sec-fetch-site")
    if fetch_site is not None and fetch_site != "same-origin":
        raise HTTPException(403, "Browser authentication requires a same-origin request")
    return request.cookies.get(COOKIE_NAME)


def browser_token_response(response: Response, pair: TokenPair) -> BrowserTokenPair:
    response.set_cookie(
        COOKIE_NAME,
        pair.refresh_token,
        max_age=pair.refresh_expires_in * 60,
        path=COOKIE_PATH,
        secure=settings.jwt_refresh_cookie_secure,
        httponly=True,
        samesite="strict",
    )
    return BrowserTokenPair.model_validate(pair.model_dump(exclude={"refresh_token"}))


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        COOKIE_NAME, path=COOKIE_PATH, secure=settings.jwt_refresh_cookie_secure,
        httponly=True, samesite="strict",
    )
