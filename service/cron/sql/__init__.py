Q_UNREAD_INBOX = """
WITH ten_days_ago AS (
    SELECT
        (SELECT (EXTRACT(EPOCH FROM (
            NOW() - INTERVAL '10 days')))::bigint) AS seconds,
        (SELECT (EXTRACT(EPOCH FROM (
            NOW() - INTERVAL '10 days')) * 1000000)::bigint) AS microseconds
), ten_minutes_ago AS (
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
        timestamp > (SELECT microseconds FROM ten_days_ago)
), unfiltered_notifications AS (
    SELECT
        username,
        MAX(seconds) AS last_message_seconds,
        BOOL_OR(CASE WHEN box = 'inbox' THEN TRUE ELSE FALSE END) AS intros,
        BOOL_OR(CASE WHEN box = 'chats' THEN TRUE ELSE FALSE END) AS chats
    FROM filtered_inbox
    GROUP BY
        username
)
SELECT
    unfiltered_notifications.username,
    unfiltered_notifications.username::int AS person_id,
    COALESCE(duo_last_notification.seconds, 0) AS last_notification_seconds,
    unfiltered_notifications.intros,
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
    -- only notify users we haven't already notified
    unfiltered_notifications.last_message_seconds > COALESCE(duo_last_notification.seconds, 0)
"""

# TODO
# AND
#     -- only notify users whose last activity was longer than ten minutes ago
#     COALESCE(last.seconds, 0) < (SELECT seconds FROM ten_minutes_ago)
# """

Q_NOTIFICATION_SETTINGS = """
SELECT
    id AS person_id,
    name,
    email,
    (
        SELECT
            CASE
            WHEN name = 'Immediately'  THEN 0
            WHEN name = 'Daily'        THEN 86400
            WHEN name = 'Every 3 days' THEN 259200
            WHEN name = 'Weekly'       THEN 604800
            WHEN name = 'Never'        THEN -1
            ELSE                            0
            END AS chats_drift_seconds
        FROM immediacy WHERE immediacy.id = chats_notification
    ),
    (
        SELECT
            CASE
            WHEN name = 'Immediately'  THEN 0
            WHEN name = 'Daily'        THEN 86400
            WHEN name = 'Every 3 days' THEN 259200
            WHEN name = 'Weekly'       THEN 604800
            WHEN name = 'Never'        THEN -1
            ELSE                            0
            END AS intros_drift_seconds
        FROM immediacy WHERE immediacy.id = intros_notification
    )
FROM person
WHERE
    id = ANY(%(ids)s)
"""

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

# TODO: Select correct XMPP update interval in the frontend
