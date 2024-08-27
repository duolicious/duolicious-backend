from sql import Q_UPSERT_LAST
from batcher import Batcher
from service.chat.username import Username
from typing import List
from database import chat_tx
import asyncio

LAST_UPDATE_INTERVAL_SECONDS = 4 * 60

def process_batch(usernames: List[str]):
    params_seq = [dict(person_uuid=username) for username in usernames]

    with chat_tx('read committed') as tx:
        tx.executemany(Q_UPSERT_LAST, params_seq)

_batcher = Batcher[str](
    process_fn=process_batch,
    flush_interval=1.0,
    min_batch_size=1,
    max_batch_size=1000,
    retry=False,
)

_batcher.start()

def update_last(username: Username):
    if username is None:
        return

    if username.username is None:
        return

    _batcher.enqueue(username.username)

async def update_last_forever(username: Username):
    try:
        while True:
            update_last(username)
            await asyncio.sleep(LAST_UPDATE_INTERVAL_SECONDS)
    except asyncio.exceptions.CancelledError:
        pass
    except:
        print(traceback.format_exc())
        raise

