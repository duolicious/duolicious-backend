Q_DELETE_EXPIRED_RECORDS = """
WITH q1 AS (
    DELETE FROM
        banned_person_admin_token
    WHERE
        expires_at < NOW()
    RETURNING
        1
), q2 AS (
    DELETE FROM
        deleted_photo_admin_token
    WHERE
        expires_at < NOW()
    RETURNING
        1
), q3 AS (
    DELETE FROM
        banned_person
    WHERE
        expires_at < NOW()
    RETURNING
        1
), q4 AS (
    DELETE FROM
        duo_session
    WHERE
        session_expiry < NOW()
    RETURNING
        1
), q5 AS (
    DELETE FROM
        onboardee
    WHERE
        created_at < NOW() - INTERVAL '1 week'
    RETURNING
        1
)
SELECT
    COUNT(*) AS count
FROM (
    SELECT 1 FROM q1 UNION ALL
    SELECT 1 FROM q2 UNION ALL
    SELECT 1 FROM q3 UNION ALL
    SELECT 1 FROM q4 UNION ALL
    SELECT 1 FROM q5
)
"""
