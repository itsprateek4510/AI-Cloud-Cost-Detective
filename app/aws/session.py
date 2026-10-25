import boto3
from botocore.config import Config

from app.core.config import settings

AWS_CONFIG = Config(
    retries={"mode": "adaptive", "max_attempts": 3},
    connect_timeout=5,
    read_timeout=10,
)


def assume_role_session(role_arn: str, external_id: str) -> boto3.Session:
    # The default credential chain uses the app's instance role or local profile.
    sts = boto3.client("sts", region_name=settings.aws_region, config=AWS_CONFIG)
    response = sts.assume_role(
        RoleArn=role_arn,
        RoleSessionName="cost-detective-verify",
        ExternalId=external_id,
        DurationSeconds=900,
    )
    credentials = response["Credentials"]
    return boto3.Session(
        aws_access_key_id=credentials["AccessKeyId"],
        aws_secret_access_key=credentials["SecretAccessKey"],
        aws_session_token=credentials["SessionToken"],
        region_name=settings.aws_region,
    )
