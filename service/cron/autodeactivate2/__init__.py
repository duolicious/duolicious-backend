from database.asyncdatabase import api_tx
from service.cron.autodeactivate2.sql import *
from service.cron.autodeactivate2.template import emailtemplate
from service.cron.cronutil import print_stacktrace, MAX_RANDOM_START_DELAY
from smtp import aws_smtp
import asyncio
import os
import random
import sessioncache

DRY_RUN = os.environ.get(
    'DUO_CRON_AUTODEACTIVATE2_DRY_RUN',
    'true',
).lower() not in ['false', 'f', '0', 'no']

AUTODEACTIVATE2_POLL_SECONDS = int(os.environ.get(
    'DUO_CRON_AUTODEACTIVATE2_POLL_SECONDS',
    str(60 * 10), # 10 minutes
))

print(f'Hello from cron module: {__name__}')

def maybe_send_email(email: str):
    if email.lower().endswith('@example.com'):
        return

    send_args = dict(
        subject="Your profile is invisible 👻",
        body=emailtemplate(),
        to_addr=email,
    )

    print('autodeactivate2: sending deactivation email to', email)
    aws_smtp.send(**send_args)

async def autodeactivate2_once():
    params = dict(
        dry_run=DRY_RUN,
    )

    async with api_tx() as tx:
        cur_deactivated = await tx.execute(Q_DEACTIVATE, params)
        rows_deactivated = await cur_deactivated.fetchall()

    # Evict the cached sessions of everyone we just deactivated so their bearer
    # tokens stop authenticating immediately instead of lingering until the
    # cache TTL. Every row carries the same aggregated list, so read it once
    # (empty on a dry run, where nothing was deleted).
    #
    # `delete_session` is a *blocking* Redis call and this runs on the cron's
    # shared asyncio event loop, so offload each call to a thread; otherwise a
    # slow Redis would stall every other cron job (garbage collection, audio
    # cleanup, etc.) for the duration of the call.
    session_token_hashes = (
        rows_deactivated[0]['session_token_hashes'] if rows_deactivated else [])
    for session_token_hash in session_token_hashes:
        await asyncio.to_thread(sessioncache.delete_session, session_token_hash)

    for p in rows_deactivated:
        if DRY_RUN:
            print(
                f'  - autodeactive2: DUO_CRON_AUTODEACTIVATE2_DRY_RUN env '
                f'var prevented deactivation of {p}'
            )
        else:
            print(f'  - autodeactive2: deactivated {p}')

    for p in rows_deactivated:
        maybe_send_email(p['email'])

async def autodeactivate2_forever():
    await asyncio.sleep(random.randint(0, MAX_RANDOM_START_DELAY))
    while True:
        await print_stacktrace(autodeactivate2_once)
        await asyncio.sleep(AUTODEACTIVATE2_POLL_SECONDS)
