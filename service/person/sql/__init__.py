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

Q_SELECT_PERSONALITY = """
SELECT
    trait.name                        AS trait_name,
    trait.description                 AS trait_description,
    trait.min_label                   AS trait_min_label,
    trait.max_label                   AS trait_max_label,
    person_trait.name                 AS person_name,
    ROUND(100 * person_trait.ratio)   AS person_percentage,
    prospect_trait.name               AS prospect_name,
    ROUND(100 * prospect_trait.ratio) AS prospect_percentage,
    CASE
        WHEN %(prospect_person_id)s IS NOT NULL
        THEN COALESCE(prospect_trait.ratio, 0)
        ELSE COALESCE(person_trait.ratio, 0)
    END AS position
FROM trait
LEFT JOIN (
    SELECT
        id,
        name,
        (trait_ratio(presence_score, absence_score, 5000)).*
    FROM person
    WHERE id = %(person_id)s
) AS person_trait ON
    person_trait.trait_id = trait.id
LEFT JOIN (
    SELECT
        id,
        name,
        (trait_ratio(presence_score, absence_score, 5000)).*
    FROM person
    WHERE id = %(prospect_person_id)s
) AS prospect_trait ON
    prospect_trait.trait_id = trait.id
WHERE
    trait.id IN (
        SELECT trait_id
        FROM trait_topic
        WHERE
            trait_topic.name = %(topic)s OR
            %(topic)s::TEXT IS NULL
    )
ORDER BY
    position DESC,
    trait_name ASC
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
    otp_expiry = NOW() + INTERVAL '10 minutes'
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
        activated = TRUE,
        sign_in_count = sign_in_count + 1
    FROM valid_session
    WHERE person.id = person_id
    RETURNING person.id, person.unit_id
), new_onboardee AS (
    INSERT INTO onboardee (
        email
    )
    SELECT email
    FROM valid_session
    WHERE NOT EXISTS (SELECT 1 FROM existing_person)
)
SELECT
    person_id,
    email,
    (SELECT name FROM unit where id = existing_person.unit_id) AS units
FROM
    valid_session
LEFT JOIN
    existing_person
ON
    valid_session.person_id = existing_person.id
"""

Q_DELETE_ONBOARDEE_PHOTO = """
DELETE FROM onboardee_photo
WHERE
    email = %(email)s AND
    position = %(position)s
"""

Q_DELETE_DUO_SESSION = """
DELETE FROM duo_session
WHERE session_token_hash = %(session_token_hash)s
"""

