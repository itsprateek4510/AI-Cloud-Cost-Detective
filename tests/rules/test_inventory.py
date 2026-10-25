from decimal import Decimal

from botocore.stub import Stubber

from app.aws.regions import list_enabled_regions
from app.rules import ebs, eip, logs


def test_unattached_ebs_only_and_sanitized_details(aws, old_instance):
    ec2 = aws.client("ec2")
    loose = ec2.create_volume(AvailabilityZone="us-east-1a", Size=100, VolumeType="gp3")["VolumeId"]
    attached = ec2.create_volume(AvailabilityZone="us-east-1a", Size=10, VolumeType="gp3")["VolumeId"]
    ec2.attach_volume(VolumeId=attached, InstanceId=old_instance, Device="/dev/sdf")
    ec2.create_tags(Resources=[loose], Tags=[{"Key": "secret", "Value": "do not send to AI"}])
    findings = ebs.scan(aws, "us-east-1")
    assert [item.resource_id for item in findings] == [loose]
    assert findings[0].savings_monthly == Decimal("8.00")
    assert "secret" not in str(findings[0].model_dump())
    assert "arn:" not in str(findings[0].details)
    assert findings[0].account_id is None


def test_unknown_ebs_price_still_produces_finding(aws):
    aws.client("ec2").create_volume(AvailabilityZone="us-east-1a", Size=100, VolumeType="io2", Iops=100)
    finding = ebs.scan(aws, "us-east-1")[0]
    assert finding.savings_monthly == Decimal("0.00")
    assert "unknown" in finding.details["pricing_note"].lower()


def test_only_unassociated_eip_is_flagged(aws, old_instance):
    ec2 = aws.client("ec2")
    unused = ec2.allocate_address(Domain="vpc")
    used = ec2.allocate_address(Domain="vpc")
    ec2.associate_address(AllocationId=used["AllocationId"], InstanceId=old_instance)
    findings = eip.scan(aws, "us-east-1")
    assert [finding.resource_id for finding in findings] == [unused["AllocationId"]]
    assert findings[0].savings_monthly == Decimal("3.65")
    assert unused["PublicIp"] not in str(findings[0].details)


def test_logs_without_retention_do_not_claim_unproven_savings(aws):
    client = aws.client("logs")
    client.create_log_group(logGroupName="no-retention")
    client.create_log_group(logGroupName="retained")
    client.put_retention_policy(logGroupName="retained", retentionInDays=14)
    findings = logs.scan(aws, "us-east-1")
    assert [finding.resource_id for finding in findings] == ["no-retention"]
    assert findings[0].savings_monthly == Decimal("0.00")
    assert "retention" in findings[0].details["savings_note"].lower()


def test_logs_pagination_is_exhausted(aws, monkeypatch):
    client = aws.client("logs")
    with Stubber(client) as stub:
        stub.add_response("describe_log_groups", {"logGroups": [{"logGroupName": "first"}], "nextToken": "next"}, {})
        stub.add_response("describe_log_groups", {"logGroups": [{"logGroupName": "second"}]}, {"nextToken": "next"})
        monkeypatch.setattr(aws, "client", lambda *args, **kwargs: client)
        assert [f.resource_id for f in logs.scan(aws, "us-east-1")] == ["first", "second"]
        stub.assert_no_pending_responses()


def test_regions_are_enabled_sorted_and_unique(aws, monkeypatch):
    client = aws.client("ec2")
    with Stubber(client) as stub:
        stub.add_response("describe_regions", {"Regions": [
            {"RegionName": "us-west-2", "OptInStatus": "opt-in-not-required"},
            {"RegionName": "us-east-1", "OptInStatus": "opted-in"},
            {"RegionName": "ap-east-1", "OptInStatus": "not-opted-in"},
        ]}, {"AllRegions": False})
        monkeypatch.setattr(aws, "client", lambda *args, **kwargs: client)
        assert list_enabled_regions(aws) == ["us-east-1", "us-west-2"]


def test_empty_inventory(aws):
    assert ebs.scan(aws, "us-east-1") == []
    assert eip.scan(aws, "us-east-1") == []
    assert logs.scan(aws, "us-east-1") == []


def test_ebs_pagination(aws, monkeypatch):
    client = aws.client("ec2")
    with Stubber(client) as stub:
        volume = {"VolumeId": "vol-first", "State": "available", "Size": 10, "VolumeType": "gp3"}
        stub.add_response("describe_volumes", {"Volumes": [volume], "NextToken": "next"}, {})
        stub.add_response("describe_volumes", {"Volumes": [volume | {"VolumeId": "vol-second"}]}, {"NextToken": "next"})
        monkeypatch.setattr(aws, "client", lambda *args, **kwargs: client)
        assert [f.resource_id for f in ebs.scan(aws, "us-east-1")] == ["vol-first", "vol-second"]


def test_byoip_does_not_use_amazon_ipv4_price(aws, monkeypatch):
    client = aws.client("ec2")
    with Stubber(client) as stub:
        stub.add_response("describe_addresses", {"Addresses": [{
            "AllocationId": "eipalloc-test", "PublicIpv4Pool": "ipv4pool-ec2-byoip", "Domain": "vpc",
        }]}, {})
        monkeypatch.setattr(aws, "client", lambda *args, **kwargs: client)
        finding = eip.scan(aws, "us-east-1")[0]
        assert finding.savings_monthly == 0
        assert "unknown" in finding.details["pricing_note"].lower()


def test_unrecognized_region_does_not_use_us_east_prices(aws):
    aws.client("ec2", region_name="us-west-2").create_volume(AvailabilityZone="us-west-2a", Size=100, VolumeType="gp3")
    finding = ebs.scan(aws, "us-west-2")[0]
    assert finding.savings_monthly == 0
    assert "unknown" in finding.details["pricing_note"].lower()
