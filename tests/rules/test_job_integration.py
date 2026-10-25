import asyncio
from datetime import datetime, timezone
import shutil
import socket
import subprocess
import time

from arq import create_pool
from arq.connections import RedisSettings
from arq.worker import Worker
import pytest
from redis import Redis
from redis.exceptions import ConnectionError
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.security import create_access_token
from app.db.models import AwsAccount
from app.rules import runner
from app.workers import scan_job as worker_module
from app.workers import weekly
from app.db.models import WeeklyDelivery
from sqlalchemy import select
from unittest.mock import Mock


@pytest.fixture
def redis_url():
    executable = shutil.which("redis-server")
    if not executable:
        pytest.skip("redis-server is required for the real ARQ integration test")
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    process = subprocess.Popen([executable, "--bind", "127.0.0.1", "--port", str(port), "--save", "", "--appendonly", "no"],
                               stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    connection = Redis(host="127.0.0.1", port=port)
    try:
        for _ in range(100):
            try:
                connection.ping()
                break
            except ConnectionError:
                time.sleep(0.02)
        else:
            pytest.fail("Test Redis failed to start")
        yield f"redis://127.0.0.1:{port}/0"
    finally:
        connection.close()
        process.terminate()
        process.communicate(timeout=5)


def test_api_real_redis_arq_rules_database_and_polling(client, db, user, aws, old_instance, put_metrics, redis_url, monkeypatch):
    headers = {"Authorization": f"Bearer {create_access_token(user.id)}"}
    ec2 = aws.client("ec2")
    ec2.create_volume(AvailabilityZone="us-east-1a", Size=100, VolumeType="gp3")
    ec2.allocate_address(Domain="vpc")
    put_metrics(old_instance)
    account = AwsAccount(user_id=user.id, external_id="test-external-id", role_arn="arn:aws:iam::123456789012:role/ReadOnly",
                         verified_at=datetime.now(timezone.utc))
    db.add(account)
    db.commit()
    monkeypatch.setattr(settings, "redis_url", redis_url)
    monkeypatch.setattr(worker_module, "SessionLocal", sessionmaker(bind=db.get_bind()))
    monkeypatch.setattr(runner, "list_enabled_regions", lambda session: ["us-east-1"])
    response = client.post("/scans", json={"account_id": account.id}, headers=headers)
    assert response.status_code == 202
    scan_id = response.json()["scan_id"]
    assert client.get(f"/scans/{scan_id}", headers=headers).json()["status"] == "pending"

    async def consume():
        queue = await create_pool(RedisSettings.from_dsn(redis_url))
        worker = Worker(functions=[worker_module.scan_job], redis_pool=queue, burst=True,
                        handle_signals=False, poll_delay=0.01, keep_result=0)
        try:
            await worker.async_run()
            assert worker.jobs_complete == 1
        finally:
            await worker.close()

    asyncio.run(consume())
    final = client.get(f"/scans/{scan_id}", headers=headers).json()
    assert final["status"] == "completed"
    assert final["progress"] == 100
    assert final["totals"] == {"findings_count": 3, "savings_monthly": "19.24"}
    assert final["skipped_checks"] == []


def test_weekly_dispatch_real_queue_scans_and_sends_without_ui(db, user, aws, old_instance, put_metrics, redis_url, monkeypatch):
    ec2 = aws.client("ec2")
    ec2.create_volume(AvailabilityZone="us-east-1a", Size=100, VolumeType="gp3")
    ec2.allocate_address(Domain="vpc")
    put_metrics(old_instance)
    account = AwsAccount(user_id=user.id, external_id="test-external-id", role_arn="arn:aws:iam::123456789012:role/ReadOnly",
                         verified_at=datetime.now(timezone.utc))
    db.add(account)
    db.commit()
    monkeypatch.setattr(settings, "delivery_channel", "email")
    monkeypatch.setattr(settings, "delivery_user_ids", [user.id])
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.test")
    monkeypatch.setattr(settings, "smtp_from", "reports@example.test")
    monkeypatch.setattr(settings, "gemini_api_key", type(settings.gemini_api_key)(""))
    factory = sessionmaker(bind=db.get_bind())
    monkeypatch.setattr(worker_module, "SessionLocal", factory)
    monkeypatch.setattr(weekly, "SessionLocal", factory)
    monkeypatch.setattr(weekly, "get_cost_data", Mock(return_value={"available": False}))
    monkeypatch.setattr(runner, "list_enabled_regions", lambda session: ["us-east-1"])
    send = Mock()
    monkeypatch.setattr(weekly, "send_report", send)

    async def consume():
        queue = await create_pool(RedisSettings.from_dsn(redis_url))
        await weekly.weekly_reports({"redis": queue})
        worker = Worker(functions=[weekly.weekly_account_report], redis_pool=queue, burst=True,
                        handle_signals=False, poll_delay=0.01, keep_result=0)
        try:
            await worker.async_run()
            assert worker.jobs_complete == 1
        finally:
            await worker.close()

    asyncio.run(consume())
    send.assert_called_once()
    assert "19.24" in send.call_args.args[2]
    assert "AI summary unavailable" in send.call_args.args[2]
    assert db.scalar(select(WeeklyDelivery)).status == "sent"
