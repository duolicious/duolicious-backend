Q_UPDATE_ANSWER = """
WITH
old_answer AS (
    SELECT question_id, answer
    FROM answer
    WHERE
        person_id = %(person_id)s AND
        question_id = COALESCE(
            %(question_id_to_insert)s,
            %(question_id_to_delete)s
        )
), deleted_answer AS (
    DELETE FROM answer
    WHERE
        person_id = %(person_id)s AND
        question_id = %(question_id_to_delete)s
), new_answer AS (
    INSERT INTO answer (
        person_id,
        question_id,
        answer,
        public_
    )
    SELECT
        %(person_id)s,
        %(question_id_to_insert)s,
        %(answer)s,
        %(public)s
    WHERE %(question_id_to_insert)s::SMALLINT IS NOT NULL
    ON CONFLICT (person_id, question_id) DO UPDATE SET
        answer  = EXCLUDED.answer,
        public_ = EXCLUDED.public_
    RETURNING
        question_id,
        answer
), updated_personality_vectors AS (
    SELECT
        (compute_personality_vectors(
            new_vectors.presence_score,
            new_vectors.absence_score,
            old_vectors.presence_score,
            old_vectors.absence_score,
            cur_vectors.presence_score,
            cur_vectors.absence_score,
            cur_vectors.count_answers
        )).*
    FROM (
        SELECT (answer_score_vectors(question_id, answer)).*
        FROM new_answer
        LIMIT 1
    ) AS new_vectors FULL OUTER JOIN (
        SELECT (answer_score_vectors(question_id, answer)).*
        FROM old_answer
        LIMIT 1
    ) AS old_vectors ON TRUE FULL OUTER JOIN (
        SELECT presence_score, absence_score, count_answers
        FROM person where id = %(person_id)s
        LIMIT 1
    ) AS cur_vectors ON TRUE
)
UPDATE person
SET
    personality    = updated_personality_vectors.personality,
    presence_score = updated_personality_vectors.presence_score,
    absence_score  = updated_personality_vectors.absence_score,
    count_answers  = updated_personality_vectors.count_answers
FROM updated_personality_vectors
WHERE person.id = %(person_id)s
"""

Q_ADD_YES_NO_COUNT = """
UPDATE question
SET
    count_yes = count_yes + %(add_yes)s,
    count_no  = count_no  + %(add_no)s
WHERE
    id = %(question_id)s
"""

Q_SELECT_ME_1 = """
SELECT id, name
FROM person
WHERE id = %(person_id)s
"""

Q_SELECT_ME_2 = """
SELECT
    trait.id AS trait_id,
    trait.name,
    trait.min_label,
    trait.max_label,
    trait.description,
    ROUND(100 * t2.ratio)::SMALLINT AS percentage,
    COALESCE(t2.ratio, -1) AS position
FROM (
    SELECT
        (trait_ratio(presence_score, absence_score, 5000)).*
    FROM
        person
    WHERE
        id = %(person_id)s
) AS t2
JOIN
    trait
ON
    t2.trait_id = trait.id
ORDER BY
    position
DESC
"""

Q_INSERT_DUO_SESSION = """
INSERT INTO duo_session (
    session_token_hash,
    person_id,
    email,
    otp
) VALUES (
    %(session_token_hash)s,
    (SELECT id FROM person WHERE email = %(email)s),
    %(email)s,
    %(otp)s
)
"""

Q_UPDATE_OTP = """
UPDATE duo_session
SET
    otp = %(otp)s,
    otp_expiry = NOW() + INTERVAL '1 minute'
WHERE session_token_hash = %(session_token_hash)s
"""

Q_MAYBE_DELETE_ONBOARDEE = """
WITH valid_session AS (
    UPDATE duo_session
    SET signed_in = TRUE
    WHERE
        session_token_hash = %(session_token_hash)s AND
        otp = %(otp)s AND
        otp_expiry > NOW()
    RETURNING email
)
DELETE FROM onboardee
WHERE email IN (SELECT email FROM valid_session)
RETURNING email
"""

