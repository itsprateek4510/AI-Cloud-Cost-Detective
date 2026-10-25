# Prompt 5: Cost Explorer + Delivery (Email/Slack) + More Rules

Add Cost Explorer spend data (cached), scheduled reports, and additional rules.

## Goal
Show spend trends and deliver weekly reports without manual clicks.

## What to build

### Cost Explorer
- `app/aws/cost.py`: call Cost Explorer `GetCostAndUsage` for last 3 months, group by service, cache results per account (since billed per API call). Store in DB or cache layer with TTL.
- Display spend by service in UI (e.g. on Scans/Report or dashboard).

### Additional Rules
- Add rules: idle load balancers, old snapshots, dev RDS (extend `app/rules/`). Compute savings where possible.

### Delivery
- Scheduler (e.g. APScheduler) or worker cron: generate weekly report for verified accounts and send via Email or Slack. Include top findings and link to app.
- Config via env vars.

### Permissions
- Ensure customer role has `ce:GetCostAndUsage` (already listed). Handle missing permissions gracefully.

## Exit criteria
- Cost Explorer data shown for last 3 months, cached
- 3 more rules added (idle LBs, old snapshots, dev RDS)
- Weekly report sent via email or Slack automatically
- Works even if some permissions missing (skips with reason)