Q_FINISH_ONBOARDING = """
WITH
onboardee_country AS (
    SELECT country
    FROM location
    ORDER BY coordinates <-> (
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
        unit_id,
        intros_notification
    ) SELECT
        email,
        name,
        date_of_birth,
        coordinates,
        gender_id,
        COALESCE(about, ''),
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
        ) AS unit_id,
        3 AS intros_notification
    FROM onboardee
    WHERE email = %(email)s
    RETURNING id, email, unit_id
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
    INSERT INTO search_preference_has_profile_picture (person_id, has_profile_picture_id)
    SELECT new_person.id, yes_no.id
    FROM new_person, yes_no
), p7 AS (
    INSERT INTO search_preference_looking_for (person_id, looking_for_id)
    SELECT new_person.id, looking_for.id
    FROM new_person, looking_for
), p8 AS (
    INSERT INTO search_preference_smoking (person_id, smoking_id)
    SELECT new_person.id, yes_no_optional.id
    FROM new_person, yes_no_optional
), p9 AS (
    INSERT INTO search_preference_drinking (person_id, drinking_id)
    SELECT new_person.id, frequency.id
    FROM new_person, frequency
), p10 AS (
    INSERT INTO search_preference_drugs (person_id, drugs_id)
    SELECT new_person.id, yes_no_optional.id
    FROM new_person, yes_no_optional
), p11 AS (
    INSERT INTO search_preference_long_distance (person_id, long_distance_id)
    SELECT new_person.id, yes_no_optional.id
    FROM new_person, yes_no_optional
), p12 AS (
    INSERT INTO search_preference_relationship_status (person_id, relationship_status_id)
    SELECT new_person.id, relationship_status.id
    FROM new_person, relationship_status
), p13 AS (
    INSERT INTO search_preference_has_kids (person_id, has_kids_id)
    SELECT new_person.id, yes_no_optional.id
    FROM new_person, yes_no_optional
), p14 AS (
    INSERT INTO search_preference_wants_kids (person_id, wants_kids_id)
    SELECT new_person.id, yes_no_maybe.id
    FROM new_person, yes_no_maybe
), p15 AS (
    INSERT INTO search_preference_exercise (person_id, exercise_id)
    SELECT new_person.id, frequency.id
    FROM new_person, frequency
), p16 AS (
    INSERT INTO search_preference_religion (person_id, religion_id)
    SELECT new_person.id, religion.id
    FROM new_person, religion
), p17 AS (
    INSERT INTO search_preference_star_sign (person_id, star_sign_id)
    SELECT new_person.id, star_sign.id
    FROM new_person, star_sign
), p18 AS (
    INSERT INTO search_preference_messaged (person_id, messaged_id)
    SELECT new_person.id, yes_no.id
    FROM new_person, yes_no
    WHERE yes_no.name = 'Yes'
), p19 AS (
    INSERT INTO search_preference_hidden (person_id, hidden_id)
    SELECT new_person.id, yes_no.id
    FROM new_person, yes_no
    WHERE yes_no.name = 'No'
), p20 AS (
    INSERT INTO search_preference_blocked (person_id, blocked_id)
    SELECT new_person.id, yes_no.id
    FROM new_person, yes_no
    WHERE yes_no.name = 'No'
), deleted_onboardee AS (
    DELETE FROM onboardee
    WHERE email = %(email)s
)
SELECT
    id AS person_id,
    (SELECT name FROM unit WHERE unit.id = new_person.unit_id) AS units
FROM
    new_person
"""

Q_SELECT_PROSPECT_PROFILE = """
WITH negative_dot_prod AS (
    SELECT (
        SELECT personality FROM person WHERE id = %(person_id)s
    ) <#> (
        SELECT personality FROM person WHERE id = %(prospect_person_id)s
    ) AS negative_dot_prod
), match_percentage AS (
    SELECT
        CLAMP(
            0,
            99,
            100 * (1 - negative_dot_prod.negative_dot_prod) / 2
        )::SMALLINT AS match_percentage
    FROM
        negative_dot_prod
)
SELECT
    ARRAY(
        SELECT uuid
        FROM photo
        WHERE person_id = %(prospect_person_id)s
        ORDER BY position
    ) AS photo_uuids,
    name,
    (
        SELECT EXTRACT(YEAR FROM AGE(p.date_of_birth))::SMALLINT
        WHERE p.show_my_age
    ) AS age,
    (
        SELECT short_friendly
        FROM location
        WHERE p.show_my_location
        ORDER BY coordinates <-> p.coordinates
        LIMIT 1
    ) AS location,
    (
        SELECT match_percentage
        FROM match_percentage
    ) AS match_percentage,
    about,
    count_answers,
    EXISTS (SELECT 1 FROM hidden  WHERE subject_person_id = %(person_id)s AND object_person_id = %(prospect_person_id)s) AS is_hidden,
    EXISTS (SELECT 1 FROM blocked WHERE subject_person_id = %(person_id)s AND object_person_id = %(prospect_person_id)s) AS is_blocked,

    -- Basics
    occupation,
    education,
    height_cm,
    (SELECT name FROM gender              WHERE id = p.gender_id              AND name != 'Unanswered') AS gender,
    (SELECT name FROM orientation         WHERE id = p.orientation_id         AND name != 'Unanswered') AS orientation,
    (SELECT name FROM looking_for         WHERE id = p.looking_for_id         AND name != 'Unanswered') AS looking_for,
    (SELECT name FROM yes_no_optional     WHERE id = p.smoking_id             AND name != 'Unanswered') AS smoking,
    (SELECT name FROM frequency           WHERE id = p.drinking_id            AND name != 'Unanswered') AS drinking,
    (SELECT name FROM yes_no_optional     WHERE id = p.drugs_id               AND name != 'Unanswered') AS drugs,
    (SELECT name FROM yes_no_optional     WHERE id = p.long_distance_id       AND name != 'Unanswered') AS long_distance,
    (SELECT name FROM relationship_status WHERE id = p.relationship_status_id AND name != 'Unanswered') AS relationship_status,
    (SELECT name FROM yes_no_optional     WHERE id = p.has_kids_id            AND name != 'Unanswered') AS has_kids,
    (SELECT name FROM yes_no_maybe        WHERE id = p.wants_kids_id          AND name != 'Unanswered') AS wants_kids,
    (SELECT name FROM frequency           WHERE id = p.exercise_id            AND name != 'Unanswered') AS exercise,
    (SELECT name FROM religion            WHERE id = p.religion_id            AND name != 'Unanswered') AS religion,
    (SELECT name FROM star_sign           WHERE id = p.star_sign_id           AND name != 'Unanswered') AS star_sign
FROM
    person AS p
WHERE
    id = %(prospect_person_id)s
"""

