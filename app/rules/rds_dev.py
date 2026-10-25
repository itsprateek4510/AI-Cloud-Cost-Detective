from app.aws.session import AWS_CONFIG
from app.rules.base import Finding

RULE_ID = "rds_dev"
DEV_ENVIRONMENTS = {"dev", "development", "test", "testing", "stage", "staging", "sandbox"}


def scan(session, region: str) -> list[Finding]:
    client = session.client("rds", region_name=region, config=AWS_CONFIG)
    findings = []
    for page in client.get_paginator("describe_db_instances").paginate():
        for instance in page["DBInstances"]:
            if instance["DBInstanceStatus"] != "available":
                continue
            tags = instance.get("TagList")
            if tags is None:
                tags = client.list_tags_for_resource(ResourceName=instance["DBInstanceArn"])["TagList"]
            environments = [tag["Value"].strip().lower() for tag in tags if tag["Key"].lower() in {"environment", "env"}]
            if not environments or any(value not in DEV_ENVIRONMENTS for value in environments):
                continue
            findings.append(Finding(
                rule_id=RULE_ID, resource_id=instance["DBInstanceIdentifier"], resource_type="rds", region=region, severity="low",
                title="Development RDS scheduling review", description="An explicit environment tag identifies this database as non-production. Review a workload-aware off-hours schedule; do not stop production dependencies or assume every engine supports stopping.",
                details={"savings_note": "Savings require an approved off-hours schedule and applicable engine pricing; no full-time deletion savings are assumed."},
            ))
    return findings
