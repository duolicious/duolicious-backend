Q_RECENT_SIGN_UPS = """
SELECT
    id
FROM
    person
WHERE
    sign_up_time >= NOW() - INTERVAL '1 second' * %(polling_interval_seconds)s * 2 - INTERVAL '365 day'
"""

Q_INSERT_LAST = """
INSERT INTO
    last (server, username, seconds, state)
SELECT
    'duolicious.app', t.username, EXTRACT(EPOCH FROM NOW())::BIGINT, ''
FROM
    UNNEST(%(usernames)s::text[]) AS t(username)
ON CONFLICT DO NOTHING
RETURNING *
"""
