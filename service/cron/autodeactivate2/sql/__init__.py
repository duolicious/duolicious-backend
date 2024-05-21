Q_INACTIVE = """
SELECT DISTINCT
    username AS person_id
FROM
    last
WHERE
    seconds < EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days')
AND
    seconds > EXTRACT(EPOCH FROM NOW() - INTERVAL '50 days')
"""

Q_DEACTIVATE = """
WITH unnested_ids AS (
    SELECT unnest(%(ids)s::TEXT[]) AS id
), valid_uuid AS (
    SELECT
        uuid_or_null(id) AS uuid
    FROM
        unnested_ids
    WHERE
        uuid_or_null(id) IS NOT NULL
), newly_deactivated AS (
    UPDATE
        person
    SET
        activated = FALSE
    WHERE
        uuid IN (SELECT uuid FROM valid_uuid)
    AND
        activated = TRUE
    AND
        sign_in_time < NOW() - INTERVAL '10 minutes'
    AND
        NOT %(dry_run)s
    RETURNING
        id,
        email
), deleted AS (
    DELETE FROM
        duo_session
    USING
        newly_deactivated
    WHERE
        duo_session.person_id = newly_deactivated.id
)
SELECT
    id,
    email
FROM
    newly_deactivated
"""
