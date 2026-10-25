from datetime import datetime, timezone

import jwt
import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from app.core.config import Settings, settings
from app.db.models import User


def test_development_login_is_disabled_by_default(client):
    assert client.post("/auth/dev/login").status_code == 404


def test_local_development_login_issues_non_expiring_token_for_dedicated_user(client, db, monkeypatch):
    monkeypatch.setattr(settings, "dev_auth_enabled", True)
    response = client.post("/auth/dev/login")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    data = response.json()
    assert data["development_only"] is True
    assert data["expires_in"] is None
    token = data["access_token"]
    claims = jwt.decode(token, settings.jwt_secret.get_secret_value(), algorithms=["HS256"],
                        issuer=settings.app_base_url, audience="cost-detective")
    assert claims["dev"] is True
    assert "exp" not in claims
    assert client.get("/accounts", headers={"Authorization": f"Bearer {token}"}).status_code == 200
    client.post("/auth/dev/login")
    assert db.scalar(select(func.count()).select_from(User)) == 1
    assert db.scalar(select(User)).google_sub == "dev:local"
    monkeypatch.setattr(settings, "dev_auth_enabled", False)
    assert client.get("/accounts", headers={"Authorization": f"Bearer {token}"}).status_code == 401


@pytest.mark.parametrize("field", ["app_base_url", "frontend_origin"])
def test_development_auth_cannot_be_enabled_for_remote_urls(field):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, dev_auth_enabled=True, **{field: "https://example.com"})


def test_normal_tokens_without_expiration_are_still_rejected(client, user, monkeypatch):
    monkeypatch.setattr(settings, "dev_auth_enabled", True)
    token = jwt.encode({"sub": str(user.id), "iat": datetime.now(timezone.utc), "iss": settings.app_base_url, "aud": "cost-detective"},
                       settings.jwt_secret.get_secret_value(), algorithm="HS256")
    assert client.get("/accounts", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_development_flag_cannot_impersonate_a_google_user(client, user, monkeypatch):
    monkeypatch.setattr(settings, "dev_auth_enabled", True)
    token = jwt.encode({"sub": str(user.id), "dev": True, "iat": datetime.now(timezone.utc),
                        "iss": settings.app_base_url, "aud": "cost-detective"},
                       settings.jwt_secret.get_secret_value(), algorithm="HS256")
    assert client.get("/accounts", headers={"Authorization": f"Bearer {token}"}).status_code == 401
