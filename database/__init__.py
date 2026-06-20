from types import TracebackType
from typing import Protocol
from collections.abc import Iterable
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

CursorQuery = str | bytes | psycopg.sql.SQL | psycopg.sql.Composed
Row = psycopg.rows.DictRow


def require_row(row: Row | None) -> Row:
    if row is None:
        raise RuntimeError('query returned no row')
    return row

class TransactionContext(Protocol):
    def __enter__(self) -> object:
        ...

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        ...


class TxConnection(Protocol):
    def transaction(self) -> TransactionContext:
        ...


class Tx(Protocol):
    @property
    def connection(self) -> psycopg.Connection[psycopg.rows.DictRow]:
        ...

    @property
    def rowcount(self) -> int:
        ...

    def execute(
        self,
        query: CursorQuery,
        params: psycopg.abc.Params | None = None,
    ) -> "Tx":
        ...

    def executemany(
        self,
        query: CursorQuery,
        params_seq: Iterable[psycopg.abc.Params],
        *,
        returning: bool = False,
    ) -> None:
        ...

    def fetchone(self) -> Row | None:
        ...

    def fetchall(self) -> list[Row]:
        ...

    def nextset(self) -> bool | None:
        ...

    def close(self) -> None:
        ...


class TxCursor:
    def __init__(self, cur: psycopg.Cursor[Row]) -> None:
        self._cur = cur

    @property
    def connection(self) -> psycopg.Connection[Row]:
        return self._cur.connection

    @property
    def rowcount(self) -> int:
        return self._cur.rowcount

    def execute(
        self,
        query: CursorQuery,
        params: psycopg.abc.Params | None = None,
    ) -> Tx:
        self._cur.execute(query, params)
        return self

    def executemany(
        self,
        query: CursorQuery,
        params_seq: Iterable[psycopg.abc.Params],
        *,
        returning: bool = False,
    ) -> None:
        self._cur.executemany(query, params_seq, returning=returning)

    def fetchone(self) -> Row | None:
        return self._cur.fetchone()

    def fetchall(self) -> list[Row]:
        return self._cur.fetchall()

    def nextset(self) -> bool | None:
        return self._cur.nextset()

    def close(self) -> None:
        self._cur.close()


_api_conn: psycopg.Connection[Row] | None = None

_api_conn_lock  = threading.Lock()

class api_tx:
    def __init__(self, isolation_level: str = _default_transaction_isolation) -> None:
        normalized_isolation_level = isolation_level.upper()

        if normalized_isolation_level not in _valid_isolation_levels:
            raise ValueError(isolation_level)

        self.isolation_level = normalized_isolation_level

        self.conn: psycopg.Connection[Row]
        self.cur: Tx

    def __enter__(self) -> Tx:
        _api_conn_lock.acquire()

        global _api_conn
        conn = _api_conn
        if conn is None or conn.closed:
            try:
                conn = psycopg.Connection.connect(
                    conninfo=_api_conninfo,
                    row_factory=psycopg.rows.dict_row,
                )
                _api_conn = conn
            except:
                _api_conn_lock.release()
                print(traceback.format_exc())
                raise

        self.conn = conn
        self.cur = TxCursor(conn.cursor())

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

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        try:
            if exc_type is None:
                self.conn.commit()
            else:
                self.conn.rollback()
        except:
                traceback.print_exception(exc_type, exc_val, exc_tb)
        finally:
            try:
                self.cur.close()
            except:
                print(traceback.format_exc())

        _api_conn_lock.release()

def fetchall_sets(tx: Tx) -> list[Row]:
    result: list[Row] = []
    while True:
        result.extend(tx.fetchall())
        nextset = tx.nextset()
        if nextset is None:
            break
    return result

def _check_api_connection_forever() -> None:
    while True:
        try:
            with api_tx() as tx:
                tx.execute('SELECT 1')
        except:
            print(traceback.format_exc())
        time.sleep(random.randint(30, 90))

threading.Thread(target=_check_api_connection_forever,  daemon=True).start()
