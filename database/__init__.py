from contextlib import contextmanager
from psycopg_pool import ConnectionPool
import psycopg
from typing import Any, ContextManager
import os

_valid_isolation_levels = [
    'SERIALIZABLE',
    'REPEATABLE READ',
    'READ COMMITTED',
]

_default_isolation_level = 'REPEATABLE READ'

DB_HOST = os.environ['DUO_DB_HOST']
DB_PORT = os.environ['DUO_DB_PORT']
DB_NAME = os.environ['DUO_DB_NAME']
DB_USER = os.environ['DUO_DB_USER']
DB_PASS = os.environ['DUO_DB_PASS']

_conninfo = (
    f" host={DB_HOST}"
    f" port={DB_PORT}"
    f" dbname={DB_NAME}"
    f" user={DB_USER}"
    f" password={DB_PASS}"
    f" options='-c idle_session_timeout=0 -c statement_timeout=5000'"
)

pool = ConnectionPool(_conninfo)

def transaction(
    isolation_level=_default_isolation_level
) -> ContextManager[psycopg.Cursor[Any]]:
    if isolation_level.upper() not in _valid_isolation_levels:
        raise ValueError(isolation_level)

    @contextmanager
    def generator_function():
        with (
            pool.connection() as conn,
            conn.cursor(row_factory=psycopg.rows.dict_row) as cur
        ):
            try:
                cur.execute(
                    f'SET TRANSACTION ISOLATION LEVEL {isolation_level}'
                )
            except psycopg.OperationalError as e:
                print('Error while starting transaction:', e)
                pool.check()

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
