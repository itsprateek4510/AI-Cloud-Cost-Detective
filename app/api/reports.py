from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.models import AwsAccount, Finding, Report as StoredReport, Scan, User
from app.db.session import get_db
from app.llm.gemini import Report, SummaryUnavailable, build_report

router = APIRouter(prefix="/scans", tags=["reports"])


class ReportOut(BaseModel):
    scan_id: int
    ai_summary_unavailable: bool = False
    report: Report | None


@router.post("/{scan_id}/report", response_model=ReportOut)
def generate_report(
    scan_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    # PostgreSQL serializes generation for a scan across API processes. A second
    # caller waits, then reads the committed cache instead of paying again.
    scan = db.scalar(select(Scan).join(AwsAccount).where(Scan.id == scan_id, AwsAccount.user_id == user.id).with_for_update(of=Scan))
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    cached = db.scalar(select(StoredReport).where(StoredReport.scan_id == scan_id))
    if cached:
        return ReportOut(scan_id=scan_id, report=Report.model_validate(cached.content))
    if scan.status != "completed":
        raise HTTPException(status_code=409, detail="Complete the scan before generating a report")
    rows = db.scalars(select(Finding).where(Finding.scan_id == scan_id)).all()
    findings = [{"id": row.id, "rule_id": row.rule_id, "resource_id": row.resource_id, "resource_type": row.resource_type,
                 "region": row.region, "severity": row.severity, "title": row.title, "description": row.description,
                 "savings_monthly": row.savings_monthly, "details": row.details} for row in rows]
    totals = {"findings_count": len(rows), "savings_monthly": sum((row.savings_monthly for row in rows), Decimal("0.00")),
              "skipped_checks_count": len(scan.skipped_checks)}
    try:
        report = build_report(findings, totals)
    except SummaryUnavailable:
        db.rollback()
        return ReportOut(scan_id=scan_id, ai_summary_unavailable=True, report=None)
    db.add(StoredReport(scan_id=scan_id, content=report.model_dump(mode="json")))
    db.commit()
    return ReportOut(scan_id=scan_id, report=report)


@router.get("/{scan_id}/report", response_model=ReportOut)
def get_report(
    scan_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    scan = db.scalar(select(Scan).join(AwsAccount).where(Scan.id == scan_id, AwsAccount.user_id == user.id))
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    cached = db.scalar(select(StoredReport).where(StoredReport.scan_id == scan_id))
    if cached is None:
        raise HTTPException(status_code=404, detail="No cached report; generate it first")
    return ReportOut(scan_id=scan_id, report=Report.model_validate(cached.content))
