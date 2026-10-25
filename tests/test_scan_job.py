import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from threading import Event
from unittest.mock import Mock

from botocore.exceptions import NoCredentialsError
import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.db.models import AwsAccount, Finding, Scan
from app.rules.base import Finding as RuleFinding, ScanResult, SkippedCheck
from app.workers import scan_job as worker


@pytest.fixture
def queued_scan(db, user, monkeypatch):
    account = AwsAccount(user_id=user.id, external_id="server-id", role_arn="arn:aws:iam::123456789012:role/ReadOnly",
                         verified_at=datetime.now(timezone.utc))
    db.add(account)
    db.flush()
    scan = Scan(account_id=account.id)
    db.add(scan)
    db.commit()
    scan_id = scan.id
    monkeypatch.setattr(worker, "SessionLocal", sessionmaker(bind=db.get_bind()))
    monkeypatch.setattr(worker, "assume_role_session", Mock(return_value="assumed-session"))
    return scan_id


def result():
    return ScanResult(findings=[RuleFinding(
        rule_id="ebs_unattached", resource_id="vol-test", resource_type="ebs", region="us-east-1",
        severity="medium", title="Unattached EBS volume", description="Review", savings_monthly=Decimal("8.00"),
    )], skipped_checks=[SkippedCheck(rule_id="nat_idle", region="us-east-1", reason="access_denied", detail="Denied")])


def test_worker_updates_progress_and_persists_result(queued_scan, db, monkeypatch):
    observed = []

    def run(session, *, on_region_complete):
        assert session == "assumed-session"
        on_region_complete(1, 2)
        with worker.SessionLocal() as progress_db:
            observed.append(progress_db.get(Scan, queued_scan).progress)
        on_region_complete(2, 2)
        return result()

    monkeypatch.setattr(worker, "run_scan", run)
    asyncio.run(worker.scan_job({}, queued_scan))
    db.expire_all()
    stored = db.get(Scan, queued_scan)
    assert stored.status == "completed"
    assert stored.progress == 100
    assert 5 < observed[0] < 100
    assert stored.savings_monthly == Decimal("8.00")
    assert stored.completed_at is not None
    assert stored.skipped_checks[0]["reason"] == "access_denied"
    finding = db.scalar(select(Finding))
    assert finding.scan_id == queued_scan
    assert db.get(AwsAccount, stored.account_id).user_id is not None
    worker.assume_role_session.assert_called_once_with("arn:aws:iam::123456789012:role/ReadOnly", "server-id")


def test_repeated_job_does_not_duplicate_findings(queued_scan, db, monkeypatch):
    run = Mock(return_value=result())
    monkeypatch.setattr(worker, "run_scan", run)
    asyncio.run(worker.scan_job({}, queued_scan))
    asyncio.run(worker.scan_job({}, queued_scan))
    assert len(db.scalars(select(Finding)).all()) == 1
    run.assert_called_once()


def test_worker_error_is_terminal_and_sanitized(queued_scan, db, monkeypatch):
    monkeypatch.setattr(worker, "run_scan", Mock(side_effect=RuntimeError("sensitive secret")))
    asyncio.run(worker.scan_job({}, queued_scan))
    db.expire_all()
    stored = db.get(Scan, queued_scan)
    assert stored.status == "failed"
    assert stored.completed_at is not None
    assert "sensitive" not in stored.error_message
    assert db.scalar(select(Finding)) is None


def test_failed_assume_role_is_terminal(queued_scan, db, monkeypatch):
    monkeypatch.setattr(worker, "assume_role_session", Mock(side_effect=NoCredentialsError()))
    asyncio.run(worker.scan_job({}, queued_scan))
    db.expire_all()
    assert db.get(Scan, queued_scan).status == "failed"


def test_discovery_failure_is_not_a_successful_empty_scan(queued_scan, db, monkeypatch):
    monkeypatch.setattr(worker, "run_scan", Mock(return_value=ScanResult(skipped_checks=[
        SkippedCheck(rule_id="region_discovery", region="global", reason="access_denied", detail="Denied"),
    ])))
    asyncio.run(worker.scan_job({}, queued_scan))
    db.expire_all()
    stored = db.get(Scan, queued_scan)
    assert stored.status == "failed"
    assert stored.skipped_checks


def test_cancelled_job_cannot_later_overwrite_failed_status(queued_scan, db, monkeypatch):
    started, release = Event(), Event()

    def slow_run(session, *, on_region_complete):
        started.set()
        release.wait(timeout=5)
        return result()

    monkeypatch.setattr(worker, "run_scan", slow_run)

    async def cancel():
        task = asyncio.create_task(worker.scan_job({}, queued_scan))
        assert await asyncio.to_thread(started.wait, 5)
        task.cancel()
        try:
            with pytest.raises(asyncio.CancelledError):
                await task
        finally:
            release.set()

    asyncio.run(cancel())
    db.expire_all()
    assert db.get(Scan, queued_scan).status == "failed"
    assert db.scalar(select(Finding)) is None


def test_revoked_account_is_not_scanned(queued_scan, db, monkeypatch):
    scan = db.get(Scan, queued_scan)
    db.get(AwsAccount, scan.account_id).verified_at = None
    db.commit()
    run = Mock()
    monkeypatch.setattr(worker, "run_scan", run)
    asyncio.run(worker.scan_job({}, queued_scan))
    db.expire_all()
    assert db.get(Scan, queued_scan).status == "failed"
    run.assert_not_called()
