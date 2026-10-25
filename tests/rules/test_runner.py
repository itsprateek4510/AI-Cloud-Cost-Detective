from decimal import Decimal
from threading import Barrier, Lock
from types import SimpleNamespace
from unittest.mock import Mock

from botocore.exceptions import ClientError, EndpointConnectionError
import pytest

from app.rules.base import Finding
from app.rules.runner import run_scan
from app.rules import runner


def test_planted_waste_exactly_detected(aws, old_instance, put_metrics):
    ec2 = aws.client("ec2")
    volume = ec2.create_volume(AvailabilityZone="us-east-1a", Size=100, VolumeType="gp3")["VolumeId"]
    address = ec2.allocate_address(Domain="vpc")["AllocationId"]
    put_metrics(old_instance)
    result = run_scan(aws, regions=["us-east-1"])
    assert {(f.rule_id, f.resource_id) for f in result.findings} == {
        ("ebs_unattached", volume), ("eip_unused", address), ("ec2_idle", old_instance),
    }
    assert result.savings_monthly == Decimal("19.24")
    assert result.savings_monthly == sum(f.savings_monthly for f in result.findings)
    assert result.skipped_checks == []


def test_access_denied_does_not_stop_other_rules_or_regions(aws):
    def denied(session, region):
        raise ClientError({"Error": {"Code": "AccessDenied", "Message": "secret AWS detail"}}, "DescribeVolumes")

    def good(session, region):
        return [Finding(rule_id="good", resource_id="vol-test", resource_type="ebs", region=region,
                        severity="low", title="Test", description="Test", savings_monthly=Decimal("0.10"))]

    result = run_scan(aws, regions=["us-east-1", "us-west-2"], rules=[
        SimpleNamespace(RULE_ID="denied", scan=denied), SimpleNamespace(RULE_ID="good", scan=good),
    ])
    assert len(result.findings) == 2
    assert len(result.skipped_checks) == 2
    assert all(skip.reason == "access_denied" for skip in result.skipped_checks)
    assert "secret AWS detail" not in result.model_dump_json()
    assert result.savings_monthly == Decimal("0.20")


def test_regions_run_concurrently_with_independent_sessions(aws):
    barrier = Barrier(2, timeout=5)
    seen = []
    lock = Lock()

    def scan(session, region):
        with lock:
            seen.append(session)
        barrier.wait()
        return []

    result = run_scan(aws, regions=["us-east-1", "us-west-2"], max_workers=2,
                      rules=[SimpleNamespace(RULE_ID="parallel", scan=scan)])
    assert result.findings == []
    assert len(seen) == 2
    assert seen[0] is not seen[1]
    assert aws not in seen


def test_missing_metrics_are_in_scan_skips(aws, old_instance):
    result = run_scan(aws, regions=["us-east-1"])
    assert result.findings == []
    assert result.skipped_checks[0].resource_id == old_instance
    assert result.skipped_checks[0].reason == "insufficient_metrics"


def test_aws_connection_failure_recorded_safely(aws):
    def unavailable(session, region):
        raise EndpointConnectionError(endpoint_url="https://example.com/sensitive")

    result = run_scan(aws, regions=["us-east-1"], rules=[SimpleNamespace(RULE_ID="unavailable", scan=unavailable)])
    assert result.skipped_checks[0].reason == "aws_error"
    assert "sensitive" not in result.model_dump_json()


def test_explicit_empty_regions_does_not_discover_or_scan(aws):
    result = run_scan(aws, regions=[])
    assert result.findings == []
    assert result.savings_monthly == Decimal("0.00")


@pytest.mark.parametrize("code", ["AccessDeniedException", "UnauthorizedOperation", "AuthorizationError", "Throttling"])
def test_aws_error_classification(aws, code):
    def error(session, region):
        raise ClientError({"Error": {"Code": code}}, "DescribeVolumes")

    result = run_scan(aws, regions=["us-east-1"], rules=[SimpleNamespace(RULE_ID="error", scan=error)])
    assert result.skipped_checks[0].reason == ("aws_error" if code == "Throttling" else "access_denied")


def test_discovery_error_reported(aws, monkeypatch):
    monkeypatch.setattr(runner, "list_enabled_regions", Mock(side_effect=ClientError(
        {"Error": {"Code": "AccessDenied"}}, "DescribeRegions",
    )))
    result = run_scan(aws)
    assert result.skipped_checks[0].rule_id == "region_discovery"
    assert result.skipped_checks[0].reason == "access_denied"


def test_missing_app_credentials_reported(aws, monkeypatch):
    monkeypatch.setattr(aws, "get_credentials", lambda: None)
    result = run_scan(aws, regions=["us-east-1"])
    assert result.skipped_checks[0].rule_id == "aws_session"
    assert result.skipped_checks[0].reason == "aws_error"


def test_default_discovery_and_region_deduplication(aws, monkeypatch):
    discover = Mock(return_value=["us-east-1", "us-east-1"])
    scan = Mock(return_value=[])
    monkeypatch.setattr(runner, "list_enabled_regions", discover)
    run_scan(aws, rules=[SimpleNamespace(RULE_ID="test", scan=scan)])
    discover.assert_called_once_with(aws)
    scan.assert_called_once()


def test_invalid_worker_count_rejected(aws):
    with pytest.raises(ValueError):
        run_scan(aws, regions=[], max_workers=0)


def test_programming_errors_are_not_hidden_as_skipped_checks(aws):
    def broken(session, region):
        raise ValueError("bug")

    with pytest.raises(ValueError, match="bug"):
        run_scan(aws, regions=["us-east-1"], rules=[SimpleNamespace(RULE_ID="broken", scan=broken)])


def test_real_rules_are_region_scoped_when_run_in_parallel(aws):
    resources = {}
    for region in ("us-east-1", "us-west-2"):
        resources[region] = aws.client("ec2", region_name=region).create_volume(
            AvailabilityZone=f"{region}a", Size=100, VolumeType="gp3",
        )["VolumeId"]
    result = run_scan(aws, regions=list(resources), max_workers=2)
    assert {(finding.region, finding.resource_id) for finding in result.findings} == set(resources.items())
    assert result.savings_monthly == Decimal("8.00")
    assert result.skipped_checks == []


def test_progress_callback_reports_completed_regions(aws):
    progress = Mock()
    run_scan(aws, regions=["us-east-1", "us-west-2"], rules=[], on_region_complete=progress)
    assert [call.args for call in progress.call_args_list] == [(1, 2), (2, 2)]
