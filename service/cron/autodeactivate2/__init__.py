from service.cron.autodeactivate2.sql import *
from service.cron.autodeactivate2.template import emailtemplate
from service.cron.util import print_stacktrace
import asyncio
import json
import os
import psycopg
import traceback
import urllib.request

DRY_RUN = os.environ.get(
    'DUO_CRON_AUTODEACTIVATE2_DRY_RUN',
    'true',
).lower() not in ['false', 'f', '0', 'no']

DEBUG_EMAIL = os.environ.get(
    'DUO_CRON_AUTODEACTIVATE2_DEBUG_EMAIL',
    'true',
).lower() not in ['false', 'f', '0', 'no']

EMAIL_KEY = os.environ['DUO_EMAIL_KEY']
EMAIL_URL = os.environ['DUO_EMAIL_URL']

AUTODEACTIVATE2_POLL_SECONDS = int(os.environ.get(
    'DUO_CRON_AUTODEACTIVATE2_POLL_SECONDS',
    10,
))

DB_HOST      = os.environ['DUO_DB_HOST']
DB_PORT      = os.environ['DUO_DB_PORT']
DB_USER      = os.environ['DUO_DB_USER']
DB_PASS      = os.environ['DUO_DB_PASS']
DB_CHAT_NAME = os.environ['DUO_DB_CHAT_NAME']
DB_API_NAME  = os.environ['DUO_DB_API_NAME']

_emails_file = os.path.join(
        os.path.dirname(__file__), '..', '..', '..',
        'test/output/cron-emails')

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

print('Hello from cron module: autodeactivate2')

def email_http_request(email: str):
    headers = {
        'accept': 'application/json',
        'api-key': EMAIL_KEY,
        'content-type': 'application/json'
    }

    data = {
       "sender": {
          "name": "Duolicious",
          "email": "no-reply@duolicious.app"
       },
       "to": [ { "email": email } ],
       "subject": "Your profile is invisible! 👻",
       "htmlContent": emailtemplate()
    }

    return urllib.request.Request(
        EMAIL_URL,
        headers=headers,
        data=json.dumps(data).encode('utf-8')
    )

def maybe_send_email(email: str):
    req = email_http_request(email)

    if DEBUG_EMAIL:
        print(
            'autodeactivate2: DUO_CRON_AUTODEACTIVATE2_DEBUG_EMAIL env var '
            'prevented email from being sent'
        )
        email_data = dict(
            headers=req.headers | {'Api-key': 'redacted'},
            data=req.data.decode('utf8'),
        )
        email_data_str = json.dumps(email_data) + '\n'

        with open(_emails_file, 'a') as f:
            f.write(email_data_str)
    else:
        try:
            print('autodeactivate2: sending deactivation email to', email)
            urllib.request.urlopen(req)
        except: # YOLO
            print(traceback.format_exc())

async def autodeactivate2_once():
    api_conn = await psycopg.AsyncConnection.connect(
        _api_conninfo,
        autocommit=False,
        row_factory=psycopg.rows.dict_row
    )

    chat_conn = await psycopg.AsyncConnection.connect(
        _chat_conninfo,
        autocommit=False,
        row_factory=psycopg.rows.dict_row
    )

    params = dict(polling_interval_seconds=AUTODEACTIVATE2_POLL_SECONDS)
    cur_inactive = await chat_conn.execute(Q_INACTIVE, params)
    rows_inactive = await cur_inactive.fetchall()

    params = dict(ids=[r['person_id'] for r in rows_inactive])
    cur_deactivated = await api_conn.execute(Q_DEACTIVATE, params)
    rows_deactivated = await cur_deactivated.fetchall()

    if rows_deactivated:
        print(
            f'autodeactivate2: About to deactivate '
            f'{len(rows_deactivated)} accounts:',
        )
        for p in rows_deactivated:
            print(f'  - {p}')

    if DRY_RUN:
        await api_conn.rollback()
        print(
            'autodeactivate2: DUO_CRON_AUTODEACTIVATE2_DRY_RUN env var '
            'prevented deactivation'
        )
    else:
        await api_conn.commit()
        if rows_deactivated:
            print('autodeactivate2: Accounts deactivated!')

    await api_conn.close()
    await chat_conn.close()

    for p in rows_deactivated:
        maybe_send_email(p['email'])

async def autodeactivate2_forever():
    while True:
        await print_stacktrace(autodeactivate2_once)
        await asyncio.sleep(AUTODEACTIVATE2_POLL_SECONDS)
