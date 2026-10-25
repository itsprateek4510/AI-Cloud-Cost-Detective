# AI Cloud Cost Detective (AWS)

An AI-powered tool that investigates AWS cloud costs and misconfigurations. It uses deterministic boto3 rules to detect waste (unattached EBS volumes, unused Elastic IPs, idle EC2, idle NAT Gateways, log groups without retention, etc.), calculates savings in code, and uses Google Gemini only to explain, prioritize, and summarize findings.

**Current implementation:** Phases 0–5: FastAPI, PostgreSQL/Alembic, Google OAuth/JWT, AWS account linking, eight deterministic rules, Redis/ARQ jobs, a React dashboard, optional Gemini reports, cached Cost Explorer history, and opt-in weekly email/Slack delivery. See [Architecture.MD](Architecture.MD) and [RequestFlow.MD](RequestFlow.MD).

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | React + Vite + Tailwind | Fast to build; polling for scan status is enough |
| Backend | FastAPI | Async, Pydantic validation shared with the LLM output |
| DB | PostgreSQL + SQLAlchemy + Alembic | Structured findings, trends later |
| Queue | Redis + ARQ | Scans run in the background |
| AWS access | boto3 + STS AssumeRole + ExternalId | No stored AWS keys |
| LLM | Gemini via the `google-genai` SDK | Structured JSON output, cheap Flash-tier models |
| Auth | Google OAuth, JWT session | No password handling |
| Hosting (MVP) | Docker Compose on one small EC2 instance | Cheapest and simplest. Move to ECS and RDS only if you get real users |

Keep the Gemini model name in an env variable (`GEMINI_MODEL`). Model names change often, so check Google AI Studio for the current Flash-tier model when you start.

## Core Rule

```
boto3 scans → rules decide → DB stores → Gemini explains → UI/Slack delivers
```

- **Code** finds problems and calculates savings.
- **Gemini** only explains, prioritizes, and summarizes.
- If Gemini ever outputs a dollar figure that your code didn't compute, that's a bug.

## Architecture

```
                               ┌──────────────┐
                               │     USER     │
                               └──────┬───────┘
                                      │
                                      ▼
                            ┌───────────────────┐
                            │  REACT FRONTEND   │
                            └────────┬──────────┘
                                     : Google OAuth / JWT
                                     ▼
                            ┌───────────────────┐
                            │  FASTAPI BACKEND  │
                            │  (REST + Polling) │
                            └───┬───┬───┬───┬───┘
                                :   :   :   :   :
                      ┌─────────┘   :   :   :   └─────────┐
                      :             :   :   :             :
                      ▼             ▼   ▼   ▼             ▼
                 ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
                 │  AWS     │   │  Redis  │   │ Worker  │   │  Gemini │
                 │ STS      │   │   ARQ   │   │(boto3 + │   │ google- │
                 │AssumeRole│   │  Queue  │   │ rules)  │   │ genai   │
                 └─────┬───┘   └─────────┘   └─────┬───┘   └─────────┘
                       │                        │
                       ▼                        ▼
                    ┌─────────────────────────────────────────┐
                    │           PostgreSQL + SQLAlchemy        │
                    │  (accounts, scans, findings, reports)    │
                    └─────────────────────────────────────────┘
```

## Request Flow

```
①  User ─·─·─► React ─·─·─► Google OAuth ─·─·─► FastAPI Auth ─·─·─► Bearer JWT (user stored in Postgres)
②  User adds AWS account (role ARN) ─·─·─► POST /accounts (generates external_id) ─·─·─► Deploy CFN template
③  User verifies ─·─·─► POST /accounts/verify ─·─·─► STS AssumeRole with ExternalId ─·─·─► Confirm access
④  User starts scan ─·─·─► POST /scans ─·─·─► Enqueue ARQ job (returns scan_id immediately)
⑤  Worker runs rules per region in parallel (boto3) ─·─·─► Convert to Findings with computed savings ─·─·─► Store in DB
⑥  UI polls GET /scans/{id} for status/progress ─·─·─► Show findings table (sorted by savings, filter by severity/region)
⑦  Generate report ─·─·─► Build prompt from top 20 findings + totals (strip sensitive data) ─·─·─► Gemini (JSON schema) ─·─·─► Store report, render executive summary + top actions
```

