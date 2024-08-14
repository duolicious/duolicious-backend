_Q_IS_ALLOWED_CLUB_NAME = """
WITH similar_banned_club AS (
    SELECT
        name
    FROM
        banned_club
    ORDER BY
        name <-> %()s
    LIMIT
        10
)
SELECT
    NOT EXISTS (
        SELECT
            1
        FROM
            similar_banned_club
        WHERE
            -- The exact club name is banned
            name = LOWER(%()s)
        OR
            -- The club name contains a banned word/phrase
            word_similarity(name, %()s) > 0.999
        AND
            -- The banned club name is distinctive enough not to trigger too
            -- many false positives when used as a word match
            (name ~ '[A-Za-z]{3}' OR name ~ '[^ ] [^ ]')
    ) AS is_allowed_club_name
"""

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
    CASE
        WHEN %(topic)s::TEXT = 'Big 5' AND trait.name = 'Introversion/Extraversion'
        THEN 'Extraversion'
        ELSE trait.name
    END                               AS trait_name,
    CASE
        WHEN %(topic)s::TEXT = 'Big 5' AND trait.name = 'Introversion/Extraversion'
        THEN NULL
        ELSE trait.min_label
    END                               AS trait_min_label,
    CASE
        WHEN %(topic)s::TEXT = 'Big 5' AND trait.name = 'Introversion/Extraversion'
        THEN NULL
        ELSE trait.max_label
    END                               AS trait_max_label,
    trait.description                 AS trait_description,
    person_trait.name                 AS person_name,
    person_trait.tiny_id              AS person_id,
    ROUND(100 * person_trait.ratio)   AS person_percentage,
    prospect_trait.name               AS prospect_name,
    ROUND(100 * prospect_trait.ratio) AS prospect_percentage,
    CASE
        WHEN %(prospect_person_id)s IS NOT NULL
        THEN COALESCE(prospect_trait.ratio, 0)
        ELSE COALESCE(person_trait.ratio, 0)
    END AS position
FROM
    trait
LEFT JOIN
    (
        SELECT
            id,
            tiny_id,
            name,
            (trait_ratio(presence_score, absence_score, 5000)).*
        FROM
            person
        WHERE
            id = %(person_id_as_int)s::INT
        OR
            tiny_id = %(person_id_as_str)s::TEXT
    ) AS person_trait
ON
    person_trait.trait_id = trait.id
LEFT JOIN
    (
        SELECT
            id,
            name,
            (trait_ratio(presence_score, absence_score, 5000)).*
        FROM person
        WHERE id = %(prospect_person_id)s
    ) AS prospect_trait
ON
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

_OTP_CTE = """
WITH random_otp AS (
    SELECT LPAD(FLOOR(RANDOM() * (10e5 + 1))::TEXT, 6, '0') AS otp
), zero_otp AS (
    SELECT '000000' AS otp
), is_registered AS (
    SELECT 1 WHERE     EXISTS (SELECT 1 FROM person WHERE normalized_email = %(normalized_email)s)
), is_unregistered AS (
    SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM person WHERE normalized_email = %(normalized_email)s)
), domain AS (
    SELECT
        SUBSTRING(%(email)s FROM POSITION('@' IN %(email)s) + 1) AS domain
), otp AS (
    SELECT
        CASE
        WHEN
                EXISTS (SELECT 1 FROM domain WHERE domain = 'example.com')
            AND
                EXISTS (SELECT 1 FROM is_registered)
            OR
                EXISTS (SELECT 1 FROM domain WHERE domain = 'example.com')
            AND
                %(is_dev)s
        THEN
            (SELECT otp FROM zero_otp)
        ELSE
            (SELECT otp FROM random_otp)
        END AS otp
    WHERE
        NOT EXISTS (
            SELECT
                1
            FROM
                banned_person
            WHERE
                normalized_email = %(normalized_email)s
            AND
                expires_at > NOW()
            OR
                ip_address = %(ip_address)s
            AND
                expires_at > NOW()
        )
    AND
        NOT EXISTS (
            SELECT
                1
            FROM
                bad_email_domain
            JOIN
                domain
            ON
                domain.domain = bad_email_domain.domain
            JOIN
                is_unregistered
            ON
                TRUE
        )
)
"""

Q_INSERT_DUO_SESSION = f"""
{_OTP_CTE}
INSERT INTO duo_session (
    session_token_hash,
    person_id,
    email,
    pending_club_name,
    otp,
    ip_address
)
SELECT
    %(session_token_hash)s,
    (
        SELECT
            id
        FROM
            person
        WHERE
            normalized_email = %(normalized_email)s
        ORDER BY
            email = %(email)s DESC,
            email
        LIMIT 1
    ),
    %(email)s,
    %(pending_club_name)s,
    otp,
    %(ip_address)s
FROM
    otp
RETURNING
    otp
"""

Q_UPDATE_OTP = f"""
{_OTP_CTE}
UPDATE
    duo_session
SET
    otp = otp.otp,
    otp_expiry = NOW() + INTERVAL '10 minutes'
FROM
    otp
WHERE
    session_token_hash = %(session_token_hash)s
RETURNING
    otp.otp
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
    UPDATE
        duo_session
    SET
        signed_in = TRUE
    WHERE
        session_token_hash = %(session_token_hash)s AND
        otp = %(otp)s AND
        otp_expiry > NOW()
    RETURNING
        person_id,
        email
), existing_person AS (
    UPDATE
        person
    SET
        activated = TRUE,
        sign_in_count = sign_in_count + 1,
        sign_in_time = NOW()
    FROM
        valid_session
    WHERE
        person.id = person_id
    RETURNING
        person.id,
        person.uuid AS person_uuid,
        person.unit_id
), new_onboardee AS (
    INSERT INTO onboardee (
        email
    )
    SELECT
        email
    FROM
        valid_session
    WHERE NOT EXISTS (SELECT 1 FROM existing_person)
), club_to_increment AS (
    SELECT
        person_club.club_name
    FROM
        existing_person
    LEFT JOIN
        person_club
    ON
        person_club.person_id = existing_person.id
    LEFT JOIN
        person AS existing_person_before_update
    ON
        existing_person_before_update.id = existing_person.id
    WHERE
        NOT existing_person_before_update.activated
), increment_club_count_if_not_activated AS (
    UPDATE
        club
    SET
        count_members = count_members + 1
    FROM
        club_to_increment
    WHERE
        club_to_increment.club_name = club.name
)
SELECT
    person_id,
    person_uuid,
    (SELECT name FROM unit WHERE id = existing_person.unit_id) AS units
FROM
    valid_session
LEFT JOIN
    existing_person
ON
    valid_session.person_id = existing_person.id
"""

