import boto3

from app.aws.session import AWS_CONFIG


def list_enabled_regions(session: boto3.Session) -> list[str]:
    response = session.client("ec2", config=AWS_CONFIG).describe_regions(AllRegions=False)
    return sorted({region["RegionName"] for region in response["Regions"]
                   if region.get("OptInStatus") != "not-opted-in"})
