from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import Mock
from concurrent.futures import ThreadPoolExecutor
import os
import time

from botocore.exceptions import ClientError
import pytest

from app.aws import cost
from app.db.models import AwsAccount, CostCache
from app.core.security import create_access_token
from app.db.models import User
from app.db.session import get_db
from app.main import app
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def cost_account(db, user):
    account = AwsAccount(user_id=user.id, role_arn="arn:aws:iam::123456789012:role/ReadOnly",
                         external_id="stored-external-id", verified_at=datetime.now(timezone.utc))
    db.add(account)
    db.commit()
    return account


def page(token=None):
    result = {"ResultsByTime": [{"TimePeriod": {"Start": "2026-07-01", "End": "2026-08-01"}, "Estimated": False,
                                "Groups": [{"Keys": ["Amazon EC2"], "Metrics": {"UnblendedCost": {"Amount": "1.234", "Unit": "USD"}}}]}]}
    if token:
        result["NextPageToken"] = token
    return result


def test_calendar_window_handles_year_boundary():
    assert cost.cost_window(datetime(2026, 1, 25, tzinfo=timezone.utc)) == ("2025-10-01", "2026-01-01")


def test_cost_pages_filter_connected_account_and_sum_exactly():
    session = Mock()
    client = session.client.return_value
    client.get_cost_and_usage.side_effect = [page("next"), page()]
    result = cost.fetch_spend(session, "123456789012", datetime(2026, 10, 25, tzinfo=timezone.utc))
    assert result["months"] == ["2026-07", "2026-08", "2026-09"]
    assert result["services"][0]["amounts"]["2026-07"] == "2.468"
    assert Decimal(result["total"]) == Decimal("2.468")
    first = client.get_cost_and_usage.call_args_list[0].kwargs
    assert first["GroupBy"] == [{"Type": "DIMENSION", "Key": "SERVICE"}]
    assert first["Filter"]["Dimensions"]["Values"] == ["123456789012"]
    assert client.get_cost_and_usage.call_args_list[1].kwargs["NextPageToken"] == "next"


def test_cost_cache_prevents_repeated_billed_calls(db, cost_account, monkeypatch):
    monkeypatch.setattr(cost, "assume_role_session", Mock())
    fetch = Mock(return_value={"available": True, "months": [], "services": [], "total": "0", "currency": "USD", "window_start": "2026-07-01", "window_end": "2026-10-01"})
    monkeypatch.setattr(cost, "fetch_spend", fetch)
    now = datetime(2026, 10, 25, tzinfo=timezone.utc)
    assert cost.get_cost_data(db, cost_account.id, now=now)["available"]
    assert cost.get_cost_data(db, cost_account.id, now=now)["cached"]
    fetch.assert_called_once()
    db.get(CostCache, cost_account.id).expires_at = now - timedelta(seconds=1)
    db.commit()
    cost.get_cost_data(db, cost_account.id, now=now)
    assert fetch.call_count == 2


def test_permission_failure_is_safe_and_negative_cached(db, cost_account, monkeypatch):
    assume = Mock(side_effect=ClientError({"Error": {"Code": "AccessDenied", "Message": "secret AWS message"}}, "GetCostAndUsage"))
    monkeypatch.setattr(cost, "assume_role_session", assume)
    now = datetime(2026, 10, 25, tzinfo=timezone.utc)
    result = cost.get_cost_data(db, cost_account.id, now=now)
    assert result["available"] is False
    assert result["reason"] == "access_denied"
    assert "secret" not in str(result)
    cost.get_cost_data(db, cost_account.id, now=now)
    assume.assert_called_once()


def test_cost_endpoint_requires_account_owner(client, headers, cost_account, monkeypatch):
    fetch = Mock()
    monkeypatch.setattr(cost, "fetch_spend", fetch)
    assert client.get("/accounts/999/cost", headers=headers).status_code == 404
    assert client.get(f"/accounts/{cost_account.id}/cost").status_code == 401
    fetch.assert_not_called()


def test_another_user_cannot_trigger_cost_calls(client, cost_account, db, monkeypatch):
    other = User(google_sub="cost-other", email="other@example.test")
    db.add(other)
    db.commit()
    fetch = Mock()
    monkeypatch.setattr(cost, "fetch_spend", fetch)
    token = create_access_token(other.id)
    assert client.get(f"/accounts/{cost_account.id}/cost", headers={"Authorization": f"Bearer {token}"}).status_code == 404
    fetch.assert_not_called()


