"""
One-off back-fill for `inbox.body` and `inbox.direction`.

PRs (2) and (2.1) started forward-filling `inbox.body` and `inbox.direction` on
insert, but the millions of pre-existing rows still have them NULL. This
back-fill populates them from the legacy `inbox.content` column.

It is NOT a SQL script. `content` holds the message as XMPP-style XML in a
`BYTEA` (tech debt from when MongooseIM stored messages), and Postgres has no
convenient in-database way to pull data out of it, so extraction has to happen
in Python. `extract_body` mirrors the read path in
`service.chat.message.xml_to_message` (the stripped `<body>` text), and
`extract_direction` mirrors the write path in
`service.chat.messagestorage.inbox` (whether the message is from the remote
party -> 'I' incoming, or from the owner -> 'O' outgoing).

Deriving `direction` is complicated by history: legacy `content` from before
JIDs became UUIDs stores numeric person-id JIDs (e.g. `107514@...`), which don't
match the row's UUID `luser`/`remote_bare_jid`. Each batch therefore resolves
those numeric ids to UUIDs via a `person` lookup, and matches against both
participants so direction survives even when one account has since been deleted.

It runs as a cron job (`backfill_inbox_body_forever`, wired into
`service.cron`) so it can be executed by flipping an env var rather than running
a script by hand. Because there are millions of rows, the work is done in
keyset-paginated batches over the primary key `(luser, remote_bare_jid)`,
committing and sleeping between batches to avoid long transactions or starving
the live workload. It uses its own database connection rather than the shared
`asyncdatabase` one, so a slow batch can't block the other cron jobs.

The job is gated behind `DUO_CRON_INBOX_BODY_BACKFILL_ENABLED` (default off).
Enable it on the cron service for the duration of the migration; it marches once
to completion and then returns. It is idempotent (the UPDATE only fills columns
that are still NULL), so re-running it is safe.

    DUO_CRON_INBOX_BODY_BACKFILL_ENABLED       '1' to run it      (default '0')
    DUO_CRON_INBOX_BODY_BACKFILL_BATCH_SIZE    rows per batch     (default 5000)
    DUO_CRON_INBOX_BODY_BACKFILL_POLL_SECONDS  pause per batch    (default 0.5)
    DUO_CRON_INBOX_BODY_BACKFILL_TIMEOUT_MS    statement timeout  (default 60000)

It can also be run manually (bypassing the enable gate):

    python3 -m backfill.inbox_body
"""

import asyncio
import os
import traceback

import psycopg
import psycopg.rows
from lxml import etree

_Conn = psycopg.AsyncConnection[psycopg.rows.TupleRow]


# `recover=True` keeps a handful of slightly malformed historical rows (e.g.
# leading whitespace from an old pretty-printer) from aborting a whole batch;
# `resolve_entities=False`/`no_network=True` mirror `service.chat.xmlparse` and
# guard against XXE. The five predefined XML entities (e.g. `&apos;`) are still
# decoded regardless of `resolve_entities`.
_PARSER = etree.XMLParser(
    resolve_entities=False,
    no_network=True,
    recover=True,
)


def _parse_content(
    content: bytes | memoryview | str | None,
) -> etree._Element | None:
    """Decode an `inbox.content` value (XMPP-style XML in a BYTEA) into an
    element, or `None` if it's absent or unparseable."""
    if content is None:
        return None

    data = content.encode('utf-8') if isinstance(content, str) else bytes(content)

    try:
        return etree.fromstring(data, parser=_PARSER)
    except Exception:
        return None


def _body_from_root(root: etree._Element | None) -> str | None:
    if root is None:
        return None

    # Historical rows all carry `xmlns="jabber:client"`, but fall back to a
    # namespace-agnostic match just in case.
    body_element = root.find('{jabber:client}body')
    if body_element is None:
        body_element = next(
            (el for el in root.iter() if etree.QName(el).localname == 'body'),
            None,
        )

    if body_element is None or not body_element.text:
        return None

    body = body_element.text.strip()

    return body or None


def _localpart(jid: str | None) -> str | None:
    """Return a JID's localpart, dropping any resource and domain
    (`user@domain/res` -> `user`)."""
    if not jid:
        return None
    return jid.split('/', 1)[0].split('@', 1)[0] or None


def _resolve(localpart: str | None, id_to_uuid: dict[str, str]) -> str | None:
    """
    Canonicalise a JID localpart to a person UUID. Legacy `content` predating
    the switch to UUID JIDs stores numeric person-id JIDs (e.g. `107514@...`);
    map those to the person's UUID so they can be compared against the row's
    (UUID-based) `luser`/`remote_bare_jid`. Already-UUID localparts -- and
    numeric ids with no mapping (e.g. deleted accounts) -- are returned
    unchanged.
    """
    if localpart is None:
        return None
    return id_to_uuid.get(localpart, localpart)


