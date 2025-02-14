from async_lru_cache import AsyncLruCache
from database.asyncdatabase import api_tx
from enum import Enum

class IntroRateLimit(Enum):
    NONE = 0
    UNVERIFIED = 10
    BASICS = 20
    PHOTOS = 50


Q_RATE_LIMIT_REASON = f"""
WITH truncated_daily_message AS (
    SELECT
        1
    FROM
        messaged AS m1
    WHERE
        m1.subject_person_id = %(from_id)s
    AND
        m1.created_at >= NOW() - INTERVAL '24 HOURS'
    AND
        NOT EXISTS (
            SELECT
                1
            FROM
                messaged AS m2
            WHERE
                m2.subject_person_id = m1.object_person_id
            AND
                m2.object_person_id = m1.subject_person_id
            AND
                m2.created_at < m1.created_at
        )
    LIMIT
        {max(x.value for x in IntroRateLimit)}
), truncated_daily_message_count AS (
    SELECT COUNT(*) AS x FROM truncated_daily_message
)
SELECT
    CASE

    WHEN verification_level_id = 3 AND x >= {IntroRateLimit.PHOTOS.value}
    THEN                                    {IntroRateLimit.PHOTOS.value}

    WHEN verification_level_id = 2 AND x >= {IntroRateLimit.BASICS.value}
    THEN                                    {IntroRateLimit.BASICS.value}

    WHEN verification_level_id = 1 AND x >= {IntroRateLimit.UNVERIFIED.value}
    THEN                                    {IntroRateLimit.UNVERIFIED.value}

    ELSE                                    {IntroRateLimit.NONE.value}

    END AS rate_limit_reason
FROM
    person,
    truncated_daily_message_count
WHERE
    id = %(from_id)s
"""


@AsyncLruCache(maxsize=1024, ttl=5)  # 5 seconds
async def fetch_rate_limit_reason(from_id: int) -> IntroRateLimit:
    async with api_tx('read committed') as tx:
        await tx.execute(Q_RATE_LIMIT_REASON, dict(from_id=from_id))
        row = await tx.fetchone()

    return IntroRateLimit(row['rate_limit_reason'])


async def maybe_fetch_rate_limit(from_id: int, stanza_id: str) -> list[str]:
    rate_limit_reason = await fetch_rate_limit_reason(from_id=from_id)

    if rate_limit_reason == IntroRateLimit.NONE:
        return []
    elif rate_limit_reason == IntroRateLimit.UNVERIFIED:
        return [
                f'<duo_message_blocked id="{stanza_id}" '
                f'reason="rate-limited-1day" '
                f'subreason="unverified-basics"/>']
    elif rate_limit_reason == IntroRateLimit.BASICS:
        return [
                f'<duo_message_blocked id="{stanza_id}" '
                f'reason="rate-limited-1day" '
                f'subreason="unverified-photos"/>']
    elif rate_limit_reason == IntroRateLimit.PHOTOS:
        return [
                f'<duo_message_blocked id="{stanza_id}" '
                f'reason="rate-limited-1day"/>']
    else:
        raise Exception(f'Unhandled rate limit reason {rate_limit_reason}')
