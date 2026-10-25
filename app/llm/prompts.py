from decimal import Decimal, InvalidOperation
import re

# Free-form resource names, tags, descriptions and pricing notes are not safe
# to forward. These descriptions come from the deterministic rule definitions.
RULE_TEXT = {
    "ebs_unattached": ("ebs", "Unattached EBS volume", "An available storage volume has no attachments."),
    "eip_unused": ("eip", "Unassociated Elastic IP", "An allocated public address has no association."),
    "ec2_idle": ("ec2", "Potentially idle EC2 instance", "Compute utilization stayed below the scanner's CPU and network thresholds over its observation window."),
    "nat_idle": ("nat", "Potentially idle NAT Gateway", "Gateway traffic stayed below the scanner's threshold over its observation window."),
    "logs_no_retention": ("logs", "CloudWatch log group has no retention", "Logs are retained indefinitely. Savings from changing retention have not been quantified."),
    "load_balancer_idle": ("load_balancer", "Potentially idle load balancer", "No requests or flows were observed across a complete observation window; review failover and network dependencies."),
    "snapshots_old": ("snapshot", "Old snapshot review candidate", "Snapshot age warrants retention and recovery review. Age alone does not establish waste or deletion savings."),
    "rds_dev": ("rds", "Development RDS scheduling review", "An explicit environment tag identifies a non-production database. Savings require an approved workload schedule and are not yet quantified."),
}
NUMERIC_DETAILS = {
    "size_gib": 10 ** 9, "stored_bytes": 10 ** 18, "observation_days": 365,
    "cpu_max_percent": 100, "network_max_daily_bytes": 10 ** 18,
    "age_days": 365000,
}


def minimal_details(details: dict) -> dict:
    if not isinstance(details, dict):
        return {}
    clean = {}
    for key, maximum in NUMERIC_DETAILS.items():
        value = details.get(key)
        if type(value) in {int, float} and 0 <= value <= maximum:
            clean[key] = value
    if isinstance(details.get("volume_type"), str) and details["volume_type"] in {"gp2", "gp3", "io1", "io2", "sc1", "st1", "standard"}:
        clean["volume_type"] = details["volume_type"]
    instance_type = details.get("instance_type")
    if isinstance(instance_type, str) and re.fullmatch(r"[a-z][0-9][a-z0-9]{0,5}\.(nano|micro|small|medium|large|xlarge|[1-9][0-9]{0,2}xlarge|metal)", instance_type):
        clean["instance_type"] = instance_type
    return clean


def monetary_value(value) -> Decimal:
    try:
        amount = Decimal(str(value))
        if not amount.is_finite() or amount < 0 or amount != amount.quantize(Decimal("0.01")):
            raise ValueError("Savings must be finite nonnegative amounts in cents")
        return amount.quantize(Decimal("0.01"))
    except InvalidOperation:
        raise ValueError("Savings must be finite nonnegative amounts in cents")


def prepare_prompt(findings: list[dict], totals: dict) -> dict:
    clean = []
    ids = set()
    for finding in findings:
        identifier = finding["id"]
        if type(identifier) is not int or identifier <= 0 or identifier in ids:
            raise ValueError("Findings require unique positive integer IDs")
        ids.add(identifier)
        resource_type, title, description = RULE_TEXT.get(finding.get("rule_id"), (
            "resource", "Scanner finding", "A deterministic check found an issue. Review the linked finding.",
        ))
        resource_id = finding.get("resource_id", "")
        if not isinstance(resource_id, str) or not re.fullmatch(r"(?:vol|i|nat|eipalloc)-(?:[0-9a-f]{8}|[0-9a-f]{17})", resource_id):
            resource_id = f"resource-{identifier}"
        region = finding.get("region", "")
        if not isinstance(region, str) or not re.fullmatch(r"[a-z]{2}(?:-[a-z]+)+-[0-9]", region):
            region = "unknown"
        clean.append({
            "id": identifier, "resource_id": resource_id, "resource_type": resource_type, "region": region,
            "severity": finding.get("severity") if finding.get("severity") in {"high", "medium", "low"} else "unknown",
            "title": title, "description": description, "savings_monthly": str(monetary_value(finding["savings_monthly"])),
            "details": minimal_details(finding.get("details") or {}),
        })
    total = sum((Decimal(f["savings_monthly"]) for f in clean), Decimal("0.00"))
    if ("savings_monthly" in totals and monetary_value(totals["savings_monthly"]) != total
            or "findings_count" in totals and totals["findings_count"] != len(clean)):
        raise ValueError("Supplied totals do not match finding savings")
    skipped_count = totals.get("skipped_checks_count", 0)
    if type(skipped_count) is not int or skipped_count < 0:
        raise ValueError("Skipped checks count must be a nonnegative integer")
    aggregates = {"currency": "USD", "findings_count": len(clean), "savings_monthly": str(total),
                  "skipped_checks_count": skipped_count}
    for field in ("region", "severity", "resource_type"):
        groups = {}
        for finding in clean:
            group = groups.setdefault(finding[field], {"findings_count": 0, "savings_monthly": Decimal("0.00")})
            group["findings_count"] += 1
            group["savings_monthly"] += Decimal(finding["savings_monthly"])
        aggregates[f"by_{field}"] = {key: {**group, "savings_monthly": str(group["savings_monthly"])}
                                     for key, group in sorted(groups.items())}
    clean.sort(key=lambda finding: (-Decimal(finding["savings_monthly"]), finding["id"]))
    return {"totals": aggregates, "findings": clean[:20]}
