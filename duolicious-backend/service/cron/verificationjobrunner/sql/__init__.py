Q_QUEUED_VERIFICATION_JOBS = """
SELECT
    id,
    person_id,
    photo_uuid AS proof_uuid,
    ARRAY(
        SELECT
            uuid
        FROM
            photo
        WHERE
            photo.person_id = vj.person_id
        ORDER BY
            position
    ) AS claimed_uuids,
    (
        SELECT
            EXTRACT(YEAR FROM AGE(date_of_birth)) AS age
        FROM
            person
        WHERE
            person.id = vj.person_id
    ) AS claimed_age,
    (
        SELECT
            gender.name
        FROM
            person
        JOIN
            gender
        ON
            gender.id = person.gender_id
        WHERE
            person.id = vj.person_id
    ) AS claimed_gender,
    (
        SELECT
            ethnicity.name
        FROM
            person
        JOIN
            ethnicity
        ON
            ethnicity.id = person.ethnicity_id
        WHERE
            person.id = vj.person_id
        AND
            ethnicity.name <> 'Unanswered'
    ) AS claimed_ethnicity
FROM
    verification_job AS vj
WHERE
    status = 'queued'
"""

Q_SET_VERIFICATION_JOB_RUNNING = """
UPDATE
    verification_job
SET
    status = 'running',
    message = 'Our AI is checking your selfie'
WHERE
    id = %(verification_job_id)s
"""

Q_UPDATE_VERIFICATION_STATUS = """
WITH updated_verification_job AS (
    UPDATE
        verification_job
    SET
        status = %(status)s,
        message = %(message)s,
        raw_json = %(raw_json)s
    WHERE
        id = %(verification_job_id)s
    RETURNING
        person_id,
        status
), successful_verification_job AS (
    SELECT
        person_id,
        status
    FROM
        updated_verification_job
    WHERE
        status = 'success'
), updated_person AS (
    UPDATE
        person
    SET
        verification_level_id = (
            SELECT
                id
            FROM
                verification_level
            WHERE
                name = %(verification_level_name)s
        ),
        verified_age = %(verified_age)s,
        verified_gender = %(verified_gender)s,
        verified_ethnicity = %(verified_ethnicity)s
    WHERE
        id IN (SELECT person_id FROM successful_verification_job)
), updated_photo AS (
    UPDATE
        photo
    SET
        verified = (uuid = ANY(%(verified_uuids)s::TEXT[]))
    WHERE
        person_id IN (SELECT person_id FROM successful_verification_job)
)
SELECT 1
"""
