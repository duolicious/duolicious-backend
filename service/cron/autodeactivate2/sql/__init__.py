Q_INACTIVE = """
SELECT DISTINCT
    username AS person_id
FROM
    last
WHERE
    seconds < EXTRACT(EPOCH FROM NOW() - INTERVAL '10 days')
AND
    seconds > EXTRACT(EPOCH FROM NOW() - INTERVAL '20 days')
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
), updated_person AS (
    UPDATE
        person
    SET
        activated = FALSE
    WHERE
        activated = TRUE
    AND
        uuid IN (SELECT uuid FROM valid_uuid)
    AND
        sign_in_time < NOW() - INTERVAL '10 minutes'
    AND
        NOT %(dry_run)s
    RETURNING
        id,
        email
), decrement_club AS (
    UPDATE
        club
    SET
        count_members = GREATEST(0, count_members - 1)
    FROM
        person_club
    WHERE
        person_club.club_name = club.name
    AND
        person_club.person_id IN (SELECT id FROM updated_person)
), deleted_duo_session AS (
    DELETE FROM
        duo_session
    USING
        updated_person
    WHERE
        duo_session.person_id = updated_person.id
)
SELECT
    id,
    email
FROM
    updated_person
"""