def test_stale_costs_are_labeled_when_refresh_fails(db, cost_account, monkeypatch):
    now = datetime(2026, 10, 25, tzinfo=timezone.utc)
    db.add(CostCache(account_id=cost_account.id, expires_at=now - timedelta(seconds=1), content={
        "available": True, "window_start": "2026-07-01", "window_end": "2026-10-01", "currency": "USD",
        "services": [{"service": "Amazon EC2", "total": "12.34"}], "total": "12.34",
    }, role_arn=cost_account.role_arn))
    db.commit()
    monkeypatch.setattr(cost, "assume_role_session", Mock(side_effect=ClientError({"Error": {"Code": "DataUnavailableException"}}, "GetCostAndUsage")))
    result = cost.get_cost_data(db, cost_account.id, now=now)
    assert result["stale"] is True
    assert result["available"] is False
    assert result["total"] == "12.34"


def test_cost_credits_remain_negative_and_mixed_currency_is_rejected():
    session = Mock()
    negative = page()
    negative["ResultsByTime"][0]["Groups"][0]["Metrics"]["UnblendedCost"]["Amount"] = "-2.50"
    session.client.return_value.get_cost_and_usage.return_value = negative
    assert cost.fetch_spend(session, "123456789012", datetime(2026, 10, 25, tzinfo=timezone.utc))["total"] == "-2.50"
    mixed = page()
    mixed["ResultsByTime"][0]["Groups"].append({"Keys": ["Other"], "Metrics": {"UnblendedCost": {"Amount": "1", "Unit": "EUR"}}})
    session.client.return_value.get_cost_and_usage.return_value = mixed
    with pytest.raises(ValueError):
        cost.fetch_spend(session, "123456789012", datetime(2026, 10, 25, tzinfo=timezone.utc))


def test_repeated_cost_page_tokens_do_not_loop_forever():
    session = Mock()
    session.client.return_value.get_cost_and_usage.return_value = page("repeat")
    with pytest.raises(ValueError):
        cost.fetch_spend(session, "123456789012", datetime(2026, 10, 25, tzinfo=timezone.utc))
    assert session.client.return_value.get_cost_and_usage.call_count == 2


def test_relinked_account_cannot_reuse_previous_role_costs(db, cost_account, monkeypatch):
    now = datetime(2026, 10, 25, tzinfo=timezone.utc)
    monkeypatch.setattr(cost, "assume_role_session", Mock())
    fetch = Mock(return_value={"available": True, "window_start": "2026-07-01", "window_end": "2026-10-01",
                               "months": [], "services": [], "total": "1", "currency": "USD"})
    monkeypatch.setattr(cost, "fetch_spend", fetch)
    cost.get_cost_data(db, cost_account.id, now=now)
    cost_account.role_arn = "arn:aws:iam::222222222222:role/DifferentAccount"
    db.commit()
    cost.get_cost_data(db, cost_account.id, now=now)
    assert fetch.call_count == 2


def test_cache_expiration_preserves_non_utc_postgresql_offsets(db, cost_account, monkeypatch):
    now = datetime(2026, 10, 25, tzinfo=timezone.utc)
    monkeypatch.setattr(cost, "assume_role_session", Mock())
    fetch = Mock(return_value={"available": True, "window_start": "2026-07-01", "window_end": "2026-10-01", "services": [], "total": "0"})
    monkeypatch.setattr(cost, "fetch_spend", fetch)
    cost.get_cost_data(db, cost_account.id, now=now)
    cached = db.get(CostCache, cost_account.id)
    cached.expires_at = (now - timedelta(seconds=1)).astimezone(timezone(timedelta(hours=5, minutes=30)))
    db.flush()
    cost.get_cost_data(db, cost_account.id, now=now)
    assert fetch.call_count == 2


@pytest.mark.skipif(not os.environ.get("TEST_DATABASE_URL"), reason="PostgreSQL cache-lock test")
def test_concurrent_cost_reads_make_one_billed_request(client, headers, cost_account, db, monkeypatch):
    account_id = cost_account.id
    factory = sessionmaker(bind=db.get_bind())

    def independent_session():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = independent_session
    monkeypatch.setattr(cost, "assume_role_session", Mock())
    start, end = cost.cost_window(datetime.now(timezone.utc))

    def fetch(*args):
        time.sleep(0.1)
        return {"available": True, "window_start": start, "window_end": end, "months": [], "services": [], "total": "0", "currency": "USD"}

    calls = Mock(side_effect=fetch)
    monkeypatch.setattr(cost, "fetch_spend", calls)
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(lambda _: client.get(f"/accounts/{account_id}/cost", headers=headers), range(2)))
    assert all(response.status_code == 200 for response in responses)
    calls.assert_called_once()
