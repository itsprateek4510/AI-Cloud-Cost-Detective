from datetime import datetime, timedelta, timezone
import json
from unittest.mock import AsyncMock, Mock
from urllib.parse import parse_qs, urlparse

import pytest
import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.auth import google
from app.api import auth
from app.db.models import User


def mock_identity(monkeypatch, **changes):
    identity = {"sub": "google-123", "email": "login@example.com", "email_verified": True} | changes
    monkeypatch.setattr(google, "authorize_access_token", AsyncMock(return_value={
        "id_token": "verified-by-authlib", "userinfo": identity,
    }))


def test_oauth_login_uses_state_nonce_and_openid(client, monkeypatch):
    monkeypatch.setattr(google, "load_server_metadata", AsyncMock(return_value={
        "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
    }))
    response = client.get("/auth/google/login", follow_redirects=False)
    assert response.status_code == 302
    query = parse_qs(urlparse(response.headers["location"]).query)
    assert query["state"]
    assert query["nonce"]
    assert "openid" in query["scope"][0]
    assert query["code_challenge_method"] == ["S256"]
    assert query["redirect_uri"] == ["http://localhost:8000/auth/google/callback"]
    assert "httponly" in response.headers["set-cookie"].lower()


def test_oauth_callback_creates_user_and_returns_usable_bearer_token(client, db, monkeypatch):
    mock_identity(monkeypatch)
    response = client.get("/auth/google/callback?code=code&state=state")
    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
    assert response.headers["cache-control"] == "no-store"
    token = response.json()["access_token"]
    assert client.post("/accounts", json={}, headers={"Authorization": f"Bearer {token}"}).status_code == 201
    assert db.scalar(select(User)).google_sub == "google-123"
    client.get("/auth/google/callback?code=code&state=state")
    assert db.scalar(select(func.count()).select_from(User)) == 1


@pytest.mark.parametrize("changes", [{"email_verified": False}, {"sub": ""}, {"email": ""}])
def test_unverified_or_incomplete_identity_rejected(client, db, monkeypatch, changes):
    mock_identity(monkeypatch, **changes)
    assert client.get("/auth/google/callback?code=code&state=state").status_code == 401
    assert db.scalar(select(func.count()).select_from(User)) == 0


def test_callback_without_oauth_state_rejected(client):
    assert client.get("/auth/google/callback?code=code&state=invalid").status_code == 400


def test_callback_cannot_use_unsigned_userinfo(client, monkeypatch):
    monkeypatch.setattr(google, "authorize_access_token", AsyncMock(return_value={
        "userinfo": {"sub": "attacker", "email": "x@example.com", "email_verified": True},
    }))
    assert client.get("/auth/google/callback?code=code").status_code == 401


@pytest.mark.parametrize("claim_change", [None, {"nonce": "wrong"}, {"iss": "https://attacker.example"},
                                         {"aud": "different-client"}, {"exp": 1},
                                         {"aud": "different-client", "azp": "test-client"}])
def test_real_oidc_validation(client, monkeypatch, claim_change):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key())) | {"kid": "google-test"}
    monkeypatch.setattr(google, "load_server_metadata", AsyncMock(return_value={
        "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
        "issuer": "https://accounts.google.com",
        "id_token_signing_alg_values_supported": ["RS256"],
    }))
    monkeypatch.setattr(google, "fetch_jwk_set", AsyncMock(return_value={"keys": [public_jwk]}))
    response = client.get("/auth/google/login", follow_redirects=False)
    query = parse_qs(urlparse(response.headers["location"]).query)
    now = datetime.now(timezone.utc)
    claims = {
        "iss": "https://accounts.google.com", "aud": "test-client", "sub": "google-oidc",
        "email": "oidc@example.com", "email_verified": True, "iat": now, "exp": now + timedelta(minutes=5),
        "nonce": query["nonce"][0],
    } | (claim_change or {})
    id_token = jwt.encode(claims, key, algorithm="RS256", headers={"kid": "google-test"})
    monkeypatch.setattr(google, "fetch_access_token", AsyncMock(return_value={"id_token": id_token, "access_token": "google-token"}))
    callback = client.get("/auth/google/callback", params={"state": query["state"][0], "code": "code"})
    assert callback.status_code == (200 if claim_change is None else 400)
    if claim_change is None:
        assert google.fetch_access_token.call_args.kwargs["code_verifier"]
        replay = client.get("/auth/google/callback", params={"state": query["state"][0], "code": "code"})
        assert replay.status_code == 400


def test_callback_invalid_signature_is_rejected(client, monkeypatch):
    from joserfc.errors import BadSignatureError

    monkeypatch.setattr(google, "authorize_access_token", AsyncMock(side_effect=BadSignatureError()))
    assert client.get("/auth/google/callback?code=code").status_code == 400


@pytest.mark.parametrize("endpoint", ["/auth/google/login", "/auth/google/callback?code=code"])
def test_google_network_errors_are_safe(client, monkeypatch, endpoint):
    method = "authorize_redirect" if endpoint.endswith("login") else "authorize_access_token"
    monkeypatch.setattr(google, method, AsyncMock(side_effect=httpx.ConnectError("sensitive error")))
    response = client.get(endpoint)
    assert response.status_code == 502
    assert "sensitive error" not in response.text


def test_google_unconfigured_is_unavailable(client, monkeypatch):
    monkeypatch.setattr(auth.settings, "google_client_id", "")
    assert client.get("/auth/google/login").status_code == 503


def test_concurrent_first_login_reuses_user():
    db = Mock()
    db.scalar.side_effect = [None, User(id=42, google_sub="same-subject", email="user@example.com")]
    db.commit.side_effect = IntegrityError("insert", {}, Exception("duplicate subject"))
    assert auth.find_or_create_user(db, "same-subject", "user@example.com") == 42
    db.rollback.assert_called_once()


def test_unrelated_database_error_is_not_hidden():
    db = Mock()
    db.scalar.side_effect = [None, None]
    db.commit.side_effect = IntegrityError("insert", {}, Exception("database error"))
    with pytest.raises(IntegrityError):
        auth.find_or_create_user(db, "subject", "user@example.com")


def test_popup_login_posts_token_only_to_configured_frontend(client, monkeypatch):
    monkeypatch.setattr(google, "load_server_metadata", AsyncMock(return_value={
        "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
    }))
    client.get("/auth/google/login?popup=1", follow_redirects=False)
    mock_identity(monkeypatch)
    response = client.get("/auth/google/callback?code=code&state=state")
    assert response.status_code == 200
    assert "window.opener.postMessage" in response.text
    assert auth.settings.frontend_origin in response.text
    assert "cost-detective-auth" in response.text
    assert "content-security-policy" in response.headers
    assert response.headers["cache-control"] == "no-store"


def test_cors_allows_only_configured_frontend(client):
    response = client.options("/scans", headers={
        "Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
    })
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    denied = client.options("/scans", headers={"Origin": "https://attacker.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in denied.headers
