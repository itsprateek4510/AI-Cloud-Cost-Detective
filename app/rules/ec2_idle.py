from decimal import Decimal

import boto3

from app.aws.pricing import estimate_monthly
from app.aws.session import AWS_CONFIG
from app.rules.base import Finding, RuleFindings
from app.rules.metrics import DAILY_TRAFFIC_LIMIT, OBSERVATION_DAYS, daily_metric, observation_window

RULE_ID = "ec2_idle"


def scan(session: boto3.Session, region: str) -> list[Finding]:
    ec2 = session.client("ec2", region_name=region, config=AWS_CONFIG)
    cloudwatch = session.client("cloudwatch", region_name=region, config=AWS_CONFIG)
    start, end = observation_window()
    findings = RuleFindings()
    for page in ec2.get_paginator("describe_instances").paginate(Filters=[{"Name": "instance-state-name", "Values": ["running"]}]):
        for reservation in page["Reservations"]:
            for instance in reservation["Instances"]:
                if instance["State"]["Name"] != "running":
                    continue
                resource_id = instance["InstanceId"]
                if not instance.get("LaunchTime") or instance["LaunchTime"] > start:
                    findings.skip(RULE_ID, region, resource_id, "resource_too_new",
                                  "The current instance run does not cover the full 14-day observation window.")
                    continue
                data = [daily_metric(cloudwatch, "AWS/EC2", name, "InstanceId", resource_id, stat, start, end)
                        for name, stat in (("CPUUtilization", "Maximum"), ("NetworkIn", "Sum"), ("NetworkOut", "Sum"))]
                if any(values is None for values in data):
                    findings.skip(RULE_ID, region, resource_id, "insufficient_metrics",
                                  "CPU maximum and network sums need at least 288 samples per metric per day for all 14 days.")
                    continue
                cpu, incoming, outgoing = data
                daily_traffic = [left + right for left, right in zip(incoming, outgoing)]
                if max(cpu) > 1 or max(daily_traffic) > DAILY_TRAFFIC_LIMIT:
                    continue
                price = estimate_monthly(region, "ec2", variant=instance["InstanceType"])
                # Linux/shared/on-demand table rates must not be applied to other billing models.
                supported_billing = (
                    instance.get("PlatformDetails", "Linux/UNIX") == "Linux/UNIX"
                    and not instance.get("Platform")
                    and instance.get("Placement", {}).get("Tenancy", "default") == "default"
                    and not instance.get("InstanceLifecycle")
                )
                findings.append(Finding(
                    rule_id=RULE_ID, resource_id=resource_id, resource_type="ec2", region=region, severity="medium",
                    title="Potentially idle EC2 instance",
                    description="CPU stayed at or below 1% and combined network traffic at or below 1 MiB per day for 14 full days. Review workload before stopping.",
                    savings_monthly=price.amount if supported_billing else Decimal("0.00"),
                    details={"instance_type": instance["InstanceType"], "observation_days": OBSERVATION_DAYS,
                             "window_start": start.isoformat(), "window_end": end.isoformat(),
                             "cpu_max_percent": max(cpu), "network_max_daily_bytes": max(daily_traffic),
                             "pricing_note": price.note if supported_billing else "Unknown price for this platform, tenancy or lifecycle; no savings claimed."},
                ))
    return findings
