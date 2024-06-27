from antiporn import predict_nsfw
from database.asyncdatabase import api_tx
from service.cron.nsfwphotorunner.sql import *
from service.cron.util import (
    MAX_RANDOM_START_DELAY,
    download_450_images,
    print_stacktrace,
)
import asyncio
import os
import random

NSFW_PHOTO_RUNNER_POLL_SECONDS = int(os.environ.get(
    'DUO_CRON_NSFW_PHOTO_RUNNER_POLL_SECONDS',
    str(1), # 1 second
))

print('Hello from cron module: nsfwphotorunner')

async def predict_nsfw_photos_once():
    async with api_tx() as tx:
        cur = await tx.execute(Q_50_UNCHECKED_PHOTOS)
        rows = await cur.fetchall()

    uuids = [r['uuid'] for r in rows]
    image_data_seq = await download_450_images(uuids)

    nsfw_scores = await asyncio.to_thread(predict_nsfw, image_data_seq)

    params_seq = [
        dict(uuid=uuid, nsfw_score=nsfw_score)
        for uuid, nsfw_score in zip(uuids, nsfw_scores)
    ]

    async with api_tx() as tx:
        await tx.executemany(Q_SET_NSFW_SCORE, params_seq)

async def predict_nsfw_photos_forever():
    await asyncio.sleep(random.randint(0, MAX_RANDOM_START_DELAY))
    while True:
        await print_stacktrace(predict_nsfw_photos_once)
        await asyncio.sleep(NSFW_PHOTO_RUNNER_POLL_SECONDS)
