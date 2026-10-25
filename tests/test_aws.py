from unittest.mock import Mock

import boto3
from botocore.stub import Stubber
from moto import mock_aws

from app.aws import session as aws_session

ROLE_ARN = "arn:aws:iam::123456789012:role/CostDetectiveReadOnly"


def test_assume_role_sends_external_id_and_uses_temporary_credentials(monkeypatch):
    sts = boto3.client("sts", region_name="us-east-1", aws_access_key_id="test", aws_secret_access_key="test")
    credentials = {
        "AccessKeyId": "ASIA" + "A" * 16, "SecretAccessKey": "B" * 40,
        "SessionToken": "temporary-session-token", "Expiration": "2030-01-01T00:00:00Z",
    }
    with Stubber(sts) as stub:
        stub.add_response("assume_role", {"Credentials": credentials}, {
            "RoleArn": ROLE_ARN, "RoleSessionName": "cost-detective-verify",
            "ExternalId": "customer-external-id", "DurationSeconds": 900,
        })
        factory = Mock(return_value=sts)
        monkeypatch.setattr(aws_session.boto3, "client", factory)
        result = aws_session.assume_role_session(ROLE_ARN, "customer-external-id")
        frozen = result.get_credentials().get_frozen_credentials()
        assert frozen.access_key == credentials["AccessKeyId"]
        assert frozen.secret_key == credentials["SecretAccessKey"]
        assert frozen.token == credentials["SessionToken"]
        assert factory.call_args.kwargs["config"].retries["mode"] == "adaptive"
        stub.assert_no_pending_responses()


@mock_aws
def test_moto_assume_role_and_list_regions():
    session = aws_session.assume_role_session(ROLE_ARN, "test-customer-external-id")
    assert session.client("ec2").describe_regions()["Regions"]