Q_SELECT_UNITS = """
SELECT
    (SELECT name FROM unit WHERE unit.id = person.unit_id) AS units
FROM
    person
WHERE
    id = %(person_id)s
"""

Q_INSERT_BLOCKED = """
WITH q1 AS (
    INSERT INTO blocked (
        subject_person_id,
        object_person_id
    ) VALUES (
        %(subject_person_id)s,
        %(object_person_id)s
    ) ON CONFLICT DO NOTHING
), q2 AS (
    DELETE FROM search_cache
    WHERE
        searcher_person_id = %(subject_person_id)s AND
        prospect_person_id = %(object_person_id)s
    OR
        searcher_person_id = %(object_person_id)s AND
        prospect_person_id = %(subject_person_id)s
)
SELECT 1
"""

Q_DELETE_BLOCKED = """
DELETE FROM blocked
WHERE
    subject_person_id = %(subject_person_id)s AND
    object_person_id = %(object_person_id)s
"""

Q_INSERT_HIDDEN = """
WITH q1 AS (
    INSERT INTO hidden (
        subject_person_id,
        object_person_id
    ) VALUES (
        %(subject_person_id)s,
        %(object_person_id)s
    ) ON CONFLICT DO NOTHING
), q2 AS (
    DELETE FROM search_cache
    WHERE
        searcher_person_id = %(subject_person_id)s AND
        prospect_person_id = %(object_person_id)s
)
SELECT 1
"""

Q_DELETE_HIDDEN = """
DELETE FROM hidden
WHERE
    subject_person_id = %(subject_person_id)s AND
    object_person_id = %(object_person_id)s
"""

