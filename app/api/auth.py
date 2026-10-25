from typing import Annotated
import json
import secrets

import httpx
from authlib.integrations.base_client.errors import OAuthError
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from joserfc.errors import JoseError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.security import create_access_token
from app.db.models import User
from app.db.session import get_db

router = APIRouter(prefix="/auth", tags=["auth"])
oauth = OAuth()
google = oauth.register(
    name="google",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret.get_secret_value(),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile", "code_challenge_method": "S256", "timeout": 10},
)


def require_google_config():
    if not settings.google_client_id or not settings.google_client_secret.get_secret_value():
        raise HTTPException(status_code=503, detail="Google OAuth is not configured")


@router.get("/google/login", dependencies=[Depends(require_google_config)])
async def google_login(request: Request):
    request.session["frontend_login"] = request.query_params.get("popup") == "1"
    try:
        return await google.authorize_redirect(request, f"{settings.app_base_url}/auth/google/callback")
    except (OAuthError, httpx.HTTPError):
        raise HTTPException(status_code=502, detail="Google sign-in is unavailable") from None


def find_or_create_user(db: Session, subject: str, email: str) -> int:
    # The immutable Google subject, not an email address, identifies the user.
    user = db.scalar(select(User).where(User.google_sub == subject))
    if user is None:
        user = User(google_sub=subject, email=email)
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            user = db.scalar(select(User).where(User.google_sub == subject))
            if user is None:
                raise
    return user.id


@router.post("/dev/login")
def development_login(db: Annotated[Session, Depends(get_db)]):
    if not settings.dev_auth_allowed:
        raise HTTPException(status_code=404, detail="Development login is disabled")
    user_id = find_or_create_user(db, "dev:local", "developer@localhost.invalid")
    return JSONResponse(
        {"access_token": create_access_token(user_id, development=True), "token_type": "bearer",
         "expires_in": None, "development_only": True},
        headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
    )


@router.get("/google/callback", dependencies=[Depends(require_google_config)])
async def google_callback(request: Request, db: Annotated[Session, Depends(get_db)]):
    frontend_login = request.session.get("frontend_login") is True
    try:
        # Authlib checks OAuth state and validates the OIDC signature, issuer,
        # audience, expiry and nonce before exposing ID-token userinfo.
        token = await google.authorize_access_token(request, claims_options={
            "iss": {"values": ["https://accounts.google.com", "accounts.google.com"]},
            "aud": {"values": [settings.google_client_id]},
        })
    except (OAuthError, JoseError):
        request.session.clear()
        raise HTTPException(status_code=400, detail="Invalid OAuth response; start sign-in again") from None
    except httpx.HTTPError:
        request.session.clear()
        raise HTTPException(status_code=502, detail="Google sign-in is unavailable") from None
    request.session.clear()
    identity = token.get("userinfo", {})
    if (not token.get("id_token") or not identity.get("sub") or not identity.get("email")
            or identity.get("email_verified") is not True):
        raise HTTPException(status_code=401, detail="A verified Google email is required")
    user_id = await run_in_threadpool(find_or_create_user, db, identity["sub"], identity["email"])
    access_token = create_access_token(user_id)
    if frontend_login:
        nonce = secrets.token_urlsafe(24)
        payload = json.dumps({"type": "cost-detective-auth", "access_token": access_token})
        origin = json.dumps(settings.frontend_origin).replace("<", "\\u003c")
        return HTMLResponse(
            f'<!doctype html><title>Signed in</title><p>Signed in. You can close this window.</p>'
            f'<script nonce="{nonce}">if (window.opener) {{ window.opener.postMessage({payload}, {origin}); window.close(); }}</script>',
            headers={"Cache-Control": "no-store", "Pragma": "no-cache", "Referrer-Policy": "no-referrer",
                     "Content-Security-Policy": f"default-src 'none'; script-src 'nonce-{nonce}'; frame-ancestors 'none'"},
        )
    return JSONResponse(
        {"access_token": access_token, "token_type": "bearer", "expires_in": 3600},
        headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
    )
