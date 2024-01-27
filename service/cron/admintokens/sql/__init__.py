Q_CLEAN_ADMIN_TOKENS = """
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
)
SELECT
    COUNT(*) AS count
FROM (
    SELECT 1 FROM q1 UNION ALL
    SELECT 1 FROM q2
)
"""
