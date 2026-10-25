from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import User
from app.db.session import get_db

bearer = HTTPBearer(auto_error=False)


def create_access_token(user_id: int, *, development: bool = False) -> str:
    now = datetime.now(timezone.utc)
    claims = {"sub": str(user_id), "iat": now, "iss": settings.app_base_url, "aud": "cost-detective"}
    if development:
        if not settings.dev_auth_allowed:
            raise ValueError("Development authentication is disabled")
        claims["dev"] = True
    else:
        claims["exp"] = now + timedelta(hours=1)
    return jwt.encode(
        claims,
        settings.jwt_secret.get_secret_value(),
        algorithm="HS256",
    )


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    unauthorized = HTTPException(
        status_code=401, detail="Invalid or expired session", headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret.get_secret_value(),
            algorithms=["HS256"],
            issuer=settings.app_base_url,
            audience="cost-detective",
            options={"require": ["sub", "iat", "iss", "aud"]},
        )
        if "exp" not in payload and not (settings.dev_auth_allowed and payload.get("dev") is True):
            raise jwt.InvalidTokenError("Expiration is required")
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise unauthorized from None
    user = db.get(User, user_id)
    if user is None:
        raise unauthorized
    if payload.get("dev") is True and (not settings.dev_auth_allowed or user.google_sub != "dev:local"):
        raise unauthorized
    return user
