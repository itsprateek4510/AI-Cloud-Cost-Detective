from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from functools import lru_cache
import json
from pathlib import Path

from app.core.config import settings


@dataclass(frozen=True)
class PriceEstimate:
    amount: Decimal
    known: bool
    note: str


@lru_cache(maxsize=8)
def load_price_table(path: Path) -> dict:
    table = json.loads(path.read_text())
    if table["currency"] != "USD":
        raise ValueError("Price table must use USD")
    return table


def estimate_monthly(region: str, kind: str, *, variant: str | None = None, quantity=1) -> PriceEstimate:
    quantity = Decimal(str(quantity))
    if not quantity.is_finite() or quantity < 0:
        raise ValueError("Pricing quantity must be finite and nonnegative")
    table = load_price_table(settings.price_table_path or Path(__file__).with_name("prices.json"))
    rate = table["regions"].get(region, {}).get(kind)
    if isinstance(rate, dict):
        rate = rate.get(variant)
    if rate is None:
        return PriceEstimate(Decimal("0.00"), False, f"Unknown price for {region}/{kind}/{variant or 'base'}; no savings claimed.")
    rate = Decimal(str(rate))
    hours = Decimal(str(table["monthly_hours"])) if kind in {"ec2", "eip", "nat", "load_balancer"} else Decimal(1)
    if not rate.is_finite() or rate < 0 or not hours.is_finite() or hours <= 0:
        raise ValueError("Configured rates must be finite and nonnegative; monthly hours must be positive")
    amount = (rate * quantity * hours).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return PriceEstimate(amount, True, table.get("note", "Configured rough monthly USD estimate; not a billing quote."))