## What It Detects (8 rules)

- **Unattached EBS volumes** — Volumes not attached to any instance
- **Unused Elastic IPs** — EIPs not associated with an instance/NAT
- **Idle EC2 instances** — Low CPU/network utilization (based on CloudWatch metrics)
- **Idle NAT Gateways** — Low traffic over a window
- **CloudWatch log groups with no retention** — Retention never set (potential indefinite storage)

- **Idle load balancers** — Complete zero-request/flow metrics for application, network, or supported classic load balancers
- **Old snapshots** — Snapshots at least 90 days old, flagged for retention/dependency review, not automatic deletion
- **Development RDS** — Explicit non-production environment tags, flagged for scheduling review rather than assumed waste

### Scanner Behavior and Estimates

Every rule exposes `scan(session, region) -> list[Finding]`. Idle rules return a list-compatible `RuleFindings` object whose `skipped_checks` records resource-level skips; `run_scan` merges these with rule-level AWS failures. Findings contain curated scalar details, not raw AWS responses, account IDs, ARNs, IP addresses, or copied tags. Resource identifiers, including log group names, remain untrusted data.

| Rule | Detection | Monthly savings basis |
|---|---|---|
| `ebs_unattached` | State `available`, no attachments | Volume GiB × configured storage rate |
| `eip_unused` | No association, instance, or network interface | Configured hourly IPv4 rate × 730 hours; customer-owned pools have unknown pricing |
| `ec2_idle` | Running before the observation window; daily CPU **maximum ≤ 1%** and combined NetworkIn/NetworkOut **≤ 1 MiB/day** for 14 full UTC days | Configured Linux shared-tenancy on-demand instance rate × 730; unsupported platforms, tenancy, or lifecycle use zero |
| `nat_idle` | Available before the window; combined BytesInFromSource/BytesInFromDestination **≤ 1 MiB/day** for 14 full UTC days | Gateway hourly rate × 730; excludes data processing and public IPv4 charges |
| `logs_no_retention` | No retention policy | **Zero**: a target retention period and log age distribution are needed to calculate savings; estimated current storage cost is informational only |
| `load_balancer_idle` | Available for the full observation window; complete daily zero RequestCount (ALB/classic) or NewFlowCount and ProcessedBytes (NLB) | Configured base hourly charge × 730; excludes capacity units and public IPv4 charges |
| `snapshots_old` | Owned, completed snapshots at least 90 days old | **Zero**: incremental stored bytes and dependency/retention analysis are needed; source volume size is not snapshot savings |
| `rds_dev` | Available DB instance with explicit Environment/env tag identifying dev, development, test, testing, stage, staging, or sandbox; conflicting production tags exclude it | **Zero**: an approved schedule, stopping eligibility, and applicable engine rates are needed before claiming savings |

Idle checks require all 14 daily buckets and at least **288 samples per metric per day** (five-minute basic-monitoring coverage). Missing, sparse, invalid, or duplicate daily metrics are not treated as zero utilization. Newly launched resources are skipped with a reason. This conservative policy may miss some waste rather than invent savings from missing evidence. Low utilization is a review recommendation, not proof a resource is safe to delete.

Load balancers often omit zero-traffic metrics. Those missing metrics are explicitly skipped, not interpreted as idle; classic TCP metrics may likewise be insufficient. Gateway load balancers are marked unsupported. Snapshot age and development tags alone do **not** establish waste, so these review findings do not inflate the savings total.

