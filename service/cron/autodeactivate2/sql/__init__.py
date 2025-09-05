Q_DEACTIVATE = """
WITH to_deactivate AS (
    SELECT
        id,
        email
    FROM
        person
    WHERE
        last_online_time < NOW() - INTERVAL '30 days'
    AND
        last_online_time > NOW() - INTERVAL '50 days'
    AND
        activated
    AND
        sign_in_time < NOW() - INTERVAL '10 minutes'
), updated_person AS (
    UPDATE
        person
    SET
        activated = FALSE
    FROM
        to_deactivate
    WHERE
        to_deactivate.id = person.id
    AND
        NOT %(dry_run)s
    RETURNING
        person.id
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
    to_deactivate
"""
