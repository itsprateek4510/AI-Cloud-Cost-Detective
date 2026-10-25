# Prompt 2: Scanners & Rules (Deterministic, no AI) with Moto

Build the rule engine and first 5 rules. All savings must be computed in code.

## Goal
Create a common rule interface, run scans across regions in parallel, handle permissions per rule, and detect planted waste in a test account.

## What to build

### Core
- `app/rules/base.py`: `Finding` dataclass/Pydantic model with fields like `rule_id`, `resource_id`, `resource_type`, `region`, `severity`, `title`, `description`, `savings_monthly`, `details` (sanitized), `account_id` (optional), `tags` (optional).
- `app/rules/runner.py`: orchestrate rules, parallelize by region (e.g. ThreadPoolExecutor/async), catch `AccessDenied` per rule, collect results, compute totals.
- `app/aws/regions.py`: list enabled regions.

### Rules (first 5)
- `app/rules/ebs.py` — unattached EBS volumes
- `app/rules/eip.py` — unused Elastic IPs
- `app/rules/ec2_idle.py` — idle EC2 (use CloudWatch CPU/network over a window, e.g. 7-14 days; if metrics missing, be conservative or skip with reason)
- `app/rules/nat.py` — idle NAT Gateways
- `app/rules/logs.py` — CloudWatch log groups with no retention

For each, compute `savings_monthly` from a price table in `app/aws/pricing.py` (start simple; no hardcoded per-call pricing from untrusted sources). If price unknown, set savings to 0 but still report the finding with a note.

### Pricing
- `app/aws/pricing.py`: rough price table (configurable), helper to estimate monthly cost/savings.

### Testing
- Add tests in `tests/rules/` using `moto` to mock AWS. Cover each rule against fixtures.
- Ensure planted waste (unattached EBS, unassociated EIP, idle t3.micro) is detected.

## Project structure
```
app/
  aws/          regions.py pricing.py session.py
  rules/        base.py runner.py ebs.py eip.py ec2_idle.py nat.py logs.py
tests/
  rules/        test_*.py
```

## Exit criteria
- Common interface `scan(session, region) -> list[Finding]` works
- All 5 rules implemented
- Regions run in parallel, `AccessDenied` caught per rule (scan continues)
- Moto tests pass
- Scan of test account returns exactly the planted waste
