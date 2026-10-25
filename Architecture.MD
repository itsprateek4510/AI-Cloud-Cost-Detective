## AI Cloud Cost Detective - Architecture (AWS + Gemini)

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
                 │  AWS     │   │  Redis  │   │  Worker  │   │  Gemini │
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

**Notes:**
- Phases 0–5 are implemented: FastAPI, SQLAlchemy/Alembic, Google OAuth/JWT, account linking, eight rules, Redis/ARQ scans, React/Vite/Tailwind, Gemini reports, cached Cost Explorer history, and opt-in weekly email/Slack delivery.
- Google OAuth uses a short-lived signed HttpOnly state cookie, OIDC nonce, and PKCE. The callback returns a one-hour bearer JWT; only the user's Google subject/email are persisted, not OAuth tokens or passwords.
- An explicitly enabled localhost-only development login can issue a non-expiring JWT for a separate dev user. It is off by default, never a production login, and does not bypass account ownership or AWS verification. Disabling DEV_AUTH_ENABLED revokes dev tokens; ordinary JWT expiration remains enforced.
- Scans are enqueued via ARQ/Redis; UI polls `GET /scans/{id}` for status and findings.
- `POST /scans` verifies account ownership and verification, commits a pending scan, and queues only its ID. The worker rechecks the account, obtains fresh STS credentials, runs boto3 off the async event loop, updates region-based progress, and atomically persists results. Findings belong to an account through `Finding.scan_id → Scan.account_id`. Queued jobs contain no AWS credentials.
- Browser sign-in uses a popup and an origin/source-validated postMessage handoff; JWTs remain in memory. API CORS permits only `FRONTEND_ORIGIN`. Scans and reports poll every 2.5 seconds until terminal state and show partial-permission skips, not just savings.
- AWS access is via STS AssumeRole + ExternalId (no stored AWS keys). CloudFormation template provisions a read-only role.
- Deterministic rules compute findings and savings; Gemini only explains/prioritizes/summarizes from a sanitized prompt.
- The standalone rule runner scans enabled regions in parallel using independent boto3 sessions and adaptive retries. It records permission/API failures per rule/region and missing metrics per resource. All totals use Decimal and a configurable USD price table; unknown prices yield zero savings. Idle checks require a complete 14-day window with adequate metric samples. No AWS resources are modified.
- API key stays on backend. Reports cached per scan.
- Report generation is manual or opted-in through weekly delivery, and owner-scoped to completed scans. PostgreSQL row locks serialize generation; unique Report.scan_id stores validated successes. Gemini receives the top 20 sanitized findings plus aggregates, never raw AWS responses or tags. Prose cannot supply figures: code renders savings and resource labels from findings. Schema/reference validation, timeout, one retry and an unavailable flag preserve the product when Gemini fails.
- Cost Explorer groups UnblendedCost by service over three completed UTC months, filtered to the connected AWS account. PostgreSQL caches by connection/role/window with a configurable TTL and row-lock protection. Failure caches and explicit stale/unavailable flags prevent repeated billed reads or false zero-spend claims.
- The ARQ worker owns weekly UTC cron scheduling. Delivery requires an explicit user-ID allowlist and email/Slack configuration. Each account/week is deduplicated in weekly_deliveries and gets a new scan, optional AI summary, costs, and a protected dashboard link. Missing AI/billing access does not suppress deterministic findings. External sends are attempted once; crash/ambiguous-delivery reconciliation is not automated.