Q_DELETE_ONBOARDEE_PHOTO = """
WITH deleted_uuid AS (
    DELETE FROM
        onboardee_photo
    WHERE
        email = %(email)s AND
        position = %(position)s
    RETURNING
        uuid
)
INSERT INTO undeleted_photo (
    uuid
)
SELECT
    uuid
FROM
    deleted_uuid
"""

Q_DELETE_DUO_SESSION = """
DELETE FROM duo_session
WHERE session_token_hash = %(session_token_hash)s
"""

Q_FINISH_ONBOARDING = """
WITH onboardee_country AS (
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
        normalized_email,
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
        %(normalized_email)s,
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
                        WHEN country IN ('United States', 'United Kingdom')
                        THEN 'Imperial'
                        ELSE 'Metric'
                    END AS name
                FROM onboardee_country
            )
        ) AS unit_id,
        3 AS intros_notification
    FROM onboardee
    WHERE email = %(email)s
    RETURNING
        id,
        person.uuid,
        email,
        unit_id,
        coordinates,
        date_of_birth
), best_age AS (
    WITH new_person_age AS (
        SELECT
            EXTRACT(YEAR FROM AGE(date_of_birth)) AS age
        FROM
            new_person
    ), unbounded_age_preference AS (
        SELECT
            age - 10 AS min_age,
            age + 10 AS max_age
        FROM
            new_person_age
    )
    SELECT
        CASE WHEN min_age <= 18 THEN NULL ELSE min_age END AS min_age,
        CASE WHEN max_age >= 99 THEN NULL ELSE max_age END AS max_age
    FROM
        unbounded_age_preference
), best_distance AS (
    -- Use a binary search to compute the "furthest distance" search preference
    -- which causes search results to contain as close as possible to 2000 users
    WITH RECURSIVE t(dist, cnt, iters) AS (
        VALUES
            (    0.0,     0.0, 0),
            (20000.0,  1.0e12, 0)
        UNION ALL (
            WITH two_closest AS (
                SELECT
                    dist,
                    cnt,
                    iters
                FROM
                    t
                ORDER BY
                    iters DESC,
                    ABS(cnt - 2000),
                    dist
                LIMIT 2
            ), midpoint AS (
                SELECT
                    AVG(dist) AS dist,
                    MAX(iters) AS iters
                FROM
                    two_closest
            ), limited_search_results AS (
                SELECT
                    midpoint.dist AS dist,
                    midpoint.iters AS iters
                FROM
                    person AS prospect, midpoint
                WHERE
                    activated
                AND
                    -- The prospect meets the new_person's gender preference
                    prospect.gender_id IN (
                        SELECT gender_id
                        FROM onboardee_search_preference_gender AS preference
                        WHERE preference.email = (SELECT email FROM new_person)
                    )
                AND
                    -- The prospect meets the new_person's location preference
                    ST_DWithin(
                        prospect.coordinates,
                        (SELECT coordinates FROM new_person),
                        midpoint.dist * 1000
                    )
                AND
                    -- The new_person meets the prospect's gender preference
                    EXISTS (
                        SELECT 1
                        FROM search_preference_gender AS preference
                        WHERE
                            preference.person_id = prospect.id AND
                            preference.gender_id = (SELECT gender_id FROM new_person)
                        LIMIT 1
                    )
                AND
                    -- The new_person meets the prospect's location preference
                    ST_DWithin(
                        prospect.coordinates,
                        (SELECT coordinates FROM new_person),
                        (
                            SELECT
                                COALESCE(
                                    (
                                        SELECT
                                            1000 * distance
                                        FROM
                                            person
                                        JOIN
                                            search_preference_distance
                                        ON
                                            person.id = person_id
                                        WHERE
                                            person.id = prospect.id
                                        LIMIT 1
                                    ),
                                    1e9
                                )
                        )
                    )
                AND
                   -- The prospect meets the new_person's age preference
                   EXISTS (
                        SELECT 1
                        FROM best_age AS preference
                        WHERE
                            prospect.date_of_birth <= (
                                CURRENT_DATE -
                                INTERVAL '1 year' *
                                COALESCE(preference.min_age, 0)
                            )
                        AND
                            prospect.date_of_birth > (
                                CURRENT_DATE -
                                INTERVAL '1 year' *
                                (COALESCE(preference.max_age, 999) + 1)
                            )
                        LIMIT 1
                    )
                AND
                   -- The new_person meets the prospect's age preference
                   EXISTS (
                        SELECT 1
                        FROM search_preference_age AS preference
                        WHERE
                            preference.person_id = prospect.id
                        AND
                            (SELECT date_of_birth FROM new_person) <= (
                                CURRENT_DATE -
                                INTERVAL '1 year' *
                                COALESCE(preference.min_age, 0)
                            )
                        AND
                            (SELECT date_of_birth FROM new_person) > (
                                CURRENT_DATE -
                                INTERVAL '1 year' *
                                (COALESCE(preference.max_age, 999) + 1)
                            )
                        LIMIT 1
                    )
                LIMIT
                    2000 * 2
            ), evaluated_midpoint AS (
                SELECT
                    MAX(dist) AS dist,
                    COUNT(*) AS cnt,
                    MAX(iters) AS iters
                FROM
                    limited_search_results
            ), points AS (
                SELECT dist, cnt, iters FROM evaluated_midpoint
                UNION
                SELECT dist, cnt, iters FROM two_closest
            )
            SELECT dist, cnt, iters + 1 FROM points WHERE iters < 7
        )
    )
    SELECT
        LEAST(dist, 9999) AS dist,
        cnt
    FROM
        t
    ORDER BY
        iters DESC,
        dist
    LIMIT
        1
    OFFSET
        1
), new_photo AS (
    INSERT INTO photo (
        person_id,
        position,
        uuid,
        blurhash
    )
    SELECT
        new_person.id,
        position,
        onboardee_photo.uuid,
        onboardee_photo.blurhash
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
    SELECT new_person.id, min_age, max_age
    FROM new_person, best_age
), p4 AS (
    INSERT INTO search_preference_distance (person_id, distance)
    SELECT
        new_person.id,
        CASE
            WHEN best_distance.cnt < 500 OR %(pending_club_name)s::TEXT IS NOT NULL
            THEN NULL
            ELSE best_distance.dist
        END AS distance
    FROM new_person, best_distance
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
    INSERT INTO search_preference_skipped (person_id, skipped_id)
    SELECT new_person.id, yes_no.id
    FROM new_person, yes_no
    WHERE yes_no.name = 'No'
), p20 AS (
    INSERT INTO search_preference_ethnicity (person_id, ethnicity_id)
    SELECT new_person.id, ethnicity.id
    FROM new_person, ethnicity
), deleted_onboardee AS (
    DELETE FROM onboardee
    WHERE email = %(email)s
)
SELECT
    new_person.id AS person_id,
    new_person.uuid AS person_uuid,
    (SELECT name FROM unit WHERE unit.id = new_person.unit_id) AS units
FROM
    new_person
"""

