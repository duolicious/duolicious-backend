from contextlib import contextmanager
from psycopg_pool import ConnectionPool
from typing import Any, ContextManager
import os
import psycopg
import random
import threading
import time

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

_api_pool  = None
_chat_pool = None

def api_tx(
    isolation_level=_default_transaction_isolation
) -> ContextManager[psycopg.Cursor[Any]]:
    global _api_pool

    if isolation_level.upper() not in _valid_isolation_levels:
        raise ValueError(isolation_level)

    if not _api_pool:
        _api_pool = ConnectionPool(_api_conninfo,  min_size=2, max_size=2)

    @contextmanager
    def generator_function():
        with (
            _api_pool.connection() as conn,
            conn.cursor(row_factory=psycopg.rows.dict_row) as cur
        ):
            if isolation_level != _default_transaction_isolation:
                cur.execute(
                    f'SET TRANSACTION ISOLATION LEVEL {isolation_level}'
                )
            yield cur

    return generator_function()

def chat_tx(
    isolation_level=_default_transaction_isolation
) -> ContextManager[psycopg.Cursor[Any]]:
    global _chat_pool

    if isolation_level.upper() not in _valid_isolation_levels:
        raise ValueError(isolation_level)

    if not _chat_pool:
        _chat_pool = ConnectionPool(_chat_conninfo,  min_size=2, max_size=2)

    @contextmanager
    def generator_function():
        with (
            _chat_pool.connection() as conn,
            conn.cursor(row_factory=psycopg.rows.dict_row) as cur
        ):
            if isolation_level != _default_transaction_isolation:
                cur.execute(
                    f'SET TRANSACTION ISOLATION LEVEL {isolation_level}'
                )
            yield cur

    return generator_function()

def fetchall_sets(tx: psycopg.Cursor[Any]):
    result = []
    while True:
        result.extend(tx.fetchall())
        nextset = tx.nextset()
        if nextset is None:
            break
    return result

def _check_api_connections_repeatedly():
    while True:
        if _api_pool:
            _api_pool.check()
        time.sleep(60 + random.randint(-30, 30))

def _check_chat_connections_repeatedly():
    while True:
        if _chat_pool:
            _chat_pool.check()
        time.sleep(60 + random.randint(-30, 30))

threading.Thread(target=_check_api_connections_repeatedly,  daemon=True).start()
threading.Thread(target=_check_chat_connections_repeatedly, daemon=True).start()