`app/aws/prices.json` is an illustrative, configurable USD table, **not live AWS pricing**. The starter table covers only `us-east-1`, gp2/gp3 storage, a few t3 instance sizes, and base load balancer rates. Other regions/types still produce findings, but with zero savings and an unknown-price note. Set `PRICE_TABLE_PATH` to a JSON file with the same schema and restart the process to use your own rates. Prices exclude discounts, reservations, Savings Plans, taxes, and add-on charges. Verify them against current AWS pricing before using estimates for decisions. All monetary calculations and totals use `Decimal`, rounded to cents in code.

### Run Rules Directly

After the backend environment is configured and an account role is linked, run from the repository root using the app's AWS execution identity:

```python
from app.aws.session import assume_role_session
from app.rules.runner import run_scan

session = assume_role_session("YOUR_CUSTOMER_ROLE_ARN", "YOUR_STORED_EXTERNAL_ID")
result = run_scan(session, regions=["us-east-1"], max_workers=4)
print(result.model_dump_json(indent=2))
```

Omit `regions` to discover enabled regions; `regions=[]` intentionally scans nothing. Regions run in parallel with separate boto3 sessions; calls use adaptive retries and timeouts. An `AccessDenied` or other AWS API failure skips only the affected rule/region and does not imply that check passed. Review `skipped_checks` alongside findings. Unexpected programming/configuration errors are raised rather than hidden. Temporary credentials stay in memory; scans must finish within their lifetime. The runner does not write to the database, enqueue jobs, call Gemini, or modify AWS resources.

## Prerequisites

- AWS account (personal) with billing alarm configured
- Google OAuth credentials
- Optional Gemini API key and current Flash-tier model for executive reports (check current terms for free vs paid)
- Docker and Docker Compose
- Node.js 22.12+ for frontend development (or use Compose)
- Python 3.12+ for host development

## Run the Backend Foundation

Create a billing alarm before provisioning any AWS test resources. Automated tests use mocks and do not create billable AWS resources.

Copy `.env.example` to `.env`, generate a random `JWT_SECRET` (at least 32 characters), and fill in Google OAuth credentials. Gemini settings may stay blank for this phase.

```bash
cp .env.example .env
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

Paste the generated value into `JWT_SECRET`. Register a Google OAuth **Web application** client with `http://localhost:8000/auth/google/callback` as its authorized redirect URI. For deployed environments, set `APP_BASE_URL` to the public HTTPS backend URL and register its corresponding callback. OAuth state cookies are HttpOnly, SameSite=Lax, expire after 10 minutes, and require HTTPS when `APP_BASE_URL` uses HTTPS.

### With Docker Compose

```bash
docker compose up --build
```

Services: PostgreSQL, Redis, FastAPI, the ARQ worker, and the React/Vite dashboard. The API applies `alembic upgrade head`, including migration `0003` for cost caching and delivery records, before starting; the worker waits for the API to be healthy so it never races migrations. Ports bind to localhost. PostgreSQL and Redis append-only data have persistent volumes. The included credentials and Vite server are for local development, not production hosting.

Open the dashboard at **http://localhost:5173** and the API docs at http://localhost:8000/docs. `/health` is a liveness check; it does not test AWS access, Redis, or worker readiness. The worker needs an AWS execution identity just like the API (see below).

Keep `APP_BASE_URL=http://localhost:8000`, `FRONTEND_ORIGIN=http://localhost:5173`, and the frontend's `VITE_API_BASE_URL` aligned. Only the configured frontend origin is allowed by CORS. Register the backend's `/auth/google/callback` URL with Google, not the frontend URL.

### Run the API on the Host

Run commands from the repository root, using Python 3.12+. Start PostgreSQL and Redis using Compose or supply your own development instances. The example `DATABASE_URL` and `REDIS_URL` point to localhost; Compose overrides their hostnames for the API container.

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
docker compose up -d postgres redis
alembic upgrade head
uvicorn app.main:app --reload
```

In another terminal, activate the same virtual environment and start the worker from the repository root:

```bash
arq app.workers.scan_job.WorkerSettings
```

Start the frontend from `frontend/`:

```bash
npm ci
npm run dev
```

The frontend defaults to `http://localhost:8000`. For another backend, copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_BASE_URL`. No AWS, Google client secret, or Gemini API key belongs in a `VITE_*` variable.

