Q_UNREAD_INBOX = """
WITH ten_minutes_ago AS (
    SELECT
        EXTRACT(EPOCH FROM (
            NOW() - INTERVAL '10 minutes'))::bigint AS seconds,
        EXTRACT(EPOCH FROM (
            NOW() - INTERVAL '10 minutes'))::bigint * 1000000 AS microseconds
), inbox_first_pass AS (
    SELECT
        luser AS username,
        MAX(CASE WHEN box = 'inbox' THEN timestamp ELSE 0 END) / 1000000 AS last_intro_seconds,
        MAX(CASE WHEN box = 'chats' THEN timestamp ELSE 0 END) / 1000000 AS last_chat_seconds,
        BOOL_OR(box = 'inbox')  AS has_intro,
        BOOL_OR(box = 'chats')  AS has_chat
    FROM
        inbox
    WHERE
        unread_count > 0
    AND
        timestamp >
            -- ten days ago as microseconds
            EXTRACT(EPOCH FROM (NOW() - INTERVAL '10 days'))::bigint * 1000000
    GROUP BY
        luser
), inbox_second_pass AS (
    SELECT
        inbox_first_pass.username AS person_uuid,
        inbox_first_pass.last_intro_seconds,
        inbox_first_pass.last_chat_seconds,
        COALESCE(person.intro_seconds, 0) AS last_intro_notification_seconds,
        COALESCE(person.chat_seconds, 0) AS last_chat_notification_seconds,
        (
                inbox_first_pass.has_intro
            AND
                -- only notify users we haven't already notified
                inbox_first_pass.last_intro_seconds >
                    COALESCE(person.intro_seconds, 0)
            AND
                -- only notify users about messages sent longer than ten minutes
                -- ago
                inbox_first_pass.last_intro_seconds <
                    (SELECT seconds FROM ten_minutes_ago)
            AND
                -- only notify users about messages sent after their last
                -- activity
                extract(epoch from person.last_online_time) < inbox_first_pass.last_intro_seconds
            AND
                -- only notify users whose last activity was longer than ten
                -- minutes ago
                extract(epoch from person.last_online_time) <
                    (SELECT seconds FROM ten_minutes_ago)
        ) AS has_intro,
        (
                inbox_first_pass.has_chat
            AND
                -- only notify users we haven't already notified
                inbox_first_pass.last_chat_seconds >
                    COALESCE(person.chat_seconds, 0)
            AND
                -- only notify users about messages sent longer than ten minutes
                -- ago
                inbox_first_pass.last_chat_seconds <
                    (SELECT seconds FROM ten_minutes_ago)
            AND
                -- only notify users about messages sent after their last
                -- activity
                extract(epoch from person.last_online_time) < inbox_first_pass.last_chat_seconds
            AND
                -- only notify users whose last activity was longer than ten
                -- minutes ago
                extract(epoch from person.last_online_time) <
                    (SELECT seconds FROM ten_minutes_ago)
        ) AS has_chat,
        extract(epoch from person.last_online_time) AS last_seconds,
        person.name,
        person.email,
        person.activated,
        -- One row per notification to send (see the LATERAL join below): a
        -- non-NULL token produces a push, a NULL token produces an email.
        notification_target.token,
        CASE
            WHEN im_chats.name = 'Immediately'  THEN 0
            WHEN im_chats.name = 'Daily'        THEN 86400
            WHEN im_chats.name = 'Every 3 days' THEN 259200
            WHEN im_chats.name = 'Weekly'       THEN 604800
            WHEN im_chats.name = 'Never'        THEN -1
            ELSE                                     0
        END AS chats_drift_seconds,
        CASE
            WHEN im_intros.name = 'Immediately'  THEN 0
            WHEN im_intros.name = 'Daily'        THEN 86400
            WHEN im_intros.name = 'Every 3 days' THEN 259200
            WHEN im_intros.name = 'Weekly'       THEN 604800
            WHEN im_intros.name = 'Never'        THEN -1
            ELSE                                      0
        END AS intros_drift_seconds
    FROM
        inbox_first_pass
    LEFT JOIN
        person
    ON
        person.uuid = uuid_or_null(inbox_first_pass.username)
    LEFT JOIN
        immediacy AS im_chats
    ON
        im_chats.id = person.chats_notification
    LEFT JOIN
        immediacy AS im_intros
    ON
        im_intros.id = person.intros_notification
    -- Fan a single person out into one row per notification that must be sent.
    -- A signed-in `duo_session` with a NULL `push_token` is a push-less (web)
    -- client: only the mobile app registers a push token, so this is how a
    -- web client is identified (its `session_token_hash` can't be NULL, being
    -- the table's primary key).
    CROSS JOIN LATERAL (
        -- One push per distinct logged-in mobile push token, but only while the
        -- user has been online within the push window (8 days). Logged-out
        -- devices have no `duo_session` row (or are not `signed_in`), so they're
        -- excluded.
        SELECT
            push_session.push_token AS token
        FROM
            duo_session AS push_session
        WHERE
            push_session.person_id = person.id
        AND
            push_session.signed_in
        AND
            push_session.push_token IS NOT NULL
        AND
            extract(epoch from person.last_online_time)
                > EXTRACT(EPOCH FROM NOW() - INTERVAL '8 days')
        GROUP BY
            push_session.push_token

        UNION ALL

        -- A single email (NULL token) when either no logged-in device can
        -- receive push, or the user was last seen online on a web client more
        -- recently than on any mobile session. Ties favour the mobile session,
        -- so the email is only added when a web session is strictly more recent.
        SELECT
            NULL AS token
        WHERE
            NOT EXISTS (
                SELECT 1
                FROM duo_session AS push_session
                WHERE push_session.person_id = person.id
                AND push_session.signed_in
                AND push_session.push_token IS NOT NULL
                AND extract(epoch from person.last_online_time)
                        > EXTRACT(EPOCH FROM NOW() - INTERVAL '8 days')
            )
            OR
            COALESCE(
                (
                    SELECT MAX(web_session.last_online_time)
                    FROM duo_session AS web_session
                    WHERE web_session.person_id = person.id
                    AND web_session.signed_in
                    AND web_session.push_token IS NULL
                )
                >
                (
                    SELECT MAX(mobile_session.last_online_time)
                    FROM duo_session AS mobile_session
                    WHERE mobile_session.person_id = person.id
                    AND mobile_session.signed_in
                    AND mobile_session.push_token IS NOT NULL
                ),
                FALSE
            )
    ) AS notification_target
)
SELECT
    inbox_second_pass.person_uuid,
    last_intro_seconds,
    last_chat_seconds,
    last_intro_notification_seconds,
    last_chat_notification_seconds,
    has_intro,
    has_chat,
    token,
    name,
    email,
    chats_drift_seconds,
    intros_drift_seconds
FROM
    inbox_second_pass
WHERE
    (has_intro OR has_chat)
AND
    activated
"""
