import boto3

from app.aws.pricing import estimate_monthly
from app.aws.session import AWS_CONFIG
from app.rules.base import Finding, RuleFindings
from app.rules.metrics import DAILY_TRAFFIC_LIMIT, OBSERVATION_DAYS, daily_metric, observation_window

RULE_ID = "nat_idle"


def scan(session: boto3.Session, region: str) -> list[Finding]:
    ec2 = session.client("ec2", region_name=region, config=AWS_CONFIG)
    cloudwatch = session.client("cloudwatch", region_name=region, config=AWS_CONFIG)
    start, end = observation_window()
    findings = RuleFindings()
    for page in ec2.get_paginator("describe_nat_gateways").paginate():
        for gateway in page["NatGateways"]:
            if gateway["State"] != "available":
                continue
            resource_id = gateway["NatGatewayId"]
            if not gateway.get("CreateTime") or gateway["CreateTime"] > start:
                findings.skip(RULE_ID, region, resource_id, "resource_too_new",
                              "Gateway age does not cover the full 14-day observation window.")
                continue
            data = [daily_metric(cloudwatch, "AWS/NATGateway", name, "NatGatewayId", resource_id, "Sum", start, end)
                    for name in ("BytesInFromSource", "BytesInFromDestination")]
            if any(values is None for values in data):
                findings.skip(RULE_ID, region, resource_id, "insufficient_metrics",
                              "Both traffic directions need at least 288 samples per metric per day for all 14 days.")
                continue
            daily_traffic = [left + right for left, right in zip(*data)]
            if max(daily_traffic) > DAILY_TRAFFIC_LIMIT:
                continue
            price = estimate_monthly(region, "nat")
            findings.append(Finding(
                rule_id=RULE_ID, resource_id=resource_id, resource_type="nat", region=region, severity="medium",
                title="Potentially idle NAT Gateway",
                description="Combined inbound traffic stayed at or below 1 MiB per day for 14 full days. Verify private-subnet egress dependencies before removing.",
                savings_monthly=price.amount,
                details={"observation_days": OBSERVATION_DAYS, "network_max_daily_bytes": max(daily_traffic),
                         "window_start": start.isoformat(), "window_end": end.isoformat(),
                         "pricing_note": price.note, "savings_basis": "Gateway hourly charge only; excludes data processing and public IPv4 charges."},
            ))
    return findings
