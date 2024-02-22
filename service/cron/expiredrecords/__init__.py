from database.asyncdatabase import api_tx, chat_tx
from service.cron.expiredrecords.sql import *
from service.cron.util import print_stacktrace, MAX_RANDOM_START_DELAY
import asyncio
import os
import random

EXPIRED_RECORDS_POLL_SECONDS = int(os.environ.get(
    'DUO_CRON_EXPIRED_RECORDS_POLL_SECONDS',
    10,
))

print('Hello from cron module: expiredrecords')

async def delete_expired_records_once():
    async with api_tx() as tx:
        cur = await tx.execute(Q_DELETE_EXPIRED_RECORDS)
        rows = await cur.fetchall()

    try:
        count = rows[0]['count']
    except:
        count = 0

    if count:
        print(f'Deleted {count} expired record(s)')

async def delete_expired_records_forever():
    await asyncio.sleep(random.randint(0, MAX_RANDOM_START_DELAY))
    while True:
        await print_stacktrace(delete_expired_records_once)
        await asyncio.sleep(EXPIRED_RECORDS_POLL_SECONDS)
