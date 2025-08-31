from typing import Any, TypeVar
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

_api_conn  = None

_api_conn_lock  = threading.Lock()

class api_tx:
    def __init__(self, isolation_level=_default_transaction_isolation):
        normalized_isolation_level = isolation_level.upper()

        if normalized_isolation_level not in _valid_isolation_levels:
            raise ValueError(isolation_level)

        self.isolation_level = normalized_isolation_level

        self.cur = None

    def __enter__(self):
        _api_conn_lock.acquire()

        global _api_conn
        if not _api_conn or _api_conn.closed:
            try:
                _api_conn = psycopg.Connection.connect(
                    conninfo=_api_conninfo,
                    row_factory=psycopg.rows.dict_row,
                )
            except:
                _api_conn_lock.release()
                print(traceback.format_exc())
                raise

        self.cur = _api_conn.cursor()

        if self.isolation_level != _default_transaction_isolation:
            try:
                self.cur.execute(
                    f'SET TRANSACTION ISOLATION LEVEL {self.isolation_level}'
                )
            except:
                _api_conn_lock.release()
                print(traceback.format_exc())
                raise
        return self.cur

    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            if exc_type is None:
                _api_conn.commit()
            else:
                _api_conn.rollback()
        except:
                traceback.print_exception(exc_type, exc_val, exc_tb)
        finally:
            try:
                self.cur.close()
            except:
                print(traceback.format_exc())

        _api_conn_lock.release()

RowT = TypeVar('RowT')

def fetchall_sets(tx: psycopg.Cursor[RowT]) -> list[RowT]:
    result: list[RowT] = []
    while True:
        result.extend(tx.fetchall())
        nextset = tx.nextset()
        if nextset is None:
            break
    return result

def _check_api_connection_forever():
    while True:
        try:
            with api_tx() as tx:
                tx.execute('SELECT 1')
        except:
            print(traceback.format_exc())
        time.sleep(random.randint(30, 90))

threading.Thread(target=_check_api_connection_forever,  daemon=True).start()
