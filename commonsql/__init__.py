Q_UPDATE_VERIFICATION_LEVEL_ASSIGN = """
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
"""

Q_UPDATE_VERIFICATION_LEVEL = f"""
UPDATE
    person
SET
    {Q_UPDATE_VERIFICATION_LEVEL_ASSIGN}
WHERE
    id = %(person_id)s
"""

Q_UPSERT_LAST = """
INSERT INTO
    last (username, seconds)
SELECT
    %(person_uuid)s::text,
    EXTRACT(EPOCH FROM NOW())::BIGINT
WHERE
    %(person_uuid)s IS NOT NULL
ON CONFLICT (username) DO UPDATE SET
    seconds = EXCLUDED.seconds
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

Q_COMPUTED_FLAIR = """
    SELECT
        array_agg(DISTINCT e ORDER BY e) AS computed_flair
    FROM (
        SELECT
            unnest(flair) AS e
        FROM
            {table}
        UNION
            SELECT 'gold'          FROM {table} WHERE has_gold
        UNION
            SELECT 'q-and-a-100'   FROM {table} WHERE count_answers >= 100
        UNION
            SELECT 'one-week'      FROM {table} WHERE sign_up_time <= now() - interval '1 week'
        UNION
            SELECT 'one-month'     FROM {table} WHERE sign_up_time <= now() - interval '1 month'
        UNION
            SELECT 'one-year'      FROM {table} WHERE sign_up_time <= now() - interval '1 year'
        UNION
            SELECT 'long-bio'      FROM {table} WHERE length(about) >= 500
        UNION
            SELECT 'early-adopter' FROM {table} WHERE sign_up_time <= '2024-08-26 01:05:49'
    ) t
"""
