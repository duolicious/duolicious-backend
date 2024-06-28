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

    zero_uuids, zero_image_data_seq = [], []
    non_zero_uuids, non_zero_image_data_seq = [], []

    for uuid, image_data in zip(uuids, image_data_seq):
        if image_data:
            non_zero_uuids.append(uuid)
            non_zero_image_data_seq.append(image_data)
        else:
            zero_uuids.append(uuid)
            zero_image_data_seq.append(image_data)

    zero_nsfw_scores = [
        0.0 for _ in zero_image_data_seq]
    non_zero_nsfw_scores = await asyncio.to_thread(
        predict_nsfw, non_zero_image_data_seq)

    uuids_ = (
        zero_uuids + non_zero_uuids)
    nsfw_scores_ = (
        zero_nsfw_scores + non_zero_nsfw_scores)

    params_seq = [
        dict(uuid=uuid, nsfw_score=nsfw_score)
        for uuid, nsfw_score in zip(uuids_, nsfw_scores_)
    ]

    async with api_tx() as tx:
        await tx.executemany(Q_SET_NSFW_SCORE, params_seq)

async def predict_nsfw_photos_forever():
    await asyncio.sleep(random.randint(0, MAX_RANDOM_START_DELAY))
    while True:
        await print_stacktrace(predict_nsfw_photos_once)
        await asyncio.sleep(NSFW_PHOTO_RUNNER_POLL_SECONDS)
