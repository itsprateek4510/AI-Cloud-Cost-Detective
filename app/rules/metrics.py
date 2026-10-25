from datetime import datetime, timedelta, timezone
import math

OBSERVATION_DAYS = 14
DAILY_TRAFFIC_LIMIT = 1024 * 1024
MIN_DAILY_SAMPLES = 288  # One sample per five minutes (EC2 basic monitoring).


def observation_window() -> tuple[datetime, datetime]:
    end = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return end - timedelta(days=OBSERVATION_DAYS), end


def daily_metric(client, namespace: str, name: str, dimension: str, resource_id: str,
                 statistic: str, start: datetime, end: datetime) -> list[float] | None:
    response = client.get_metric_statistics(
        Namespace=namespace, MetricName=name, Dimensions=[{"Name": dimension, "Value": resource_id}],
        StartTime=start, EndTime=end, Period=86400, Statistics=[statistic, "SampleCount"],
    )
    buckets = {}
    for point in response["Datapoints"]:
        timestamp = point["Timestamp"].astimezone(timezone.utc)
        if not start <= timestamp < end:
            continue
        day = (timestamp - start).days
        value = point.get(statistic)
        samples = point.get("SampleCount", 0)
        if (day in buckets or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0
                or not isinstance(samples, (int, float)) or not math.isfinite(samples) or samples < MIN_DAILY_SAMPLES):
            return None
        buckets[day] = value
    if set(buckets) != set(range((end - start).days)):
        return None
    return [buckets[day] for day in sorted(buckets)]
