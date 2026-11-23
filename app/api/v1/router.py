from fastapi import APIRouter

from app.api.v1.routes import auth, comments, labels, notifications, organizations, projects, tasks, users


router = APIRouter(prefix="/api/v1")
for feature in (auth, users, organizations, projects, tasks, comments, labels, notifications):
    router.include_router(feature.router)
