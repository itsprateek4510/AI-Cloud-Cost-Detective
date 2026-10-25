import boto3

from app.aws.pricing import estimate_monthly
from app.aws.session import AWS_CONFIG
from app.rules.base import Finding

RULE_ID = "ebs_unattached"


def scan(session: boto3.Session, region: str) -> list[Finding]:
    client = session.client("ec2", region_name=region, config=AWS_CONFIG)
    findings = []
    for page in client.get_paginator("describe_volumes").paginate():
        for volume in page["Volumes"]:
            if volume["State"] != "available" or volume.get("Attachments"):
                continue
            price = estimate_monthly(region, "ebs", variant=volume["VolumeType"], quantity=volume["Size"])
            findings.append(Finding(
                rule_id=RULE_ID, resource_id=volume["VolumeId"], resource_type="ebs", region=region,
                severity="medium", title="Unattached EBS volume",
                description="This available volume is not attached. Review ownership and snapshot requirements before deletion.",
                savings_monthly=price.amount,
                details={"size_gib": volume["Size"], "volume_type": volume["VolumeType"], "pricing_note": price.note},
            ))
    return findings
