from service.cron.expiredrecords.sql import *
from service.cron.util import print_stacktrace
import asyncio
import os
import psycopg

EXPIRED_RECORDS_POLL_SECONDS = int(os.environ.get(
    'DUO_CRON_EXPIRED_RECORDS_POLL_SECONDS',
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

print('Hello from cron module: expiredrecords')

async def delete_expired_records_once():
    api_conn = await psycopg.AsyncConnection.connect(
        _api_conninfo,
        row_factory=psycopg.rows.dict_row
    )

    cur = await api_conn.execute(Q_DELETE_EXPIRED_RECORDS)
    await api_conn.commit()
    rows = await cur.fetchall()

    try:
        count = rows[0]['count']
    except:
        count = 0

    if count:
        print(f'Deleted {count} expired record(s)')

    await api_conn.close()

async def delete_expired_records_forever():
    while True:
        await print_stacktrace(delete_expired_records_once)
        await asyncio.sleep(EXPIRED_RECORDS_POLL_SECONDS)
