from decimal import Decimal
from unittest.mock import Mock

import pytest
from botocore.stub import Stubber

from app.rules import ec2_idle, nat


def test_idle_t3_micro_detected_with_complete_metrics(aws, old_instance, put_metrics):
    put_metrics(old_instance)
    findings = ec2_idle.scan(aws, "us-east-1")
    assert [finding.resource_id for finding in findings] == [old_instance]
    assert findings[0].savings_monthly == Decimal("7.59")
    assert findings[0].details["observation_days"] == 14


@pytest.mark.parametrize("cpu, traffic", [(10, 0), (0.5, 2 * 1024 * 1024)])
def test_active_ec2_not_flagged(aws, old_instance, put_metrics, cpu, traffic):
    put_metrics(old_instance, cpu=cpu, traffic=traffic)
    assert ec2_idle.scan(aws, "us-east-1") == []


@pytest.mark.parametrize("options", [{"days": 13}, {"omit": "NetworkOut"}, {"omit": "CPUUtilization"}])
def test_missing_ec2_metrics_skip_with_reason(aws, old_instance, put_metrics, options):
    put_metrics(old_instance, **options)
    findings = ec2_idle.scan(aws, "us-east-1")
    assert findings == []
    assert findings.skipped_checks[0].resource_id == old_instance
    assert findings.skipped_checks[0].reason == "insufficient_metrics"


def test_new_ec2_is_not_treated_as_idle(aws, put_metrics):
    instance_id = aws.client("ec2").run_instances(
        ImageId="ami-test", InstanceType="t3.micro", MinCount=1, MaxCount=1,
    )["Instances"][0]["InstanceId"]
    put_metrics(instance_id)
    findings = ec2_idle.scan(aws, "us-east-1")
    assert findings == []
    assert findings.skipped_checks[0].reason == "resource_too_new"


def test_sparse_ec2_metrics_do_not_claim_idle(aws, old_instance, put_metrics):
    put_metrics(old_instance, samples=1)
    findings = ec2_idle.scan(aws, "us-east-1")
    assert findings == []
    assert findings.skipped_checks[0].reason == "insufficient_metrics"


def test_stopped_instance_not_flagged(aws, old_instance, put_metrics):
    put_metrics(old_instance)
    aws.client("ec2").stop_instances(InstanceIds=[old_instance])
    assert ec2_idle.scan(aws, "us-east-1") == []


def test_unknown_ec2_type_still_reports_zero_savings(aws, put_metrics):
    from freezegun import freeze_time

    with freeze_time("2026-09-01"):
        instance_id = aws.client("ec2").run_instances(
            ImageId="ami-test", InstanceType="m5.large", MinCount=1, MaxCount=1,
        )["Instances"][0]["InstanceId"]
    put_metrics(instance_id)
    finding = ec2_idle.scan(aws, "us-east-1")[0]
    assert finding.savings_monthly == 0
    assert "unknown" in finding.details["pricing_note"].lower()


@pytest.fixture
def old_nat(aws):
    from freezegun import freeze_time

    ec2 = aws.client("ec2")
    vpc_id = ec2.create_vpc(CidrBlock="10.0.0.0/16")["Vpc"]["VpcId"]
    subnet_id = ec2.create_subnet(VpcId=vpc_id, CidrBlock="10.0.0.0/24")["Subnet"]["SubnetId"]
    allocation_id = ec2.allocate_address(Domain="vpc")["AllocationId"]
    with freeze_time("2026-09-01"):
        return ec2.create_nat_gateway(SubnetId=subnet_id, AllocationId=allocation_id)["NatGateway"]["NatGatewayId"]


def test_idle_nat_gateway(aws, old_nat, put_metrics):
    put_metrics(old_nat, nat=True)
    findings = nat.scan(aws, "us-east-1")
    assert [finding.resource_id for finding in findings] == [old_nat]
    assert findings[0].savings_monthly == Decimal("32.85")


def test_busy_nat_not_flagged(aws, old_nat, put_metrics):
    put_metrics(old_nat, nat=True, traffic=2 * 1024 * 1024)
    assert nat.scan(aws, "us-east-1") == []