### Dashboard Flow

1. Click **Sign in with Google** and allow the popup. The backend validates OAuth/OIDC and hands the JWT to the exact configured frontend origin via `postMessage`. The browser verifies both the backend origin and popup source; the token stays in memory, never in localStorage or a URL. Refreshing the page requires signing in again.
2. On **Accounts**, create a connection, deploy `infra/customer-role.yaml` with its ExternalId, enter the RoleArn output, and click **Verify account**. Existing connections are loaded using authenticated `GET /accounts`.
3. On **Scans**, choose a verified account and click **Start Scan**. `POST /scans` accepts `{"account_id": 1}` and returns HTTP 202 with `{"scan_id": ..., "status": "pending"}` without running AWS checks in the request. Once weekly delivery is explicitly configured below, the scheduler can also start scans automatically.
4. The worker obtains fresh temporary AWS credentials, runs the regional rules, persists findings, skipped checks, and Decimal totals, and sets `completed` or `failed`. Findings link to `AwsAccount` through their parent `Scan.account_id`.
5. The dashboard polls authenticated `GET /scans/{id}` every 2.5 seconds, with no overlapping requests. It stops on completion/failure and aborts when navigating away or signing out. Transient polling errors retry; authorization/not-found errors stop polling. The table sorts by savings descending and supports severity and region filters.
6. **Report** shows stored findings, exact totals, skipped-check warnings, and safe errors. It loads an existing executive report without calling Gemini. Click **Generate AI summary** to request a new explanation; successful reports are cached per scan. Gemini failures show **AI summary unavailable**, without hiding findings or totals. **Load spend history** loads the account's cached Cost Explorer data, or fetches it when missing/expired, with service-by-month trends.

Progress is stage/region based: 0% queued, 5% running, up to 90% as regions finish, then 100% when results are committed. Findings are committed atomically at completion, not streamed piecemeal. A partial-permission scan can complete with explicit skipped checks; failure to initialize AWS access fails the scan instead of reporting a clean empty result. Queue failures return 503 and do not leave an orphaned pending scan after a rejected enqueue.

Worker jobs have a 14-minute timeout (shorter than their 15-minute STS credentials), and at most two scans run concurrently per worker. Duplicate deliveries do not duplicate findings. Graceful cancellation marks a scan failed and prevents late results from overwriting that state. A hard process/host crash can leave a running scan without a terminal state; automatic recovery/reconciliation is not implemented. After restarting the worker, refresh/sign in to start a new scan rather than relying on stale progress.

### Sign In and Link an AWS Account

For **local development only**, you can temporarily skip Google with `DEV_AUTH_ENABLED=true` in the backend `.env`. Compose also sets `VITE_DEV_AUTH_ENABLED` for the dashboard; for host Vite development set `VITE_DEV_AUTH_ENABLED=true` in `frontend/.env`. Recreate the API/worker and rebuild/recreate the frontend, then click **Continue with local development**. `POST /auth/dev/login` issues a non-expiring bearer JWT for a separate `dev:local` user, not an existing Google identity. The token is not the server's `JWT_SECRET` signing key. Backend and frontend URLs must both be localhost/loopback; keep the ports bound to localhost. Never enable this on a public deployment.

Set `DEV_AUTH_ENABLED=false` and recreate services to revoke all development tokens. Normal Google JWTs still expire after an hour, and normal tokens without expiration are rejected even in development mode. Any manually saved `.dev-jwt` file is a private local credential: do not commit, share, or bake it into an image. This bypass does **not** configure or bypass AWS permissions; account role verification is still required. The development user has a reserved, non-deliverable email address, not a verified Google email.

