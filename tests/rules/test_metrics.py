from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

import pytest
from pydantic import ValidationError

from app.rules.base import Finding
from app.rules.metrics import daily_metric


def test_daily_metric_orders_buckets_and_ignores_outside_window():
    start = datetime(2026, 10, 1, tzinfo=timezone.utc)
    end = start + timedelta(days=2)
    client = Mock()
    client.get_metric_statistics.return_value = {"Datapoints": [
        {"Timestamp": start + timedelta(days=1), "Sum": 2, "SampleCount": 288},
        {"Timestamp": start - timedelta(days=1), "Sum": 99},
        {"Timestamp": start, "Sum": 1, "SampleCount": 288}, {"Timestamp": end, "Sum": 99},
    ]}
    assert daily_metric(client, "AWS/EC2", "NetworkIn", "InstanceId", "i-test", "Sum", start, end) == [1, 2]


@pytest.mark.parametrize("values", [[0], [0, 0, 0], [0, -1], [0, float("nan")], [0, float("inf")], [0, None]])
def test_incomplete_duplicate_or_invalid_metrics_are_not_idle_evidence(values):
    start = datetime(2026, 10, 1, tzinfo=timezone.utc)
    client = Mock()
    client.get_metric_statistics.return_value = {"Datapoints": [
        {"Timestamp": start + timedelta(days=day % 2), "Sum": value, "SampleCount": 288} for day, value in enumerate(values)
    ]}
    assert daily_metric(client, "AWS/EC2", "NetworkIn", "InstanceId", "i-test", "Sum", start, start + timedelta(days=2)) is None


@pytest.mark.parametrize("savings", ["-1.00", "1.001", "NaN", "Infinity"])
def test_finding_rejects_invalid_money(savings):
    with pytest.raises(ValidationError):
        Finding(rule_id="test", resource_id="test", resource_type="test", region="us-east-1",
                severity="low", title="Test", description="Test", savings_monthly=savings)


def test_finding_rejects_raw_nested_aws_data_in_details():
    with pytest.raises(ValidationError):
        Finding(rule_id="test", resource_id="test", resource_type="test", region="us-east-1",
                severity="low", title="Test", description="Test", details={"raw": {"arn": "secret"}})
