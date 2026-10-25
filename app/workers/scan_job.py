import asyncio
from datetime import datetime, timezone
import logging

from arq.connections import RedisSettings
from arq import cron
from botocore.exceptions import BotoCoreError, ClientError
from sqlalchemy import select, update

from app.aws.session import assume_role_session
from app.core.config import settings
from app.db.models import AwsAccount, Finding, Scan
from app.db.session import SessionLocal
from app.rules.runner import run_scan
from app.workers.weekly import weekly_account_report, weekly_reports

logger = logging.getLogger(__name__)


def fail_scan(scan_id: int, message: str):
    with SessionLocal() as db:
        db.execute(update(Scan).where(Scan.id == scan_id, Scan.status.in_(["pending", "running"])).values(
            status="failed", error_message=message, completed_at=datetime.now(timezone.utc),
        ))
        db.commit()


def execute_scan(scan_id: int):
    with SessionLocal() as db:
        claimed = db.execute(update(Scan).where(Scan.id == scan_id, Scan.status == "pending").values(status="running", progress=5))
        if claimed.rowcount != 1:
            db.rollback()
            return
        db.commit()
        scan = db.get(Scan, scan_id)
        account = db.get(AwsAccount, scan.account_id)
        if not account or not account.verified_at or not account.role_arn:
            raise ValueError("Account is no longer verified")
        role_arn, external_id = account.role_arn, account.external_id

    def progress(completed: int, total: int):
        with SessionLocal() as db:
            db.execute(update(Scan).where(Scan.id == scan_id, Scan.status == "running").values(
                progress=5 + (85 * completed // total),
            ))
            db.commit()

    session = assume_role_session(role_arn, external_id)
    result = run_scan(session, on_region_complete=progress)
    with SessionLocal() as db:
        # A cancelled/timed-out job must not overwrite its terminal failed status.
        scan = db.scalar(select(Scan).where(Scan.id == scan_id, Scan.status == "running").with_for_update())
        if scan is None:
            return
        scan.skipped_checks = [skip.model_dump() for skip in result.skipped_checks]
        if any(skip.rule_id in {"region_discovery", "aws_session"} for skip in result.skipped_checks):
            scan.status = "failed"
            scan.error_message = "Unable to initialize AWS scanning. Review skipped checks and role permissions."
        else:
            db.add_all([Finding(scan_id=scan_id, **finding.model_dump(exclude={"account_id", "tags"}))
                        for finding in result.findings])
            scan.savings_monthly = result.savings_monthly
            scan.status = "completed"
            scan.progress = 100
        scan.completed_at = datetime.now(timezone.utc)
        db.commit()


async def scan_job(ctx: dict, scan_id: int):
    try:
        # boto3 and synchronous SQLAlchemy never block the ARQ event loop.
        await asyncio.to_thread(execute_scan, scan_id)
    except asyncio.CancelledError:
        await asyncio.shield(asyncio.to_thread(fail_scan, scan_id, "Scan timed out or the worker stopped. Start a new scan."))
        raise
    except Exception as error:
        logger.error("Scan %s failed (%s)", scan_id, type(error).__name__)
        message = ("AWS access failed. Check the app credentials, role trust and ExternalId."
                   if isinstance(error, (BotoCoreError, ClientError)) else "Scan failed. Start a new scan or contact the operator.")
        await asyncio.to_thread(fail_scan, scan_id, message)


class WorkerSettings:
    functions = [scan_job, weekly_account_report]
    cron_jobs = [cron(weekly_reports, weekday=settings.weekly_report_day, hour=settings.weekly_report_hour,
                      minute=settings.weekly_report_minute, second=0)]
    timezone = timezone.utc
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = 2
    max_tries = 1
    job_timeout = 840  # Less than the 15-minute assumed-role credential lifetime.
