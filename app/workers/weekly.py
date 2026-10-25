import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import logging
from threading import Event

from redis.exceptions import RedisError
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.api.reports import generate_report
from app.aws.cost import get_cost_data
from app.core.config import settings
from app.db.models import AwsAccount, Finding, Scan, User, WeeklyDelivery
from app.db.session import SessionLocal
from app.delivery.send_report import delivery_configured, send_report

logger = logging.getLogger(__name__)


def prepare_deliveries() -> list[int]:
    today = datetime.now(timezone.utc).date()
    week_start = today - timedelta(days=today.weekday())
    with SessionLocal() as db:
        accounts = db.scalars(select(AwsAccount.id).where(AwsAccount.verified_at.is_not(None), AwsAccount.role_arn.is_not(None),
                                                         AwsAccount.user_id.in_(settings.delivery_user_ids))).all()
    ids = []
    for account_id in accounts:
        with SessionLocal() as db:
            if db.scalar(select(WeeklyDelivery.id).where(WeeklyDelivery.account_id == account_id, WeeklyDelivery.week_start == week_start)):
                continue
            scan = Scan(account_id=account_id)
            db.add(scan)
            db.flush()
            delivery = WeeklyDelivery(account_id=account_id, scan_id=scan.id, week_start=week_start, channel=settings.delivery_channel)
            db.add(delivery)
            try:
                db.commit()
                ids.append(delivery.id)
            except IntegrityError:
                db.rollback()  # Another scheduler already claimed this account/week.
    return ids


def fail_delivery(delivery_id: int):
    with SessionLocal() as db:
        delivery = db.get(WeeklyDelivery, delivery_id)
        if delivery and delivery.status in {"pending", "running"}:
            delivery.status = "failed"
            delivery.error_message = "Weekly report could not be delivered; check worker, AWS and delivery configuration."
            db.execute(update(Scan).where(Scan.id == delivery.scan_id, Scan.status == "pending").values(
                status="failed", error_message="Weekly scan could not be started.", completed_at=datetime.now(timezone.utc)))
            db.commit()


async def weekly_reports(ctx: dict):
    if not delivery_configured():
        return
    for delivery_id in await asyncio.to_thread(prepare_deliveries):
        try:
            await ctx["redis"].enqueue_job("weekly_account_report", delivery_id, _job_id=f"weekly:{delivery_id}")
        except (RedisError, OSError):
            await asyncio.to_thread(fail_delivery, delivery_id)


def claim_delivery(delivery_id: int) -> int | None:
    with SessionLocal() as db:
        result = db.execute(update(WeeklyDelivery).where(WeeklyDelivery.id == delivery_id, WeeklyDelivery.status == "pending").values(status="running"))
        if result.rowcount != 1:
            db.rollback()
            return None
        db.commit()
        delivery = db.get(WeeklyDelivery, delivery_id)
        account = db.get(AwsAccount, delivery.account_id)
        if (not account or not account.verified_at or account.user_id not in settings.delivery_user_ids
                or not account.role_arn or delivery.channel != settings.delivery_channel or not delivery_configured()):
            raise ValueError("Delivery consent or account verification changed")
        return delivery.scan_id


def compose_and_send(delivery_id: int, cancelled: Event | None = None):
    with SessionLocal() as db:
        delivery = db.get(WeeklyDelivery, delivery_id)
        if delivery is None or delivery.status != "running":
            return
        account = db.get(AwsAccount, delivery.account_id)
        if not account or not account.verified_at or account.user_id not in settings.delivery_user_ids:
            raise ValueError("Account is no longer eligible for delivery")
        owner = db.get(User, account.user_id)
        scan = db.get(Scan, delivery.scan_id)
        if scan is None or scan.status not in {"completed", "failed"}:
            raise ValueError("Weekly scan did not reach a terminal state")
        rows = db.scalars(select(Finding).where(Finding.scan_id == scan.id).order_by(Finding.savings_monthly.desc(), Finding.id)).all()
        total = sum((row.savings_monthly for row in rows), Decimal("0.00"))
        lines = ["Weekly AWS Cost Detective report", f"Connection #{account.id} · scan #{scan.id} · {scan.status}",
                 f"Estimated monthly savings: USD {total:.2f}", f"Findings: {len(rows)} · skipped checks: {len(scan.skipped_checks)}"]
        for row in rows[:5]:
            lines.append(f"- {row.title}: {row.resource_id} ({row.region}) · USD {row.savings_monthly:.2f}/month")
        if scan.error_message:
            lines.append(scan.error_message)
        if scan.status == "completed":
            summary = generate_report(scan.id, owner, db)
            lines.append(summary.report.executive_summary if summary.report else "AI summary unavailable; deterministic findings are still included.")
        costs = get_cost_data(db, account.id)
        if costs.get("available"):
            lines.append(f"Previous completed months' spend: {costs['currency']} {costs['total']}")
            for service in costs["services"][:5]:
                lines.append(f"- {service['service']}: {costs['currency']} {service['total']}")
        else:
            lines.append("Cost Explorer unavailable; review the role's billing permissions and Cost Explorer activation.")
        lines.extend(["Review dependencies before changes. Estimates are not billing quotes; no resources were modified.",
                      f"Open report: {settings.frontend_origin}/?scan={scan.id}"])
        channel, recipient = delivery.channel, owner.email
    # No database locks are held during SMTP/webhook I/O. One send attempt only:
    # retrying an ambiguous transport failure could send the same message twice.
    if cancelled is not None and cancelled.is_set():
        return
    send_report(channel, recipient, "\n".join(lines))
    with SessionLocal() as db:
        db.execute(update(WeeklyDelivery).where(WeeklyDelivery.id == delivery_id, WeeklyDelivery.status == "running").values(
            status="sent", sent_at=datetime.now(timezone.utc)))
        db.commit()


async def weekly_account_report(ctx: dict, delivery_id: int):
    from app.workers.scan_job import scan_job

    cancelled = Event()
    try:
        scan_id = await asyncio.to_thread(claim_delivery, delivery_id)
        if scan_id is None:
            return
        await scan_job(ctx, scan_id)
        await asyncio.to_thread(compose_and_send, delivery_id, cancelled)
    except asyncio.CancelledError:
        cancelled.set()
        await asyncio.shield(asyncio.to_thread(fail_delivery, delivery_id))
        raise
    except Exception as error:
        logger.error("Weekly delivery %s failed (%s)", delivery_id, type(error).__name__)
        await asyncio.to_thread(fail_delivery, delivery_id)
