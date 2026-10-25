from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
import re

from botocore.exceptions import BotoCoreError, ClientError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.aws.session import AWS_CONFIG, assume_role_session
from app.core.config import settings
from app.db.models import AwsAccount, CostCache


def cost_window(now: datetime) -> tuple[str, str]:
    now = now.astimezone(timezone.utc)
    month_index = now.year * 12 + now.month - 1
    year, month = divmod(month_index - 3, 12)
    return f"{year:04d}-{month + 1:02d}-01", f"{now.year:04d}-{now.month:02d}-01"


def fetch_spend(session, aws_account_id: str, now: datetime) -> dict:
    if not re.fullmatch(r"[0-9]{12}", aws_account_id):
        raise ValueError("Invalid AWS account identifier")
    start, end = cost_window(now)
    start_year, start_month = map(int, start[:7].split("-"))
    months = [f"{(start_year * 12 + start_month - 1 + offset) // 12:04d}-{(start_year * 12 + start_month - 1 + offset) % 12 + 1:02d}" for offset in range(3)]
    client = session.client("ce", region_name="us-east-1", config=AWS_CONFIG)
    request = {"TimePeriod": {"Start": start, "End": end}, "Granularity": "MONTHLY", "Metrics": ["UnblendedCost"],
               "GroupBy": [{"Type": "DIMENSION", "Key": "SERVICE"}],
               "Filter": {"Dimensions": {"Key": "LINKED_ACCOUNT", "Values": [aws_account_id]}}}
    services, currencies, seen_tokens = {}, set(), set()
    estimated = False
    while True:
        response = client.get_cost_and_usage(**request)
        for period in response.get("ResultsByTime", []):
            month = period["TimePeriod"]["Start"][:7]
            if month not in months:
                raise ValueError("Cost Explorer returned an unexpected month")
            estimated = estimated or bool(period.get("Estimated"))
            for group in period.get("Groups", []):
                service = group["Keys"][0]
                metric = group["Metrics"]["UnblendedCost"]
                amount = Decimal(metric["Amount"])
                if not amount.is_finite() or not re.fullmatch(r"[A-Z]{3}", metric["Unit"]):
                    raise ValueError("Invalid cost amount or currency")
                currencies.add(metric["Unit"])
                values = services.setdefault(service, {month: Decimal(0) for month in months})
                values[month] += amount
        token = response.get("NextPageToken")
        if not token:
            break
        if token in seen_tokens:
            raise ValueError("Cost Explorer repeated a page token")
        seen_tokens.add(token)
        request["NextPageToken"] = token
    if len(currencies) > 1:
        raise ValueError("Mixed currencies cannot be combined")
    rows = [{"service": service, "amounts": {month: str(value) for month, value in values.items()},
             "total": str(sum(values.values(), Decimal(0)))} for service, values in services.items()]
    rows.sort(key=lambda row: (-Decimal(row["total"]), row["service"]))
    return {"available": True, "stale": False, "reason": None, "window_start": start, "window_end": end,
            "months": months, "services": rows, "currency": next(iter(currencies), "USD"), "estimated": estimated,
            "monthly_totals": {month: str(sum((values[month] for values in services.values()), Decimal(0))) for month in months},
            "total": str(sum((Decimal(row["total"]) for row in rows), Decimal(0))), "fetched_at": now.isoformat()}


def get_cost_data(db: Session, account_id: int, *, now: datetime | None = None) -> dict:
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    account = db.scalar(select(AwsAccount).where(AwsAccount.id == account_id).with_for_update())
    if account is None or not account.verified_at or not account.role_arn:
        raise ValueError("A verified AWS account is required")
    cached = db.get(CostCache, account_id)
    start, end = cost_window(now)
    same_window = (cached is not None and cached.role_arn == account.role_arn
                   and cached.content.get("window_start") == start and cached.content.get("window_end") == end)
    if same_window:
        # SQLite drops tzinfo; PostgreSQL can return a non-UTC offset. Preserve
        # aware timestamps instead of replacing their actual offset with UTC.
        expires_at = cached.expires_at if cached.expires_at.tzinfo else cached.expires_at.replace(tzinfo=timezone.utc)
        if expires_at > now:
            result = {**cached.content, "cached": True}
            db.commit()
            return result
    try:
        session = assume_role_session(account.role_arn, account.external_id)
        content = fetch_spend(session, account.role_arn.split(":")[4], now)
        ttl = settings.cost_cache_ttl_seconds
    except (ClientError, BotoCoreError, ValueError, InvalidOperation) as error:
        denied = isinstance(error, ClientError) and error.response.get("Error", {}).get("Code") in {"AccessDenied", "AccessDeniedException", "UnauthorizedOperation"}
        content = {**cached.content} if same_window and cached.content.get("services") else {"months": [], "services": [], "total": None, "currency": "USD"}
        content.update(available=False, stale=bool(content.get("services")), reason="access_denied" if denied else "aws_error",
                       window_start=start, window_end=end)
        ttl = 300
    if cached is None:
        cached = CostCache(account_id=account_id, role_arn=account.role_arn, content=content, expires_at=now + timedelta(seconds=ttl))
        db.add(cached)
    else:
        cached.role_arn = account.role_arn
        cached.content = content
        cached.expires_at = now + timedelta(seconds=ttl)
    db.commit()
    return {**content, "cached": False}
