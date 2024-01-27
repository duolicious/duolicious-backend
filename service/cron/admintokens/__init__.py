from service.cron.admintokens.sql import *
from service.cron.util import print_stacktrace
import asyncio
import os
import psycopg

INSERT_LAST_POLL_SECONDS = int(os.environ.get(
    'DUO_CRON_ADMIN_TOKENS_POLL_SECONDS',
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

print('Hello from cron module: admintokens')

async def clean_admin_tokens_once():
    api_conn = await psycopg.AsyncConnection.connect(
        _api_conninfo,
        row_factory=psycopg.rows.dict_row
    )

    cur = await api_conn.execute(Q_CLEAN_ADMIN_TOKENS)
    rows = await cur.fetchall()

    try:
        count = rows[0]['count']
    except:
        count = 0

    if count:
        print('Cleaned {count} admin token(s)')

    await api_conn.close()

async def clean_admin_tokens_forever():
    while True:
        await print_stacktrace(clean_admin_tokens_once)
        await asyncio.sleep(INSERT_LAST_POLL_SECONDS)
