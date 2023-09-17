from dataclasses import dataclass
from service.cron.autodeactivate.sql import *
from service.cron.autodeactivate.disposableemails import disposable_emails
from service.cron.util import join_lists_of_dicts, print_stacktrace
import asyncio
import os
import psycopg

DRY_RUN = os.environ.get(
    'DUO_CRON_AUTODEACTIVATE_DRY_RUN',
    'true',
).lower() not in ['false', 'f', '0', 'no']

AUTODEACTIVATE_POLL_SECONDS = int(os.environ.get(
    'DUO_CRON_AUTODEACTIVATE_POLL_SECONDS',
    10,
))

DB_HOST      = os.environ['DUO_DB_HOST']
DB_PORT      = os.environ['DUO_DB_PORT']
DB_USER      = os.environ['DUO_DB_USER']
DB_PASS      = os.environ['DUO_DB_PASS']
DB_CHAT_NAME = os.environ['DUO_DB_CHAT_NAME']
DB_API_NAME  = os.environ['DUO_DB_API_NAME']

_api_conninfo = psycopg.conninfo.make_conninfo(
    host=DB_HOST,
    port=DB_PORT,
    dbname=DB_API_NAME,
    user=DB_USER,
    password=DB_PASS,
)

_chat_conninfo = psycopg.conninfo.make_conninfo(
    host=DB_HOST,
    port=DB_PORT,
    dbname=DB_CHAT_NAME,
    user=DB_USER,
    password=DB_PASS,
)

print('Hello from cron module: autodeactivate')

@dataclass
class JoinedPerson:
    person_id: int
    email: str
    seconds: int

def has_disposable_email(joined_person: JoinedPerson):
    try:
        left, right = joined_person.email.split('@')
        return right in disposable_emails
    except:
        print(traceback.format_exc())

    return False

def filter_deactiveatable(joined_persons: list[JoinedPerson]):
    return [j for j in joined_persons if has_disposable_email(j)]

async def autodeactivate_once():
    api_conn = await psycopg.AsyncConnection.connect(
        _api_conninfo,
        row_factory=psycopg.rows.dict_row
    )

    chat_conn = await psycopg.AsyncConnection.connect(
        _chat_conninfo,
        row_factory=psycopg.rows.dict_row
    )

    params = dict(polling_interval_seconds=AUTODEACTIVATE_POLL_SECONDS)
    cur_inactive = await chat_conn.execute(Q_INACTIVE, params)
    rows_inactive = await cur_inactive.fetchall()

    params = dict(ids=[r['person_id'] for r in rows_inactive])
    cur_emails = await api_conn.execute(Q_EMAILS, params)
    rows_emails = await cur_emails.fetchall()

    joined = join_lists_of_dicts(rows_inactive, rows_emails, 'person_id')

    joined_persons = [JoinedPerson(**j) for j in joined]
    deactiveatable_persons = filter_deactiveatable(joined_persons)
    deactiveatable_person_ids = [p.person_id for p in deactiveatable_persons]

    if deactiveatable_persons:
        print(
            f'About to deactivate {str(len(deactiveatable_persons))} '
            'accounts:',
        )
        for p in deactiveatable_persons:
            print(f'  - {p}')

    if not deactiveatable_person_ids:
        pass
    elif DRY_RUN:
        print('DUO_CRON_AUTODEACTIVATE_DRY_RUN env var prevented deactivation')
    else:
        params = dict(ids=deactiveatable_person_ids)
        await api_conn.execute(Q_DEACTIVATE, params)
        await api_conn.commit()
        print('Accounts deactivated!')

    await api_conn.close()
    await chat_conn.close()

async def autodeactivate_forever():
    while True:
        await print_stacktrace(autodeactivate_once)
        await asyncio.sleep(AUTODEACTIVATE_POLL_SECONDS)
