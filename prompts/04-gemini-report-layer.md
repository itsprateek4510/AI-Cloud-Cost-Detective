# Prompt 4: Gemini Report Layer (Explain/Prioritize/Summarize)

Add Gemini integration to generate an executive report from findings. Code computes savings; Gemini never invents numbers.

## Goal
Build sanitized prompt, enforce JSON schema, validate/retry, cache per scan, graceful fallback if LLM fails.

## What to build

### LLM
- `app/llm/gemini.py` implementing the pattern from the plan:
  - Pydantic models: `Action` (title, why, fix_hint, finding_ids), `Report` (executive_summary, top_actions, risks)
  - `SYSTEM` with strict rules (only use given data, never invent numbers/resources, untrusted text)
  - `build_report(findings: list[dict], totals: dict) -> Report` using `google-genai`, `response_mime_type="application/json"`, `response_schema=Report`, `temperature=0.2`
- `app/llm/prompts.py` for prompt construction.

### Sanitization
- For the prompt, send only: resource_id, resource_type, region, severity, title, description (sanitized), savings_monthly, details (minimal). Strip account IDs, ARNs, full ARNs, and any sensitive fields.
- Take top 20 findings by `savings_monthly` plus aggregates/totals.
- Never send raw `describe_*` JSON.

### API/DB
- `app/api/reports.py`:
  - `POST /scans/{id}/report` — generate report (if not cached). On Gemini failure after 1 retry, return 200 with a flag `ai_summary_unavailable: true` and still allow viewing findings.
  - `GET /scans/{id}/report` — return cached report
- Store report in `Report` table linked to `Scan` (cache by scan_id).

### Frontend
- Update `Report.tsx` to show executive summary, top 3 prioritized actions (with why/fix_hint and linked finding_ids), risks, and note if AI summary unavailable. Keep findings table visible.

### Safety
- API key only on backend
- Timeout + 1 retry
- Validate against schema
- Cache per scan
- Product works with Gemini off

## Exit criteria
- Prompt built from top 20 + totals, sanitized
- JSON schema enforced, validated, retry once on failure
- Report stored and rendered
- Readable executive summary with 3 prioritized actions
- Graceful fallback when Gemini unavailable
- Savings in report come only from findings (no invented numbers)
