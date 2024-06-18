from database.asyncdatabase import api_tx
from service.cron.nsfwphotocleaner.sql import *
from service.cron.util import (
    MAX_RANDOM_START_DELAY,
    delete_images_from_object_store,
    print_stacktrace,
)
import asyncio
import os
import random

DRY_RUN = os.environ.get(
    'DUO_CRON_NSFW_PHOTO_CLEANER_DRY_RUN',
    'true',
).lower() not in ['false', 'f', '0', 'no']

NSFW_PHOTO_CLEANER_POLL_SECONDS = int(os.environ.get(
    'DUO_CRON_NSFW_PHOTO_CLEANER_POLL_SECONDS',
    str(60), # 1 minute
))

print('Hello from cron module: nsfwphotocleaner')

def classify_local_images_nsfw(images: list[io.BytesIO]) -> list[bool]:
    # TODO
    return

def classify_remote_images_nsfw(uuids: list[str]) -> list[bool]:
    images = download_450_images(uuids)
    return classify_local_images_nsfw(images)

async def clean_nsfw_photos_once():
    async with api_tx() as tx:
        cur = await tx.execute(Q_50_UNCHECKED_PHOTOS)
        rows = await cur.fetchall()

    uuids = [r['uuid'] for r in rows]

    is_nsfw = classify_remote_images_nsfw(uuids)

    nsfw_uuids = [uuid for uuid, is_nsfw in zip(uuids, is_nsfw) if     is_nsfw]
    sfw_uuids  = [uuid for uuid, is_nsfw in zip(uuids, is_nsfw) if not is_nsfw]

    await delete_images_from_object_store(
        uuids=nsfw_uuids,
        dry_run=DRY_RUN,
        dry_run_env_var_name='DUO_CRON_NSFW_PHOTO_CLEANER_DRY_RUN',
    )

    async with api_tx() as tx:
        await tx.execute(Q_SET_NSFW_CHECKED, dict(uuids=sfw_uuids))

async def clean_nsfw_photos_forever():
    await asyncio.sleep(random.randint(0, MAX_RANDOM_START_DELAY))
    while True:
        await print_stacktrace(clean_nsfw_photos_once)
        await asyncio.sleep(NSFW_PHOTO_CLEANER_POLL_SECONDS)
