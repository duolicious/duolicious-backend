from database.asyncdatabase import api_tx, chat_tx
from service.cron.garbagerecords.sql import *
from service.cron.util import print_stacktrace, MAX_RANDOM_START_DELAY
import asyncio
import os
import random

GARBAGE_RECORDS_POLL_SECONDS = int(os.environ.get(
    'DUO_CRON_GARBAGE_RECORDS_POLL_SECONDS',
    str(60), # 1 minute
))

print('Hello from cron module: garbagerecords')

async def delete_garbage_records_once():
    async with api_tx() as tx:
        cur = await tx.execute(Q_DELETE_GARBAGE_RECORDS_ON_DUO_API)
        api_rows = await cur.fetchall()

    async with chat_tx() as tx:
        cur = await tx.execute(Q_DELETE_GARBAGE_RECORDS_ON_DUO_CHAT)
        chat_rows = await cur.fetchall()

    try:
        api_count = int(api_rows[0]['count'])
    except:
        api_count = 0

    try:
        chat_count = int(chat_rows[0]['count'])
    except:
        chat_count = 0

    count = api_count + chat_count

    if count:
        print(f'Deleted {count} garbage record(s)')

async def delete_garbage_records_forever():
    await asyncio.sleep(random.randint(0, MAX_RANDOM_START_DELAY))
    while True:
        await print_stacktrace(delete_garbage_records_once)
        await asyncio.sleep(GARBAGE_RECORDS_POLL_SECONDS)
