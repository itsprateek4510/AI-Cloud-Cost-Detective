from decimal import Decimal
import json

import pytest

from app.aws.pricing import estimate_monthly
from app.core.config import settings


@pytest.mark.parametrize("kind, variant, quantity, expected", [
    ("ebs", "gp3", 100, "8.00"),
    ("ebs", "gp2", 10, "1.00"),
    ("eip", None, 1, "3.65"),
    ("ec2", "t3.micro", 1, "7.59"),
    ("nat", None, 1, "32.85"),
    ("logs", None, 10, "0.30"),
])
def test_configured_price_estimates(kind, variant, quantity, expected):
    price = estimate_monthly("us-east-1", kind, variant=variant, quantity=quantity)
    assert price.amount == Decimal(expected)
    assert price.known
    assert "estimate" in price.note.lower()


@pytest.mark.parametrize("region, kind, variant", [
    ("unknown-region", "ebs", "gp3"), ("us-east-1", "ebs", "unknown"), ("us-east-1", "unknown", None),
])
def test_unknown_price_is_zero_with_reason(region, kind, variant):
    price = estimate_monthly(region, kind, variant=variant)
    assert price.amount == Decimal("0.00")
    assert not price.known
    assert "unknown" in price.note.lower()


def test_custom_price_table(tmp_path, monkeypatch):
    path = tmp_path / "prices.json"
    path.write_text(json.dumps({"currency": "USD", "monthly_hours": "100", "regions": {
        "custom-region": {"ec2": {"t3.micro": "0.20"}},
    }}))
    monkeypatch.setattr(settings, "price_table_path", path)
    assert estimate_monthly("custom-region", "ec2", variant="t3.micro").amount == Decimal("20.00")


@pytest.mark.parametrize("quantity", [-1, float("nan"), float("inf")])
def test_invalid_quantity_rejected(quantity):
    with pytest.raises(ValueError):
        estimate_monthly("us-east-1", "eip", quantity=quantity)


@pytest.mark.parametrize("changes", [{"currency": "EUR"}, {"monthly_hours": "0"}, {"monthly_hours": "NaN"},
                                      {"regions": {"us-east-1": {"eip": "-1"}}}])
def test_invalid_price_configuration_rejected(tmp_path, monkeypatch, changes):
    path = tmp_path / "invalid.json"
    table = {"currency": "USD", "monthly_hours": "730", "regions": {"us-east-1": {"eip": "0.005"}}} | changes
    path.write_text(json.dumps(table))
    monkeypatch.setattr(settings, "price_table_path", path)
    with pytest.raises(ValueError):
        estimate_monthly("us-east-1", "eip")
