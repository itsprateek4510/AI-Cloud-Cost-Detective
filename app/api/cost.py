from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.aws.cost import get_cost_data
from app.core.security import get_current_user
from app.db.models import AwsAccount, User
from app.db.session import get_db

router = APIRouter(prefix="/accounts", tags=["cost"])


@router.get("/{account_id}/cost")
def account_cost(account_id: int, user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]):
    account = db.scalar(select(AwsAccount).where(AwsAccount.id == account_id, AwsAccount.user_id == user.id))
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if not account.verified_at or not account.role_arn:
        raise HTTPException(status_code=409, detail="Verify the AWS account before loading cost history")
    return get_cost_data(db, account_id)