Q_SELECT_PROSPECT_PROFILE = """
WITH prospect AS (
    SELECT
        *,
        (
            SELECT EXTRACT(YEAR FROM AGE(prospect.date_of_birth))::SMALLINT
            WHERE prospect.show_my_age
        ) AS age,
        (
            SELECT short_friendly
            FROM location
            WHERE prospect.show_my_location
            ORDER BY location.coordinates <-> prospect.coordinates
            LIMIT 1
        ) AS location
    FROM
        person AS prospect
    WHERE
        uuid = uuid_or_null(%(prospect_uuid)s::TEXT)
    AND
        activated
    AND (
            NOT hide_me_from_strangers
        OR
            EXISTS (
                SELECT 1
                FROM messaged
                WHERE
                    messaged.subject_person_id = prospect.id
                AND
                    messaged.object_person_id = %(person_id)s
            )
    )
    AND (
        prospect.privacy_verification_level_id <= (
            SELECT
                verification_level_id
            FROM
                person
            WHERE
                id = %(person_id)s
        )
        OR
            EXISTS (
                SELECT 1
                FROM messaged
                WHERE
                    messaged.subject_person_id = prospect.id
                AND
                    messaged.object_person_id = %(person_id)s
            )
    )
    AND
        NOT EXISTS (
            SELECT 1
            FROM skipped
            WHERE
                subject_person_id = prospect.id AND
                object_person_id  = %(person_id)s
            LIMIT 1
        )
    OR

    -- User is viewing their own profile
        uuid = uuid_or_null(%(prospect_uuid)s::TEXT)
    AND
        prospect.id = %(person_id)s

    LIMIT
        1
), negative_dot_prod AS (
    SELECT (
        SELECT personality FROM person WHERE id = %(person_id)s
    ) <#> (
        SELECT personality FROM prospect
    ) AS negative_dot_prod
), match_percentage AS (
    SELECT
        CLAMP(
            0,
            99,
            100 * (1 - negative_dot_prod.negative_dot_prod) / 2
        )::SMALLINT AS j
    FROM
        negative_dot_prod
), photo_uuids AS (
    SELECT COALESCE(json_agg(photo.uuid ORDER BY position), '[]'::json) AS j
    FROM photo
    JOIN prospect
    ON   prospect.id = photo.person_id
), photo_blurhashes AS (
    SELECT COALESCE(json_agg(photo.blurhash ORDER BY position), '[]'::json) AS j
    FROM photo
    JOIN prospect
    ON   prospect.id = photo.person_id
), photo_verifications AS (
    SELECT COALESCE(json_agg(photo.verified ORDER BY position), '[]'::json) AS j
    FROM photo
    JOIN prospect
    ON   prospect.id = photo.person_id
), gender AS (
    SELECT gender.name AS j
    FROM gender JOIN prospect ON gender_id = gender.id
    WHERE gender.name != 'Unanswered'
), orientation AS (
    SELECT orientation.name AS j
    FROM orientation JOIN prospect ON orientation_id = orientation.id
    WHERE orientation.name != 'Unanswered'
), ethnicity AS (
    SELECT ethnicity.name AS j
    FROM ethnicity JOIN prospect ON ethnicity_id = ethnicity.id
    WHERE ethnicity.name != 'Unanswered'
), looking_for AS (
    SELECT looking_for.name AS j
    FROM looking_for JOIN prospect ON looking_for_id = looking_for.id
    WHERE looking_for.name != 'Unanswered'
), smoking AS (
    SELECT yes_no_optional.name AS j
    FROM yes_no_optional JOIN prospect ON smoking_id = yes_no_optional.id
    WHERE yes_no_optional.name != 'Unanswered'
), drinking AS (
    SELECT frequency.name AS j
    FROM frequency JOIN prospect ON drinking_id = frequency.id
    WHERE frequency.name != 'Unanswered'
), drugs AS (
    SELECT yes_no_optional.name AS j
    FROM yes_no_optional JOIN prospect ON drugs_id = yes_no_optional.id
    WHERE yes_no_optional.name != 'Unanswered'
), long_distance AS (
    SELECT yes_no_optional.name AS j
    FROM yes_no_optional JOIN prospect ON long_distance_id = yes_no_optional.id
    WHERE yes_no_optional.name != 'Unanswered'
), relationship_status AS (
    SELECT relationship_status.name AS j
    FROM relationship_status JOIN prospect ON relationship_status_id = relationship_status.id
    WHERE relationship_status.name != 'Unanswered'
), has_kids AS (
    SELECT yes_no_maybe.name AS j
    FROM yes_no_maybe JOIN prospect ON has_kids_id = yes_no_maybe.id
    WHERE yes_no_maybe.name != 'Unanswered'
), wants_kids AS (
    SELECT yes_no_maybe.name AS j
    FROM yes_no_maybe JOIN prospect ON wants_kids_id = yes_no_maybe.id
    WHERE yes_no_maybe.name != 'Unanswered'
), exercise AS (
    SELECT frequency.name AS j
    FROM frequency JOIN prospect ON exercise_id = frequency.id
    WHERE frequency.name != 'Unanswered'
), religion AS (
    SELECT religion.name AS j
    FROM religion JOIN prospect ON religion_id = religion.id
    WHERE religion.name != 'Unanswered'
), star_sign AS (
    SELECT star_sign.name AS j
    FROM star_sign JOIN prospect ON star_sign_id = star_sign.id
    WHERE star_sign.name != 'Unanswered'
), is_skipped AS (
    SELECT
        EXISTS (
            SELECT 1
            FROM skipped
            WHERE
                subject_person_id = %(person_id)s AND
                object_person_id  = (SELECT id FROM prospect)
        ) AS j
), clubs AS (
    SELECT
        prospect_person_club.club_name,
        person_club_.person_id IS NOT NULL AS is_mutual
    FROM
        person_club AS prospect_person_club
    LEFT JOIN
        person_club AS person_club_
    ON
        prospect_person_club.club_name = person_club_.club_name
    AND
        person_club_.person_id = %(person_id)s
    WHERE
        prospect_person_club.person_id = (SELECT id FROM prospect)
    ORDER BY
        is_mutual DESC,
        club_name
), mutual_clubs_json AS (
    SELECT COALESCE(
        json_agg(
            club_name
            ORDER BY
                is_mutual DESC,
                club_name
        ),
        '[]'::json
    ) AS j
    FROM clubs
    WHERE is_mutual
), other_clubs_json AS (
    SELECT COALESCE(
        json_agg(
            club_name
            ORDER BY
                is_mutual DESC,
                club_name
        ),
        '[]'::json
    ) AS j
    FROM clubs
    WHERE NOT is_mutual
)
SELECT
    json_build_object(
        'person_id',              (SELECT id            FROM prospect),
        'photo_uuids',            (SELECT j             FROM photo_uuids),
        'photo_blurhashes',       (SELECT j             FROM photo_blurhashes),
        'photo_verifications',    (SELECT j             FROM photo_verifications),
        'name',                   (SELECT name          FROM prospect),
        'age',                    (SELECT age           FROM prospect),
        'location',               (SELECT location      FROM prospect),
        'match_percentage',       (SELECT j             FROM match_percentage),
        'about',                  (SELECT about         FROM prospect),
        'count_answers',          (SELECT count_answers FROM prospect),
        'is_skipped',             (SELECT j             FROM is_skipped),

        -- Basics
        'occupation',             (SELECT occupation    FROM prospect),
        'education',              (SELECT education     FROM prospect),
        'height_cm',              (SELECT height_cm     FROM prospect),
        'gender',                 (SELECT j             FROM gender),
        'orientation',            (SELECT j             FROM orientation),
        'ethnicity',              (SELECT j             FROM ethnicity),
        'looking_for',            (SELECT j             FROM looking_for),
        'smoking',                (SELECT j             FROM smoking),
        'drinking',               (SELECT j             FROM drinking),
        'drugs',                  (SELECT j             FROM drugs),
        'long_distance',          (SELECT j             FROM long_distance),
        'relationship_status',    (SELECT j             FROM relationship_status),
        'has_kids',               (SELECT j             FROM has_kids),
        'wants_kids',             (SELECT j             FROM wants_kids),
        'exercise',               (SELECT j             FROM exercise),
        'religion',               (SELECT j             FROM religion),
        'star_sign',              (SELECT j             FROM star_sign),

        -- Clubs
        'mutual_clubs',           (SELECT j             FROM mutual_clubs_json),
        'other_clubs',            (SELECT j             FROM other_clubs_json),

        -- Verifications
        'verified_age',           (SELECT verified_age       FROM prospect),
        'verified_gender',        (SELECT verified_gender    FROM prospect),
        'verified_ethnicity',     (SELECT verified_ethnicity FROM prospect),

        -- Theme
        'theme', json_build_object(
            'title_color',         (SELECT title_color      FROM prospect),
            'body_color',          (SELECT body_color       FROM prospect),
            'background_color',    (SELECT background_color FROM prospect)
        )
    ) AS j
WHERE
    EXISTS (SELECT 1 FROM prospect)
"""

