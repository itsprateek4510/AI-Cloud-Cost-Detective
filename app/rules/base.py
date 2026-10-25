from decimal import Decimal
from typing import Literal, Protocol

import boto3
from pydantic import BaseModel, ConfigDict, Field, computed_field


class Finding(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    rule_id: str
    resource_id: str
    resource_type: str
    region: str
    severity: Literal["high", "medium", "low"]
    title: str
    description: str
    savings_monthly: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)
    # Rules populate only explicit scalar facts, not raw AWS responses or tags.
    details: dict[str, str | int | float | bool | None] = Field(default_factory=dict)
    account_id: str | None = None
    tags: dict[str, str] | None = None


class SkippedCheck(BaseModel):
    rule_id: str
    region: str
    resource_id: str | None = None
    reason: Literal["access_denied", "aws_error", "insufficient_metrics", "resource_too_new", "unsupported_resource"]
    detail: str


class RuleFindings(list[Finding]):
    """A list-compatible rule result that also preserves resource-level skips."""

    def __init__(self):
        super().__init__()
        self.skipped_checks: list[SkippedCheck] = []

    def skip(self, rule_id: str, region: str, resource_id: str, reason: str, detail: str):
        self.skipped_checks.append(SkippedCheck(
            rule_id=rule_id, region=region, resource_id=resource_id, reason=reason, detail=detail,
        ))


class Rule(Protocol):
    RULE_ID: str

    def scan(self, session: boto3.Session, region: str) -> list[Finding]: ...


class ScanResult(BaseModel):
    findings: list[Finding] = Field(default_factory=list)
    skipped_checks: list[SkippedCheck] = Field(default_factory=list)

    @computed_field
    @property
    def savings_monthly(self) -> Decimal:
        return sum((finding.savings_monthly for finding in self.findings), Decimal("0.00"))
