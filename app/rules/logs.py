from decimal import Decimal

import boto3

from app.aws.pricing import estimate_monthly
from app.aws.session import AWS_CONFIG
from app.rules.base import Finding

RULE_ID = "logs_no_retention"


def scan(session: boto3.Session, region: str) -> list[Finding]:
    client = session.client("logs", region_name=region, config=AWS_CONFIG)
    findings = []
    for page in client.get_paginator("describe_log_groups").paginate():
        for group in page.get("logGroups", []):
            if group.get("retentionInDays"):
                continue
            stored_bytes = group.get("storedBytes", 0)
            storage = estimate_monthly(region, "logs", quantity=Decimal(stored_bytes) / Decimal(1024 ** 3))
            findings.append(Finding(
                rule_id=RULE_ID, resource_id=group["logGroupName"], resource_type="logs", region=region,
                severity="low", title="CloudWatch log group has no retention",
                description="Logs are retained indefinitely. Choose a retention policy that meets operational and compliance needs.",
                savings_monthly=Decimal("0.00"),
                details={"stored_bytes": stored_bytes, "estimated_storage_monthly_usd": str(storage.amount),
                         "pricing_note": storage.note,
                         "savings_note": "Retention savings cannot be calculated without log age distribution and a target retention period."},
            ))
    return findings
