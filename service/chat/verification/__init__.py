from async_lru_cache import AsyncLruCache
from database.asyncdatabase import api_tx

_Q_VERIFICATION_REQUIRED = f"""
SELECT
    1
FROM
    person
WHERE
    id = %(person_id)s
AND
    verification_required
AND
    verification_level_id <= 1
"""


FMT_VERIFICATION_REQUIRED = """
<duo_message_blocked id="{stanza_id}" reason="age-verification"/>
""".strip()


@AsyncLruCache(ttl=3)  # 3 seconds
async def verification_required(person_id: int) -> bool:
    async with api_tx('read committed') as tx:
        await tx.execute(_Q_VERIFICATION_REQUIRED, dict(person_id=person_id))
        row = await tx.fetchone()
        return row is not None
