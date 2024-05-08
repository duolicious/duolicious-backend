Q_INACTIVE = """
SELECT DISTINCT
    username AS person_id
FROM
    last
WHERE
    seconds < EXTRACT(EPOCH FROM NOW() - INTERVAL '70 days')
AND
    seconds > EXTRACT(EPOCH FROM NOW() - INTERVAL '90 days')
"""

Q_DEACTIVATE = """
WITH newly_deactivated AS (
    UPDATE
        person
    SET
        activated = FALSE
    WHERE
        id = ANY(%(ids)s)
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
