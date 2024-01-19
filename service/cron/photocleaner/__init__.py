from service.cron.photocleaner.sql import *
from service.cron.util import print_stacktrace
import asyncio
import boto3
import os
import psycopg

DRY_RUN = os.environ.get(
    'DUO_CRON_PHOTO_CLEANER_DRY_RUN',
    'true',
).lower() not in ['false', 'f', '0', 'no']

PHOTO_CLEANER_POLL_SECONDS = int(os.environ.get(
    'DUO_CRON_PHOTO_CLEANER_POLL_SECONDS',
    10,
))

DB_HOST     = os.environ['DUO_DB_HOST']
DB_PORT     = os.environ['DUO_DB_PORT']
DB_USER     = os.environ['DUO_DB_USER']
DB_PASS     = os.environ['DUO_DB_PASS']
DB_API_NAME = os.environ['DUO_DB_API_NAME']

R2_ACCT_ID           = os.environ['DUO_R2_ACCT_ID']
R2_ACCESS_KEY_ID     = os.environ['DUO_R2_ACCESS_KEY_ID']
R2_ACCESS_KEY_SECRET = os.environ['DUO_R2_ACCESS_KEY_SECRET']
R2_BUCKET_NAME       = os.environ['DUO_R2_BUCKET_NAME']

BOTO_ENDPOINT_URL = os.getenv(
    'DUO_BOTO_ENDPOINT_URL',
    f'https://{R2_ACCT_ID}.r2.cloudflarestorage.com'
)

_api_conninfo = psycopg.conninfo.make_conninfo(
    host=DB_HOST,
    port=DB_PORT,
    dbname=DB_API_NAME,
    user=DB_USER,
    password=DB_PASS,
)

print('Hello from cron module: photocleaner')

async def delete_images_from_object_store(api_conn, uuids: list[str]):
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
            await api_conn.execute(Q_MARK_PHOTO_DELETED, dict(uuids=chunk))
            await api_conn.commit()
            print('Objects have been marked as deleted')

async def clean_photos_once():
    api_conn = await psycopg.AsyncConnection.connect(
        _api_conninfo,
        row_factory=psycopg.rows.dict_row
    )

    params = dict(polling_interval_seconds=PHOTO_CLEANER_POLL_SECONDS)
    cur_unused_photos = await api_conn.execute(Q_UNUSED_PHOTOS, params)
    rows_unused_photos = await cur_unused_photos.fetchall()

    uuids = [r['uuid'] for r in rows_unused_photos]
    await delete_images_from_object_store(api_conn, uuids)

    await api_conn.close()

async def clean_photos_forever():
    while True:
        await print_stacktrace(clean_photos_once)
        await asyncio.sleep(PHOTO_CLEANER_POLL_SECONDS)
