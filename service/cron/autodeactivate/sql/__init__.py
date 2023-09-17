Q_INACTIVE = """
SELECT
    username::int AS person_id,
    seconds
FROM
    last
WHERE
    seconds <= extract(epoch from NOW() - INTERVAL '3 days')::int
"""
# AND
#     seconds >= extract(epoch from NOW() - INTERVAL '3 days + 1 hour')::int - 2 * %(polling_interval_seconds)s
# """

Q_EMAILS = """
SELECT
    id AS person_id,
    email
FROM
    person
WHERE
    activated
AND
    id = ANY(%(ids)s)
"""

Q_DEACTIVATE = """
WITH q1 AS (
    UPDATE
        person
    SET
        activated = FALSE
    WHERE
        id = ANY(%(ids)s)
), q2 AS (
    DELETE FROM
        duo_session
    WHERE
        person_id = ANY(%(ids)s)
)
SELECT 1
"""
