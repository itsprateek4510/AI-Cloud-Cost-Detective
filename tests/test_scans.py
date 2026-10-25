from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, Mock

import pytest
from sqlalchemy import select

from app.api.scans import get_queue
from app.api import scans
from app.core.security import create_access_token
from app.db.models import AwsAccount, Finding, Scan, User
from app.main import app


@pytest.fixture
def account(db, user):
    account = AwsAccount(user_id=user.id, role_arn="arn:aws:iam::123456789012:role/ReadOnly",
                         external_id="server-generated-external-id", verified_at=datetime.now(timezone.utc))
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@pytest.fixture
def queue(client):
    queue = Mock(enqueue_job=AsyncMock(return_value=object()))
    app.dependency_overrides[get_queue] = lambda: queue
    return queue


def test_scan_is_enqueued_without_running_it(client, headers, account, queue, db):
    response = client.post("/scans", json={"account_id": account.id}, headers=headers)
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "pending"
    queue.enqueue_job.assert_awaited_once_with("scan_job", data["scan_id"], _job_id=f"scan:{data['scan_id']}")
    stored = db.get(Scan, data["scan_id"])
    assert stored.status == "pending"
    assert stored.progress == 0


def test_scan_requires_verified_account(client, headers, account, queue, db):
    account.verified_at = None
    db.commit()
    assert client.post("/scans", json={"account_id": account.id}, headers=headers).status_code == 409
    queue.enqueue_job.assert_not_awaited()


def test_scan_requires_account_ownership(client, headers, queue, db):
    other = User(google_sub="other", email="other@example.com")
    db.add(other)
    db.flush()
    account = AwsAccount(user_id=other.id, external_id="other-id", role_arn="arn:aws:iam::123456789012:role/Other",
                         verified_at=datetime.now(timezone.utc))
    db.add(account)
    db.commit()
    assert client.post("/scans", json={"account_id": account.id}, headers=headers).status_code == 404
    queue.enqueue_job.assert_not_awaited()


def test_enqueue_failure_does_not_leave_pending_scan(client, headers, account, queue, db):
    queue.enqueue_job.side_effect = ConnectionError("sensitive redis connection")
    response = client.post("/scans", json={"account_id": account.id}, headers=headers)
    assert response.status_code == 503
    assert "sensitive" not in response.text
    stored = db.scalar(select(Scan))
    assert stored.status == "failed"
    assert stored.completed_at is not None


def test_status_returns_sorted_findings_exact_totals_and_skips(client, headers, account, db):
    scan = Scan(account_id=account.id, status="completed", progress=100, savings_monthly=Decimal("0.30"),
                skipped_checks=[{"rule_id": "nat_idle", "region": "us-east-1", "reason": "access_denied", "detail": "Denied"}])
    db.add(scan)
    db.flush()
    for resource_id, savings in [("vol-cheap", "0.10"), ("vol-expensive", "0.20")]:
        db.add(Finding(scan_id=scan.id, rule_id="ebs_unattached", resource_id=resource_id, resource_type="ebs",
                       region="us-east-1", severity="medium", title="Unattached volume", description="Review",
                       savings_monthly=Decimal(savings)))
    db.commit()
    response = client.get(f"/scans/{scan.id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["totals"] == {"findings_count": 2, "savings_monthly": "0.30"}
    assert [f["resource_id"] for f in data["findings"]] == ["vol-expensive", "vol-cheap"]
    assert data["skipped_checks"][0]["reason"] == "access_denied"
    assert "external_id" not in data
    assert "role_arn" not in data


def test_polling_other_users_scan_is_hidden(client, account, db):
    scan = Scan(account_id=account.id)
    other = User(google_sub="other", email="other@example.com")
    db.add_all([scan, other])
    db.commit()
    token = create_access_token(other.id)
    assert client.get(f"/scans/{scan.id}", headers={"Authorization": f"Bearer {token}"}).status_code == 404


def test_scans_require_auth(client):
    assert client.get("/scans/1").status_code == 401
    assert client.post("/scans", json={"account_id": 1}).status_code == 401


def test_account_list_is_owned_and_includes_verification(client, headers, account):
    response = client.get("/accounts", headers=headers)
    assert response.status_code == 200
    assert response.json()[0]["id"] == account.id
    assert response.json()[0]["verified_at"] is not None


def test_redis_connection_failure_is_service_unavailable(client, headers, account, db, monkeypatch):
    monkeypatch.setattr(scans, "create_pool", AsyncMock(side_effect=ConnectionError("private Redis URL")))
    response = client.post("/scans", json={"account_id": account.id}, headers=headers)
    assert response.status_code == 503
    assert "private" not in response.text
    assert db.scalar(select(Scan)) is None


def test_unknown_scan_is_not_found(client, headers):
    assert client.get("/scans/999", headers=headers).status_code == 404


def test_account_listing_cannot_expose_other_users_external_id(client, headers, db):
    other = User(google_sub="other-list", email="other@example.com")
    db.add(other)
    db.flush()
    db.add(AwsAccount(user_id=other.id, external_id="another-customer-external-id"))
    db.commit()
    assert client.get("/accounts", headers=headers).json() == []