1. Open `http://localhost:8000/auth/google/login` in a browser. Google OAuth uses state, OIDC nonce, and PKCE; the backend validates the ID token and requires a verified email.
2. The callback returns JSON containing `access_token`, `token_type: bearer`, and `expires_in: 3600`, with caching disabled. Use `Authorization: Bearer <access_token>` on protected endpoints. No passwords are stored; sign in again when the token expires. Do not put tokens in URLs or persist them in browser localStorage.
3. Create an unverified account (an existing `role_arn` may optionally be included):

```bash
curl -X POST http://localhost:8000/accounts \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}'
```

4. Note the returned `id` and `external_id`. Deploy `infra/customer-role.yaml` **in the customer AWS account**, acknowledging `CAPABILITY_IAM`. Set `TrustedPrincipalArn` to the app's AWS account root ARN or, preferably, its specific execution-role ARN, and `ExternalId` to the exact server-generated value. Do not use the customer's own account as the trusted app principal. The stack outputs `RoleArn`.
5. Give the app's AWS execution identity permission to call `sts:AssumeRole` on that customer role. The customer role's trust policy alone is not enough. On EC2, use an instance profile; for host development, use boto3's standard credential chain, for example `export AWS_PROFILE=your-app-profile` before starting Uvicorn. No customer AWS access keys or STS credentials are saved in the database.
6. Verify using the returned values:

```bash
curl -X POST http://localhost:8000/accounts/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"account_id": 1, "role_arn": "arn:aws:iam::123456789012:role/YOUR_STACK_ROLE", "external_id": "YOUR_SERVER_GENERATED_EXTERNAL_ID"}'
```

Verification checks ownership, matches the supplied ExternalId against the stored value, obtains a 15-minute STS session, and lists enabled regions. Only the region list, verification time, and a 15-minute metadata expiry are persisted. These are snapshots, not authorization to reuse expired credentials. Failed AWS verification clears prior verification metadata without exposing raw AWS error messages.

Both the API (verification) and worker (scanning) need an AWS execution identity. The base Compose file intentionally does not mount your AWS credentials. For host development, export `AWS_PROFILE=your-app-profile` in **both** terminal sessions before starting their processes; alternatively, explicitly supply a read-only profile mount to both containers. Production should use an instance role rather than static keys. Neither service stores customer access keys or STS credentials in the database or Redis.

### Cost History and Weekly Delivery

**Cost Explorer:** on Report, click **Load spend history** to call owner-scoped `GET /accounts/{id}/cost`. It groups `UnblendedCost` by service for the previous three **completed UTC calendar months**, not a partial current month. A linked-account filter restricts payer roles to the AWS account in the connected role ARN. Pagination is exhausted, credits remain negative, and mixed currencies are not combined. Actual historical spend is separate from estimated savings.

PostgreSQL caches costs per connection, role ARN, and month window for `COST_CACHE_TTL_SECONDS` (default 86400). Row locks prevent concurrent cache misses from duplicating billed requests. Re-linking invalidates the old connection's costs. Failures are cached for five minutes and shown as unavailable, not zero spend. Same-role, same-window older data can be shown with an explicit stale warning. Cost Explorer must be activated and the customer role needs `ce:GetCostAndUsage`.

**Weekly reports:** delivery is disabled by default. Set `DELIVERY_CHANNEL=email` or `slack`, plus an explicit allowlist such as `DELIVERY_USER_IDS=[1]`, in the backend `.env`. Local user IDs can be read by an operator with `SELECT id, email FROM users;` in the app database. Only opted-in users' verified connections are scheduled. Restart/rebuild the API and worker after configuration changes.

