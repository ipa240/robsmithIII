"""VANurses FastAPI Application"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from .config import get_settings
from .routers import jobs, facilities, stats, users, sully, billing, notifications, admin, support, hr, applications, community, learning, news, resume, trends, alerts, dashboard

settings = get_settings()

app = FastAPI(
    title="VANurses API",
    description="Virginia Nursing Jobs Platform API",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(stats.router)
app.include_router(jobs.router)
app.include_router(facilities.router)
app.include_router(users.router)
app.include_router(sully.router)
app.include_router(billing.router)
app.include_router(notifications.router)
app.include_router(admin.router)
app.include_router(support.router)
app.include_router(hr.router)
app.include_router(applications.router)
app.include_router(community.router)
app.include_router(learning.router)
app.include_router(news.router)
app.include_router(resume.router)
app.include_router(trends.router)
app.include_router(alerts.router)
app.include_router(dashboard.router)


@app.get("/")
async def root():
    return {
        "name": "VANurses API",
        "version": "2.0.0",
        "status": "running"
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True
    )
