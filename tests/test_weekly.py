import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, Mock
import logging

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.models import AwsAccount, WeeklyDelivery, Scan, Finding
from app.workers import weekly
from app.workers import scan_job as scan_worker
from app.delivery import send_report
from app.workers.scan_job import WorkerSettings


@pytest.fixture
def weekly_account(db, user, monkeypatch):
    account = AwsAccount(user_id=user.id, role_arn="arn:aws:iam::123456789012:role/ReadOnly", external_id="stored-id",
                         verified_at=datetime.now(timezone.utc))
    db.add(account)
    db.commit()
    monkeypatch.setattr(weekly, "SessionLocal", sessionmaker(bind=db.get_bind()))
    monkeypatch.setattr(settings, "delivery_channel", "email")
    monkeypatch.setattr(settings, "delivery_user_ids", [user.id])
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.test")
    monkeypatch.setattr(settings, "smtp_from", "reports@example.test")
    return account


def test_weekly_dispatch_is_deduplicated_and_queues_without_manual_scan(db, weekly_account):
    queue = Mock(enqueue_job=AsyncMock())
    asyncio.run(weekly.weekly_reports({"redis": queue}))
    asyncio.run(weekly.weekly_reports({"redis": queue}))
    deliveries = db.scalars(select(WeeklyDelivery)).all()
    assert len(deliveries) == 1
    assert db.get(Scan, deliveries[0].scan_id).status == "pending"
    queue.enqueue_job.assert_awaited_once()


def test_delivery_is_off_by_default_and_requires_allowlist(db, weekly_account, monkeypatch):
    monkeypatch.setattr(settings, "delivery_user_ids", [])
    queue = Mock(enqueue_job=AsyncMock())
    asyncio.run(weekly.weekly_reports({"redis": queue}))
    queue.enqueue_job.assert_not_awaited()


def test_weekly_job_runs_scan_and_delivers_even_without_gemini_or_cost_access(db, weekly_account, monkeypatch):
    queue = Mock(enqueue_job=AsyncMock())
    asyncio.run(weekly.weekly_reports({"redis": queue}))
    delivery_id = db.scalar(select(WeeklyDelivery.id))

    async def scan(ctx, scan_id):
        with weekly.SessionLocal() as session:
            row = session.get(Scan, scan_id)
            row.status = "completed"
            row.progress = 100
            row.savings_monthly = 8
            session.add(Finding(scan_id=scan_id, rule_id="ebs_unattached", resource_id="vol-test", resource_type="ebs", region="us-east-1",
                                severity="medium", title="Unattached storage", description="Review", savings_monthly=8))
            session.commit()

    monkeypatch.setattr(scan_worker, "scan_job", scan)
    monkeypatch.setattr(weekly, "generate_report", Mock(return_value=Mock(report=None, ai_summary_unavailable=True)))
    monkeypatch.setattr(weekly, "get_cost_data", Mock(return_value={"available": False, "reason": "access_denied"}))
    send = Mock()
    monkeypatch.setattr(weekly, "send_report", send)
    asyncio.run(weekly.weekly_account_report({}, delivery_id))
    asyncio.run(weekly.weekly_account_report({}, delivery_id))
    send.assert_called_once()
    body = send.call_args.args[2]
    assert "8.00" in body
    assert "vol-test" in body
    assert "?scan=" in body
    assert "unavailable" in body.lower()
    db.expire_all()
    assert db.get(WeeklyDelivery, delivery_id).status == "sent"


def test_slack_text_disables_mentions_and_unfurls(monkeypatch):
    monkeypatch.setattr(settings, "slack_webhook_url", type(settings.slack_webhook_url)("https://hooks.slack.com/services/test"))
    post = Mock(return_value=Mock())
    monkeypatch.setattr(send_report.httpx, "post", post)
    send_report.send_report("slack", "owner@example.test", "Review <@everyone> & storage")
    payload = post.call_args.kwargs["json"]
    assert "<@everyone>" not in payload["text"]
    assert payload["unfurl_links"] is False
    assert post.call_args.kwargs["timeout"] == 10


