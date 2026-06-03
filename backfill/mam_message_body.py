"""
One-off back-fill for `mam_message.body` and `mam_message.stanza_id`.

PR (2) started forward-filling these structured columns on insert, but the ~38M
pre-existing rows still have them NULL. This back-fill populates them from the
legacy `mam_message.message` column.

It is NOT a SQL script. `message` holds an Erlang external term format (ETF)
blob, and roughly a third of the rows are additionally zlib-compressed (they
begin with the bytes `83 50`, the ETF `COMPRESSED` tag). Postgres has no
in-database way to inflate them, so extraction has to happen in Python via
`erlastic`, which transparently handles both the compressed and uncompressed
encodings. `extract_body_and_stanza_id` mirrors the read path in
`service.chat.chatutil.erlang.term_to_etree`.

It runs as a cron job (`backfill_mam_message_body_forever`, wired into
`service.cron`) so it can be executed by flipping an env var rather than running
a script by hand. Because there are ~38M rows, the work is done in keyset-
paginated batches over the primary key `(person_id, id)`, committing and
sleeping between batches to avoid long transactions or starving the live
workload. It uses its own database connection rather than the shared
`asyncdatabase` one, so a slow batch can't block the other cron jobs.

The job is gated behind `DUO_CRON_MAM_MESSAGE_BACKFILL_ENABLED` (default off).
Enable it on the cron service for the duration of the migration; it marches once
to completion and then returns. It is idempotent (the UPDATE only writes rows
whose `body` is still NULL), so re-running it is safe.

    DUO_CRON_MAM_MESSAGE_BACKFILL_ENABLED       '1' to run it      (default '0')
    DUO_CRON_MAM_MESSAGE_BACKFILL_BATCH_SIZE    rows per batch     (default 5000)
    DUO_CRON_MAM_MESSAGE_BACKFILL_POLL_SECONDS  pause per batch    (default 0.5)
    DUO_CRON_MAM_MESSAGE_BACKFILL_TIMEOUT_MS    statement timeout  (default 60000)

It can also be run manually (bypassing the enable gate):

    python3 -m backfill.mam_message_body
"""

import asyncio
import os
import traceback

import erlastic
from erlastic import Atom


_XMLEL = Atom('xmlel')
_XMLCDATA = Atom('xmlcdata')


def _decode(value):
    return value.decode('utf8') if isinstance(value, (bytes, bytearray)) else value


def extract_body_and_stanza_id(message) -> tuple[str | None, str | None]:
    """
    Decode a `mam_message.message` value and return its `(body, stanza_id)`,
    mirroring `service.chat.chatutil.erlang.term_to_etree` followed by reading
    the message's `id` attribute and `<body>` text.

    `erlastic.decode` transparently inflates zlib-compressed terms. Returns
    `(None, None)` when the blob can't be decoded or isn't a message element;
    `body` is `None` when the message has no `<body>` child.
    """
    try:
        term = erlastic.decode(bytes(message))
    except Exception:
        return None, None

    if not (isinstance(term, tuple) and len(term) == 4 and term[0] == _XMLEL):
        return None, None

    _, _tag, attrs, children = term

    stanza_id = None
    for key, value in attrs:
        if _decode(key) == 'id':
            stanza_id = _decode(value)
            break

    body = None
    for child in children:
        if (
            isinstance(child, tuple)
            and len(child) == 4
            and child[0] == _XMLEL
            and _decode(child[1]) == 'body'
        ):
            parts = [
                _decode(grandchild[1])
                for grandchild in child[3]
                if isinstance(grandchild, tuple) and grandchild[0] == _XMLCDATA
            ]
            body = ''.join(parts) if parts else None
            break

    return body, stanza_id


print(f'Hello from cron module: {__name__}')


BACKFILL_ENABLED = os.environ.get(
    'DUO_CRON_MAM_MESSAGE_BACKFILL_ENABLED', '0') == '1'

BATCH_SIZE = int(os.environ.get(
    'DUO_CRON_MAM_MESSAGE_BACKFILL_BATCH_SIZE', str(5000)))

POLL_SECONDS = float(os.environ.get(
    'DUO_CRON_MAM_MESSAGE_BACKFILL_POLL_SECONDS', str(0.5)))

STATEMENT_TIMEOUT_MS = int(os.environ.get(
    'DUO_CRON_MAM_MESSAGE_BACKFILL_TIMEOUT_MS', str(60000)))


