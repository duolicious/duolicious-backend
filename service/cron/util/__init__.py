from database.asyncdatabase import api_tx
from concurrent.futures import ThreadPoolExecutor
from botocore.exceptions import ClientError
from service.cron.util.sql import *
import asyncio
import boto3
import io
import os
import traceback
import time

R2_ACCT_ID           = os.environ['DUO_R2_ACCT_ID']
R2_ACCESS_KEY_ID     = os.environ['DUO_R2_ACCESS_KEY_ID']
R2_ACCESS_KEY_SECRET = os.environ['DUO_R2_ACCESS_KEY_SECRET']
R2_BUCKET_NAME       = os.environ['DUO_R2_BUCKET_NAME']

BOTO_ENDPOINT_URL = os.getenv(
    'DUO_BOTO_ENDPOINT_URL',
    f'https://{R2_ACCT_ID}.r2.cloudflarestorage.com'
)

MAX_RANDOM_START_DELAY = int(os.environ.get(
    'DUO_CRON_MAX_RANDOM_START_DELAY',
    15,
))

def join_lists_of_dicts(list1, list2, join_key):
    lookup1 = {item[join_key]: item for item in list1}
    lookup2 = {item[join_key]: item for item in list2}

    common_keys = set(lookup1.keys()) & set(lookup2.keys())

    return [lookup1[k] | lookup2[k] for k in common_keys]

async def print_stacktrace(fun):
    try:
        await fun()
    except:
        print(traceback.format_exc())

async def delete_images_from_object_store(
    uuids: list[str],
    dry_run: bool = True,
    dry_run_env_var_name: str = 'dry run',
):
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
                f'{uuid}.gif',
            ]
            if uuid is not None
        ]

        if dry_run:
            print(
                f'{dry_run_env_var_name} env var prevented photo deletion:',
                keys_to_delete
            )
            continue

        delete_request = {
            'Objects': [{'Key': key} for key in keys_to_delete],
            'Quiet': True
        }

        # Use asyncio's run_in_executor to run synchronous boto3 call
        response = await asyncio.to_thread(
            s3_client.delete_objects,
            Bucket=R2_BUCKET_NAME,
            Delete=delete_request,
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

async def download_450_images(
    uuids: list[str],
    max_workers: int = 5,
) -> list[io.BytesIO | None]:
    if not uuids:
        return []

    print(f'Downloading {len(uuids)} images')

    s3_client = boto3.client(
        's3',
        endpoint_url=BOTO_ENDPOINT_URL,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_ACCESS_KEY_SECRET,
    )

    def download_one(uuid):
        buffer = io.BytesIO()
        key = f'450-{uuid}.jpg'
        retries = 3
        for attempt in range(retries):
            try:
                s3_client.download_fileobj(
                    Bucket=R2_BUCKET_NAME,
                    Key=key,
                    Fileobj=buffer
                )
                buffer.seek(0)
                return buffer
            except ClientError as e:
                if e.response['Error']['Code'] in ('NoSuchKey', '404'):
                    if attempt < retries - 1:
                        time.sleep(2 ** attempt)
                        continue
                    else:
                        return None
                else:
                    raise

    def download_many():
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            return list(executor.map(download_one, uuids))

    results = await asyncio.to_thread(download_many)

    print(f'Downloading {len(uuids)} images complete')
    return results
