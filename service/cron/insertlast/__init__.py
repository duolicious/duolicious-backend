from service.cron.insertlast.sql import *
from service.cron.util import print_stacktrace
import asyncio
import os
import psycopg

INSERT_LAST_POLL_SECONDS = int(os.environ.get(
    'DUO_CRON_INSERT_LAST_POLL_SECONDS',
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

print('Hello from cron module: insertlast')

async def insert_last_once():
    api_conn = await psycopg.AsyncConnection.connect(
        _api_conninfo,
        row_factory=psycopg.rows.dict_row
    )

    chat_conn = await psycopg.AsyncConnection.connect(
        _chat_conninfo,
        row_factory=psycopg.rows.dict_row
    )

    params = dict(polling_interval_seconds=INSERT_LAST_POLL_SECONDS)
    cur_recent_sign_ups = await api_conn.execute(Q_RECENT_SIGN_UPS, params)
    rows_recent_sign_ups = await cur_recent_sign_ups.fetchall()

    params = dict(usernames=[r['id'] for r in rows_recent_sign_ups])
    cur_insert_last = await chat_conn.execute(Q_INSERT_LAST, params)
    rows_cur_insert_last = await cur_insert_last.fetchall()
    await chat_conn.commit()

    for row in rows_cur_insert_last:
        print('INSERT `last` row:', row)

    await api_conn.close()
    await chat_conn.close()

async def insert_last_forever():
    while True:
        await print_stacktrace(insert_last_once)
        await asyncio.sleep(INSERT_LAST_POLL_SECONDS)
