from concurrent.futures import ThreadPoolExecutor, as_completed
from collections.abc import Callable, Sequence

import boto3
from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError

from app.aws.regions import list_enabled_regions
from app.rules import ebs, ec2_idle, eip, logs, nat, load_balancers, snapshots, rds_dev
from app.rules.base import Rule, RuleFindings, ScanResult, SkippedCheck

DEFAULT_RULES = (ebs, eip, ec2_idle, nat, logs, load_balancers, snapshots, rds_dev)
ACCESS_DENIED_CODES = {"AccessDenied", "AccessDeniedException", "UnauthorizedOperation", "AuthorizationError"}


def aws_skip(rule_id: str, region: str, error: Exception) -> SkippedCheck:
    denied = isinstance(error, ClientError) and error.response.get("Error", {}).get("Code") in ACCESS_DENIED_CODES
    return SkippedCheck(rule_id=rule_id, region=region, reason="access_denied" if denied else "aws_error",
                        detail="AWS denied this check." if denied else "AWS could not complete this check.")


def run_scan(session: boto3.Session, *, regions: Sequence[str] | None = None,
             rules: Sequence[Rule] = DEFAULT_RULES, max_workers: int = 4,
             on_region_complete: Callable[[int, int], None] | None = None) -> ScanResult:
    if max_workers < 1:
        raise ValueError("max_workers must be positive")
    result = ScanResult()
    try:
        selected_regions = sorted(set(list_enabled_regions(session) if regions is None else regions))
        if not selected_regions:
            return result
    except (ClientError, BotoCoreError) as error:
        result.skipped_checks.append(aws_skip("region_discovery", "global", error))
        return result
    try:
        credentials = session.get_credentials()
        if credentials is None:
            raise NoCredentialsError()
        frozen = credentials.get_frozen_credentials()
    except (ClientError, BotoCoreError) as error:
        result.skipped_checks.append(aws_skip("aws_session", "global", error))
        return result

    def scan_region(region: str) -> ScanResult:
        # boto3 Sessions are not thread-safe. Each region gets its own in-memory
        # session from credentials frozen once before starting worker threads.
        regional_session = boto3.Session(
            aws_access_key_id=frozen.access_key, aws_secret_access_key=frozen.secret_key,
            aws_session_token=frozen.token, region_name=region,
        )
        regional_result = ScanResult()
        for rule in rules:
            try:
                findings = rule.scan(regional_session, region)
                regional_result.findings.extend(findings)
                if isinstance(findings, RuleFindings):
                    regional_result.skipped_checks.extend(findings.skipped_checks)
            except (ClientError, BotoCoreError) as error:
                regional_result.skipped_checks.append(aws_skip(rule.RULE_ID, region, error))
        return regional_result

    with ThreadPoolExecutor(max_workers=min(max_workers, len(selected_regions))) as executor:
        futures = [executor.submit(scan_region, region) for region in selected_regions]
        for completed, future in enumerate(as_completed(futures), start=1):
            regional_result = future.result()
            result.findings.extend(regional_result.findings)
            result.skipped_checks.extend(regional_result.skipped_checks)
            if on_region_complete:
                on_region_complete(completed, len(selected_regions))
    result.findings.sort(key=lambda finding: (-finding.savings_monthly, finding.region, finding.rule_id, finding.resource_id))
    result.skipped_checks.sort(key=lambda skip: (skip.region, skip.rule_id, skip.resource_id or ""))
    return result
