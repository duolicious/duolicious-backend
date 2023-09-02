from service.cron.sql import *
import asyncio
import os
import psycopg

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

def join_lists_of_dicts(list1, list2, join_key):
    lookup1 = {item[join_key]: item for item in list1}
    lookup2 = {item[join_key]: item for item in list2}

    all_keys = set(lookup1.keys()) | set(lookup2.keys())

    return [
        {**lookup1[k], **lookup2[k]}
        for k in all_keys
        if k in lookup1 and k in lookup2
    ]


async def maybe_send_notifications():
    api_conn  = await psycopg.AsyncConnection.connect(
        _api_conninfo,
        row_factory=psycopg.rows.dict_row
    )

    chat_conn = await psycopg.AsyncConnection.connect(
        _chat_conninfo,
        row_factory=psycopg.rows.dict_row
    )

    cur_unread_inbox = await chat_conn.execute(
        Q_UNREAD_INBOX,
    )
    rows_unread_inbox = await cur_unread_inbox.fetchall()

    cur_notification_settings = await api_conn.execute(
        Q_NOTIFICATION_SETTINGS,
        params=dict(ids=[r['person_id'] for r in rows_unread_inbox])
    )
    rows_notification_settings = await cur_notification_settings.fetchall()

    joined = join_lists_of_dicts(
        rows_unread_inbox,
        rows_notification_settings,
        'person_id',
    )

    for row in joined:
        print(row)

    # TODO: Close connexions

async def periodic_task(name: str, interval: int):
    """A task that prints a given name every specified interval."""
    while True:
        print(f'Hello from task {name}!')
        await asyncio.sleep(interval)

async def main():
    task1 = periodic_task('Task 1', 60)

    await asyncio.gather(task1, maybe_send_notifications())

if __name__ == '__main__':
    asyncio.run(main())
