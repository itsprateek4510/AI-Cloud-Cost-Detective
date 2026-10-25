# Prompt 3: Job Queue + Dashboard with Polling

Add background scanning via Redis + ARQ and a React dashboard that polls for results.

## Goal
Make scans non-blocking: enqueue job, return scan_id immediately, worker processes, UI polls status/findings.

## What to build

### Backend
- `app/workers/scan_job.py`: ARQ worker that takes `scan_id`, loads account/role, assumes role per region/session, runs rules via `rules.runner`, persists `Finding` rows to DB, updates `Scan` status/progress/totals.
- `app/api/scans.py`:
  - `POST /scans` — create `Scan` (status=pending), enqueue job, return `{scan_id, status}`
  - `GET /scans/{id}` — return scan status, progress, totals (sum of savings), and findings (or paginated)
- Redis connection configured via `REDIS_URL`.

### Frontend
- Pages: `frontend/src/pages/Accounts.tsx`, `frontend/src/pages/Scans.tsx`, `frontend/src/pages/Report.tsx` (structure per plan)
- `Scans.tsx`: "Start Scan" button calls `POST /scans`, polls `GET /scans/{id}` every 2-3s until completed/failed, shows progress
- Findings table: sort by `savings_monthly` desc, filter by severity and region
- Show totals (count, total monthly savings)

### DB
- Ensure `Scan` has status (`pending|running|completed|failed`), progress, totals; `Finding` linked to `Scan` and `AwsAccount`.

## Project structure
```
app/
  api/          scans.py
  workers/      scan_job.py
frontend/
  src/pages/    Accounts.tsx Scans.tsx Report.tsx
```

## Exit criteria
- `POST /scans` returns scan_id immediately
- Worker processes and stores findings
- UI polls and shows progress
- Findings table sorted by savings, with severity/region filters
- Click "Scan" → watch progress → see findings