- Email: set `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_FROM`, and optionally `SMTP_USERNAME`/`SMTP_PASSWORD`. Email goes only to the owner's last verified Google email. STARTTLS defaults on and is required for login credentials. Only disable it for an intentionally trusted, unauthenticated local relay. Implicit SMTP-over-SSL is not implemented; use a STARTTLS endpoint.
- Slack: set `SLACK_WEBHOOK_URL` to an HTTPS incoming webhook on `hooks.slack.com` or `hooks.slack-gov.com`. All allowlisted users share this deployment-level webhook; obtain their consent before delivering infrastructure details to that workspace. Secret webhook paths are redacted from normal HTTP request logging; mentions, markup, redirects, and link previews are disabled/escaped.
- Schedule: `WEEKLY_REPORT_DAY=0`, `WEEKLY_REPORT_HOUR=9`, `WEEKLY_REPORT_MINUTE=0` means Monday at 09:00 **UTC** (Monday=0, Sunday=6). The existing ARQ worker must be running; there is no extra scheduler service or automatic backfill of missed runs.

Each account/week has a unique delivery record and gets a fresh scan. The weekly job runs all rules, attempts/caches the optional Gemini report, loads cached/refreshed costs, and sends the top findings, code-computed savings, coverage warnings, and a `/?scan=<id>` dashboard link. That link requires normal sign-in and ownership checks. Disabled/unavailable Gemini or missing billing permissions do not prevent delivery of deterministic findings. No resources are changed.

Outbound delivery is attempted once. Queue and transport failures are recorded safely, and duplicate jobs do not resend an already claimed report. A hard crash or an ambiguous provider acknowledgement can leave uncertain delivery state; automatic recovery/resend is intentionally not implemented because SMTP/webhooks cannot be made exactly-once with the database transaction. Inspect delivery/provider logs before operator-driven resending. Both API and worker still need the app's AWS execution identity.

Existing customer roles should be updated from `infra/customer-role.yaml`: the new RDS rule may need `rds:ListTagsForResource` in addition to `rds:Describe*`. Missing permissions skip that check rather than terminating the scan.

### Tests

```bash
python -m pytest -q
```

The default suite uses isolated SQLite databases, moto/botocore mocks for AWS, and locally signed OIDC test tokens. It needs no AWS/Google credentials and tests migration upgrade, downgrade, and model/schema consistency. Scanner tests under `tests/rules/` cover all eight rules, pagination, healthy controls, unknown pricing, complete/missing/sparse metrics, parallel region isolation, and partial permissions. An integrated moto test account returns exactly the planted unattached EBS volume, unused EIP, and idle t3.micro, with totals equal to the sum of finding savings.

If `redis-server` is installed, tests use isolated Redis processes for the real API → ARQ → moto rules → database flow and weekly dispatch → fresh scan → mocked delivery flow. Otherwise those integration tests are explicitly skipped. Tests also cover cost pagination, linked-account filtering, TTL/negative caching, stale results, credits, role changes, delivery consent, SMTP TLS, and failure/deduplication. PostgreSQL-only tests verify concurrency protection for cost and Gemini cache misses. No live Cost Explorer, Gemini, SMTP or Slack calls are made.

Frontend tests and production build, from `frontend/`:

```bash
npm test
npm run build
```

These cover sign-in, account verification, scan polling, sorting/filters, reports and fallback, and monthly spend display/permission warnings. Live Google/AWS/Gemini/SMTP/Slack verification still requires your configured credentials.

To exercise the same database/API tests against PostgreSQL:

```bash
TEST_DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/DISPOSABLE_TEST_DB python -m pytest -q
```

**Use a dedicated disposable database:** tests create and drop tables. Do not point `TEST_DATABASE_URL` at a development or production database containing data.

## Gemini Integration Rules

### Configuration and Usage

Set `GEMINI_API_KEY` and `GEMINI_MODEL` in the backend `.env`, choosing a current Flash-tier model from Google AI Studio. Restart/rebuild the API after changing them. Leave either blank to disable Gemini; scanners, background jobs, findings, and savings continue to work. Never put these values in `VITE_*` variables. Use paid-tier terms appropriate for real customer infrastructure data; review Google's current data-use terms before enabling it.

