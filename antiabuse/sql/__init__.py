Q_LAST_MESSAGES = """
WITH last_messages AS (
    SELECT
        mam_message.id AS id,
        CASE
        WHEN mam_message.direction = 'O'
            THEN 'reporter'
            ELSE 'accused'
        END AS sent_by,
        message,
        search_body
    FROM
        mam_message
    JOIN
        person
    ON
        person.id = mam_message.person_id
    AND
        person.uuid = %(subject_uuid)s
    WHERE
        mam_message.remote_bare_jid IN (
            %(subject_uuid)s::TEXT,
            %(object_uuid)s::TEXT
        )
    ORDER BY
        mam_message.id DESC
    LIMIT 25
)
SELECT
    sent_by,
    message,
    search_body
FROM
    last_messages
ORDER BY
    id
"""

Q_MAKE_REPORT = """
WITH object_person_id AS (
    SELECT
        id
    FROM
        person
    WHERE
        uuid = %(object_uuid)s
), subject_person_id AS (
    SELECT
        id
    FROM
        person
    WHERE
        uuid = %(subject_uuid)s
), token AS (
    INSERT INTO banned_person_admin_token (
        person_id
    )
    VALUES
        ((SELECT id FROM subject_person_id)),
        ((SELECT id FROM object_person_id))
    RETURNING
        person_id,
        token
), photo_ban AS (
    INSERT INTO deleted_photo_admin_token (
        photo_uuid
    )
    SELECT
        uuid AS photo_uuid
    FROM
        photo
    JOIN
        token
    ON
        photo.person_id = token.person_id
    RETURNING
        photo_uuid,
        token
), photo_ban_with_id AS (
    SELECT
        photo_ban.photo_uuid AS uuid,
        token.person_id AS person_id,
        photo_ban.token AS token,
        photo.position AS position
    FROM
        photo_ban
    JOIN
        photo ON photo_ban.photo_uuid = photo.uuid
    JOIN
        token ON photo.person_id = token.person_id
)
SELECT
    CASE
        WHEN id = (SELECT id FROM subject_person_id)
        THEN 'Reporter'
        ELSE 'Accused'
    END AS role,
    id,
    uuid::TEXT,
    location_long_friendly AS location,
    split_part(email, '@', 2) AS email_domain,
    ARRAY(
        SELECT DISTINCT
            ip_address::TEXT
        FROM duo_session
        WHERE person_id = p.id
    ) AS ip_addresses,
    count_answers,
    ARRAY(
        SELECT
            'https://user-images.duolicious.app/original-' || uuid || '.jpg'
        FROM photo
        WHERE photo.person_id = p.id
        ORDER BY position
    ) AS photo_links,
    ARRAY(
        SELECT
            uuid || ': https://api.duolicious.app/admin/delete-photo-link/' || photo_ban_with_id.token
        FROM photo_ban_with_id
        WHERE photo_ban_with_id.person_id = p.id
        ORDER BY position
    ) AS photo_deletion_links,
    EXTRACT(YEAR FROM AGE(date_of_birth))::int AS age,
    name,
    (
        select name from gender where id = gender_id
    ) AS gender,
    occupation,
    education,
    about,
    ARRAY(
        SELECT
            club_name
        FROM person_club
        WHERE person_id = p.id
    ) AS clubs,
    token::text,
    FLOOR(
        EXTRACT(epoch FROM age(now(), sign_up_time)) / 86400
    )::INT AS account_age_in_days,
    (
        SELECT
            count(*)
        FROM
            skipped
        WHERE
            reported
        AND
            object_person_id = p.id
    ) AS times_reported,
    (
        SELECT
            count(*)
        FROM
            skipped
        WHERE
            reported
        AND
            object_person_id = p.id
        AND
            created_at > NOW() - INTERVAL '1 day'
    ) AS times_reported_in_the_past_24_hours,
    ARRAY(
        SELECT
            report_reason
        FROM
            skipped
        WHERE
            reported
        AND
            object_person_id = p.id
        AND
            report_reason <> ''
    ) AS all_report_reasons,
    (
        SELECT
            name
        FROM
            verification_level
        WHERE
            verification_level.id = p.verification_level_id
    ) AS verification_level
FROM
    person AS p
JOIN
    token
ON
    token.person_id = p.id
ORDER BY
    (id = (SELECT id FROM subject_person_id)) DESC
"""

Q_INSERT_SKIPPED = """
WITH subject_person_id AS (
    SELECT
        id
    FROM
        person
    WHERE
        uuid = %(subject_uuid)s
), object_person_id AS (
    SELECT
        id
    FROM
        person
    WHERE
        uuid = %(object_uuid)s
), q1 AS (
    INSERT INTO skipped (
        subject_person_id,
        object_person_id,
        reported,
        report_reason
    ) VALUES (
        (SELECT id FROM subject_person_id),
        (SELECT id FROM object_person_id),
        %(reported)s,
        %(report_reason)s
    ) ON CONFLICT DO NOTHING
), q2 AS (
    DELETE FROM search_cache
    WHERE
        searcher_person_id = (SELECT id FROM subject_person_id) AND
        prospect_person_id = (SELECT id FROM object_person_id)
    OR
        searcher_person_id = (SELECT id FROM object_person_id) AND
        prospect_person_id = (SELECT id FROM subject_person_id)
)
SELECT 1
"""
