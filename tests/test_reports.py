from datetime import datetime, timezone
from decimal import Decimal
import os
from concurrent.futures import ThreadPoolExecutor
import time
from unittest.mock import Mock

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.api import reports
from app.core.security import create_access_token
from app.core.config import settings
from app.db.models import AwsAccount, Finding, Report as StoredReport, Scan, User
from app.db.session import get_db
from app.llm.gemini import Report, SummaryUnavailable
from app.main import app


@pytest.fixture
def completed(db, user):
    account = AwsAccount(user_id=user.id, external_id="stored-id", verified_at=datetime.now(timezone.utc))
    db.add(account)
    db.flush()
    scan = Scan(account_id=account.id, status="completed", progress=100, savings_monthly=Decimal("8.00"))
    db.add(scan)
    db.flush()
    finding = Finding(scan_id=scan.id, rule_id="ebs_unattached", resource_id="vol-test", resource_type="ebs", region="us-east-1",
                      severity="medium", title="Unattached EBS volume", description="Review", savings_monthly=Decimal("8.00"))
    db.add(finding)
    db.commit()
    return scan.id, finding.id


def response_report(finding_id):
    return Report(executive_summary="Unused storage warrants review.", top_actions=[{
        "title": "Review storage", "why": "Storage is unattached.", "fix_hint": "Check ownership before deletion.", "finding_ids": [finding_id],
    }], risks=["Confirm recovery requirements."])


def test_generate_cache_and_get_do_not_pay_twice(client, headers, completed, db, monkeypatch):
    scan_id, finding_id = completed
    build = Mock(return_value=response_report(finding_id))
    monkeypatch.setattr(reports, "build_report", build)
    assert client.get(f"/scans/{scan_id}/report", headers=headers).status_code == 404
    first = client.post(f"/scans/{scan_id}/report", headers=headers)
    assert first.status_code == 200
    assert first.json()["ai_summary_unavailable"] is False
    assert first.json()["report"]["top_actions"][0]["finding_ids"] == [finding_id]
    assert client.post(f"/scans/{scan_id}/report", headers=headers).json() == first.json()
    assert client.get(f"/scans/{scan_id}/report", headers=headers).json() == first.json()
    build.assert_called_once()
    assert db.scalar(select(StoredReport)).scan_id == scan_id
    assert build.call_args.args[1]["savings_monthly"] == Decimal("8.00")


def test_failure_returns_unavailable_and_keeps_findings_accessible(client, headers, completed, db, monkeypatch):
    scan_id, _ = completed
    monkeypatch.setattr(reports, "build_report", Mock(side_effect=SummaryUnavailable()))
    response = client.post(f"/scans/{scan_id}/report", headers=headers)
    assert response.status_code == 200
    assert response.json()["ai_summary_unavailable"] is True
    assert response.json()["report"] is None
    assert db.scalar(select(StoredReport)) is None
    assert client.get(f"/scans/{scan_id}", headers=headers).json()["totals"]["savings_monthly"] == "8.00"


@pytest.mark.parametrize("method", ["get", "post"])
def test_report_is_owner_scoped(client, completed, db, monkeypatch, method):
    other = User(google_sub="other-report", email="other@example.com")
    db.add(other)
    db.commit()
    build = Mock()
    monkeypatch.setattr(reports, "build_report", build)
    response = getattr(client, method)(f"/scans/{completed[0]}/report", headers={"Authorization": f"Bearer {create_access_token(other.id)}"})
    assert response.status_code == 404
    build.assert_not_called()


def test_running_scan_cannot_generate_report(client, headers, completed, db, monkeypatch):
    db.get(Scan, completed[0]).status = "running"
    db.commit()
    build = Mock()
    monkeypatch.setattr(reports, "build_report", build)
    assert client.post(f"/scans/{completed[0]}/report", headers=headers).status_code == 409
    build.assert_not_called()


def test_report_requires_auth(client):
    assert client.post("/scans/1/report").status_code == 401
    assert client.get("/scans/1/report").status_code == 401


def test_gemini_off_returns_unavailable_without_affecting_scan(client, headers, completed, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", type(settings.gemini_api_key)(""))
    response = client.post(f"/scans/{completed[0]}/report", headers=headers)
    assert response.status_code == 200
    assert response.json()["ai_summary_unavailable"] is True
    assert client.get(f"/scans/{completed[0]}", headers=headers).json()["findings"]


@pytest.mark.skipif(not os.environ.get("TEST_DATABASE_URL"), reason="PostgreSQL row-lock integration test")
def test_concurrent_requests_share_one_generated_report(client, headers, completed, db, monkeypatch):
    scan_id, finding_id = completed
    factory = sessionmaker(bind=db.get_bind())

    def independent_session():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = independent_session

    def generate(*args):
        time.sleep(0.1)
        return response_report(finding_id)

    build = Mock(side_effect=generate)
    monkeypatch.setattr(reports, "build_report", build)
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: client.post(f"/scans/{scan_id}/report", headers=headers), range(2)))
    assert all(result.status_code == 200 for result in results)
    assert results[0].json() == results[1].json()
    build.assert_called_once()
