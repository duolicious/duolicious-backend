from database.asyncdatabase import api_tx
from service.cron.cronutil import MAX_RANDOM_START_DELAY
from urlslug import assign_url_slug_async
import asyncio
import os
import random
import traceback

# One-shot backfill that populates person.url_slug for users created before
# custom profile URLs existed. The unique index already exists (created by the
# migration), so assign_url_slug_async enforces uniqueness as we go. Disabled by
# default; enable it once, let it run to completion, then disable it again.
ENABLED = os.environ.get(
    'DUO_CRON_URL_SLUG_BACKFILL_ENABLED',
    '0',
).lower() not in ['false', 'f', '0', 'no', '']

BATCH_SIZE = int(os.environ.get(
    'DUO_CRON_URL_SLUG_BACKFILL_BATCH_SIZE',
    str(1000),
))

POLL_SECONDS = float(os.environ.get(
    'DUO_CRON_URL_SLUG_BACKFILL_POLL_SECONDS',
    str(1),
))

print(f'Hello from cron module: {__name__}')

async def _backfill_batch() -> int:
    async with api_tx() as tx:
        cur = await tx.execute(
            """
            SELECT id FROM person WHERE url_slug IS NULL ORDER BY id LIMIT %(n)s
            """,
            dict(n=BATCH_SIZE),
        )
        rows = await cur.fetchall()

        for row in rows:
            await assign_url_slug_async(tx, row['id'])

    return len(rows)

async def backfill_url_slug_forever():
    if not ENABLED:
        return

    await asyncio.sleep(random.randint(0, MAX_RANDOM_START_DELAY))

    try:
        while True:
            count = await _backfill_batch()
            if not count:
                print('url_slug backfill: complete')
                return
            print(f'url_slug backfill: assigned {count} slug(s)')
            await asyncio.sleep(POLL_SECONDS)
    except:
        print(traceback.format_exc())