Q_ANSWER_COMPARISON = """
WITH prospect_name AS(
    SELECT name FROM person WHERE id = %(prospect_person_id)s
), person_name AS(
    SELECT name FROM person WHERE id = %(person_id)s
)
SELECT
    prospect_answer.person_id AS prospect_person_id,
    (SELECT name FROM prospect_name) AS prospect_name,
    prospect_answer.answer AS prospect_answer,
    person_answer.person_id AS person_id,
    (SELECT name FROM person_name) AS person_name,
    person_answer.answer AS person_answer,
    person_answer.public_ AS person_public_,
    question.id AS question_id,
    question.question AS question,
    question.topic AS topic
FROM (
    SELECT
        person_id,
        question_id,
        answer.answer
    FROM
        answer
    JOIN
        question ON
        question.id = answer.question_id AND
        (question.topic = %(topic)s OR %(topic)s = 'All') AND
        answer.person_id = %(prospect_person_id)s AND
        answer.public_ = TRUE AND
        answer.answer IS NOT NULL
) AS prospect_answer
JOIN
    question ON
    question.id = prospect_answer.question_id
LEFT JOIN
    answer AS person_answer ON
    person_answer.person_id = %(person_id)s AND
    person_answer.question_id = prospect_answer.question_id
WHERE
    (
        %(agreement)s != 'Agree' OR
        person_answer.answer IS NOT NULL AND
        prospect_answer.answer IS NOT NULL AND
        person_answer.answer = prospect_answer.answer
    ) AND (
        %(agreement)s != 'Disagree' OR
        person_answer.answer IS NOT NULL AND
        prospect_answer.answer IS NOT NULL AND
        person_answer.answer != prospect_answer.answer
    ) AND (
        %(agreement)s != 'Unanswered' OR
        person_answer.answer IS NULL
    )
ORDER BY
    question.id
LIMIT %(n)s
OFFSET %(o)s
"""

Q_INBOX_INFO = """
SELECT
    id AS person_id,
    name,
    CLAMP(
        0,
        99,
        100 * (
            1 - (
                SELECT (
                    SELECT personality FROM person WHERE id = %(person_id)s
                ) <#> (
                    prospect.personality
                )
            )
        ) / 2
    )::SMALLINT AS match_percentage,
    (
        SELECT
            uuid
        FROM
            photo
        WHERE
            person_id = prospect.id
        ORDER BY
            position
        LIMIT 1
    ) AS image_uuid,
    (
        EXISTS (
            SELECT
                1
            FROM
                blocked
            WHERE
                subject_person_id = %(person_id)s
            AND
                object_person_id = prospect.id
            LIMIT 1
        )
    OR
        EXISTS (
            SELECT
                1
            FROM
                hidden
            WHERE
                subject_person_id = %(person_id)s
            AND
                object_person_id = prospect.id
            LIMIT 1
        )
    ) AS was_archived_by_me
FROM
    person AS prospect
WHERE
    id = ANY(%(prospect_person_ids)s)
AND
    activated
AND
    NOT EXISTS (
        SELECT
            1
        FROM
            blocked
        WHERE
            subject_person_id = prospect.id
        AND
            object_person_id = %(person_id)s
        LIMIT 1
    )
AND
    NOT EXISTS (
        SELECT
            1
        FROM
            hidden
        WHERE
            subject_person_id = prospect.id
        AND
            object_person_id = %(person_id)s
        LIMIT 1
    )
"""

Q_DELETE_ACCOUNT = """
DELETE FROM person WHERE id = %(person_id)s
"""

Q_POST_DEACTIVATE = """
UPDATE
    person
SET
    activated = FALSE
WHERE
    id = %(person_id)s
"""

