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
    RETURNING
        duo_session.person_id,
        duo_session.session_token_hash
), deleted_session_hashes AS (
    SELECT
        person_id,
        array_agg(session_token_hash) AS hashes
    FROM
        deleted_duo_session
    GROUP BY
        person_id
)
-- Each person row carries only its own just-deleted session token hashes so the
-- caller can evict those cached sessions. The LEFT JOIN yields an empty array
-- for persons with no deleted sessions, including every row on a dry run (when
-- `updated_person`, and thus the cascade, is empty).
SELECT
    to_deactivate.id,
    to_deactivate.email,
    COALESCE(deleted_session_hashes.hashes, ARRAY[]::TEXT[])
        AS session_token_hashes
FROM
    to_deactivate
LEFT JOIN
    deleted_session_hashes
ON
    deleted_session_hashes.person_id = to_deactivate.id
"""