Q_MAYBE_SIGN_IN = """
WITH valid_session AS (
    UPDATE duo_session
    SET signed_in = TRUE
    WHERE
        session_token_hash = %(session_token_hash)s AND
        otp = %(otp)s AND
        otp_expiry > NOW()
    RETURNING person_id, email
), existing_person AS (
    UPDATE person
    SET
        last_active_time = NOW(),
        activated = TRUE,
        sign_in_count = sign_in_count + 1
    FROM valid_session
    WHERE person.id = person_id
    RETURNING person.id
), new_onboardee AS (
    INSERT INTO onboardee (
        email
    )
    SELECT email
    FROM valid_session
    WHERE NOT EXISTS (SELECT 1 FROM existing_person)
)
SELECT * FROM valid_session
"""

Q_SELECT_ONBOARDEE_PHOTO = """
SELECT uuid
FROM onboardee_photo
WHERE
    email = %(email)s AND
    position = %(position)s
"""

Q_DELETE_ONBOARDEE_PHOTO = """
DELETE FROM onboardee_photo
WHERE
    email = %(email)s AND
    position = %(position)s
"""

Q_SELECT_ONBOARDEE_PHOTOS_TO_DELETE = """
WITH
valid_session AS (
    SELECT email
    FROM duo_session
    WHERE
        session_token_hash = %(session_token_hash)s AND
        otp = %(otp)s AND
        otp_expiry > NOW()
)
SELECT uuid
FROM onboardee_photo
WHERE email IN (SELECT email from valid_session)
"""

Q_DELETE_DUO_SESSION = """
DELETE FROM duo_session
WHERE session_token_hash = %(session_token_hash)s
"""

Q_POST_ACTIVE = """
UPDATE person
SET last_active_time = NOW()
WHERE person_id = %(person_id)s
"""