Q_CHECK_SESSION_TOKEN = """
SELECT
    (SELECT name FROM unit WHERE unit.id = person.unit_id) AS units
FROM
    person
WHERE
    id = %(person_id)s
"""

Q_INSERT_SKIPPED = """
WITH object_person_id AS (
    SELECT
        id
    FROM
        person
    WHERE
        uuid = %(prospect_uuid)s
), q1 AS (
    INSERT INTO skipped (
        subject_person_id,
        object_person_id,
        reported,
        report_reason
    ) VALUES (
        %(subject_person_id)s,
        (SELECT id FROM object_person_id),
        %(reported)s,
        %(report_reason)s
    ) ON CONFLICT DO NOTHING
), q2 AS (
    DELETE FROM search_cache
    WHERE
        searcher_person_id = %(subject_person_id)s AND
        prospect_person_id = (SELECT id FROM object_person_id)
    OR
        searcher_person_id = (SELECT id FROM object_person_id) AND
        prospect_person_id = %(subject_person_id)s
)
SELECT 1
"""

Q_DELETE_SKIPPED = """
DELETE FROM skipped
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
WITH person_info AS (
    SELECT
        id_table.id AS person_id,
        id_table.uuid AS person_uuid,
        prospect.id IS NULL AS is_prospect_deleted,
        COALESCE(prospect.activated, FALSE) AS is_prospect_activated,
        prospect.name AS name,
        prospect.personality AS personality,
        EXISTS (
            SELECT
                1
            FROM
                messaged
            WHERE
                subject_person_id = %(person_id)s
            AND
                object_person_id = id_table.id
            LIMIT 1
        ) AS person_messaged_prospect,
        EXISTS (
            SELECT
                1
            FROM
                messaged
            WHERE
                subject_person_id = id_table.id
            AND
                object_person_id = %(person_id)s
            LIMIT 1
        ) AS prospect_messaged_person,
        EXISTS (
            SELECT
                1
            FROM
                skipped
            WHERE
                subject_person_id = %(person_id)s
            AND
                object_person_id = id_table.id
            LIMIT 1
        ) AS person_skipped_prospect,
        EXISTS (
            SELECT
                1
            FROM
                skipped
            WHERE
                subject_person_id = id_table.id
            AND
                object_person_id = %(person_id)s
            LIMIT 1
        ) AS prospect_skipped_person
    FROM
        (
            SELECT DISTINCT
                id,
                uuid
            FROM
                person
            JOIN
                messaged
            ON
                messaged.subject_person_id = %(person_id)s
            AND
                messaged.object_person_id = person.id
            OR
                messaged.subject_person_id = person.id
            AND
                messaged.object_person_id = %(person_id)s
        ) AS id_table
    LEFT JOIN
        person AS prospect
    ON
        prospect.id = id_table.id
    LEFT JOIN
        skipped
    ON
        subject_person_id = prospect.id
    AND
        object_person_id = %(person_id)s
)
SELECT
    person_id,
    person_uuid,
    CASE
        WHEN is_prospect_activated AND NOT prospect_skipped_person
        THEN
            name
        ELSE
            NULL
    END AS name,
    CASE
        WHEN is_prospect_activated AND NOT prospect_skipped_person
        THEN
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
            )::SMALLINT
        ELSE
            NULL
    END AS match_percentage,
    CASE
        WHEN is_prospect_activated AND NOT prospect_skipped_person
        THEN
            (
                SELECT
                    uuid
                FROM
                    photo
                WHERE
                    person_id = prospect.person_id
                ORDER BY
                    position
                LIMIT 1
            )
        ELSE
            NULL
    END AS image_uuid,
    CASE
        WHEN is_prospect_activated AND NOT prospect_skipped_person
        THEN
            (
                SELECT
                    blurhash
                FROM
                    photo
                WHERE
                    person_id = prospect.person_id
                ORDER BY
                    position
                LIMIT 1
            )
        ELSE
            NULL
    END AS image_blurhash,
    CASE
        WHEN
                NOT is_prospect_deleted
            AND
                NOT prospect_messaged_person
        THEN 'nowhere'
        WHEN
                is_prospect_activated
            AND
                NOT prospect_skipped_person
            AND
                NOT person_skipped_prospect
            AND
                prospect_messaged_person
            AND
                person_messaged_prospect
        THEN 'chats'
        WHEN
                is_prospect_activated
            AND
                NOT prospect_skipped_person
            AND
                NOT person_skipped_prospect
            AND
                prospect_messaged_person
            AND
                NOT person_messaged_prospect
        THEN 'intros'
        ELSE 'archive'
    END AS conversation_location
FROM
    person_info AS prospect
ORDER BY
    person_id
"""

