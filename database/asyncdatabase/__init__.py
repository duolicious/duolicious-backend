from typing import Any
import asyncio
import os
import psycopg
import random
import threading
import time
import traceback

DB_HOST = os.environ['DUO_DB_HOST']
DB_PORT = os.environ['DUO_DB_PORT']
DB_USER = os.environ['DUO_DB_USER']
DB_PASS = os.environ['DUO_DB_PASS']

_valid_isolation_levels = [
    'SERIALIZABLE',
    'REPEATABLE READ',
    'READ COMMITTED',
]

_default_transaction_isolation = 'REPEATABLE READ'

_coninfo_args = dict(
    host=DB_HOST,
    port=DB_PORT,
    user=DB_USER,
    password=DB_PASS,
    options=(
        f" -c default_transaction_isolation=" +
            _default_transaction_isolation.replace(' ', '\\ ') +
        f" -c idle_session_timeout=0"
        f" -c statement_timeout=5000"
    ),
)

_api_conninfo = psycopg.conninfo.make_conninfo(
    **(_coninfo_args | dict(dbname='duo_api'))
)

_chat_conninfo = psycopg.conninfo.make_conninfo(
    **(_coninfo_args | dict(dbname='duo_chat'))
)

_api_conn = None
_chat_conn = None

_api_conn_lock = asyncio.Lock()
_chat_conn_lock = asyncio.Lock()

class api_tx:
    def __init__(self, isolation_level=_default_transaction_isolation):
        normalized_isolation_level = isolation_level.upper()

        if normalized_isolation_level not in _valid_isolation_levels:
            raise ValueError(isolation_level)

        self.isolation_level = normalized_isolation_level

        self.cur = None

    async def __aenter__(self):
        await _api_conn_lock.acquire()

        global _api_conn
        if not _api_conn or _api_conn.closed:
            try:
                _api_conn = await psycopg.AsyncConnection.connect(
                    conninfo=_api_conninfo,
                    row_factory=psycopg.rows.dict_row,
                )
            except:
                print(traceback.format_exc())
                raise

        self.cur = _api_conn.cursor()

        if self.isolation_level != _default_transaction_isolation:
            await self.cur.execute(
                f'SET TRANSACTION ISOLATION LEVEL {self.isolation_level}'
            )
        return self.cur

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        try:
            if exc_type is None:
                await _api_conn.commit()
            else:
                await _api_conn.rollback()
                traceback.print_exception(exc_type, exc_val, exc_tb)
        finally:
            try:
                await self.cur.close()
            except:
                print(traceback.format_exc())

        _api_conn_lock.release()

class chat_tx:
    def __init__(self, isolation_level=_default_transaction_isolation):
        normalized_isolation_level = isolation_level.upper()

        if normalized_isolation_level not in _valid_isolation_levels:
            raise ValueError(isolation_level)

        self.isolation_level = normalized_isolation_level

        self.cur = None

    async def __aenter__(self):
        await _chat_conn_lock.acquire()

        global _chat_conn
        if not _chat_conn or _chat_conn.closed:
            try:
                _chat_conn = await psycopg.AsyncConnection.connect(
                    conninfo=_chat_conninfo,
                    row_factory=psycopg.rows.dict_row,
                )
            except:
                print(traceback.format_exc())
                raise

        self.cur = _chat_conn.cursor()

        if self.isolation_level != _default_transaction_isolation:
            await self.cur.execute(
                f'SET TRANSACTION ISOLATION LEVEL {self.isolation_level}'
            )
        return self.cur

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        try:
            if exc_type is None:
                await _chat_conn.commit()
            else:
                await _chat_conn.rollback()
                traceback.print_exception(exc_type, exc_val, exc_tb)
        finally:
            try:
                await self.cur.close()
            except:
                print(traceback.format_exc())

        _chat_conn_lock.release()

async def _check_api_connection_forever():
    while True:
        try:
            async with api_tx() as tx:
                await tx.execute('SELECT 1')
        except:
            print(traceback.format_exc())
        await asyncio.sleep(random.randint(30, 90))

async def _check_chat_connection_forever():
    while True:
        try:
            async with chat_tx() as tx:
                await tx.execute('SELECT 1')
        except:
            print(traceback.format_exc())
        await asyncio.sleep(random.randint(30, 90))

async def check_connections_forever():
    await asyncio.gather(
        _check_api_connection_forever(),
        _check_chat_connection_forever(),
    )
