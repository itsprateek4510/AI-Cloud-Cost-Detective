from datetime import datetime, timezone
from unittest.mock import Mock

import pytest
from botocore.exceptions import ClientError, EndpointConnectionError, NoCredentialsError
from app.api import accounts
from app.aws.session import AWS_CONFIG
from app.db.models import AwsAccount, User
from app.core.security import create_access_token

ROLE_ARN = "arn:aws:iam::123456789012:role/CostDetectiveReadOnly"


def create_account(client, headers, role_arn=None):
    body = {"role_arn": role_arn} if role_arn else {}
    response = client.post("/accounts", json=body, headers=headers)
    assert response.status_code == 201
    return response.json()


def verify_payload(account):
    return {"account_id": account["id"], "role_arn": ROLE_ARN, "external_id": account["external_id"]}


def test_create_unverified_account(client, headers, db, user):
    data = create_account(client, headers)
    stored = db.get(AwsAccount, data["id"])
    assert stored.user_id == user.id
    assert stored.external_id == data["external_id"]
    assert len(data["external_id"]) >= 32
    assert stored.verified_at is None
    assert stored.role_arn is None
    assert "customer-role.yaml" in data["template_path"]
    assert "ExternalId" in data["guidance"]


def test_external_ids_are_unique(client, headers):
    assert create_account(client, headers)["external_id"] != create_account(client, headers)["external_id"]


def test_create_with_role(client, headers):
    assert create_account(client, headers, ROLE_ARN)["role_arn"] == ROLE_ARN


@pytest.mark.parametrize("role_arn", ["not-an-arn", "arn:aws:iam::123456789012:user/bob", "arn:aws:iam::*:role/Admin"])
def test_invalid_role_rejected(client, headers, role_arn):
    assert client.post("/accounts", json={"role_arn": role_arn}, headers=headers).status_code == 422


def test_verify_uses_stored_external_id_and_stores_only_metadata(client, headers, db, monkeypatch):
    account = create_account(client, headers)
    session = Mock()
    session.client.return_value.describe_regions.return_value = {
        "Regions": [{"RegionName": "us-east-1"}, {"RegionName": "eu-west-1"}]
    }
    assume = Mock(return_value=session)
    monkeypatch.setattr(accounts, "assume_role_session", assume)
    response = client.post("/accounts/verify", json=verify_payload(account), headers=headers)
    assert response.status_code == 200
    assert response.json()["verified"] is True
    assume.assert_called_once_with(ROLE_ARN, account["external_id"])
    session.client.assert_called_once_with("ec2", config=AWS_CONFIG)
    session.client.return_value.describe_regions.assert_called_once_with(AllRegions=False)
    stored = db.get(AwsAccount, account["id"])
    assert stored.verified_at is not None
    assert stored.role_arn == ROLE_ARN
    assert stored.verification_metadata["regions"] == ["eu-west-1", "us-east-1"]
    assert datetime.fromisoformat(stored.verification_metadata["expires_at"]) > datetime.now(timezone.utc)
    assert "AccessKeyId" not in str(stored.verification_metadata)


def test_cross_user_verify_is_hidden(client, headers, db, monkeypatch):
    account = create_account(client, headers)
    other = User(google_sub="other", email="other@example.com")
    db.add(other)
    db.commit()
    other_headers = {"Authorization": f"Bearer {create_access_token(other.id)}"}
    assume = Mock()
    monkeypatch.setattr(accounts, "assume_role_session", assume)
    response = client.post("/accounts/verify", json=verify_payload(account), headers=other_headers)
    assert response.status_code == 404
    assume.assert_not_called()


def test_verify_rejects_external_id_override(client, headers, monkeypatch):
    account = create_account(client, headers)
    payload = verify_payload(account) | {"external_id": "attacker-supplied-external-id-12345"}
    assume = Mock()
    monkeypatch.setattr(accounts, "assume_role_session", assume)
    assert client.post("/accounts/verify", json=payload, headers=headers).status_code == 400
    assume.assert_not_called()


def test_non_ascii_external_id_is_rejected(client, headers):
    account = create_account(client, headers)
    payload = verify_payload(account) | {"external_id": "invalid-☁"}
    assert client.post("/accounts/verify", json=payload, headers=headers).status_code == 422


@pytest.mark.parametrize("error, status", [
    (ClientError({"Error": {"Code": "AccessDenied", "Message": "sensitive AWS message"}}, "AssumeRole"), 400),
    (NoCredentialsError(), 503),
    (EndpointConnectionError(endpoint_url="https://sts.amazonaws.com"), 503),
])
def test_aws_errors_are_safe_and_do_not_verify(client, headers, db, monkeypatch, error, status):
    account = create_account(client, headers)
    monkeypatch.setattr(accounts, "assume_role_session", Mock(side_effect=error))
    response = client.post("/accounts/verify", json=verify_payload(account), headers=headers)
    assert response.status_code == status
    assert "sensitive AWS message" not in response.text
    assert db.get(AwsAccount, account["id"]).verified_at is None


def test_region_access_denied_clears_previous_verification(client, headers, db, monkeypatch):
    account = create_account(client, headers)
    stored = db.get(AwsAccount, account["id"])
    stored.verified_at = datetime.now(timezone.utc)
    stored.verification_metadata = {"regions": ["us-east-1"]}
    db.commit()
    session = Mock()
    session.client.return_value.describe_regions.side_effect = ClientError(
        {"Error": {"Code": "UnauthorizedOperation", "Message": "denied"}}, "DescribeRegions"
    )
    monkeypatch.setattr(accounts, "assume_role_session", Mock(return_value=session))
    assert client.post("/accounts/verify", json=verify_payload(account), headers=headers).status_code == 400
    db.refresh(stored)
    assert stored.verified_at is None
    assert stored.verification_metadata is None
