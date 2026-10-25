from pathlib import Path

import yaml


def test_customer_role_trust_requires_external_id_and_only_read_permissions():
    template = yaml.safe_load(Path("infra/customer-role.yaml").read_text())
    role = template["Resources"]["CustomerReadOnlyRole"]["Properties"]
    trust = role["AssumeRolePolicyDocument"]["Statement"][0]
    assert trust["Action"] == "sts:AssumeRole"
    assert trust["Principal"]["AWS"] == {"Ref": "TrustedPrincipalArn"}
    assert trust["Condition"]["StringEquals"]["sts:ExternalId"] == {"Ref": "ExternalId"}
    actions = role["Policies"][0]["PolicyDocument"]["Statement"][0]["Action"]
    assert set(actions) == {
        "ec2:Describe*", "rds:Describe*", "rds:ListTagsForResource", "elasticloadbalancing:Describe*",
        "cloudwatch:GetMetricData", "cloudwatch:GetMetricStatistics", "logs:DescribeLogGroups",
        "ce:GetCostAndUsage", "s3:GetBucketPublicAccessBlock", "s3:GetBucketPolicyStatus", "s3:ListAllMyBuckets",
    }
    assert "ManagedPolicyArns" not in role


def test_compose_has_dependencies_health_checks_and_migration_startup():
    services = yaml.safe_load(Path("docker-compose.yml").read_text())["services"]
    assert set(services) == {"postgres", "redis", "api", "worker", "frontend"}
    assert services["postgres"]["healthcheck"]
    assert services["redis"]["healthcheck"]
    assert services["api"]["depends_on"]["postgres"]["condition"] == "service_healthy"
    assert "alembic upgrade head" in services["api"]["command"]
    assert services["worker"]["command"] == "arq app.workers.scan_job.WorkerSettings"
    assert services["worker"]["depends_on"]["api"]["condition"] == "service_healthy"
