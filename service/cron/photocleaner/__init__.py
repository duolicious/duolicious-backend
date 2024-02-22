from database.asyncdatabase import api_tx, chat_tx
from service.cron.photocleaner.sql import *
from service.cron.util import print_stacktrace, MAX_RANDOM_START_DELAY
import asyncio
import boto3
import os
import random

DRY_RUN = os.environ.get(
    'DUO_CRON_PHOTO_CLEANER_DRY_RUN',
    'true',
).lower() not in ['false', 'f', '0', 'no']

PHOTO_CLEANER_POLL_SECONDS = int(os.environ.get(
    'DUO_CRON_PHOTO_CLEANER_POLL_SECONDS',
    10,
))

R2_ACCT_ID           = os.environ['DUO_R2_ACCT_ID']
R2_ACCESS_KEY_ID     = os.environ['DUO_R2_ACCESS_KEY_ID']
R2_ACCESS_KEY_SECRET = os.environ['DUO_R2_ACCESS_KEY_SECRET']
R2_BUCKET_NAME       = os.environ['DUO_R2_BUCKET_NAME']

BOTO_ENDPOINT_URL = os.getenv(
    'DUO_BOTO_ENDPOINT_URL',
    f'https://{R2_ACCT_ID}.r2.cloudflarestorage.com'
)

print('Hello from cron module: photocleaner')

async def delete_images_from_object_store(uuids: list[str]):
    # Split the uuids list into chunks of 300 since the limit is 1000 and
    # there's three objects to delete per uuid
    chunks = [uuids[i:i+300] for i in range(0, len(uuids), 300)]

    s3_client = boto3.client(
        's3',
        endpoint_url=BOTO_ENDPOINT_URL,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_ACCESS_KEY_SECRET,
    )

    for chunk in chunks:
        keys_to_delete = [
            key_to_delete
            for uuid in chunk
            for key_to_delete in [
                f'original-{uuid}.jpg',
                f'900-{uuid}.jpg',
                f'450-{uuid}.jpg',
            ]
            if uuid is not None
        ]

        if DRY_RUN:
            print(
                'DUO_PHOTO_CLEANER_DRY_RUN env var prevented photo '
                'deletion:',
                keys_to_delete
            )
            continue

        delete_request = {
            'Objects': [{'Key': key} for key in keys_to_delete],
            'Quiet': True
        }

        # Use asyncio's run_in_executor to run synchronous boto3 call
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: s3_client.delete_objects(
                Bucket=R2_BUCKET_NAME,
                Delete=delete_request
            )
        )

        if 'Errors' in response:
            for error in response['Errors']:
                print(f"Error deleting {error['Key']}: {error['Message']}")
        else:
            for key in keys_to_delete:
                print('Deleted object', key)
            async with api_tx() as tx:
                await tx.execute(Q_MARK_PHOTO_DELETED, dict(uuids=chunk))
            print('Objects have been marked as deleted')

async def clean_photos_once():
    params = dict(polling_interval_seconds=PHOTO_CLEANER_POLL_SECONDS)

    async with api_tx() as tx:
        cur_unused_photos = await tx.execute(Q_UNUSED_PHOTOS, params)
        rows_unused_photos = await cur_unused_photos.fetchall()

    uuids = [r['uuid'] for r in rows_unused_photos]
    await delete_images_from_object_store(uuids)

async def clean_photos_forever():
    await asyncio.sleep(random.randint(0, MAX_RANDOM_START_DELAY))
    while True:
        await print_stacktrace(clean_photos_once)
        await asyncio.sleep(PHOTO_CLEANER_POLL_SECONDS)
