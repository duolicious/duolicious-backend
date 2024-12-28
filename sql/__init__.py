Q_UPDATE_VERIFICATION_LEVEL = """
UPDATE
    person
SET
    verification_level_id = CASE
        WHEN EXISTS (
            SELECT
                1
            FROM
                photo
            WHERE
                person_id = person.id
            AND
                verified
        )
        THEN 3

        WHEN EXISTS (
            SELECT
                1
            FROM
                person p
            WHERE
                p.id = person.id
            AND
                p.verified_age
            AND
                p.verified_gender
        )
        THEN 2

        ELSE 1
    END
WHERE
    id = %(person_id)s
"""

Q_UPSERT_LAST = """
INSERT INTO
    last (server, username, seconds, state)
SELECT
    'duolicious.app',
    %(person_uuid)s::text,
    EXTRACT(EPOCH FROM NOW())::BIGINT,
    ''
WHERE
    %(person_uuid)s IS NOT NULL
ON CONFLICT (server, username) DO UPDATE SET
    seconds  = EXCLUDED.seconds
"""

Q_UPSERT_LAST_INTRO_NOTIFICATION_TIME = """
INSERT INTO duo_last_notification (username, intro_seconds)
VALUES (%(username)s, extract(epoch from now() + INTERVAL '5 seconds')::int)
ON CONFLICT (username) DO UPDATE SET
    intro_seconds = EXCLUDED.intro_seconds
"""

Q_UPSERT_LAST_CHAT_NOTIFICATION_TIME = """
INSERT INTO duo_last_notification (username, chat_seconds)
VALUES (%(username)s, extract(epoch from now() + INTERVAL '5 seconds')::int)
ON CONFLICT (username) DO UPDATE SET
    chat_seconds = EXCLUDED.chat_seconds
"""

Q_IS_ALLOWED_CLUB_NAME = """
WITH similar_banned_club AS (
    SELECT
        name
    FROM
        banned_club
    ORDER BY
        name <-> %()s
    LIMIT
        10
)
SELECT
    NOT EXISTS (
        SELECT
            1
        FROM
            similar_banned_club
        WHERE
            -- The exact club name is banned
            name = LOWER(%()s)
        OR
            -- The club name contains a banned word/phrase
            word_similarity(name, %()s) > 0.999
        AND
            -- The banned club name is distinctive enough not to trigger too
            -- many false positives when used as a word match
            (name ~ '[A-Za-z]{3}' OR name ~ '[^ ] [^ ]')
    ) AS is_allowed_club_name
"""