def test_nat_missing_metrics_skip(aws, old_nat, put_metrics):
    put_metrics(old_nat, nat=True, omit="BytesInFromDestination")
    findings = nat.scan(aws, "us-east-1")
    assert findings == []
    assert findings.skipped_checks[0].reason == "insufficient_metrics"


@pytest.mark.parametrize("changes", [
    {"Platform": "windows"}, {"PlatformDetails": "Windows"}, {"InstanceLifecycle": "spot"},
    {"Placement": {"Tenancy": "dedicated"}},
])
def test_unsupported_ec2_billing_never_uses_linux_on_demand_price(aws, old_instance, put_metrics, monkeypatch, changes):
    put_metrics(old_instance)
    real_client = aws.client
    ec2 = real_client("ec2")
    instance = ec2.describe_instances(InstanceIds=[old_instance])["Reservations"][0]["Instances"][0] | changes
    mock_ec2 = Mock()
    mock_ec2.get_paginator.return_value.paginate.return_value = [{"Reservations": [{"Instances": [instance]}]}]
    monkeypatch.setattr(aws, "client", lambda name, **kwargs: mock_ec2 if name == "ec2" else real_client(name, **kwargs))
    finding = ec2_idle.scan(aws, "us-east-1")[0]
    assert finding.savings_monthly == 0
    assert "unknown" in finding.details["pricing_note"].lower()


def test_new_nat_gateway_is_skipped(aws, old_nat, monkeypatch):
    from datetime import datetime, timezone

    real_client = aws.client
    client = Mock()
    client.get_paginator.return_value.paginate.return_value = [{"NatGateways": [{
        "NatGatewayId": old_nat, "State": "available", "CreateTime": datetime.now(timezone.utc),
    }]}]
    monkeypatch.setattr(aws, "client", lambda name, **kwargs: client if name == "ec2" else real_client(name, **kwargs))
    findings = nat.scan(aws, "us-east-1")
    assert findings == []
    assert findings.skipped_checks[0].reason == "resource_too_new"


def test_deleted_nat_gateway_is_not_flagged(aws, old_nat, put_metrics):
    put_metrics(old_nat, nat=True)
    aws.client("ec2").delete_nat_gateway(NatGatewayId=old_nat)
    assert nat.scan(aws, "us-east-1") == []


def test_ec2_pagination_finds_later_page(aws, old_instance, put_metrics, monkeypatch):
    put_metrics(old_instance)
    real_client = aws.client
    client = real_client("ec2")
    reservation = client.describe_instances(InstanceIds=[old_instance])["Reservations"][0]
    filters = [{"Name": "instance-state-name", "Values": ["running"]}]
    with Stubber(client) as stub:
        stub.add_response("describe_instances", {"Reservations": [], "NextToken": "next"}, {"Filters": filters})
        stub.add_response("describe_instances", {"Reservations": [reservation]}, {"Filters": filters, "NextToken": "next"})
        monkeypatch.setattr(aws, "client", lambda name, **kwargs: client if name == "ec2" else real_client(name, **kwargs))
        assert ec2_idle.scan(aws, "us-east-1")[0].resource_id == old_instance
        stub.assert_no_pending_responses()


def test_nat_pagination_finds_later_page(aws, old_nat, put_metrics, monkeypatch):
    put_metrics(old_nat, nat=True)
    real_client = aws.client
    client = real_client("ec2")
    gateway = client.describe_nat_gateways(NatGatewayIds=[old_nat])["NatGateways"][0]
    with Stubber(client) as stub:
        stub.add_response("describe_nat_gateways", {"NatGateways": [], "NextToken": "next"}, {})
        stub.add_response("describe_nat_gateways", {"NatGateways": [gateway]}, {"NextToken": "next"})
        monkeypatch.setattr(aws, "client", lambda name, **kwargs: client if name == "ec2" else real_client(name, **kwargs))
        assert nat.scan(aws, "us-east-1")[0].resource_id == old_nat
        stub.assert_no_pending_responses()