def test_email_uses_verified_owner_recipient_and_tls(monkeypatch):
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.test")
    monkeypatch.setattr(settings, "smtp_from", "reports@example.test")
    monkeypatch.setattr(settings, "smtp_starttls", True)
    connection = MagicMock()
    smtp = connection.__enter__.return_value
    monkeypatch.setattr(send_report.smtplib, "SMTP", Mock(return_value=connection))
    send_report.send_report("email", "owner@example.test", "Weekly deterministic findings")
    smtp.starttls.assert_called_once()
    message = smtp.send_message.call_args.args[0]
    assert message["To"] == "owner@example.test"
    assert "Weekly deterministic findings" in message.get_content()


def test_weekly_cron_is_registered_in_existing_worker():
    assert any(job.coroutine is weekly.weekly_reports for job in WorkerSettings.cron_jobs)
    assert weekly.weekly_account_report in WorkerSettings.functions


def test_failed_enqueue_marks_scan_and_delivery_failed(db, weekly_account):
    queue = Mock(enqueue_job=AsyncMock(side_effect=ConnectionError("secret redis URL")))
    asyncio.run(weekly.weekly_reports({"redis": queue}))
    row = db.scalar(select(WeeklyDelivery))
    assert row.status == "failed"
    assert db.get(Scan, row.scan_id).status == "failed"
    assert "secret" not in row.error_message


def test_send_failure_is_recorded_without_repeating_delivery(db, weekly_account, monkeypatch):
    queue = Mock(enqueue_job=AsyncMock())
    asyncio.run(weekly.weekly_reports({"redis": queue}))
    delivery_id = db.scalar(select(WeeklyDelivery.id))
    monkeypatch.setattr(scan_worker, "scan_job", AsyncMock())
    send = Mock(side_effect=RuntimeError("secret webhook"))
    monkeypatch.setattr(weekly, "compose_and_send", send)
    asyncio.run(weekly.weekly_account_report({}, delivery_id))
    asyncio.run(weekly.weekly_account_report({}, delivery_id))
    db.expire_all()
    assert db.get(WeeklyDelivery, delivery_id).status == "failed"
    send.assert_called_once()


def test_other_users_are_not_scheduled(db, weekly_account, monkeypatch):
    monkeypatch.setattr(settings, "delivery_user_ids", [999])
    queue = Mock(enqueue_job=AsyncMock())
    asyncio.run(weekly.weekly_reports({"redis": queue}))
    queue.enqueue_job.assert_not_awaited()


def test_httpx_logs_cannot_expose_slack_webhook_secret(caplog):
    with caplog.at_level(logging.INFO, logger="httpx"):
        logging.getLogger("httpx").info("HTTP Request: POST %s", "https://hooks.slack.com/services/secret-webhook-token")
    assert "secret-webhook-token" not in caplog.text
    assert "redacted" in caplog.text


def test_revoked_account_cannot_leave_an_unstarted_weekly_scan_pending(db, weekly_account, monkeypatch):
    queue = Mock(enqueue_job=AsyncMock())
    asyncio.run(weekly.weekly_reports({"redis": queue}))
    row = db.scalar(select(WeeklyDelivery))
    scan_id, delivery_id = row.scan_id, row.id
    weekly_account.verified_at = None
    db.commit()
    scan = AsyncMock()
    monkeypatch.setattr(scan_worker, "scan_job", scan)
    asyncio.run(weekly.weekly_account_report({}, delivery_id))
    db.expire_all()
    assert db.get(WeeklyDelivery, delivery_id).status == "failed"
    assert db.get(Scan, scan_id).status == "failed"
    scan.assert_not_awaited()


def test_smtp_password_is_not_sent_over_plaintext(monkeypatch):
    monkeypatch.setattr(settings, "smtp_starttls", False)
    monkeypatch.setattr(settings, "smtp_username", "smtp-user")
    connection = MagicMock()
    smtp = connection.__enter__.return_value
    monkeypatch.setattr(send_report.smtplib, "SMTP", Mock(return_value=connection))
    with pytest.raises(ValueError):
        send_report.send_report("email", "owner@example.test", "Report")
    smtp.login.assert_not_called()
    smtp.send_message.assert_not_called()
