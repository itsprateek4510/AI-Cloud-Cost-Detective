from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.models import AwsAccount, Finding, Report, Scan


def test_scan_finding_and_cached_report_round_trip(db, user):
    account = AwsAccount(user_id=user.id, external_id="unique-customer-id")
    db.add(account)
    db.flush()
    scan = Scan(account_id=account.id)
    db.add(scan)
    db.flush()
    finding = Finding(
        scan_id=scan.id, rule_id="ebs-unattached", resource_id="vol-test", resource_type="ebs",
        region="us-east-1", severity="medium", title="Unattached volume", description="Unused storage",
        savings_monthly=Decimal("12.34"),
    )
    report = Report(scan_id=scan.id, content={"executive_summary": "Unused storage found"})
    db.add_all([finding, report])
    db.commit()
    db.expire_all()
    assert db.scalar(select(Finding)).savings_monthly == Decimal("12.34")
    assert db.scalar(select(Scan)).status == "pending"
    assert db.scalar(select(Scan)).progress == 0
    assert db.scalar(select(Scan)).skipped_checks == []
    assert db.scalar(select(Finding)).details == {}
    assert db.scalar(select(Report)).content == report.content
    db.add(Report(scan_id=scan.id, content={}))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_external_id_has_database_unique_constraint(db, user):
    db.add_all([AwsAccount(user_id=user.id, external_id="duplicate") for _ in range(2)])
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
