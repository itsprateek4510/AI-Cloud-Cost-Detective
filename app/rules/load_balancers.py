from app.aws.pricing import estimate_monthly
from app.aws.session import AWS_CONFIG
from app.rules.base import Finding, RuleFindings
from app.rules.metrics import daily_metric, observation_window

RULE_ID = "load_balancer_idle"


def scan(session, region: str) -> list[Finding]:
    findings = RuleFindings()
    cloudwatch = session.client("cloudwatch", region_name=region, config=AWS_CONFIG)
    start, end = observation_window()
    for api in ("elbv2", "elb"):
        client = session.client(api, region_name=region, config=AWS_CONFIG)
        for page in client.get_paginator("describe_load_balancers").paginate():
            for lb in page.get("LoadBalancers", page.get("LoadBalancerDescriptions", [])):
                kind = lb.get("Type", "classic")
                resource_id = lb["LoadBalancerArn"].split(":loadbalancer/")[1] if api == "elbv2" else lb["LoadBalancerName"]
                if api == "elbv2" and lb.get("State", {}).get("Code") != "active":
                    continue
                if kind not in {"application", "network", "classic"}:
                    findings.skip(RULE_ID, region, resource_id, "unsupported_resource", "This load balancer type has no supported idle/pricing check.")
                    continue
                if not lb.get("CreatedTime") or lb["CreatedTime"] > start:
                    findings.skip(RULE_ID, region, resource_id, "resource_too_new", "Load balancer does not cover the full observation window.")
                    continue
                namespace = {"application": "AWS/ApplicationELB", "network": "AWS/NetworkELB", "classic": "AWS/ELB"}[kind]
                dimension = "LoadBalancerName" if kind == "classic" else "LoadBalancer"
                metrics = ["NewFlowCount", "ProcessedBytes"] if kind == "network" else ["RequestCount"]
                values = [daily_metric(cloudwatch, namespace, name, dimension, resource_id, "Sum", start, end) for name in metrics]
                if any(value is None for value in values):
                    findings.skip(RULE_ID, region, resource_id, "insufficient_metrics", "Complete daily request/flow metrics are required; missing data is not zero traffic.")
                    continue
                if any(any(amount > 0 for amount in value) for value in values):
                    continue
                price = estimate_monthly(region, "load_balancer", variant=kind)
                findings.append(Finding(
                    rule_id=RULE_ID, resource_id=resource_id, resource_type="load_balancer", region=region, severity="medium",
                    title="Potentially idle load balancer", description="No requests or flows were observed across a complete observation window. Verify DNS, failover and network dependencies before removing this load balancer.",
                    savings_monthly=price.amount,
                    details={"observation_days": 14, "load_balancer_type": kind, "pricing_note": price.note,
                             "savings_basis": "Base load balancer hours only; excludes capacity units and public IPv4."},
                ))
    return findings
