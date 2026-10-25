from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api import accounts, auth, cost, reports, scans
from app.core.config import settings

app = FastAPI(title="AWS Cost & Misconfiguration AI Agent")
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_origin],
                   allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.jwt_secret.get_secret_value(),
    session_cookie="oauth_state",
    max_age=600,
    same_site="lax",
    https_only=settings.app_base_url.startswith("https://"),
)
app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(scans.router)
app.include_router(reports.router)
app.include_router(cost.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
