# Prompt 1: FastAPI Foundation + AWS AssumeRole + CloudFormation

Create the backend foundation for the AWS Cost & Misconfiguration AI Agent.

## Goal
Set up FastAPI app structure, DB models/migrations, config, and AWS account linking via STS AssumeRole with ExternalId.

## What to build

### Infrastructure/Config
- Add `docker-compose.yml` running Postgres, Redis, and FastAPI (for local dev).
- Add `.env.example` with: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `APP_BASE_URL`.
- Use Pydantic settings in `app/core/config.py`.

### Database
- SQLAlchemy models in `app/db/models.py`: `User`, `AwsAccount` (with `role_arn`, `external_id`, `verified_at`), `Scan`, `Finding`, `Report`.
- Alembic setup in `app/db/` with initial migration.
- DB session in `app/db/session.py`.

### Auth (Google OAuth + JWT)
- Add `app/api/auth.py` with Google OAuth flow and JWT session issuance (httpOnly cookie or Bearer as appropriate). No password auth.
- Auth dependency for protected routes.

### AWS Account Linking
- `app/aws/session.py` to assume role via STS with ExternalId, return boto3 session.
- `app/api/accounts.py`:
  - `POST /accounts` — generate a unique `external_id` per user, store `AwsAccount` (unverified), return role ARN guidance + external_id.
  - `POST /accounts/verify` — call `assume_role` with provided role_arn and external_id; on success mark verified and store a short-lived verification metadata; return success/failure.
- Provide CloudFormation template `infra/customer-role.yaml` that creates a read-only role trusting the app's AWS account and requiring `sts:ExternalId`. Include minimal permissions from the plan:
  ```
  ec2:Describe*              rds:Describe*
  elasticloadbalancing:Describe*
  cloudwatch:GetMetricData   cloudwatch:GetMetricStatistics
  logs:DescribeLogGroups     ce:GetCostAndUsage
  s3:GetBucketPublicAccessBlock  s3:GetBucketPolicyStatus  s3:ListAllMyBuckets
  ```

### Health
- `GET /health` returns OK. DB migration must run successfully.

## Project structure
```
app/
  api/          accounts.py auth.py
  core/         config.py security.py
  db/           models.py session.py (+ alembic/)
  aws/          session.py
infra/          customer-role.yaml
docker-compose.yml
.env.example
```

## Exit criteria
- `GET /health` works
- DB migrates
- `POST /accounts` generates external_id
- CloudFormation template exists
- `POST /accounts/verify` can assume role in test account and list regions (or confirm access)


Always refer to Architecture.MD and RequestFlow.MD 