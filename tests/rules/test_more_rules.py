from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import Mock

from botocore.stub import Stubber
from freezegun import freeze_time

from app.rules import load_balancers, snapshots, rds_dev


def test_old_snapshots_need_review_but_do_not_claim_full_volume_savings(aws):
    ec2 = aws.client("ec2")
    volume = ec2.create_volume(AvailabilityZone="us-east-1a", Size=100, VolumeType="gp3")["VolumeId"]
    with freeze_time("2026-01-01"):
        old = ec2.create_snapshot(VolumeId=volume)["SnapshotId"]
    ec2.create_snapshot(VolumeId=volume)
    findings = snapshots.scan(aws, "us-east-1")
    assert [f.resource_id for f in findings] == [old]
    assert findings[0].savings_monthly == Decimal("0.00")
    assert "incremental" in findings[0].details["savings_note"]


def test_dev_rds_uses_explicit_environment_tag_not_identifier_guess(aws):
    client = aws.client("rds")
    client.create_db_instance(DBInstanceIdentifier="prod-named-dev", DBInstanceClass="db.t3.micro", Engine="postgres", AllocatedStorage=20)
    client.create_db_instance(DBInstanceIdentifier="explicit-dev", DBInstanceClass="db.t3.micro", Engine="postgres", AllocatedStorage=20,
                              Tags=[{"Key": "Environment", "Value": "dev"}])
    findings = rds_dev.scan(aws, "us-east-1")
    assert [f.resource_id for f in findings] == ["explicit-dev"]
    assert findings[0].savings_monthly == 0
    assert "schedule" in findings[0].details["savings_note"].lower()
    assert findings[0].tags is None


def lb_session(aws, monkeypatch, *, requests=None):
    real_client = aws.client
    elb = Mock()
    arn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/test/1234567890123456"
    elb.get_paginator.return_value.paginate.return_value = [{"LoadBalancers": [{
        "LoadBalancerArn": arn, "LoadBalancerName": "test", "Type": "application",
        "CreatedTime": datetime(2026, 9, 1, tzinfo=timezone.utc), "State": {"Code": "active"},
        "AvailabilityZones": [{"ZoneName": "us-east-1a"}, {"ZoneName": "us-east-1b"}],
    }]}]
    cw = Mock()
    cw.get_metric_statistics.return_value = {"Datapoints": requests or []}
    monkeypatch.setattr(aws, "client", lambda name, **kwargs: elb if name == "elbv2" else cw if name == "cloudwatch" else real_client(name, **kwargs))
    return elb, cw


def test_idle_load_balancer_never_infers_zero_from_missing_metrics(aws, monkeypatch):
    lb_session(aws, monkeypatch)
    result = load_balancers.scan(aws, "us-east-1")
    assert result == []
    assert result.skipped_checks[0].reason == "insufficient_metrics"


def test_idle_alb_from_complete_zero_request_metrics(aws, monkeypatch):
    points = [{"Timestamp": datetime.now(timezone.utc) - timedelta(days=day), "Sum": 0, "SampleCount": 288} for day in range(1, 15)]
    lb_session(aws, monkeypatch, requests=points)
    finding = load_balancers.scan(aws, "us-east-1")[0]
    assert finding.savings_monthly == Decimal("16.43")
    assert finding.details["savings_basis"] == "Base load balancer hours only; excludes capacity units and public IPv4."


def test_active_alb_not_flagged(aws, monkeypatch):
    points = [{"Timestamp": datetime.now(timezone.utc) - timedelta(days=day), "Sum": 10, "SampleCount": 288} for day in range(1, 15)]
    lb_session(aws, monkeypatch, requests=points)
    assert load_balancers.scan(aws, "us-east-1") == []


def test_network_load_balancer_requires_both_flow_and_byte_metrics(aws, monkeypatch):
    points = [{"Timestamp": datetime.now(timezone.utc) - timedelta(days=day), "Sum": 0, "SampleCount": 288} for day in range(1, 15)]
    elb, cloudwatch = lb_session(aws, monkeypatch, requests=points)
    elb.get_paginator.return_value.paginate.return_value[0]["LoadBalancers"][0]["Type"] = "network"
    assert load_balancers.scan(aws, "us-east-1")[0].savings_monthly == Decimal("16.43")
    assert {call.kwargs["MetricName"] for call in cloudwatch.get_metric_statistics.call_args_list} == {"NewFlowCount", "ProcessedBytes"}


def test_unsupported_or_new_load_balancers_are_explicitly_skipped(aws, monkeypatch):
    elb, _ = lb_session(aws, monkeypatch)
    record = elb.get_paginator.return_value.paginate.return_value[0]["LoadBalancers"][0]
    record["Type"] = "gateway"
    assert load_balancers.scan(aws, "us-east-1").skipped_checks[0].reason == "unsupported_resource"
    record["Type"] = "application"
    record["CreatedTime"] = datetime.now(timezone.utc)
    assert load_balancers.scan(aws, "us-east-1").skipped_checks[0].reason == "resource_too_new"


def test_snapshot_pagination_keeps_owner_filter(aws, monkeypatch):
    client = aws.client("ec2")
    with Stubber(client) as stub:
        stub.add_response("describe_snapshots", {"Snapshots": [], "NextToken": "next"}, {"OwnerIds": ["self"]})
        stub.add_response("describe_snapshots", {"Snapshots": [{"SnapshotId": "snap-old", "State": "completed",
                           "StartTime": datetime(2026, 1, 1, tzinfo=timezone.utc)}]}, {"OwnerIds": ["self"], "NextToken": "next"})
        monkeypatch.setattr(aws, "client", lambda *args, **kwargs: client)
        assert snapshots.scan(aws, "us-east-1")[0].resource_id == "snap-old"
        stub.assert_no_pending_responses()


def test_conflicting_rds_environment_tags_are_not_treated_as_dev(aws):
    aws.client("rds").create_db_instance(DBInstanceIdentifier="conflicting-tags", DBInstanceClass="db.t3.micro", Engine="postgres", AllocatedStorage=20,
                                        Tags=[{"Key": "Environment", "Value": "dev"}, {"Key": "env", "Value": "production"}])
    assert rds_dev.scan(aws, "us-east-1") == []
