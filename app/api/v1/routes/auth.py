from fastapi import APIRouter, HTTPException, Request, Response

from app.api.auth_cookies import AuthMode, browser_refresh_token, browser_token_response, clear_refresh_cookie
from app.api.dependencies import Database
from app.core.security import invalid_credentials
from app.schemas.auth import AuthError, BrowserTokenPair, Login, Refresh, TokenPair
from app.services.auth import authenticate, issue_tokens, revoke_token, rotate_tokens


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/login",
    description="Sign in with an active account provisioned by your company admin.",
    responses={
        401: {"model": AuthError, "description": "The email or password is invalid or the account is inactive."},
        503: {"model": AuthError, "description": "Token signing or token lifetime configuration is unavailable."},
    },
)
async def login(
    payload: Login, db: Database, request: Request, response: Response, auth_mode: AuthMode = None
) -> TokenPair | BrowserTokenPair:
    previous = browser_refresh_token(request) if auth_mode == "cookie" else None
    user = await authenticate(db, payload.email, payload.password)
    response.headers["Cache-Control"] = "no-store"
    pair = await issue_tokens(db, user, replace_refresh_token=previous)
    return browser_token_response(response, pair) if auth_mode == "cookie" else pair


@router.post(
    "/refresh",
    responses={
        401: {"model": AuthError, "description": "The refresh token is invalid, expired, or revoked, or the account is inactive."},
        503: {"model": AuthError, "description": "Token signing or token lifetime configuration is unavailable."},
    },
)
async def refresh(
    db: Database, request: Request, response: Response, payload: Refresh | None = None, auth_mode: AuthMode = None
) -> TokenPair | BrowserTokenPair:
    response.headers["Cache-Control"] = "no-store"
    if auth_mode == "cookie":
        token = browser_refresh_token(request)
        if not token:
            raise invalid_credentials()
        return browser_token_response(response, await rotate_tokens(db, token))
    if payload is None:
        raise HTTPException(422, "A refresh token is required")
    return await rotate_tokens(db, payload.refresh_token)


@router.post("/logout", status_code=204)
async def logout(
    db: Database, request: Request, response: Response, payload: Refresh | None = None, auth_mode: AuthMode = None
) -> None:
    response.headers["Cache-Control"] = "no-store"
    if auth_mode == "cookie":
        token = browser_refresh_token(request)
        if token:
            await revoke_token(db, token)
        clear_refresh_cookie(response)
    elif payload is None:
        raise HTTPException(422, "A refresh token is required")
    else:
        await revoke_token(db, payload.refresh_token)