Q_DELETE_ACCOUNT = """
WITH deleted_photo AS (
    SELECT
        uuid
    FROM
        photo
    WHERE
        person_id = %(person_id)s
), deleted_verification_photo AS (
    SELECT
        photo_uuid AS uuid
    FROM
        verification_job
    WHERE
        person_id = %(person_id)s
), every_deleted_photo_uuid AS (
    SELECT uuid FROM deleted_photo
    UNION
    SELECT uuid FROM deleted_verification_photo
), deleted_person_club AS (
    SELECT
        club_name
    FROM
        person_club
    WHERE
        person_id  = %(person_id)s
), deleted_person AS (
    DELETE FROM
        person
    WHERE
        id = %(person_id)s
    RETURNING
        activated
), undeleted_photo_insertion AS (
    INSERT INTO undeleted_photo (
        uuid
    )
    SELECT
        uuid
    FROM
        every_deleted_photo_uuid
), club_update AS (
    UPDATE
        club
    SET
        count_members = GREATEST(0, count_members - 1)
    FROM
        deleted_person_club
    WHERE
        club.name = deleted_person_club.club_name
    AND
        (SELECT activated FROM deleted_person)
)
SELECT 1
"""

Q_DELETE_XMPP = """
WITH q1 AS (
    DELETE FROM
        mam_message
    USING
        mam_server_user
    WHERE
        mam_message.user_id = mam_server_user.id
    AND
        mam_server_user.server = 'duolicious.app'
    AND
        mam_server_user.user_name = %(person_uuid)s
), q2 AS (
    DELETE FROM last
    WHERE username = %(person_uuid)s
), q3 AS (
    DELETE FROM inbox
    WHERE luser = %(person_uuid)s AND lserver = 'duolicious.app'
), q4 AS (
    DELETE FROM mam_server_user
    WHERE server = 'duolicious.app' AND user_name = %(person_uuid)s
), q5 AS (
    DELETE FROM duo_last_notification
    WHERE username = %(person_uuid)s
), q6 AS (
    DELETE FROM duo_push_token
    WHERE username = %(person_uuid)s
)
SELECT 1
"""

