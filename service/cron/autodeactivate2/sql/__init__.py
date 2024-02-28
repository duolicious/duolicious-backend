Q_INACTIVE = """
SELECT DISTINCT
    inbox.luser AS person_id
FROM
    inbox
JOIN
    last
ON
    inbox.lserver = 'duolicious.app'
AND
    last.username = inbox.luser
AND
    inbox.timestamp > last.seconds::bigint * 1000000
AND
    inbox.timestamp <=
        extract(epoch from now() - interval '10 days')::bigint * 1000000
AND
    inbox.timestamp >=
        extract(epoch from now() - interval '11 days')::bigint * 1000000
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
