# TODO: Benchmark changes, especially for women searching for anyone, anywhere

# TODO: Write tests

Q_UPDATE_SEARCH_PREFERENCE_CLUB = """
WITH delete_search_preference_club AS (
    DELETE FROM
        search_preference_club
    WHERE
        person_id = %(person_id)s
    AND
        %(club_name)s::TEXT IS NULL
), update_search_preference_club AS (
    INSERT INTO search_preference_club (
        person_id,
        club_name
    )
    SELECT
        %(person_id)s,
        %(club_name)s::TEXT
    WHERE
        %(club_name)s::TEXT IS NOT NULL
    ON CONFLICT (person_id) DO UPDATE SET
        club_name = EXCLUDED.club_name
)
SELECT 1
"""

Q_UNCACHED_SEARCH_1 = """
DELETE FROM search_cache
WHERE searcher_person_id = %(searcher_person_id)s
"""

Q_UNCACHED_SEARCH_2 = """
WITH searcher AS (
    SELECT
        coordinates,
        personality,
        gender_id,
        COALESCE(
            (
                SELECT
                    1000 * distance
                FROM
                    search_preference_distance
                WHERE
                    person_id = %(searcher_person_id)s
                LIMIT 1
            ),
            1e9
        ) AS distance_preference,
        (
            SELECT
                club_name
            FROM
                search_preference_club
            WHERE
                person_id = %(searcher_person_id)s
            LIMIT 1
        ) AS club_preference,
        date_of_birth
    FROM
        person
    WHERE
        person.id = %(searcher_person_id)s
    LIMIT 1
), prospects_first_pass AS (
    SELECT
        id AS prospect_person_id,

        uuid AS prospect_uuid,

        name,

        personality,

        has_profile_picture_id,
        orientation_id,
        ethnicity_id,
        occupation,
        education,
        height_cm,
        looking_for_id,
        smoking_id,
        drinking_id,
        drugs_id,
        long_distance_id,
        relationship_status_id,
        has_kids_id,
        wants_kids_id,
        exercise_id,
        religion_id,
        star_sign_id,

        show_my_age,
        hide_me_from_strangers,

        verification_level_id > 1 AS verified,

        -- TODO
        (
            SELECT uuid
            FROM photo
            WHERE
                person_id = id
            ORDER BY
                position
            LIMIT 1
        ) AS profile_photo_uuid,
        CASE
            WHEN show_my_age
            THEN EXTRACT(YEAR FROM AGE(date_of_birth))
            ELSE NULL
        END AS age,
        CLAMP(
            0,
            99,
            100 * (
                1 - (personality <#> (SELECT personality FROM searcher))
            ) / 2
        ) AS match_percentage

    FROM
        person AS prospect

    WHERE
        prospect.activated
    AND
        prospect.gender_id IN (
            SELECT
                gender_id
            FROM
                search_preference_gender AS preference
            WHERE
                person_id = %(searcher_person_id)s
        )
    AND
        ST_DWithin(
            prospect.coordinates,
            (SELECT coordinates FROM searcher),
            (SELECT distance_preference FROM searcher)
        )
    AND
        prospect.id != %(searcher_person_id)s
    AND
        -- The searcher meets the prospect's gender preference
        EXISTS (
            SELECT 1
            FROM search_preference_gender AS preference
            WHERE
                preference.person_id = prospect.id AND
                preference.gender_id = (SELECT gender_id FROM searcher)
            LIMIT 1
        )
    AND
        -- The searcher meets the prospect's location preference
        ST_DWithin(
            prospect.coordinates,
            (SELECT coordinates FROM searcher),
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
       -- The prospect meets the searcher's age preference
       EXISTS (
            SELECT 1
            FROM search_preference_age AS preference
            WHERE
                preference.person_id = %(searcher_person_id)s
            AND
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
       -- The searcher meets the prospect's age preference
       EXISTS (
            SELECT 1
            FROM search_preference_age AS preference
            WHERE
                preference.person_id = prospect.id
            AND
                (SELECT date_of_birth FROM searcher) <= (
                    CURRENT_DATE -
                    INTERVAL '1 year' *
                    COALESCE(preference.min_age, 0)
                )
            AND
                (SELECT date_of_birth FROM searcher) > (
                    CURRENT_DATE -
                    INTERVAL '1 year' *
                    (COALESCE(preference.max_age, 999) + 1)
                )
            LIMIT 1
        )
    AND
        -- The users have at least a 50%% match
        (personality <#> (SELECT personality FROM searcher)) < 1e-5

    -- Second pass filters
    AND
        EXISTS (
            SELECT 1
            FROM search_preference_orientation AS preference
            WHERE
                preference.person_id      = %(searcher_person_id)s AND
                preference.orientation_id = prospect.orientation_id
            LIMIT 1
        )
    AND
        EXISTS (
            SELECT 1
            FROM search_preference_ethnicity AS preference
            WHERE
                preference.person_id      = %(searcher_person_id)s AND
                preference.ethnicity_id   = prospect.ethnicity_id
            LIMIT 1
        )
    AND
       EXISTS (
            SELECT 1
            FROM search_preference_height_cm AS preference
            WHERE
                preference.person_id = %(searcher_person_id)s AND
                COALESCE(preference.min_height_cm, 0)   <= COALESCE(prospect.height_cm, 0) AND
                COALESCE(preference.max_height_cm, 999) >= COALESCE(prospect.height_cm, 999)
            LIMIT 1
        )
    AND
        EXISTS (
            SELECT 1
            FROM search_preference_has_profile_picture AS preference
            WHERE
                preference.person_id              = %(searcher_person_id)s AND
                preference.has_profile_picture_id = prospect.has_profile_picture_id
            LIMIT 1
        )
    AND
        EXISTS (
            SELECT 1
            FROM search_preference_looking_for AS preference
            WHERE
                preference.person_id      = %(searcher_person_id)s AND
                preference.looking_for_id = prospect.looking_for_id
            LIMIT 1
        )
    AND
        EXISTS (
            SELECT 1
            FROM search_preference_smoking AS preference
            WHERE
                preference.person_id  = %(searcher_person_id)s AND
                preference.smoking_id = prospect.smoking_id
            LIMIT 1
        )
    AND
        EXISTS (
            SELECT 1
            FROM search_preference_drinking AS preference
            WHERE
                preference.person_id  = %(searcher_person_id)s AND
                preference.drinking_id = prospect.drinking_id
            LIMIT 1
        )
    AND
        EXISTS (
            SELECT 1
            FROM search_preference_drugs AS preference
            WHERE
                preference.person_id = %(searcher_person_id)s AND
                preference.drugs_id  = prospect.drugs_id
            LIMIT 1
        )
    AND
        EXISTS (
            SELECT 1
            FROM search_preference_long_distance AS preference
            WHERE
                preference.person_id         = %(searcher_person_id)s AND
                preference.long_distance_id  = prospect.long_distance_id
            LIMIT 1
        )
    AND
        EXISTS (
            SELECT 1
            FROM search_preference_relationship_status AS preference
            WHERE
                preference.person_id               = %(searcher_person_id)s AND
                preference.relationship_status_id  = prospect.relationship_status_id
            LIMIT 1
        )
    AND
        EXISTS (
            SELECT 1
            FROM search_preference_has_kids AS preference
            WHERE
                preference.person_id   = %(searcher_person_id)s AND
                preference.has_kids_id = prospect.has_kids_id
            LIMIT 1
        )
    AND
        EXISTS (
            SELECT 1
            FROM search_preference_wants_kids AS preference
            WHERE
                preference.person_id     = %(searcher_person_id)s AND
                preference.wants_kids_id = prospect.wants_kids_id
            LIMIT 1
        )
    AND
        EXISTS (
            SELECT 1
            FROM search_preference_exercise AS preference
            WHERE
                preference.person_id   = %(searcher_person_id)s AND
                preference.exercise_id = prospect.exercise_id
            LIMIT 1
        )
    AND
        EXISTS (
            SELECT 1
            FROM search_preference_religion AS preference
            WHERE
                preference.person_id   = %(searcher_person_id)s AND
                preference.religion_id = prospect.religion_id
            LIMIT 1
        )
    AND
        EXISTS (
            SELECT 1
            FROM search_preference_star_sign AS preference
            WHERE
                preference.person_id    = %(searcher_person_id)s AND
                preference.star_sign_id = prospect.star_sign_id
            LIMIT 1
        )
    AND
        EXISTS (
            (
                SELECT 1 WHERE NOT prospect.hide_me_from_strangers
            ) UNION ALL (
                SELECT 1
                FROM messaged
                WHERE
                    messaged.subject_person_id = prospect.id AND
                    messaged.object_person_id = %(searcher_person_id)s AND
                    prospect.hide_me_from_strangers
                LIMIT 1
            )
            LIMIT 1
        )
    AND
        -- The prospect did not skip the searcher
        NOT EXISTS (
            SELECT 1
            FROM
                skipped
            WHERE
                subject_person_id = prospect.id AND
                object_person_id  = %(searcher_person_id)s
            LIMIT 1
        )
    AND
        -- The searcher did not skip the prospect, or the searcher wishes to
        -- view skipped prospects
        NOT EXISTS (
            SELECT 1
            FROM search_preference_skipped AS preference
            JOIN skipped
            ON
                preference.person_id      = %(searcher_person_id)s AND
                preference.skipped_id     = 2 AND
                skipped.subject_person_id = %(searcher_person_id)s AND
                skipped.object_person_id  = prospect.id
            LIMIT 1
        )
    AND
        NOT EXISTS (
            SELECT 1
            FROM search_preference_messaged AS preference
            JOIN messaged
            ON
                preference.person_id       = %(searcher_person_id)s AND
                preference.messaged_id     = 2 AND
                messaged.subject_person_id = %(searcher_person_id)s AND
                messaged.object_person_id  = prospect.id
            LIMIT 1
        )
    AND
        -- NOT EXISTS an answer contrary to the searcher's preference...
        NOT EXISTS (
            SELECT 1
            FROM (
                SELECT *
                FROM search_preference_answer
                WHERE person_id = %(searcher_person_id)s) AS pref
            LEFT JOIN
                answer ans
            ON
                ans.person_id = prospect.id AND
                ans.question_id = pref.question_id
            WHERE
                -- Contrary because the answer exists and is wrong
                ans.answer IS NOT NULL AND
                ans.answer != pref.answer
            OR
                -- Contrary because the answer doesn't exist but should
                ans.answer IS NULL AND
                pref.accept_unanswered = FALSE
            LIMIT 1
        )

    LIMIT
        500
), updated_search_cache AS (
    INSERT INTO search_cache (
        searcher_person_id,
        position,
        prospect_person_id,
        prospect_uuid,
        profile_photo_uuid,
        name,
        age,
        match_percentage,
        personality,
        verified
    )
    SELECT
        %(searcher_person_id)s,
        ROW_NUMBER() OVER (
            ORDER BY
                -- If this is changed, other queries will need changing too
                (profile_photo_uuid IS NOT NULL) DESC,
                match_percentage DESC
        ) AS position,
        prospect_person_id,
        prospect_uuid,
        profile_photo_uuid,
        name,
        age,
        match_percentage,
        personality,
        verified
    FROM
        prospects_first_pass
    LIMIT
        500
    RETURNING *
)
SELECT
    prospect_person_id,
    prospect_uuid,
    profile_photo_uuid,
    (
        SELECT blurhash FROM photo WHERE profile_photo_uuid = photo.uuid
    ) AS profile_photo_blurhash,
    name,
    age,
    match_percentage,
    EXISTS (
        SELECT
            1
        FROM
            messaged
        WHERE
            subject_person_id = %(searcher_person_id)s
        AND
            object_person_id = prospect_person_id
    ) AS person_messaged_prospect,
    EXISTS (
        SELECT
            1
        FROM
            messaged
        WHERE
            subject_person_id = prospect_person_id
        AND
            object_person_id = %(searcher_person_id)s
    ) AS prospect_messaged_person,
    verified
FROM
    updated_search_cache
ORDER BY
    position
LIMIT
    %(n)s
"""

