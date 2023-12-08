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
), inbox_first_pass AS (
    SELECT
        luser AS username,
        MAX(CASE WHEN box = 'inbox' THEN timestamp ELSE 0 END) / 1000000 AS last_intro_seconds,
        MAX(CASE WHEN box = 'chats' THEN timestamp ELSE 0 END) / 1000000 AS last_chat_seconds,
        BOOL_OR(CASE WHEN box = 'inbox' THEN TRUE ELSE FALSE END) AS has_intro,
        BOOL_OR(CASE WHEN box = 'chats' THEN TRUE ELSE FALSE END) AS has_chat
    FROM inbox
    WHERE
        unread_count > 0
    AND
        timestamp > (SELECT microseconds FROM ten_days_ago)
    GROUP BY
        luser
), inbox_second_pass AS (
    SELECT
        inbox_first_pass.username,
        inbox_first_pass.username::int AS person_id,
        inbox_first_pass.last_intro_seconds,
        inbox_first_pass.last_chat_seconds,
        COALESCE(duo_last_notification.intro_seconds, 0) AS last_intro_notification_seconds,
        COALESCE(duo_last_notification.chat_seconds, 0) AS last_chat_notification_seconds,
        (
                inbox_first_pass.has_intro
            AND
                -- only notify users we haven't already notified
                inbox_first_pass.last_intro_seconds >
                    COALESCE(duo_last_notification.intro_seconds, 0)
            AND
                -- only notify users about messages sent longer than ten minutes
                -- ago
                inbox_first_pass.last_intro_seconds <
                    (SELECT seconds FROM ten_minutes_ago)
            AND
                -- only notify users about messages sent after their last
                -- activity
                COALESCE(last.seconds, 0) < inbox_first_pass.last_intro_seconds
            AND
                -- only notify users whose last activity was longer than ten
                -- minutes ago
                COALESCE(last.seconds, 0) <
                    (SELECT seconds FROM ten_minutes_ago)
        ) AS has_intro,
        (
                inbox_first_pass.has_chat
            AND
                -- only notify users we haven't already notified
                inbox_first_pass.last_chat_seconds >
                    COALESCE(duo_last_notification.chat_seconds, 0)
            AND
                -- only notify users about messages sent longer than ten minutes
                -- ago
                inbox_first_pass.last_chat_seconds <
                    (SELECT seconds FROM ten_minutes_ago)
            AND
                -- only notify users about messages sent after their last
                -- activity
                COALESCE(last.seconds, 0) < inbox_first_pass.last_chat_seconds
            AND
                -- only notify users whose last activity was longer than ten
                -- minutes ago
                COALESCE(last.seconds, 0) <
                    (SELECT seconds FROM ten_minutes_ago)
        ) AS has_chat
    FROM inbox_first_pass
    LEFT JOIN
        last
    ON
        last.username = inbox_first_pass.username
    LEFT JOIN
        duo_last_notification
    ON
        duo_last_notification.username = inbox_first_pass.username
)
SELECT
    username,
    username::int AS person_id,
    last_intro_seconds,
    last_chat_seconds,
    last_intro_notification_seconds,
    last_chat_notification_seconds,
    has_intro,
    has_chat
FROM
    inbox_second_pass
WHERE
    has_intro
OR
    has_chat
"""

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
AND
    activated
"""

Q_UPDATE_LAST_INTRO_NOTIFICATION_TIME = """
INSERT INTO duo_last_notification (username, intro_seconds)
VALUES (%(username)s, extract(epoch from now())::int)
ON CONFLICT (username) DO UPDATE SET
    intro_seconds = extract(epoch from now())::int
"""

Q_UPDATE_LAST_CHAT_NOTIFICATION_TIME = """
INSERT INTO duo_last_notification (username, chat_seconds)
VALUES (%(username)s, extract(epoch from now())::int)
ON CONFLICT (username) DO UPDATE SET
    chat_seconds = extract(epoch from now())::int
"""
