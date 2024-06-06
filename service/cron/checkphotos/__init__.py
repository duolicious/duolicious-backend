# Remove unused imports
from database.asyncdatabase import api_tx, chat_tx
from service.cron.util import print_stacktrace, MAX_RANDOM_START_DELAY
import asyncio
import boto3
import os
import random
import io
import blurhash
import numpy
from PIL import Image

DRY_RUN = os.environ.get(
    'DUO_CRON_CHECK_PHOTOS_DRY_RUN',
    'true',
).lower() not in ['false', 'f', '0', 'no']

CHECK_PHOTOS_POLL_SECONDS = int(os.environ.get(
    'DUO_CRON_CHECK_PHOTOS_POLL_SECONDS',
    str(1), # 1 second
))

R2_ACCT_ID           = os.environ['DUO_R2_ACCT_ID']
R2_ACCESS_KEY_ID     = os.environ['DUO_R2_ACCESS_KEY_ID']
R2_ACCESS_KEY_SECRET = os.environ['DUO_R2_ACCESS_KEY_SECRET']
R2_BUCKET_NAME       = os.environ['DUO_R2_BUCKET_NAME']

BOTO_ENDPOINT_URL = os.getenv(
    'DUO_BOTO_ENDPOINT_URL',
    f'https://{R2_ACCT_ID}.r2.cloudflarestorage.com'
)

print('Hello from cron module: checkphotos')

s3_client = boto3.client(
    's3',
    endpoint_url=BOTO_ENDPOINT_URL,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_ACCESS_KEY_SECRET,
)

async def delete_images_from_object_store(uuids: list[str]):
    # Split the uuids list into chunks of 300 since the limit is 1000 and
    # there's three objects to delete per uuid
    chunks = [uuids[i:i+300] for i in range(0, len(uuids), 300)]

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

        delete_request = {
            'Objects': [{'Key': key} for key in keys_to_delete],
            'Quiet': True
        }

        if DRY_RUN:
            print(
                'DUO_CHECK_PHOTOS_DRY_RUN env var prevented photo deletion:',
                keys_to_delete
            )
            continue

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
                print(f"checkphotos: Error deleting {error['Key']}: {error['Message']}")
        else:
            for key in keys_to_delete:
                print('checkphotos: Deleted object', key)
            print('checkphotos: Objects have been marked as deleted')

async def update_blurhashes(uuids: list[str]):
    images = download_450_images(uuids)
    blurhashes = compute_blurhashes(images)

    params_seq = [
        dict(uuid=uuid, blurhash=blurhash)
        for uuid, blurhash in zip(uuids, blurhashes)
    ]

    q = "update photo set blurhash = %(blurhash)s where uuid = %(uuid)s"

    if DRY_RUN:
        print(
            'DUO_CHECK_PHOTOS_DRY_RUN env var prevented blurhash update:',
            params_seq
        )
        return

    async with api_tx() as tx:
        await tx.executemany(q, params_seq)

    print('checkphotos: updated blurhashes', params_seq)

def list_images_in_object_store() -> list[list[str]]:
    print(f'checkphotos: listing images in object store')
    paginator = s3_client.get_paginator('list_objects_v2')

    count = 0

    # Iterate over the pages of the results
    for page in paginator.paginate(
            Bucket=R2_BUCKET_NAME, Prefix='450-', MaxKeys=300):
        # Check if 'Contents' key is in the page (it's not if the bucket is empty)
        if 'Contents' in page:
            keys = [obj['Key'] for obj in page['Contents']]

            count += len(keys)

            print(f'checkphotos: fetched {count} keys')

            yield keys

    print(f'checkphotos: fetched {count} keys in total')

def list_uuids_in_object_store() -> list[list[str]]:
    for chunk in list_images_in_object_store():
        yield [key[4:-4] for key in chunk]

async def resolve_uuids(uuids: list[str]) -> tuple[list[str], list[str]]:
    q_to_update = """
        SELECT uuid
        FROM photo
        WHERE
            uuid = ANY(%(uuids)s::TEXT[])
        AND
            blurhash = ''
    """
    q_to_delete = """
        SELECT unn.uuid
        FROM unnest(%(uuids)s::TEXT[]) AS unn(uuid)
        LEFT JOIN photo p ON unn.uuid = p.uuid
        LEFT JOIN onboardee_photo op ON unn.uuid = op.uuid
        WHERE p.uuid IS NULL AND op.uuid IS NULL
    """
    params = dict(uuids=uuids)

    async with api_tx() as tx:
        cur = await tx.execute(q_to_update, params)
        to_update = await cur.fetchall()

    async with api_tx() as tx:
        cur = await tx.execute(q_to_delete, params)
        to_delete = await cur.fetchall()

    to_update = [x['uuid'] for x in to_update]
    to_delete = [x['uuid'] for x in to_delete]

    return to_update, to_delete

def download_450_images(uuids: list[str]) -> list[io.BytesIO]:
    print('checkphotos: downloading images')

    objects = []
    for uuid in uuids:
        # Create a BytesIO object to hold the binary data
        buffer = io.BytesIO()

        # Download the object from S3 and put it into the buffer
        key = f'450-{uuid}.jpg'
        s3_client.download_fileobj(
            Bucket=R2_BUCKET_NAME,
            Key=key,
            Fileobj=buffer
        )

        # Reset buffer pointer to the beginning after writing
        buffer.seek(0)

        # Store the buffer in a dictionary using the key as its identifier
        objects.append(buffer)

    print('checkphotos: downloading images complete')

    return objects

def compute_blurhash(image_bytes: io.BytesIO) -> str:
    image = Image.open(image_bytes)
    image = image.resize((16, 16), resample=Image.Resampling.NEAREST)
    return blurhash.encode(numpy.array(image.convert("RGB")))

def compute_blurhashes(images: list[io.BytesIO]) -> list[str]:
    print('checkphotos: computing blurhashes')

    blurhashes = [compute_blurhash(i) for i in images]

    print('checkphotos: computing blurhashes complete')

    return blurhashes

async def check_photos_once():
    for chunk in list_uuids_in_object_store():
        uuids_to_update, uuids_to_delete = await resolve_uuids(chunk)

        await update_blurhashes(uuids_to_update)
        await delete_images_from_object_store(uuids_to_delete)

async def check_photos_forever():
    await asyncio.sleep(random.randint(0, MAX_RANDOM_START_DELAY))
    while True:
        await print_stacktrace(check_photos_once)
        await asyncio.sleep(CHECK_PHOTOS_POLL_SECONDS)