Q_POST_DEACTIVATE = """
WITH updated_person AS (
    UPDATE
        person
    SET
        activated = FALSE
    WHERE
        activated = TRUE
    AND
        id = %(person_id)s
    RETURNING
        id
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
)
SELECT 1
"""

Q_GET_PROFILE_INFO = """
WITH photo_ AS (
    SELECT json_object_agg(position, uuid) AS j
    FROM photo
    WHERE person_id = %(person_id)s
), photo_blurhash AS (
    SELECT json_object_agg(position, blurhash) AS j
    FROM photo
    WHERE person_id = %(person_id)s
), photo_verification AS (
    SELECT json_object_agg(position, verified) AS j
    FROM photo
    WHERE person_id = %(person_id)s
), name AS (
    SELECT name AS j FROM person WHERE id = %(person_id)s
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
), ethnicity AS (
    SELECT ethnicity.name AS j
    FROM ethnicity JOIN person ON ethnicity_id = ethnicity.id
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

), clubs AS (
    SELECT
        COALESCE(
            json_agg(
                json_build_object(
                    'name', name,
                    'count_members', count_members
                )
                ORDER BY name
            ),
            '[]'::json
        ) AS j
    FROM person_club
    JOIN club ON club.name = club_name
    WHERE person_id = %(person_id)s

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

), privacy_verification_level AS (
    SELECT
        verification_level.name AS j
    FROM person
    JOIN verification_level
    ON verification_level.id = person.privacy_verification_level_id
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
), verified_gender AS (
    SELECT verified_gender AS j FROM person WHERE id = %(person_id)s
), verified_age AS (
    SELECT verified_age AS j FROM person WHERE id = %(person_id)s
), verified_ethnicity AS (
    SELECT verified_ethnicity AS j FROM person WHERE id = %(person_id)s
), title_color AS (
    SELECT title_color AS j FROM person WHERE id = %(person_id)s
), body_color AS (
    SELECT body_color AS j FROM person WHERE id = %(person_id)s
), background_color AS (
    SELECT background_color AS j FROM person WHERE id = %(person_id)s
)
SELECT
    json_build_object(
        'photo',                  (SELECT j FROM photo_),
        'photo_blurhash',         (SELECT j FROM photo_blurhash),
        'photo_verification',     (SELECT j FROM photo_verification),
        'name',                   (SELECT j FROM name),
        'about',                  (SELECT j FROM about),
        'gender',                 (SELECT j FROM gender),
        'orientation',            (SELECT j FROM orientation),
        'ethnicity',              (SELECT j FROM ethnicity),
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

        'clubs',                  (SELECT j FROM clubs),

        'units',                  (SELECT j FROM unit),

        'chats',                  (SELECT j FROM chat),
        'intros',                 (SELECT j FROM intro),

        'verification level',     (SELECT j FROM privacy_verification_level),
        'show my location',       (SELECT j FROM show_my_location),
        'show my age',            (SELECT j FROM show_my_age),
        'hide me from strangers', (SELECT j FROM hide_me_from_strangers),

        'verified_gender',        (SELECT j FROM verified_gender),
        'verified_age',           (SELECT j FROM verified_age),
        'verified_ethnicity',     (SELECT j FROM verified_ethnicity),

        'theme', json_build_object(
            'title_color',            (SELECT j FROM title_color),
            'body_color',             (SELECT j FROM body_color),
            'background_color',       (SELECT j FROM background_color)
        )
    ) AS j
"""

Q_DELETE_PROFILE_INFO = """
WITH deleted_photo AS (
    DELETE FROM
        photo
    WHERE
        person_id = %(person_id)s AND
        position = %(position)s
    RETURNING
        uuid
)
INSERT INTO undeleted_photo (
    uuid
)
SELECT
    uuid
FROM
    deleted_photo
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
), ethnicity AS (
    SELECT COALESCE(array_agg(name ORDER BY name), ARRAY[]::TEXT[]) AS j
    FROM search_preference_ethnicity JOIN ethnicity
    ON ethnicity_id = ethnicity.id
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
), people_you_messaged AS (
    SELECT name AS j
    FROM search_preference_messaged JOIN yes_no
    ON messaged_id = yes_no.id
    WHERE person_id = %(person_id)s
), people_you_skipped AS (
    SELECT name AS j
    FROM search_preference_skipped JOIN yes_no
    ON skipped_id = yes_no.id
    WHERE person_id = %(person_id)s
)
SELECT
    json_build_object(
        'answer',                 (SELECT j FROM answer),

        'gender',                 (SELECT j FROM gender),
        'orientation',            (SELECT j FROM orientation),
        'ethnicity',              (SELECT j FROM ethnicity),
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

        'people_you_messaged',    (SELECT j FROM people_you_messaged),
        'people_you_skipped',     (SELECT j FROM people_you_skipped)
    ) AS j
"""

