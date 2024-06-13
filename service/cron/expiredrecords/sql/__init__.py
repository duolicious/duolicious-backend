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
        email
), q6 AS (
    DELETE FROM
        verification_job
    WHERE
        expires_at < NOW()
    RETURNING
        photo_uuid AS uuid
), each_deleted_photo AS (
    SELECT
        onboardee_photo.uuid
    FROM
        onboardee_photo
    JOIN
        q5
    ON
        onboardee_photo.email = q5.email

    UNION

    SELECT
        uuid
    FROM
        q6
), q7 AS (
    INSERT INTO
        undeleted_photo (uuid)
    SELECT
        uuid
    FROM
        each_deleted_photo
    RETURNING
        1
)
SELECT
    SUM(n) AS count
FROM (
    SELECT 1 AS n FROM q1 UNION ALL
    SELECT 1 AS n FROM q2 UNION ALL
    SELECT 1 AS n FROM q3 UNION ALL
    SELECT 1 AS n FROM q4 UNION ALL
    SELECT 1 AS n FROM q5 UNION ALL
    SELECT 1 AS n FROM q6 UNION ALL
    SELECT 0 AS n FROM q7
) AS t(n)
"""
