import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.v1.router import router
from app.api.v1.routes.organizations import add_member
from app.db.session import engine
from app.services.notification_events import NotificationEvents


@asynccontextmanager
async def lifespan(app: FastAPI):
    events = app.state.notification_events = NotificationEvents()
    listener = asyncio.create_task(events.listen(engine))
    try:
        yield
    finally:
        listener.cancel()
        with suppress(asyncio.CancelledError):
            await listener


app = FastAPI(title="Fluxtech API", version="1.0.0", lifespan=lifespan)
app.include_router(router)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError):
    if getattr(request.scope.get("route"), "endpoint", None) is add_member:
        return JSONResponse(status_code=422, content={"detail": [
            {key: item[key] for key in ("loc", "msg", "type")} for item in error.errors()
        ]})
    return await request_validation_exception_handler(request, error)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