Q_MAKE_REPORT = """
WITH object_person_id AS (
    SELECT
        id
    FROM
        person
    WHERE
        uuid = %(prospect_uuid)s
), token AS (
    INSERT INTO banned_person_admin_token (
        person_id
    )
    VALUES
        (%(subject_person_id)s),
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
        photo_ban.token AS token
    FROM
        photo_ban
    JOIN
        photo ON photo_ban.photo_uuid = photo.uuid
    JOIN
        token ON photo.person_id = token.person_id
)
SELECT
    CASE
        WHEN id = %(subject_person_id)s
        THEN 'Reporter'
        ELSE 'Accused'
    END AS role,
    id,
    uuid::TEXT,
    (
        SELECT long_friendly
        FROM location
        ORDER BY location.coordinates <-> p.coordinates
        LIMIT 1
    ) AS location,
    split_part(email, '@', 2) AS email_domain,
    ARRAY(
        SELECT DISTINCT
            ip_address::TEXT
        FROM duo_session
        WHERE email = p.email
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
    (id = %(subject_person_id)s) DESC
"""

Q_LAST_MESSAGES = """
WITH last_messages AS (
    SELECT
        mam_message.id AS id,
        CASE
        WHEN mam_message.direction = 'O'
            THEN 'reporter'
            ELSE 'accused'
        END AS sent_by,
        search_body AS message
    FROM
        mam_message
    JOIN
        mam_server_user
    ON
        mam_server_user.id = mam_message.user_id
    AND
        mam_server_user.server = 'duolicious.app'
    AND
        mam_server_user.user_name = %(subject_person_uuid)s
    WHERE
        mam_message.remote_bare_jid IN (
            %(subject_person_uuid)s,
            %(prospect_uuid)s
        )
    ORDER BY
        mam_message.id DESC
    LIMIT 25
)
SELECT
    sent_by,
    message
FROM
    last_messages
ORDER BY
    id
"""

Q_TOP_CLUBS = """
SELECT
    name,
    count_members
FROM
    club
ORDER BY
    count_members DESC,
    name
"""

Q_SEARCH_CLUBS = f"""
WITH currently_joined_club AS (
    SELECT
        club_name AS name
    FROM
        person_club
    WHERE
        person_id = %(person_id)s
), is_allowed_club_name AS (
    {_Q_IS_ALLOWED_CLUB_NAME.replace('%()s', '%(search_string)s')}
), maybe_stuff_the_user_typed AS (
    SELECT
        %(search_string)s AS name,
        COALESCE(
            (SELECT count_members FROM club WHERE name = %(search_string)s),
            0
        ) AS count_members
    WHERE
        NOT EXISTS (
            SELECT 1 FROM currently_joined_club WHERE name = %(search_string)s
        )
    AND
        (SELECT is_allowed_club_name FROM is_allowed_club_name)
    LIMIT
        1
), fuzzy_match AS (
    SELECT
        name,
        count_members
    FROM
        club
    WHERE
        name NOT IN (SELECT name FROM currently_joined_club)
    AND
        name NOT IN (SELECT name FROM maybe_stuff_the_user_typed)
    AND
        count_members > 0
    ORDER BY
        name <-> %(search_string)s
    LIMIT
        20 - (SELECT COUNT(*) FROM maybe_stuff_the_user_typed)
)
SELECT
    name,
    count_members
FROM (
    SELECT name, count_members FROM fuzzy_match UNION
    SELECT name, count_members FROM maybe_stuff_the_user_typed
)
ORDER BY
    count_members = 0,
    name <-> %(search_string)s,
    count_members DESC,
    name
"""

Q_JOIN_CLUB = f"""
WITH is_allowed_club_name AS (
    {_Q_IS_ALLOWED_CLUB_NAME.replace('%()s', '%(club_name)s')}
), will_be_within_club_quota AS (
    SELECT
        COUNT(*) < 100 AS x
    FROM
        person_club
    WHERE
        person_id = %(person_id)s
), existing_club AS (
    SELECT
        name
    FROM
        club
    WHERE
        name = %(club_name)s
    AND
        (SELECT is_allowed_club_name FROM is_allowed_club_name)
    AND
        (SELECT x FROM will_be_within_club_quota)
), inserted_club AS (
    INSERT INTO club (
        name,
        count_members
    )
    SELECT
        %(club_name)s,
        1
    WHERE
        (SELECT is_allowed_club_name FROM is_allowed_club_name)
    AND
        (SELECT x FROM will_be_within_club_quota)
    ON CONFLICT (name) DO NOTHING
    RETURNING
        name
), existing_or_inserted_club AS (
    SELECT name FROM existing_club UNION
    SELECT name FROM inserted_club
), inserted_person_club AS (
    INSERT INTO person_club (
        person_id,
        club_name
    )
    SELECT
        %(person_id)s,
        name
    FROM
        existing_or_inserted_club
    ON CONFLICT (person_id, club_name) DO NOTHING
    RETURNING
        club_name
), updated_club AS (
    UPDATE
        club
    SET
        count_members = count_members + 1
    FROM
        inserted_person_club
    WHERE
        inserted_person_club.club_name = club.name
)
SELECT
    1
FROM
    existing_or_inserted_club
LIMIT 1
"""

Q_LEAVE_CLUB = """
WITH deleted_person_club AS (
    DELETE FROM
        person_club
    WHERE
        person_id = %(person_id)s
    AND
        club_name = %(club_name)s
    RETURNING
        club_name
)
UPDATE
    club
SET
    count_members = GREATEST(0, count_members - 1)
WHERE
    name = %(club_name)s
AND
    EXISTS (SELECT 1 FROM deleted_person_club)
"""

Q_UPDATE_CHATS_NOTIFICATIONS = """
WITH updated_rows AS (
    UPDATE
        person
    SET
        chats_notification = immediacy.id
    FROM
        immediacy
    WHERE
        person.email = %(email)s
    AND
        immediacy.name = %(frequency)s
    RETURNING 1
)
SELECT
    count(*) > 0 AS ok
FROM
    updated_rows
"""

