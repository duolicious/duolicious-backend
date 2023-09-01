Q_UNREAD_INBOX = """
WITH ten_minutes_ago AS (
    SELECT
        (SELECT (EXTRACT(EPOCH FROM (
            NOW() - INTERVAL '10 minutes')))::bigint) AS seconds,
        (SELECT (EXTRACT(EPOCH FROM (
            NOW() - INTERVAL '10 minutes')) * 1000000)::bigint) AS microseconds
), filtered_inbox AS (
    SELECT
        luser AS username,
        box,
        unread_count,
        timestamp / 1000000 AS seconds
    FROM inbox
    WHERE
        unread_count > 0
    AND
        -- As a performance optimization, we only consider recently sent
        -- messages. This'll result in dropped messages if the app is down for
        -- too long.
        timestamp > (SELECT microseconds FROM ten_minutes_ago)
), unfiltered_notifications AS (
    SELECT
        username,
        MAX(seconds) AS last_message_seconds,
        BOOL_OR(CASE WHEN box = 'inbox' THEN TRUE ELSE FALSE END) AS inbox,
        BOOL_OR(CASE WHEN box = 'chats' THEN TRUE ELSE FALSE END) AS chats
    FROM filtered_inbox
    GROUP BY
        username
)
SELECT
    unfiltered_notifications.username::int AS person_id,
    unfiltered_notifications.last_message_seconds,
    unfiltered_notifications.inbox,
    unfiltered_notifications.chats,
    (SELECT EXTRACT(EPOCH FROM NOW())::bigint) AS now_seconds
FROM unfiltered_notifications
LEFT JOIN
    last
ON
    last.username = unfiltered_notifications.username
LEFT JOIN
    duo_last_notification
ON
    duo_last_notification.username = unfiltered_notifications.username
WHERE
    -- only notify users whose last activity was longer than ten minutes ago
    last.seconds < (SELECT seconds FROM ten_minutes_ago)
AND
    -- only notify users we haven't already notified
    unfiltered_notifications.last_message_seconds > COALESCE(duo_last_notification.seconds, 0)
"""

# TODO: Possible values
# INSERT INTO immediacy (name) VALUES ('Immediately') ON CONFLICT (name) DO NOTHING;
# INSERT INTO immediacy (name) VALUES ('Daily') ON CONFLICT (name) DO NOTHING;
# INSERT INTO immediacy (name) VALUES ('Every 3 days') ON CONFLICT (name) DO NOTHING;
# INSERT INTO immediacy (name) VALUES ('Weekly') ON CONFLICT (name) DO NOTHING;
# INSERT INTO immediacy (name) VALUES ('Never') ON CONFLICT (name) DO NOTHING;

Q_EMAILS = """
SELECT
    id::text AS username,
    email,
    (SELECT name FROM immediacy WHERE immediacy.id = chats_notification),
    (SELECT name FROM immediacy WHERE immediacy.id = intros_notification)
FROM person
WHERE
    id = ANY(%(ids)s)
"""

# TODO
Q_UPDATE_LAST_NOTIFICATION_TIME = """
INSERT INTO duo_last_notification (
    username,
    seconds
) VALUES (
    %(username)s,
    %(seconds)s
)
ON CONFLICT (username) DO UPDATE SET
    seconds = EXCLUDED.seconds
"""

# TODO: You need to batch emails in at most 100, because of brevo's limitations
# TODO: Replace '10 minutes' with correct intervals, based on how often the XMPP
#       clients send activity
# TODO: Select correct XMPP update interval in the frontend