def _numeric_ids_in_root(root: etree._Element | None) -> set[str]:
    """Numeric person-id localparts in the message's `from`/`to`, which need
    mapping to UUIDs (see `_resolve`) before they can be matched."""
    if root is None:
        return set()
    ids: set[str] = set()
    for attr in ('from', 'to'):
        localpart = _localpart(root.get(attr))
        if localpart is not None and localpart.isdigit():
            ids.add(localpart)
    return ids


def _direction_from_root(
    root: etree._Element | None,
    luser: str,
    remote_bare_jid: str,
    id_to_uuid: dict[str, str],
) -> str | None:
    """
    Derive the `mam_direction` of the last message from the legacy `content`
    XML's `from`/`to`:

      * 'I' (incoming): the message is from the remote party / to the owner.
      * 'O' (outgoing): the message is from the owner / to the remote party.

    Both the message's `from`/`to` and the row's `luser`/`remote_bare_jid` are
    canonicalised to person UUIDs (see `_resolve`) before comparing, because
    legacy rows store numeric person-id JIDs that predate UUID JIDs. We match
    against *both* the owner and the remote party so direction stays recoverable
    when one participant's account has since been deleted (its numeric id no
    longer maps to a UUID, but the other side still does). This yields 'I' for
    the recipient's copy and 'O' for the sender's, matching the forward-fill in
    `service.chat.messagestorage.inbox`. Returns `None` only when neither side
    can be matched (e.g. malformed content, or both participants deleted).
    """
    if root is None:
        return None

    owner = _localpart(luser)
    remote = _localpart(remote_bare_jid)

    from_party = _resolve(_localpart(root.get('from')), id_to_uuid)
    to_party = _resolve(_localpart(root.get('to')), id_to_uuid)

    if (remote is not None and from_party == remote) or \
            (owner is not None and to_party == owner):
        return 'I'

    if (owner is not None and from_party == owner) or \
            (remote is not None and to_party == remote):
        return 'O'

    return None


def extract_body(content: bytes | memoryview | str | None) -> str | None:
    """
    Return the stripped `<body>` text of an `inbox.content` value, mirroring the
    forward-fill path in `service.chat.message.xml_to_message`. Returns `None`
    when the XML can't be parsed or has no non-empty `<body>` text.
    """
    return _body_from_root(_parse_content(content))


def extract_direction(
    content: bytes | memoryview | str | None,
    luser: str,
    remote_bare_jid: str,
    id_to_uuid: dict[str, str] | None = None,
) -> str | None:
    """
    Return the `mam_direction` ('I'/'O') of an `inbox.content` value relative to
    the row's `luser`/`remote_bare_jid`, or `None` when it can't be determined.
    `id_to_uuid` maps legacy numeric person ids to UUIDs (see `_resolve`); pass
    the mapping for the message's participants, or omit it when `content`
    already uses UUID JIDs.
    """
    return _direction_from_root(
        _parse_content(content), luser, remote_bare_jid, id_to_uuid or {})


print(f'Hello from cron module: {__name__}')


BACKFILL_ENABLED = os.environ.get(
    'DUO_CRON_INBOX_BODY_BACKFILL_ENABLED', '0') == '1'

BATCH_SIZE = int(os.environ.get(
    'DUO_CRON_INBOX_BODY_BACKFILL_BATCH_SIZE', str(5000)))

POLL_SECONDS = float(os.environ.get(
    'DUO_CRON_INBOX_BODY_BACKFILL_POLL_SECONDS', str(0.5)))

STATEMENT_TIMEOUT_MS = int(os.environ.get(
    'DUO_CRON_INBOX_BODY_BACKFILL_TIMEOUT_MS', str(60000)))


# Keyset pagination over the primary key. We march through every row in PK
# order rather than filtering on `body IS NULL`: the latter would force the
# index scan to hunt for sparse NULL rows when resuming over an already-filled
# prefix. The in-memory cursor advances each batch, and the UPDATE's NULL
# guard keeps the work idempotent.
_SELECT_SQL = """
    SELECT
        luser,
        remote_bare_jid,
        content
    FROM
        inbox
    WHERE
        (luser, remote_bare_jid) > (%(luser)s, %(remote_bare_jid)s)
    ORDER BY
        luser, remote_bare_jid
    LIMIT
        %(batch_size)s
"""


