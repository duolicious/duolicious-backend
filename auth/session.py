from typing import Iterable

from constants import MAX_SIGNED_IN_SESSIONS
from database import api_tx
import sessioncache


Q_SIGN_OUT_SESSIONS = """
DELETE FROM
    duo_session
WHERE
    session_token_hash = ANY(%(session_token_hashes)s)
"""

Q_OVER_LIMIT_SESSIONS = """
SELECT
    session_token_hash
FROM
    duo_session
WHERE
    person_id = %(person_id)s
AND
    signed_in
AND
    session_token_hash <> %(current_session_token_hash)s
ORDER BY
    last_online_time DESC,
    session_expiry DESC
OFFSET
    %(keep)s
"""


def sign_out(session_token_hashes: Iterable[str]):
    """The one and only way to sign sessions out: delete the `duo_session`
    row(s) AND evict them from the session cache.

    Flipping `signed_in = FALSE` is not a sign-out (the chat server's auth never
    checks it, so the token keeps working), and deleting the row without evicting
    the cache leaves the token usable until the cache TTL expires. Evicting only
    after the delete commits avoids re-caching the row we're removing.
    """
    hashes = [h for h in session_token_hashes if h]
    if not hashes:
        return

    with api_tx('READ COMMITTED') as tx:
        tx.execute(Q_SIGN_OUT_SESSIONS, dict(session_token_hashes=hashes))

    for session_token_hash in hashes:
        sessioncache.delete_session(session_token_hash)


def enforce_session_limit(person_id, current_session_token_hash):
    """Sign out a person's least-recently-active sessions beyond
    MAX_SIGNED_IN_SESSIONS, always keeping the current one. No-op for a session
    not yet attached to a person."""
    if person_id is None:
        return

    with api_tx('READ COMMITTED') as tx:
        over_limit = [
            row['session_token_hash']
            for row in tx.execute(Q_OVER_LIMIT_SESSIONS, dict(
                person_id=person_id,
                current_session_token_hash=current_session_token_hash,
                # The current session is excluded above and always kept, so keep
                # it plus the (MAX - 1) most-recently-active others.
                keep=MAX_SIGNED_IN_SESSIONS - 1,
            )).fetchall()
        ]

    sign_out(over_limit)