Q_FINISH_ONBOARDING = """
WITH
onboardee_country AS (
    SELECT country
    FROM location
    ORDER BY location.coordinates <-> (
        SELECT coordinates
        FROM onboardee
        WHERE email = %(email)s
    )
    LIMIT 1
), new_person AS (
    INSERT INTO person (
        email,
        name,
        date_of_birth,
        coordinates,
        gender_id,
        about,
        has_profile_picture_id,
        unit_id
    ) SELECT
        email,
        name,
        date_of_birth,
        coordinates,
        gender_id,
        about,
        CASE
            WHEN EXISTS (SELECT 1 FROM onboardee_photo WHERE email = %(email)s)
            THEN 1
            ELSE 2
        END AS has_profile_picture_id,
        (
            SELECT id
            FROM unit
            WHERE name IN (
                SELECT
                    CASE
                        WHEN country = 'United States'
                        THEN 'Imperial'
                        ELSE 'Metric'
                    END AS name
                FROM onboardee_country
            )
        ) AS unit_id
    FROM onboardee
    WHERE email = %(email)s
    RETURNING id, email
), new_photo AS (
    INSERT INTO photo (
        person_id,
        position,
        uuid
    )
    SELECT
        new_person.id,
        position,
        uuid
    FROM onboardee_photo
    JOIN new_person
    ON onboardee_photo.email = new_person.email
), new_question_order_map AS (
    WITH
    row_to_shuffle AS (
      SELECT id
      FROM question
      WHERE id > 100
      ORDER BY RANDOM()
      LIMIT (SELECT ROUND(0.2 * COUNT(*)) FROM question)
    ), shuffled_src_to_dst_position AS (
      SELECT
        a.id AS src_position,
        b.id AS dst_position
      FROM (SELECT *, ROW_NUMBER() OVER(ORDER BY RANDOM()) FROM row_to_shuffle) AS a
      JOIN (SELECT *, ROW_NUMBER() OVER(ORDER BY RANDOM()) FROM row_to_shuffle) AS b
      ON a.row_number = b.row_number
    ), identity_src_to_dst_position AS (
      SELECT
        id AS src_position,
        id AS dst_position
      FROM question
      WHERE id NOT IN (SELECT src_position FROM shuffled_src_to_dst_position)
    )
    (SELECT * FROM identity_src_to_dst_position)
    UNION
    (SELECT * FROM shuffled_src_to_dst_position)
), new_question_order AS (
    INSERT INTO question_order (
        person_id,
        question_id,
        position
    ) SELECT
        new_person.id,
        new_question_order_map.src_position,
        new_question_order_map.dst_position
    FROM new_person
    CROSS JOIN new_question_order_map
), updated_session AS (
    UPDATE duo_session
    SET person_id = new_person.id
    FROM new_person
    WHERE duo_session.email = new_person.email
), p1 AS (
    INSERT INTO search_preference_gender (person_id, gender_id)
    SELECT new_person.id, gender_id
    FROM onboardee_search_preference_gender
    JOIN new_person
    ON new_person.email = onboardee_search_preference_gender.email
), p2 AS (
    INSERT INTO search_preference_orientation (person_id, orientation_id)
    SELECT new_person.id, orientation.id
    FROM new_person, orientation
), p3 AS (
    INSERT INTO search_preference_age (person_id, min_age, max_age)
    SELECT new_person.id, NULL, NULL
    FROM new_person
), p4 AS (
    INSERT INTO search_preference_distance (person_id, distance)
    SELECT new_person.id, NULL
    FROM new_person
), p5 AS (
    INSERT INTO search_preference_height_cm (person_id, min_height_cm, max_height_cm)
    SELECT new_person.id, NULL, NULL
    FROM new_person
), p6 AS (
    INSERT INTO search_preference_verified (person_id, verified_id)
    SELECT new_person.id, yes_no.id
    FROM new_person, yes_no
), p7 AS (
    INSERT INTO search_preference_has_profile_picture (person_id, has_profile_picture_id)
    SELECT new_person.id, yes_no.id
    FROM new_person, yes_no
), p8 AS (
    INSERT INTO search_preference_looking_for (person_id, looking_for_id)
    SELECT new_person.id, looking_for.id
    FROM new_person, looking_for
), p9 AS (
    INSERT INTO search_preference_smoking (person_id, smoking_id)
    SELECT new_person.id, yes_no_optional.id
    FROM new_person, yes_no_optional
), p10 AS (
    INSERT INTO search_preference_drinking (person_id, drinking_id)
    SELECT new_person.id, frequency.id
    FROM new_person, frequency
), p11 AS (
    INSERT INTO search_preference_drugs (person_id, drugs_id)
    SELECT new_person.id, yes_no_optional.id
    FROM new_person, yes_no_optional
), p12 AS (
    INSERT INTO search_preference_long_distance (person_id, long_distance_id)
    SELECT new_person.id, yes_no_optional.id
    FROM new_person, yes_no_optional
), p13 AS (
    INSERT INTO search_preference_relationship_status (person_id, relationship_status_id)
    SELECT new_person.id, relationship_status.id
    FROM new_person, relationship_status
), p14 AS (
    INSERT INTO search_preference_has_kids (person_id, has_kids_id)
    SELECT new_person.id, yes_no_maybe.id
    FROM new_person, yes_no_maybe
), p15 AS (
    INSERT INTO search_preference_wants_kids (person_id, wants_kids_id)
    SELECT new_person.id, yes_no_maybe.id
    FROM new_person, yes_no_maybe
), p16 AS (
    INSERT INTO search_preference_exercise (person_id, exercise_id)
    SELECT new_person.id, frequency.id
    FROM new_person, frequency
), p17 AS (
    INSERT INTO search_preference_religion (person_id, religion_id)
    SELECT new_person.id, religion.id
    FROM new_person, religion
), p18 AS (
    INSERT INTO search_preference_star_sign (person_id, star_sign_id)
    SELECT new_person.id, star_sign.id
    FROM new_person, star_sign
), p19 AS (
    INSERT INTO search_preference_messaged (person_id, messaged_id)
    SELECT new_person.id, yes_no.id
    FROM new_person, yes_no
    WHERE yes_no.name = 'Yes'
), p20 AS (
    INSERT INTO search_preference_hidden (person_id, hidden_id)
    SELECT new_person.id, yes_no.id
    FROM new_person, yes_no
    WHERE yes_no.name = 'No'
), p21 AS (
    INSERT INTO search_preference_blocked (person_id, blocked_id)
    SELECT new_person.id, yes_no.id
    FROM new_person, yes_no
    WHERE yes_no.name = 'No'
)
DELETE FROM onboardee
WHERE email = %(email)s
"""
