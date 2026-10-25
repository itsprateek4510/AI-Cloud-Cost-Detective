from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated, Literal

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from redis.exceptions import RedisError
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.security import get_current_user
from app.db.models import AwsAccount, Finding, Scan, User
from app.db.session import get_db

router = APIRouter(prefix="/scans", tags=["scans"])


async def get_queue():
    config = RedisSettings.from_dsn(settings.redis_url)
    config.conn_retries = 0
    config.conn_timeout = 2
    try:
        queue = await create_pool(config)
    except (RedisError, OSError):
        raise HTTPException(status_code=503, detail="Scan queue is unavailable") from None
    try:
        yield queue
    finally:
        await queue.aclose()


class CreateScan(BaseModel):
    model_config = ConfigDict(extra="forbid")
    account_id: int = Field(gt=0)


class ScanQueued(BaseModel):
    scan_id: int
    status: str = "pending"


class FindingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    rule_id: str
    resource_id: str
    resource_type: str
    region: str
    severity: str
    title: str
    description: str
    savings_monthly: Decimal
    details: dict


class Totals(BaseModel):
    findings_count: int
    savings_monthly: Decimal


class ScanOut(BaseModel):
    scan_id: int
    account_id: int
    status: Literal["pending", "running", "completed", "failed"]
    progress: int
    totals: Totals
    findings: list[FindingOut]
    skipped_checks: list[dict]
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None


def create_pending_scan(db: Session, user_id: int, account_id: int) -> int:
    account = db.scalar(select(AwsAccount).where(AwsAccount.id == account_id, AwsAccount.user_id == user_id))
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if not account.verified_at or not account.role_arn:
        raise HTTPException(status_code=409, detail="Verify this AWS account before scanning")
    scan = Scan(account_id=account.id)
    db.add(scan)
    db.commit()
    return scan.id


def fail_enqueue(db: Session, scan_id: int):
    db.execute(update(Scan).where(Scan.id == scan_id, Scan.status == "pending").values(
        status="failed", error_message="Scan could not be queued. Start a new scan when Redis is available.",
        completed_at=datetime.now(timezone.utc),
    ))
    db.commit()


@router.post("", response_model=ScanQueued, status_code=202)
async def start_scan(
    body: CreateScan,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    queue: Annotated[ArqRedis, Depends(get_queue)],
):
    scan_id = await run_in_threadpool(create_pending_scan, db, user.id, body.account_id)
    try:
        await queue.enqueue_job("scan_job", scan_id, _job_id=f"scan:{scan_id}")
    except (RedisError, OSError):
        await run_in_threadpool(fail_enqueue, db, scan_id)
        raise HTTPException(status_code=503, detail="Scan queue is unavailable") from None
    return ScanQueued(scan_id=scan_id)


@router.get("/{scan_id}", response_model=ScanOut)
def get_scan(
    scan_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    scan = db.scalar(select(Scan).join(AwsAccount).where(Scan.id == scan_id, AwsAccount.user_id == user.id))
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    findings = db.scalars(select(Finding).where(Finding.scan_id == scan_id).order_by(Finding.savings_monthly.desc(), Finding.id)).all()
    return ScanOut(
        scan_id=scan.id, account_id=scan.account_id, status=scan.status, progress=scan.progress,
        totals=Totals(findings_count=len(findings), savings_monthly=sum((f.savings_monthly for f in findings), Decimal("0.00"))),
        findings=[FindingOut.model_validate(finding) for finding in findings], skipped_checks=scan.skipped_checks,
        error_message=scan.error_message, created_at=scan.created_at, completed_at=scan.completed_at,
    )
