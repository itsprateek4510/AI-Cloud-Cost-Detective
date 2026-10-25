from datetime import datetime, timedelta, timezone

from app.aws.session import AWS_CONFIG
from app.rules.base import Finding

RULE_ID = "snapshots_old"


def scan(session, region: str) -> list[Finding]:
    client = session.client("ec2", region_name=region, config=AWS_CONFIG)
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    findings = []
    for page in client.get_paginator("describe_snapshots").paginate(OwnerIds=["self"]):
        for snapshot in page["Snapshots"]:
            if snapshot["State"] != "completed" or not snapshot.get("StartTime") or snapshot["StartTime"] > cutoff:
                continue
            findings.append(Finding(
                rule_id=RULE_ID, resource_id=snapshot["SnapshotId"], resource_type="snapshot", region=region, severity="low",
                title="Old snapshot review candidate", description="Snapshot is at least ninety days old. Age alone is not waste: verify backup retention, AMI references and recovery dependencies before removal.",
                details={"age_days": (datetime.now(timezone.utc) - snapshot["StartTime"]).days,
                         "savings_note": "Snapshots are incremental; source volume size does not reveal billed snapshot bytes or deletion savings."},
            ))
    return findings