# A single array-based UPDATE is dramatically faster than one statement per
# row: the whole batch travels in a few arrays and the join runs server-side.
# `COALESCE` only writes a column that's still NULL, so the back-fill never
# clobbers a value the forward-fill already set, and a row is touched only while
# either column is still NULL -- keeping the work idempotent.
_UPDATE_SQL = """
    UPDATE
        inbox AS i
    SET
        body = COALESCE(i.body, v.body),
        direction = COALESCE(i.direction, v.direction::mam_direction)
    FROM
        unnest(
            %(lusers)s::text[],
            %(remote_bare_jids)s::text[],
            %(bodies)s::text[],
            %(directions)s::text[]
        ) AS v(luser, remote_bare_jid, body, direction)
    WHERE
        i.luser = v.luser
    AND
        i.remote_bare_jid = v.remote_bare_jid
    AND
        (i.body IS NULL OR i.direction IS NULL)
"""


async def _connect() -> _Conn:
    # A dedicated connection, separate from the shared `asyncdatabase` one, so a
    # slow batch neither holds that lock nor inherits its 5s statement timeout.
    return await psycopg.AsyncConnection.connect(
        host=os.environ.get('DUO_DB_HOST', 'localhost'),
        port=os.environ.get('DUO_DB_PORT', '5432'),
        user=os.environ.get('DUO_DB_USER', 'postgres'),
        password=os.environ.get('DUO_DB_PASS', 'password'),
        dbname='duo_api',
        autocommit=False,
        options=f'-c statement_timeout={STATEMENT_TIMEOUT_MS}',
    )


async def _fetch_id_to_uuid(
    conn: _Conn,
    numeric_ids: set[str],
) -> dict[str, str]:
    """Map legacy numeric person ids (as strings) to their UUIDs. Returns only
    the ids that still exist; deleted accounts are simply absent."""
    if not numeric_ids:
        return {}
    async with conn.cursor() as cur:
        await cur.execute(
            'SELECT id, uuid FROM person WHERE id = ANY(%(ids)s)',
            dict(ids=[int(i) for i in numeric_ids]),
        )
        return {str(person_id): str(uuid) for person_id, uuid in await cur.fetchall()}


async def _backfill_batch(
    conn: _Conn,
    after: tuple[str, str],
) -> tuple[tuple[str, str], int, int] | None:
    """
    Back-fill one batch of rows whose key is greater than `after`. Returns
    `(next_cursor, scanned, updated)`, or `None` once no rows remain.
    """
    async with conn.cursor() as cur:
        await cur.execute(_SELECT_SQL, dict(
            luser=after[0],
            remote_bare_jid=after[1],
            batch_size=BATCH_SIZE,
        ))
        rows = await cur.fetchall()

    if not rows:
        return None

    # Parse once, then resolve the numeric person-id JIDs in legacy `content`
    # to UUIDs with a single `person` lookup for the whole batch.
    parsed: list[tuple[str, str, etree._Element | None]] = []
    numeric_ids: set[str] = set()
    for luser, remote_bare_jid, content in rows:
        root = _parse_content(content)
        parsed.append((luser, remote_bare_jid, root))
        numeric_ids |= _numeric_ids_in_root(root)

    id_to_uuid = await _fetch_id_to_uuid(conn, numeric_ids)

    lusers: list[str] = []
    remote_bare_jids: list[str] = []
    bodies: list[str | None] = []
    directions: list[str | None] = []
    for luser, remote_bare_jid, root in parsed:
        body = _body_from_root(root)
        direction = _direction_from_root(
            root, luser, remote_bare_jid, id_to_uuid)
        if body is None and direction is None:
            continue
        lusers.append(luser)
        remote_bare_jids.append(remote_bare_jid)
        bodies.append(body)
        directions.append(direction)

    updated = 0
    if lusers:
        async with conn.cursor() as cur:
            await cur.execute(_UPDATE_SQL, dict(
                lusers=lusers,
                remote_bare_jids=remote_bare_jids,
                bodies=bodies,
                directions=directions,
            ))
            updated = cur.rowcount
    await conn.commit()

    return (rows[-1][0], rows[-1][1]), len(rows), updated


async def _backfill_to_completion() -> None:
    conn = await _connect()
    cursor = ('', '')
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
                f'inbox body/direction back-fill: scanned={scanned} '
                f'updated={updated} cursor={cursor}',
                flush=True,
            )
            await asyncio.sleep(POLL_SECONDS)
    finally:
        await conn.close()

    print(
        f'inbox body/direction back-fill complete: '
        f'scanned={scanned} updated={updated}',
        flush=True,
    )


async def backfill_inbox_body_forever() -> None:
    if not BACKFILL_ENABLED:
        print(
            'inbox body/direction back-fill disabled; set '
            'DUO_CRON_INBOX_BODY_BACKFILL_ENABLED=1 to run it',
            flush=True,
        )
        return

    await _backfill_to_completion()


if __name__ == '__main__':
    # Manual runs bypass the enable gate.
    asyncio.run(_backfill_to_completion())