# Keyset pagination over the primary key. We march through every row in PK
# order rather than filtering on `body IS NULL`: the latter would force the
# index scan to hunt for sparse NULL rows when resuming over an already-filled
# prefix. The in-memory cursor advances each batch, and the UPDATE's
# `body IS NULL` guard keeps the work idempotent.
_SELECT_SQL = """
    SELECT
        person_id,
        id,
        message
    FROM
        mam_message
    WHERE
        (person_id, id) > (%(person_id)s, %(id)s)
    ORDER BY
        person_id, id
    LIMIT
        %(batch_size)s
"""


# A single array-based UPDATE is dramatically faster than one statement per
# row: the whole batch travels in four arrays and the join runs server-side.
_UPDATE_SQL = """
    UPDATE
        mam_message AS m
    SET
        body = v.body,
        stanza_id = v.stanza_id
    FROM
        unnest(
            %(person_ids)s::int[],
            %(ids)s::bigint[],
            %(bodies)s::text[],
            %(stanza_ids)s::text[]
        ) AS v(person_id, id, body, stanza_id)
    WHERE
        m.person_id = v.person_id
    AND
        m.id = v.id
    AND
        m.body IS NULL
"""


async def _connect():
    # A dedicated connection, separate from the shared `asyncdatabase` one, so a
    # slow batch neither holds that lock nor inherits its 5s statement timeout.
    import psycopg
    return await psycopg.AsyncConnection.connect(
        host=os.environ.get('DUO_DB_HOST', 'localhost'),
        port=os.environ.get('DUO_DB_PORT', '5432'),
        user=os.environ.get('DUO_DB_USER', 'postgres'),
        password=os.environ.get('DUO_DB_PASS', 'password'),
        dbname='duo_api',
        autocommit=False,
        options=f'-c statement_timeout={STATEMENT_TIMEOUT_MS}',
    )


async def _backfill_batch(
    conn,
    after: tuple[int, int],
) -> tuple[tuple[int, int], int, int] | None:
    """
    Back-fill one batch of rows whose key is greater than `after`. Returns
    `(next_cursor, scanned, updated)`, or `None` once no rows remain.
    """
    async with conn.cursor() as cur:
        await cur.execute(_SELECT_SQL, dict(
            person_id=after[0],
            id=after[1],
            batch_size=BATCH_SIZE,
        ))
        rows = await cur.fetchall()

    if not rows:
        return None

    person_ids = []
    ids = []
    bodies = []
    stanza_ids = []
    for person_id, id, message in rows:
        body, stanza_id = extract_body_and_stanza_id(message)
        if body is None:
            continue
        person_ids.append(person_id)
        ids.append(id)
        bodies.append(body)
        stanza_ids.append(stanza_id)

    updated = 0
    if ids:
        async with conn.cursor() as cur:
            await cur.execute(_UPDATE_SQL, dict(
                person_ids=person_ids,
                ids=ids,
                bodies=bodies,
                stanza_ids=stanza_ids,
            ))
            updated = cur.rowcount
    await conn.commit()

    return (rows[-1][0], rows[-1][1]), len(rows), updated


async def _backfill_to_completion() -> None:
    conn = await _connect()
    cursor = (-1, -1)
    scanned = 0
    updated = 0
    try:
        while True:
            try:
                result = await _backfill_batch(conn, cursor)
            except Exception:
                print(traceback.format_exc(), flush=True)
                await conn.close()
                await asyncio.sleep(POLL_SECONDS)
                conn = await _connect()
                continue

            if result is None:
                break

            cursor, batch_scanned, batch_updated = result
            scanned += batch_scanned
            updated += batch_updated
            print(
                f'mam_message back-fill: scanned={scanned} updated={updated} '
                f'cursor={cursor}',
                flush=True,
            )
            await asyncio.sleep(POLL_SECONDS)
    finally:
        await conn.close()

    print(
        f'mam_message back-fill complete: scanned={scanned} updated={updated}',
        flush=True,
    )


async def backfill_mam_message_body_forever():
    if not BACKFILL_ENABLED:
        print(
            'mam_message back-fill disabled; set '
            'DUO_CRON_MAM_MESSAGE_BACKFILL_ENABLED=1 to run it',
            flush=True,
        )
        return

    await _backfill_to_completion()


if __name__ == '__main__':
    # Manual runs bypass the enable gate.
    asyncio.run(_backfill_to_completion())