Q_GET_PROFILE_INFO = """
WITH photo AS (
    SELECT json_object_agg(position, uuid) AS j
    FROM photo
    WHERE person_id = %(person_id)s
), about AS (
    SELECT about AS j FROM person WHERE id = %(person_id)s
), gender AS (
    SELECT gender.name AS j
    FROM gender JOIN person ON gender_id = gender.id
    WHERE person.id = %(person_id)s
), orientation AS (
    SELECT orientation.name AS j
    FROM orientation JOIN person ON orientation_id = orientation.id
    WHERE person.id = %(person_id)s
), location AS (
    SELECT long_friendly AS j
    FROM location
    ORDER BY coordinates <-> (
        SELECT coordinates FROM person WHERE id = %(person_id)s
    )
    LIMIT 1
), occupation AS (
    SELECT occupation AS j FROM person WHERE id = %(person_id)s
), education AS (
    SELECT education AS j FROM person WHERE id = %(person_id)s
), height AS (
    SELECT height_cm AS j FROM person WHERE id = %(person_id)s
), looking_for AS (
    SELECT looking_for.name AS j
    FROM looking_for JOIN person ON looking_for_id = looking_for.id
    WHERE person.id = %(person_id)s
), smoking AS (
    SELECT yes_no_optional.name AS j
    FROM yes_no_optional JOIN person ON smoking_id = yes_no_optional.id
    WHERE person.id = %(person_id)s
), drinking AS (
    SELECT frequency.name AS j
    FROM frequency JOIN person ON drinking_id = frequency.id
    WHERE person.id = %(person_id)s
), drugs AS (
    SELECT yes_no_optional.name AS j
    FROM yes_no_optional JOIN person ON drugs_id = yes_no_optional.id
    WHERE person.id = %(person_id)s
), long_distance AS (
    SELECT yes_no_optional.name AS j
    FROM yes_no_optional JOIN person ON long_distance_id = yes_no_optional.id
    WHERE person.id = %(person_id)s
), relationship_status AS (
    SELECT relationship_status.name AS j
    FROM relationship_status JOIN person ON relationship_status_id = relationship_status.id
    WHERE person.id = %(person_id)s
), has_kids AS (
    SELECT yes_no_maybe.name AS j
    FROM yes_no_maybe JOIN person ON has_kids_id = yes_no_maybe.id
    WHERE person.id = %(person_id)s
), wants_kids AS (
    SELECT yes_no_maybe.name AS j
    FROM yes_no_maybe JOIN person ON wants_kids_id = yes_no_maybe.id
    WHERE person.id = %(person_id)s
), exercise AS (
    SELECT frequency.name AS j
    FROM frequency JOIN person ON exercise_id = frequency.id
    WHERE person.id = %(person_id)s
), religion AS (
    SELECT religion.name AS j
    FROM religion JOIN person ON religion_id = religion.id
    WHERE person.id = %(person_id)s
), star_sign AS (
    SELECT star_sign.name AS j
    FROM star_sign JOIN person ON star_sign_id = star_sign.id
    WHERE person.id = %(person_id)s

), unit AS (
    SELECT unit.name AS j
    FROM unit JOIN person ON unit_id = unit.id
    WHERE person.id = %(person_id)s

), chat AS (
    SELECT immediacy.name AS j
    FROM immediacy JOIN person ON chats_notification = immediacy.id
    WHERE person.id = %(person_id)s
), intro AS (
    SELECT immediacy.name AS j
    FROM immediacy JOIN person ON intros_notification = immediacy.id
    WHERE person.id = %(person_id)s

), show_my_location AS (
    SELECT
        CASE WHEN show_my_location THEN 'Yes' ELSE 'No' END AS j
    FROM person
    WHERE id = %(person_id)s
), show_my_age AS (
    SELECT
        CASE WHEN show_my_age THEN 'Yes' ELSE 'No' END AS j
    FROM person
    WHERE id = %(person_id)s
), hide_me_from_strangers AS (
    SELECT
        CASE WHEN hide_me_from_strangers THEN 'Yes' ELSE 'No' END AS j
    FROM person
    WHERE id = %(person_id)s

)
SELECT
    json_build_object(
        'photo',                  (SELECT j FROM photo),
        'about',                  (SELECT j FROM about),
        'gender',                 (SELECT j FROM gender),
        'orientation',            (SELECT j FROM orientation),
        'location',               (SELECT j FROM location),
        'occupation',             (SELECT j FROM occupation),
        'education',              (SELECT j FROM education),
        'height',                 (SELECT j FROM height),
        'looking for',            (SELECT j FROM looking_for),
        'smoking',                (SELECT j FROM smoking),
        'drinking',               (SELECT j FROM drinking),
        'drugs',                  (SELECT j FROM drugs),
        'long distance',          (SELECT j FROM long_distance),
        'relationship status',    (SELECT j FROM relationship_status),
        'has kids',               (SELECT j FROM has_kids),
        'wants kids',             (SELECT j FROM wants_kids),
        'exercise',               (SELECT j FROM exercise),
        'religion',               (SELECT j FROM religion),
        'star sign',              (SELECT j FROM star_sign),

        'units',                  (SELECT j FROM unit),

        'chats',                  (SELECT j FROM chat),
        'intros',                 (SELECT j FROM intro),

        'show my location',       (SELECT j FROM show_my_location),
        'show my age',            (SELECT j FROM show_my_age),
        'hide me from strangers', (SELECT j FROM hide_me_from_strangers)
    ) AS j
"""

