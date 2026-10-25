from datetime import datetime, timedelta, timezone

import jwt
import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.core.config import Settings, settings
from app.core.security import create_access_token
from app.db import session as db_session


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_settings_require_strong_secret():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, jwt_secret="short")


def test_settings_accept_optional_gemini():
    config = Settings(_env_file=None, gemini_api_key="", gemini_model="")
    assert config.gemini_model == ""


@pytest.mark.parametrize("url", ["ftp://localhost", "localhost:8000", "https://app.example/?next=evil"])
def test_invalid_base_url_rejected(url):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, app_base_url=url)


def test_token_claims(user):
    claims = jwt.decode(
        create_access_token(user.id),
        settings.jwt_secret.get_secret_value(),
        algorithms=["HS256"],
        issuer=settings.app_base_url,
        audience="cost-detective",
    )
    assert claims["sub"] == str(user.id)
    assert claims["exp"] > claims["iat"]


@pytest.mark.parametrize("authorization", [None, "Bearer invalid", "Basic abc"])
def test_protected_endpoint_requires_valid_jwt(client, authorization):
    headers = {"Authorization": authorization} if authorization else {}
    assert client.post("/accounts", json={}, headers=headers).status_code == 401


def test_expired_token_rejected(client, user):
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {"sub": str(user.id), "iat": now - timedelta(hours=2),
         "exp": now - timedelta(hours=1), "iss": settings.app_base_url,
         "aud": "cost-detective"},
        settings.jwt_secret.get_secret_value(),
        algorithm="HS256",
    )
    assert client.post("/accounts", json={}, headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_missing_user_rejected(client):
    token = create_access_token(999)
    assert client.post("/accounts", json={}, headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_database_session_dependency(db, monkeypatch):
    monkeypatch.setattr(db_session, "SessionLocal", sessionmaker(bind=db.get_bind()))
    dependency = db_session.get_db()
    session = next(dependency)
    assert session.scalar(select(1)) == 1
    dependency.close()


@pytest.mark.parametrize("origin", ["https://frontend.example/path", "https://user:password@frontend.example", "file:///page"])
def test_frontend_origin_rejects_paths_credentials_and_non_http(origin):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, frontend_origin=origin)