Q_CACHED_SEARCH = """
SELECT
    prospect_person_id,
    prospect_uuid,
    profile_photo_uuid,
    (
        SELECT blurhash FROM photo WHERE profile_photo_uuid = photo.uuid
    ) AS profile_photo_blurhash,
    name,
    age,
    match_percentage,
    EXISTS (
        SELECT
            1
        FROM
            messaged
        WHERE
            subject_person_id = %(searcher_person_id)s
        AND
            object_person_id = prospect_person_id
    ) AS person_messaged_prospect,
    EXISTS (
        SELECT
            1
        FROM
            messaged
        WHERE
            subject_person_id = prospect_person_id
        AND
            object_person_id = %(searcher_person_id)s
    ) AS prospect_messaged_person,
    verified
FROM
    search_cache
WHERE
    searcher_person_id = %(searcher_person_id)s AND
    position >  %(o)s AND
    position <= %(o)s + %(n)s
ORDER BY
    position
"""

Q_QUIZ_SEARCH = """
WITH searcher AS (
    SELECT
        personality
    FROM
        person
    WHERE
        person.id = %(searcher_person_id)s
    LIMIT 1
)
SELECT
    prospect_person_id,
    prospect_uuid,
    profile_photo_uuid,
    (
        SELECT blurhash FROM photo WHERE profile_photo_uuid = photo.uuid
    ) AS profile_photo_blurhash,
    name,
    age,
    CLAMP(
        0,
        99,
        100 * (1 - (personality <#> (SELECT personality FROM searcher))) / 2
    )::SMALLINT AS match_percentage
FROM
    search_cache
WHERE
    searcher_person_id = %(searcher_person_id)s
ORDER BY
    -- If this is changed, other queries will need changing too
    (profile_photo_uuid IS NOT NULL) DESC,
    match_percentage DESC
LIMIT
    1
"""
