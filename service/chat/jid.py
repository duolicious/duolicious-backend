"""
Dependency-light JID and timestamp helpers.

Kept free of database/redis imports so the protocol layer (and unit tests) can
use them without pulling in the rest of the service.
"""
import datetime


LSERVER = 'duolicious.app'

FMT_ISO_8601_TIMESTAMP = '%Y-%m-%dT%H:%M:%S.%fZ'


def to_bare_jid(jid: str | None) -> str | None:
    if jid is None:
        return None

    try:
        return jid.split('@')[0]
    except Exception:
        return None


def format_timestamp(microseconds: int) -> str:
    """
    Converts a timestamp in microseconds to an ISO 8601 string.
    """
    timestamp_sec = microseconds / 1e6
    dt = datetime.datetime.utcfromtimestamp(timestamp_sec)
    return dt.strftime(FMT_ISO_8601_TIMESTAMP)


def format_datetime(dt: datetime.datetime) -> str:
    """
    Converts a datetime to an ISO 8601 string in UTC. Naive datetimes (e.g. the
    `TIMESTAMP` columns, which store UTC) are assumed to be in UTC.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    return dt.astimezone(datetime.timezone.utc).strftime(FMT_ISO_8601_TIMESTAMP)
