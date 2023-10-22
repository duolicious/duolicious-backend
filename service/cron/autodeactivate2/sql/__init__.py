Q_INACTIVE = """
WITH earliest_unacked_message_by_user AS (
    SELECT
        inbox.luser,
        MIN(inbox.timestamp / 1000000) AS earliest_message_seconds
    FROM
        inbox
    JOIN
        last
    ON
        last.username = inbox.luser
    AND
        inbox.timestamp / 1000000 > last.seconds
    GROUP BY
        inbox.luser
)
SELECT
    luser::int AS person_id
FROM
    earliest_unacked_message_by_user
WHERE
    -- It's been more than x days after their earliest unacked message
    earliest_message_seconds + extract(epoch from interval '10 days')::int < extract(epoch from now())
"""

Q_DEACTIVATE = """
WITH q1 AS (
    DELETE FROM
        duo_session
    WHERE
        person_id = ANY(%(ids)s)
)
UPDATE
    person
SET
    activated = FALSE
WHERE
    id = ANY(%(ids)s)
AND
    activated = TRUE
RETURNING
    id
"""
