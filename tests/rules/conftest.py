from datetime import datetime, timedelta, timezone

import boto3
from freezegun import freeze_time
from moto import mock_aws
import pytest


@pytest.fixture
def aws():
    with mock_aws(), freeze_time("2026-10-25 00:00:00", real_asyncio=True):
        yield boto3.Session(region_name="us-east-1")


@pytest.fixture
def old_instance(aws):
    with freeze_time("2026-09-01 00:00:00"):
        return aws.client("ec2").run_instances(
            ImageId="ami-test", InstanceType="t3.micro", MinCount=1, MaxCount=1,
        )["Instances"][0]["InstanceId"]


@pytest.fixture
def put_metrics(aws):
    def put(resource_id, *, nat=False, cpu=0.5, traffic=0, days=14, omit=None, samples=288):
        namespace = "AWS/NATGateway" if nat else "AWS/EC2"
        names = {"BytesInFromSource": traffic, "BytesInFromDestination": traffic} if nat else {
            "CPUUtilization": cpu, "NetworkIn": traffic, "NetworkOut": traffic,
        }
        for name, value in names.items():
            if name == omit:
                continue
            data = [{
                "MetricName": name,
                "Dimensions": [{"Name": "NatGatewayId" if nat else "InstanceId", "Value": resource_id}],
                "Timestamp": datetime.now(timezone.utc) - timedelta(days=day, hours=-12),
                "StatisticValues": {
                    "SampleCount": samples,
                    "Sum": value * samples if name == "CPUUtilization" else value,
                    "Minimum": value if name == "CPUUtilization" else value / samples,
                    "Maximum": value if name == "CPUUtilization" else value / samples,
                },
                "Unit": "Percent" if name == "CPUUtilization" else "Bytes",
            } for day in range(1, days + 1)]
            aws.client("cloudwatch").put_metric_data(Namespace=namespace, MetricData=data)
    return put
