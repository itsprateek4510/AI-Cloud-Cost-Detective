## AI Cloud Cost Detective - Request Flow (AWS + Gemini)

```
①  User ─·─·─► React ─·─·─► Google OAuth ─·─·─► FastAPI Auth ─·─·─► Bearer JWT (user stored in Postgres)
②  User adds AWS account (role ARN) ─·─·─► POST /accounts (generate external_id) ─·─·─► Deploy infra/customer-role.yaml (CFN)
③  User verifies ─·─·─► POST /accounts/verify ─·─·─► STS AssumeRole(ExternalId) ─·─·─► Confirm access (list regions)
④  User starts scan ─·─·─► POST /scans ─·─·─► Enqueue ARQ job (return scan_id immediately)
⑤  Worker executes rules per region in parallel ─·─·─► Findings with computed savings ─·─·─► Store in Postgres
⑥  UI polls GET /scans/{id} ─·─·─► Display findings table (sorted by savings, filters by severity/region)
⑦  Generate AI report ─·─·─► Sanitize to top 20 findings + totals ─·─·─► Gemini (JSON schema, timeout+retry) ─·─·─► Cache in DB ─·─·─► Render summary + top actions
⑧  Load spend ─·─·─► Owner-scoped cost endpoint ─·─·─► TTL cache / Cost Explorer (3 complete months, service grouping)
⑨  Weekly UTC ARQ cron ─·─·─► Allowlisted verified connections ─·─·─► Fresh scan + optional AI + cached costs ─·─·─► Email/Slack
```

Steps ①–⑨ are implemented. The React dashboard signs in through a Google OAuth popup and keeps the backend-issued JWT in memory. `GET /accounts` lists only the user's connections; `POST /accounts` creates one, and `POST /accounts/verify` checks its role using the stored ExternalId. The verification snapshot is not reused as AWS credentials.

`POST /scans` accepts `account_id`, validates ownership and verification, commits a pending scan, and enqueues its ID in Redis/ARQ, returning HTTP 202 immediately. The worker claims it once, assumes the customer role, invokes `run_scan`, updates progress as regions finish, then persists findings, skipped checks, and code-computed totals. `GET /scans/{id}` checks ownership and returns status, progress, findings sorted by savings, exact totals, and safe failure details. React polls every 2.5 seconds until completed/failed, cancels on unmount, and provides severity/region filters. See [dashboard flow](README.md#dashboard-flow) and [scanner behavior](README.md#scanner-behavior-and-estimates).

On the Report page, `GET /scans/{id}/report` loads a cached executive report without making a provider call. Clicking Generate sends `POST /scans/{id}/report`: verify ownership/completion → lock scan row → return cache if present → sanitize the top 20 findings plus all-finding aggregates → Gemini JSON schema/timeout → validate prose and finding references, retry once if necessary → persist validated report → render executive summary, prioritized actions, risks, and code-owned finding links/savings. Failures return 200 with `ai_summary_unavailable: true`; the findings table and exact totals remain visible. Empty scans use a code-generated summary without Gemini. See [Gemini integration](README.md#gemini-integration-rules).

`GET /accounts/{id}/cost` verifies ownership and returns role/window-scoped cached cost data, or fetches/paginates Cost Explorer with a linked-account filter. The UI loads it explicitly to avoid accidental billed calls. Negative caching and stale/unavailable labels preserve transparency when billing access fails. The worker's configured weekly cron creates a fresh scan for each allowlisted verified connection and queues one delivery per account/week. It rechecks eligibility, runs the scan, attempts the cached AI summary, loads costs, and sends top findings plus an authenticated dashboard link. Email/Slack transport failures are recorded without exposing secrets or automatically resending ambiguous deliveries. See [cost and delivery setup](README.md#cost-history-and-weekly-delivery).