Q_UPDATE_INTROS_NOTIFICATIONS = """
WITH updated_rows AS (
    UPDATE
        person
    SET
        intros_notification = immediacy.id
    FROM
        immediacy
    WHERE
        person.email = %(email)s
    AND
        immediacy.name = %(frequency)s
    RETURNING 1
)
SELECT
    count(*) > 0 AS ok
FROM
    updated_rows
"""

Q_CHECK_ADMIN_BAN_TOKEN = """
SELECT 1 FROM banned_person_admin_token WHERE token = %(token)s
"""

Q_ADMIN_BAN = """
WITH deleted_token AS (
    DELETE FROM
        banned_person_admin_token
    WHERE
        token = %(token)s
    AND
        expires_at > NOW()
    RETURNING
        person_id
), this_banned_person AS (
    SELECT
        normalized_email,
        uuid AS person_uuid,
        id AS person_id
    FROM
        person
    JOIN
        deleted_token
    ON
        deleted_token.person_id = person.id
), report_reason AS (
    SELECT
        COALESCE(array_agg(report_reason), ARRAY[]::text[]) AS report_reasons
    FROM
        skipped
    WHERE
        reported
    AND
        object_person_id = (SELECT person_id FROM deleted_token)
    AND
        report_reason <> ''
), _duo_session AS (
    SELECT
        this_banned_person.normalized_email AS normalized_email,
        COALESCE(duo_session.ip_address, '127.0.0.1') AS ip_address
    FROM
        duo_session
    JOIN
        this_banned_person
    ON
        duo_session.person_id = this_banned_person.person_id
), banned_person_insertion AS (
    INSERT INTO banned_person (
        normalized_email,
        ip_address,
        report_reasons
    )
    SELECT
        normalized_email,
        ip_address,
        report_reasons
    FROM
        _duo_session,
        report_reason
    ON CONFLICT DO NOTHING
)
SELECT
    person_id,
    person_uuid::TEXT
FROM
    this_banned_person
"""

Q_CHECK_ADMIN_DELETE_PHOTO_TOKEN = """
SELECT 1 FROM deleted_photo_admin_token WHERE token = %(token)s
"""

Q_ADMIN_DELETE_PHOTO = """
WITH deleted_token AS (
    DELETE FROM
        deleted_photo_admin_token
    WHERE
        token = %(token)s
    AND
        expires_at > NOW()
    RETURNING
        photo_uuid
), deleted_photo AS (
    DELETE FROM
        photo
    USING
        deleted_token
    WHERE
        photo.uuid = deleted_token.photo_uuid
    RETURNING
        photo.uuid
)
INSERT INTO undeleted_photo (
    uuid
)
SELECT
    uuid
FROM
    deleted_photo
RETURNING
    uuid
"""

Q_STATS = """
SELECT
    count(*) AS num_active_users
FROM
    person
WHERE
    activated
"""

Q_STATS_BY_CLUB_NAME = """
SELECT
    COALESCE(SUM(count_members), 0) AS num_active_users
FROM
    club
WHERE
    name = %(club_name)s
"""

Q_PERSON_ID_TO_UUID = """
SELECT
    uuid::text
FROM
    person
WHERE
    id = %(person_id)s
"""

Q_ADMIN_TOKEN_TO_UUID = """
SELECT
    person.uuid::text AS person_uuid
FROM
    person
JOIN
    banned_person_admin_token
ON
    banned_person_admin_token.person_id = person.id
WHERE
    banned_person_admin_token.token = %(token)s
"""

Q_DELETE_VERIFICATION_JOB = """
WITH deleted_job AS (
    DELETE FROM
        verification_job
    WHERE
        person_id = %(person_id)s
    RETURNING
        photo_uuid AS uuid
)
INSERT INTO undeleted_photo (
    uuid
)
SELECT
    uuid
FROM
    deleted_job
"""

Q_INSERT_VERIFICATION_JOB = """
INSERT INTO verification_job (
    person_id,
    photo_uuid
) VALUES (
    %(person_id)s,
    %(photo_uuid)s
)
"""

Q_ENQUEUE_VERIFICATION_JOB = """
UPDATE
    verification_job
SET
    status = 'queued',
    message = 'Waiting in line for the next selfie checker'
WHERE
    person_id = %(person_id)s
"""

Q_CHECK_VERIFICATION = """
SELECT
    person.verified_gender,
    person.verified_age,
    person.verified_ethnicity,
    (
        SELECT json_object_agg(position, verified) AS j
        FROM photo
        WHERE person_id = %(person_id)s
    ) AS verified_photos,
    verification_job.status,
    verification_job.message
FROM
    person
LEFT JOIN
    verification_job
ON
    verification_job.person_id = person.id
WHERE
    person.id = %(person_id)s
"""

Q_GET_SESSION_CLUBS = """
SELECT
    COALESCE(
        (
            SELECT
                json_agg(
                    json_build_object(
                        'name',
                        person_club.club_name,

                        'count_members',
                        -1,

                        'search_preference',
                        person_club.club_name IS NOT DISTINCT FROM search_preference_club.club_name
                    )
                    ORDER BY
                        person_club.club_name
                )
            FROM
                person_club
            LEFT JOIN
                search_preference_club
            ON
                search_preference_club.person_id = person_club.person_id
            WHERE
                person_club.person_id = %(person_id)s
        ),
        '[]'::json
    ) AS clubs,
    (
        SELECT
            json_build_object(
                'name',
                %(pending_club_name)s::TEXT,

                'count_members',
                (
                    SELECT
                        coalesce(sum(count_members), 0)
                    FROM
                        club
                    WHERE
                        name = %(pending_club_name)s
                )
            )
        WHERE
            %(pending_club_name)s::TEXT IS NOT NULL
    ) AS pending_club
"""