Q_DELETE_PROFILE_INFO = """
DELETE FROM photo
WHERE
    person_id = %(person_id)s AND
    position = %(position)s
"""

Q_GET_SEARCH_FILTERS = """
WITH answer AS (
    SELECT COALESCE(
        array_agg(
            json_build_object(
                'question_id', question_id,
                'question', question,
                'topic', topic,
                'answer', answer,
                'accept_unanswered', accept_unanswered
            )
            ORDER BY question_id
        ),
        ARRAY[]::JSON[]
    ) AS j
    FROM search_preference_answer
    LEFT JOIN question
    ON question.id = question_id
    WHERE person_id = %(person_id)s
), gender AS (
    SELECT COALESCE(array_agg(name ORDER BY name), ARRAY[]::TEXT[]) AS j
    FROM search_preference_gender JOIN gender
    ON gender_id = gender.id
    WHERE person_id = %(person_id)s
), orientation AS (
    SELECT COALESCE(array_agg(name ORDER BY name), ARRAY[]::TEXT[]) AS j
    FROM search_preference_orientation JOIN orientation
    ON orientation_id = orientation.id
    WHERE person_id = %(person_id)s
), age AS (
    SELECT json_build_object(
        'min_age', min_age,
        'max_age', max_age
    ) AS j
    FROM search_preference_age
    WHERE person_id = %(person_id)s
), furthest_distance AS (
    SELECT distance AS j
    FROM search_preference_distance
    WHERE person_id = %(person_id)s
), height AS (
    SELECT json_build_object(
        'min_height_cm', min_height_cm,
        'max_height_cm', max_height_cm
    ) AS j
    FROM search_preference_height_cm
    WHERE person_id = %(person_id)s
), has_a_profile_picture AS (
    SELECT COALESCE(array_agg(name ORDER BY name), ARRAY[]::TEXT[]) AS j
    FROM search_preference_has_profile_picture JOIN yes_no
    ON has_profile_picture_id = yes_no.id
    WHERE person_id = %(person_id)s
), looking_for AS (
    SELECT COALESCE(array_agg(name ORDER BY name), ARRAY[]::TEXT[]) AS j
    FROM search_preference_looking_for JOIN looking_for
    ON looking_for_id = looking_for.id
    WHERE person_id = %(person_id)s
), smoking AS (
    SELECT COALESCE(array_agg(name ORDER BY name), ARRAY[]::TEXT[]) AS j
    FROM search_preference_smoking JOIN yes_no_optional
    ON smoking_id = yes_no_optional.id
    WHERE person_id = %(person_id)s
), drinking AS (
    SELECT COALESCE(array_agg(name ORDER BY name), ARRAY[]::TEXT[]) AS j
    FROM search_preference_drinking JOIN frequency
    ON drinking_id = frequency.id
    WHERE person_id = %(person_id)s
), drugs AS (
    SELECT COALESCE(array_agg(name ORDER BY name), ARRAY[]::TEXT[]) AS j
    FROM search_preference_drugs JOIN yes_no_optional
    ON drugs_id = yes_no_optional.id
    WHERE person_id = %(person_id)s
), long_distance AS (
    SELECT COALESCE(array_agg(name ORDER BY name), ARRAY[]::TEXT[]) AS j
    FROM search_preference_long_distance JOIN yes_no_optional
    ON long_distance_id = yes_no_optional.id
    WHERE person_id = %(person_id)s
), relationship_status AS (
    SELECT COALESCE(array_agg(name ORDER BY name), ARRAY[]::TEXT[]) AS j
    FROM search_preference_relationship_status JOIN relationship_status
    ON relationship_status_id = relationship_status.id
    WHERE person_id = %(person_id)s
), has_kids AS (
    SELECT COALESCE(array_agg(name ORDER BY name), ARRAY[]::TEXT[]) AS j
    FROM search_preference_has_kids JOIN yes_no_optional
    ON has_kids_id = yes_no_optional.id
    WHERE person_id = %(person_id)s
), wants_kids AS (
    SELECT COALESCE(array_agg(name ORDER BY name), ARRAY[]::TEXT[]) AS j
    FROM search_preference_wants_kids JOIN yes_no_maybe
    ON wants_kids_id = yes_no_maybe.id
    WHERE person_id = %(person_id)s
), exercise AS (
    SELECT COALESCE(array_agg(name ORDER BY name), ARRAY[]::TEXT[]) AS j
    FROM search_preference_exercise JOIN frequency
    ON exercise_id = frequency.id
    WHERE person_id = %(person_id)s
), religion AS (
    SELECT COALESCE(array_agg(name ORDER BY name), ARRAY[]::TEXT[]) AS j
    FROM search_preference_religion JOIN religion
    ON religion_id = religion.id
    WHERE person_id = %(person_id)s
), star_sign AS (
    SELECT COALESCE(array_agg(name ORDER BY name), ARRAY[]::TEXT[]) AS j
    FROM search_preference_star_sign JOIN star_sign
    ON star_sign_id = star_sign.id
    WHERE person_id = %(person_id)s
), people_messaged AS (
    SELECT name AS j
    FROM search_preference_messaged JOIN yes_no
    ON messaged_id = yes_no.id
    WHERE person_id = %(person_id)s
), people_hidden AS (
    SELECT name AS j
    FROM search_preference_hidden JOIN yes_no
    ON hidden_id = yes_no.id
    WHERE person_id = %(person_id)s
), people_blocked AS (
    SELECT name AS j
    FROM search_preference_blocked JOIN yes_no
    ON blocked_id = yes_no.id
    WHERE person_id = %(person_id)s
)
SELECT
    json_build_object(
        'answer',                 (SELECT j FROM answer),

        'gender',                 (SELECT j FROM gender),
        'orientation',            (SELECT j FROM orientation),
        'age',                    (SELECT j FROM age),
        'furthest_distance',      (SELECT j FROM furthest_distance),
        'height',                 (SELECT j FROM height),
        'has_a_profile_picture',  (SELECT j FROM has_a_profile_picture),
        'looking_for',            (SELECT j FROM looking_for),
        'smoking',                (SELECT j FROM smoking),
        'drinking',               (SELECT j FROM drinking),
        'drugs',                  (SELECT j FROM drugs),
        'long_distance',          (SELECT j FROM long_distance),
        'relationship_status',    (SELECT j FROM relationship_status),
        'has_kids',               (SELECT j FROM has_kids),
        'wants_kids',             (SELECT j FROM wants_kids),
        'exercise',               (SELECT j FROM exercise),
        'religion',               (SELECT j FROM religion),
        'star_sign',              (SELECT j FROM star_sign),

        'people_messaged',        (SELECT j FROM people_messaged),
        'people_hidden',          (SELECT j FROM people_hidden),
        'people_blocked',         (SELECT j FROM people_blocked)
    ) AS j
"""

Q_INSERT_MESSAGED = """
INSERT INTO messaged (
    subject_person_id,
    object_person_id
) VALUES (
    %(subject_person_id)s,
    %(object_person_id)s
) ON CONFLICT DO NOTHING
"""
