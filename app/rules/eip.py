from decimal import Decimal

import boto3

from app.aws.pricing import estimate_monthly
from app.aws.session import AWS_CONFIG
from app.rules.base import Finding

RULE_ID = "eip_unused"


def scan(session: boto3.Session, region: str) -> list[Finding]:
    client = session.client("ec2", region_name=region, config=AWS_CONFIG)
    findings = []
    # DescribeAddresses has no pagination API.
    for address in client.describe_addresses()["Addresses"]:
        if any(address.get(key) for key in ("AssociationId", "InstanceId", "NetworkInterfaceId")):
            continue
        if not address.get("AllocationId"):
            continue
        price = estimate_monthly(region, "eip")
        amazon_owned = address.get("PublicIpv4Pool", "amazon") == "amazon" and not address.get("CustomerOwnedIp")
        findings.append(Finding(
            rule_id=RULE_ID, resource_id=address["AllocationId"], resource_type="eip", region=region,
            severity="medium", title="Unassociated Elastic IP",
            description="This allocated public IPv4 address is not associated. Release it only after checking dependencies.",
            savings_monthly=price.amount if amazon_owned else Decimal("0.00"),
            details={"pricing_note": price.note if amazon_owned else "Unknown charge for a customer-owned IPv4 pool; no savings claimed."},
        ))
    return findings
