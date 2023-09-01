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

async def maybe_send_notifications():
    api_conn  = await psycopg.AsyncConnection.connect(
        _api_conninfo,
        row_factory=psycopg.rows.dict_row
    )

    chat_conn = await psycopg.AsyncConnection.connect(
        _chat_conninfo,
        row_factory=psycopg.rows.dict_row
    )

    rows = await(await chat_conn.execute(Q_UNREAD_INBOX)).fetchall()

    for row in rows:
        print(row)

async def periodic_task(name: str, interval: int):
    """A task that prints a given name every specified interval."""
    while True:
        print(f'Hello from task {name}!')
        await asyncio.sleep(interval)

async def main():
    # Start three tasks with different intervals
    # task1 = periodic_task('Task 1', 1)  # Prints every 1 second
    # task2 = periodic_task('Task 2', 2)  # Prints every 2 seconds
    # task3 = periodic_task('Task 3', 3)  # Prints every 3 seconds

    # await asyncio.gather(task1, task2, task3, maybe_send_notifications())

    await asyncio.gather(maybe_send_notifications())

if __name__ == '__main__':
    asyncio.run(main())
