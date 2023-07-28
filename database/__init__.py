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
DB_NAME = 'duo_api'
DB_USER = os.environ['DUO_DB_USER']
DB_PASS = os.environ['DUO_DB_PASS']

_valid_isolation_levels = [
    'SERIALIZABLE',
    'REPEATABLE READ',
    'READ COMMITTED',
]

_default_transaction_isolation = 'REPEATABLE READ'

_conninfo = psycopg.conninfo.make_conninfo(
    host=DB_HOST,
    port=DB_PORT,
    dbname=DB_NAME,
    user=DB_USER,
    password=DB_PASS,
    options=(
        f" -c default_transaction_isolation=" +
            _default_transaction_isolation.replace(' ', '\\ ') +
        f" -c idle_session_timeout=0"
        f" -c statement_timeout=5000"
    ),
)

pool = ConnectionPool(_conninfo, min_size=2, max_size=2)

def transaction(
    isolation_level=_default_transaction_isolation
) -> ContextManager[psycopg.Cursor[Any]]:
    if isolation_level.upper() not in _valid_isolation_levels:
        raise ValueError(isolation_level)

    @contextmanager
    def generator_function():
        with (
            pool.connection() as conn,
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

def check_connections_repeatedly():
    while True:
        pool.check()
        time.sleep(60 + random.randint(-30, 30))

threading.Thread(target=check_connections_repeatedly, daemon=True).start()
