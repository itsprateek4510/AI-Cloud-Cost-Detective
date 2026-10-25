import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.aws.session import AWS_CONFIG, assume_role_session
from app.core.security import get_current_user
from app.db.models import AwsAccount, User
from app.db.session import get_db

router = APIRouter(prefix="/accounts", tags=["accounts"])
RoleArn = Annotated[str, Field(
    max_length=2048,
    pattern=r"^arn:aws(?:-us-gov|-cn)?:iam::[0-9]{12}:role/[A-Za-z0-9_+=,.@/\-]+$",
)]


class CreateAccount(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role_arn: RoleArn | None = None


class VerifyAccount(BaseModel):
    model_config = ConfigDict(extra="forbid")
    account_id: int = Field(gt=0)
    role_arn: RoleArn
    external_id: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")


class AccountCreated(BaseModel):
    id: int
    role_arn: str | None
    external_id: str
    template_path: str = "infra/customer-role.yaml"
    guidance: str = (
        "Deploy the customer-role template in your AWS account. Set TrustedPrincipalArn to the app's "
        "AWS account or execution-role ARN and ExternalId to the external_id below. "
        "Then submit account_id, the resulting role_arn, and external_id to POST /accounts/verify."
    )


class AccountVerified(BaseModel):
    account_id: int
    verified: bool
    regions: list[str]
    expires_at: datetime


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    role_arn: str | None
    external_id: str
    verified_at: datetime | None


@router.get("", response_model=list[AccountOut])
def list_accounts(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return db.scalars(select(AwsAccount).where(AwsAccount.user_id == user.id).order_by(AwsAccount.id)).all()


@router.post("", response_model=AccountCreated, status_code=201)
def create_account(
    body: CreateAccount,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    account = AwsAccount(user_id=user.id, role_arn=body.role_arn, external_id=secrets.token_urlsafe(32))
    db.add(account)
    db.commit()
    db.refresh(account)
    return AccountCreated(id=account.id, role_arn=account.role_arn, external_id=account.external_id)


@router.post("/verify", response_model=AccountVerified)
def verify_account(
    body: VerifyAccount,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    account = db.scalar(select(AwsAccount).where(AwsAccount.id == body.account_id, AwsAccount.user_id == user.id))
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if not secrets.compare_digest(account.external_id, body.external_id):
        raise HTTPException(status_code=400, detail="ExternalId does not match this account")
    try:
        session = assume_role_session(body.role_arn, account.external_id)
        regions = sorted(
            region["RegionName"]
            for region in session.client("ec2", config=AWS_CONFIG).describe_regions(AllRegions=False)["Regions"]
        )
    except (ClientError, BotoCoreError) as error:
        account.verified_at = None
        account.verification_metadata = None
        db.commit()
        if isinstance(error, ClientError):
            raise HTTPException(
                status_code=400,
                detail="AWS verification failed. Check the role trust, ExternalId and DescribeRegions permission.",
            ) from None
        raise HTTPException(status_code=503, detail="AWS is unavailable or the app's AWS credentials are missing") from None
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=15)
    account.role_arn = body.role_arn
    account.verified_at = now
    account.verification_metadata = {
        "regions": regions, "checked_at": now.isoformat(), "expires_at": expires_at.isoformat(),
    }
    db.commit()
    return AccountVerified(account_id=account.id, verified=True, regions=regions, expires_at=expires_at)
