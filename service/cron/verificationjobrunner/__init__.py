from database.asyncdatabase import api_tx
from service.cron.verificationjobrunner.sql import *
from verification import verify
from service.cron.util import print_stacktrace, MAX_RANDOM_START_DELAY
import asyncio
import os
import random
from dataclasses import dataclass

VERIFICATION_POLL_SECONDS = int(os.environ.get(
    'DUO_CRON_VERIFICATION_POLL_SECONDS',
    str(1), # 1 second
))

print('Hello from cron module: verificationjobrunner')

@dataclass
class VerificationJob:
    id: int
    person_id: int
    proof_uuid: str
    claimed_uuids: list[str]
    claimed_age: int
    claimed_gender: str
    claimed_ethnicity: str | None

async def do_verification_job(verification_job: VerificationJob):
    async with api_tx() as tx:
        await tx.execute(
            Q_SET_VERIFICATION_JOB_RUNNING,
            dict(verification_job_id=verification_job.id)
        )

    verification_result = await verify(
        proof_uuid=verification_job.proof_uuid,
        claimed_uuids=verification_job.claimed_uuids,
        claimed_age=verification_job.claimed_age,
        claimed_gender=verification_job.claimed_gender,
        claimed_ethnicity=verification_job.claimed_ethnicity,
    )

    if verification_result.success:
        params = dict(
            verification_job_id=verification_job.id,
            person_id=verification_job.person_id,
            verified_uuids=verification_result.success.verified_uuids,
            verified_age=verification_result.success.is_verified_age,
            verified_gender=verification_result.success.is_verified_gender,
            verified_ethnicity=verification_result.success.is_verified_ethnicity,
            status='success',
            message='',
            verification_level_name=(
                'Photos'
                if verification_result.success.verified_uuids
                else 'Basics only'
            ),
            raw_json=verification_result.success.raw_json,
        )
    else:
        message = (
            verification_result.failure.reason
            if verification_result.failure
            else 'Something went wrong')

        params = dict(
            verification_job_id=verification_job.id,
            person_id=verification_job.person_id,
            verified_uuids=[],
            verified_age=False,
            verified_gender=False,
            verified_ethnicity=False,
            status='failure',
            message=message,
            verification_level_name='No verification',
            raw_json=verification_result.failure.raw_json,
        )

    async with api_tx() as tx:
        await tx.execute(Q_UPDATE_VERIFICATION_STATUS, params)

async def verify_once():
    async with api_tx() as tx:
        cur = await tx.execute(Q_QUEUED_VERIFICATION_JOBS)
        rows = await cur.fetchall()

    verification_jobs = [
        VerificationJob(
            id=row['id'],
            person_id=row['person_id'],
            proof_uuid=row['proof_uuid'],
            claimed_uuids=row['claimed_uuids'],
            claimed_age=row['claimed_age'],
            claimed_gender=row['claimed_gender'],
            claimed_ethnicity=row['claimed_ethnicity'],
        )
        for row in rows
    ]

    for verification_job in verification_jobs:
        await do_verification_job(verification_job)

async def verify_forever():
    await asyncio.sleep(random.randint(0, MAX_RANDOM_START_DELAY))
    while True:
        await print_stacktrace(verify_once)
        await asyncio.sleep(VERIFICATION_POLL_SECONDS)