- `POST /scans/{id}/report`: authenticated owner-only generation for a **completed** scan; returns a cached successful report if present. Opted-in weekly jobs use the same ownership/cache path. Response: `{"scan_id": ..., "ai_summary_unavailable": false, "report": {"executive_summary": ..., "top_actions": ..., "risks": ...}}`.
- `GET /scans/{id}/report`: reads only the cached report, never calls Gemini; returns 404 if none exists.
- Disabled Gemini, provider failures, malformed JSON, invalid references, or rejected prose return HTTP 200 with `ai_summary_unavailable: true` and `report: null` after at most one retry. Failure responses are not cached, allowing an explicit retry later; no repeated generation happens automatically on page loads.
- With no findings, code builds a no-findings summary without a provider call and warns about skipped checks when applicable. With findings, there are exactly three distinct prioritized actions when enough findings exist; otherwise there is an action per available finding, never fabricated filler.

### Input and Output Boundaries

`app/llm/prompts.py` chooses the top 20 findings by computed savings (ties by ID), with exact **all-finding** totals and aggregates by region, resource type, and severity. It validates supplied totals against the sum of findings. No raw AWS responses are sent. Titles/descriptions use canonical rule text rather than arbitrary stored strings; details are restricted to bounded numeric evidence and validated volume/instance types. Tags, account IDs, ARNs, role/external IDs, pricing-note text, and unknown fields are omitted. Recognized opaque AWS resource IDs may be retained; names, log group paths, ARN identifiers, and other sensitive identifiers become `resource-<finding_id>` aliases. Resource strings remain untrusted data, not instructions.

Gemini receives a Pydantic JSON schema through `google-genai`, with JSON MIME type and temperature 0.2. Responses are explicitly validated again. Finding references must be distinct and belong to the actual top-20 prompt, not another scan or a hidden finding. Prose is explanation-only: numeric/currency claims, number words, and recognizable resource identifiers are rejected (service names EC2/S3/IPv4 are allowed). Figures and resource labels in action links are rendered from database findings; the savings total stays code-owned. This deliberately stricter policy avoids trusting natural-language arithmetic. AI explanations still require human review and do not prove a resource is safe to delete.

Calls use a 15-second per-request transport timeout and at most two application attempts; SDK automatic retries are disabled. Only exception class names are logged, not prompts, provider responses, or keys. Successful reports use the existing unique `Report.scan_id` cache, so no new database migration is needed. PostgreSQL locks the scan row during generation so concurrent requests across API processes reuse a successful result. SQLite is for isolated tests and does not provide this row-lock guarantee. An interrupted client request may still finish and populate the server cache.

### Operating Rules

1. Keep the API key on the backend only, never in React.
2. **Minimize what you send.** Strip account IDs and ARNs, send resource IDs, types, sizes, and savings only.
3. **Use the paid tier for real customer data.** Free-tier API content may be used by Google to improve products — check current terms.
4. Wrap calls in a timeout and one retry. If Gemini fails, still show findings and say "AI summary unavailable" (product works without LLM).
5. Cache the report per scan so you never pay twice for the same input.
6. Convert raw `describe_*` JSON to findings first; never send raw AWS JSON to Gemini.
7. If Gemini outputs a dollar figure not computed by code, treat as a bug.

## How You'll Know It Works

- Your test account's planted waste is 100% detected.
- The report's savings total matches the sum of finding savings exactly.
- A scan on a partial-permission role completes and lists skipped checks.
- The app still works with Gemini turned off.

## Folder Structure (target)

```
app/
  api/          accounts.py scans.py reports.py auth.py
  core/         config.py security.py
  db/           models.py session.py  (+ alembic/)
  aws/          session.py regions.py pricing.py prices.json cost.py
  rules/        base.py runner.py metrics.py ebs.py eip.py ec2_idle.py nat.py logs.py
                load_balancers.py snapshots.py rds_dev.py
  llm/          gemini.py prompts.py
  workers/      scan_job.py weekly.py
  delivery/     send_report.py
frontend/       src/pages/{Accounts,Scans,Report}.tsx
infra/          customer-role.yaml
docker-compose.yml
tests/          rules/ (use moto to mock AWS)
```
