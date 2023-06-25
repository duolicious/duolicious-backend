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

DB_HOST = os.environ['DUO_DB_HOST']
DB_PORT = os.environ['DUO_DB_PORT']
DB_NAME = os.environ['DUO_DB_NAME']
DB_USER = os.environ['DUO_DB_USER']
DB_PASS = os.environ['DUO_DB_PASS']

def _create_conn_string(params_dict):
    return " ".join([f"{key}={value}" for key, value in params_dict.items()])

_db_params = dict(
    host=DB_HOST,
    port=DB_PORT,
    dbname=DB_NAME,
    user=DB_USER,
    password=DB_PASS,
)

_conninfo = _create_conn_string(_db_params)

pool = ConnectionPool(_conninfo)

def transaction(
    isolation_level='SERIALIZABLE'
) -> ContextManager[psycopg.Cursor[Any]]:
    @contextmanager
    def generator_function():
        with (
                pool.connection() as conn,
                conn.cursor(row_factory=psycopg.rows.dict_row) as cur
        ):
            if isolation_level.upper() in _valid_isolation_levels:
                cur.execute(
                    f'SET TRANSACTION ISOLATION LEVEL {isolation_level}'
                )
            else:
                raise ValueError(isolation_level)
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
