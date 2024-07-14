Q_SEARCH_PREFERENCE = """
WITH delete_search_preference_club AS (
    DELETE FROM
        search_preference_club
    WHERE
        person_id = %(person_id)s
    AND
        %(club_name)s::TEXT IS NULL
    AND
        %(do_modify)s
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
    AND
        %(do_modify)s
    ON CONFLICT (person_id) DO UPDATE SET
        club_name = EXCLUDED.club_name
)
SELECT
    gender_id
FROM
    search_preference_gender
WHERE
    person_id = %(person_id)s
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
), prospects_first_pass_without_club AS (
    SELECT
        id
    FROM
        person AS prospect
    WHERE
        prospect.activated
    AND
        -- The prospect meets the searcher's gender preference
        prospect.gender_id = ANY(%(gender_preference)s::SMALLINT[])
    AND
        -- The prospect meets the searcher's location preference
        ST_DWithin(
            prospect.coordinates,
            (SELECT coordinates FROM searcher),
            (SELECT distance_preference FROM searcher)
        )
    AND
        (SELECT club_preference FROM searcher) IS NULL

    LIMIT
        30000
), prospects_first_pass_with_club AS (
    SELECT
        person_id AS id
    FROM
        person_club AS prospect
    WHERE
        prospect.activated
    AND
        -- The prospect meets the searcher's gender preference
        prospect.gender_id = ANY(%(gender_preference)s::SMALLINT[])
    AND
        -- The prospect meets the searcher's location preference
        ST_DWithin(
            prospect.coordinates,
            (SELECT coordinates FROM searcher),
            (SELECT distance_preference FROM searcher)
        )
    AND
        prospect.club_name = (SELECT club_preference FROM searcher)

    LIMIT
        30000
), prospects_second_pass AS (
    SELECT id FROM prospects_first_pass_without_club
    UNION ALL
    SELECT id FROM prospects_first_pass_with_club
), prospects_third_pass AS (
    SELECT
        prospect.id
    FROM
        person AS prospect
    JOIN
        prospects_second_pass
    ON
        prospects_second_pass.id = prospect.id
    ORDER BY
        personality <#> (SELECT personality FROM searcher)
    LIMIT
        10000
), prospects_fourth_pass AS (
    SELECT
        prospect.id AS prospect_person_id,

        uuid AS prospect_uuid,

        name,

        personality,

        verification_level_id > 1 AS verified,

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
    JOIN
        prospects_third_pass
    ON
        prospects_third_pass.id = prospect.id

    WHERE
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

   -- The prospect meets the searcher's age preference
    AND
        prospect.date_of_birth <= (
            SELECT
                CURRENT_DATE -
                INTERVAL '1 year' *
                COALESCE(min_age, 0)
            FROM
                search_preference_age
            WHERE
                person_id = %(searcher_person_id)s
        )::DATE
    AND
        prospect.date_of_birth > (
            SELECT
                CURRENT_DATE -
                INTERVAL '1 year' *
                (COALESCE(max_age, 999) + 1)
            FROM
                search_preference_age
            WHERE
                person_id = %(searcher_person_id)s
        )::DATE

   -- The searcher meets the prospect's age preference
    AND
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

    -- The users have at least a 50%% match
    AND
        (personality <#> (SELECT personality FROM searcher)) < 1e-5

    -- One-way filters
    AND
        prospect.orientation_id IN (
            SELECT
                orientation_id
            FROM
                search_preference_orientation
            WHERE
                person_id = %(searcher_person_id)s
        )
    AND
        prospect.ethnicity_id IN (
            SELECT
                ethnicity_id
            FROM
                search_preference_ethnicity
            WHERE
                person_id = %(searcher_person_id)s
        )
    AND
        COALESCE(prospect.height_cm, 0) >= COALESCE(
            (
                SELECT
                    min_height_cm
                FROM
                    search_preference_height_cm
                WHERE
                    person_id = %(searcher_person_id)s
            ),
            0
        )
    AND
        COALESCE(prospect.height_cm, 999) <= COALESCE(
            (
                SELECT
                    max_height_cm
                FROM
                    search_preference_height_cm
                WHERE
                    person_id = %(searcher_person_id)s
            ),
            999
        )
    AND
        prospect.has_profile_picture_id IN (
            SELECT
                has_profile_picture_id
            FROM
                search_preference_has_profile_picture
            WHERE
                person_id = %(searcher_person_id)s
        )
    AND
        prospect.looking_for_id IN (
            SELECT
                looking_for_id
            FROM
                search_preference_looking_for
            WHERE
                person_id = %(searcher_person_id)s
        )
    AND
        prospect.smoking_id IN (
            SELECT
                smoking_id
            FROM
                search_preference_smoking
            WHERE
                person_id = %(searcher_person_id)s
        )
    AND
        prospect.drinking_id IN (
            SELECT
                drinking_id
            FROM
                search_preference_drinking
            WHERE
                person_id = %(searcher_person_id)s
        )
    AND
        prospect.drugs_id IN (
            SELECT
                drugs_id
            FROM
                search_preference_drugs
            WHERE
                person_id = %(searcher_person_id)s
        )
    AND
        prospect.long_distance_id IN (
            SELECT
                long_distance_id
            FROM
                search_preference_long_distance
            WHERE
                person_id = %(searcher_person_id)s
        )
    AND
        prospect.relationship_status_id IN (
            SELECT
                relationship_status_id
            FROM
                search_preference_relationship_status
            WHERE
                person_id = %(searcher_person_id)s
        )
    AND
        prospect.has_kids_id IN (
            SELECT
                has_kids_id
            FROM
                search_preference_has_kids
            WHERE
                person_id = %(searcher_person_id)s
        )
    AND
        prospect.wants_kids_id IN (
            SELECT
                wants_kids_id
            FROM
                search_preference_wants_kids
            WHERE
                person_id = %(searcher_person_id)s
        )
    AND
        prospect.exercise_id IN (
            SELECT
                exercise_id
            FROM
                search_preference_exercise
            WHERE
                person_id = %(searcher_person_id)s
        )
    AND
        prospect.religion_id IN (
            SELECT
                religion_id
            FROM
                search_preference_religion
            WHERE
                person_id = %(searcher_person_id)s
        )
    AND
        prospect.star_sign_id IN (
            SELECT
                star_sign_id
            FROM
                search_preference_star_sign
            WHERE
                person_id = %(searcher_person_id)s
        )
    AND
        -- The prospect wants to be shown to strangers or isn't a stranger
        (
            prospect.id IN (
                SELECT
                    subject_person_id
                FROM
                    messaged
                WHERE
                    object_person_id = %(searcher_person_id)s
            )
        OR
            NOT prospect.hide_me_from_strangers
        )
    AND
        -- The prospect did not skip the searcher
        prospect.id NOT IN (
            SELECT
                subject_person_id
            FROM
                skipped
            WHERE
                object_person_id = %(searcher_person_id)s
        )
    AND
        -- The searcher did not skip the prospect, or the searcher wishes to
        -- view skipped prospects
        (
            prospect.id NOT IN (
                SELECT
                    object_person_id
                FROM
                    skipped
                WHERE
                    subject_person_id = %(searcher_person_id)s
            )
        OR
            1 IN (
                SELECT
                    skipped_id
                FROM
                    search_preference_skipped
                WHERE
                    person_id = %(searcher_person_id)s
            )
        )
    AND
        -- The searcher did not message the prospect, or the searcher wishes to
        -- view messaged prospects
        (
            prospect.id NOT IN (
                SELECT
                    object_person_id
                FROM
                    messaged
                WHERE
                    subject_person_id = %(searcher_person_id)s
            )
        OR
            1 IN (
                SELECT
                    messaged_id
                FROM
                    search_preference_messaged
                WHERE
                    person_id = %(searcher_person_id)s
            )
        )
    AND
        -- NOT EXISTS an answer contrary to the searcher's preference...
        NOT EXISTS (
            SELECT 1
            FROM (
                SELECT *
                FROM search_preference_answer
                WHERE person_id = %(searcher_person_id)s
            ) AS pref
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

    ORDER BY
        -- If this is changed, other subqueries will need changing too
        (has_profile_picture_id = 1) DESC,
        match_percentage DESC

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
                -- If this is changed, other subqueries will need changing too
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
        prospects_fourth_pass
    ORDER BY
        position
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
    -- If this is changed, other subqueries will need changing too
    (profile_photo_uuid IS NOT NULL) DESC,
    match_percentage DESC
LIMIT
    1
"""
