Q_UNCACHED_SEARCH_1 = """
WITH deleted_search_cache AS (
    DELETE FROM search_cache
    WHERE searcher_person_id = %(searcher_person_id)s
)
SELECT
    1000 * distance AS distance
FROM
    person
JOIN
    search_preference_distance
ON
    person.id = person_id
WHERE
    person.id = %(searcher_person_id)s
"""

Q_UNCACHED_SEARCH_2 = """
WITH searcher AS (
    SELECT
        coordinates,
        personality
    FROM
        person
    WHERE
        person.id = %(searcher_person_id)s
    LIMIT 1
), prospects_first_pass AS (
    SELECT
        person_id AS prospect_person_id,
        personality <#> (SELECT personality FROM searcher) AS negative_dot_prod
    FROM
        [[search_table]]
    WHERE
        person_id != %(searcher_person_id)s
        [[maybe_distance_fragment]]
    ORDER BY
        negative_dot_prod
    LIMIT
        [[first_pass_limit]]
[[later_passes_fragments]]
"""

Q_UNCACHED_SEARCH_2_DISTANCE_FRAGMENT = """
    AND
        ST_DWithin(
            coordinates,
            (SELECT coordinates FROM searcher),
            %(distance)s
        )
"""

Q_UNCACHED_SEARCH_2_QUIZ_FRAGMENT = """
)
SELECT
    prospect_person_id,
    (
        SELECT uuid
        FROM photo
        WHERE
            person_id = prospect_person_id
        ORDER BY
            position
        LIMIT 1
    ) AS profile_photo_uuid,
    CLAMP(0, 99, 100 * (1 - negative_dot_prod) / 2)::SMALLINT AS match_percentage
FROM
    prospects_first_pass AS prospect
WHERE
    NOT EXISTS (
        SELECT 1
        FROM
            blocked
        WHERE
            subject_person_id = %(searcher_person_id)s AND
            object_person_id  = prospect_person_id
        OR
            subject_person_id = prospect_person_id AND
            object_person_id  = %(searcher_person_id)s
        LIMIT 1
    )
"""

Q_UNCACHED_SEARCH_2_STANDARD_FRAGMENT = """
), joined_prospects AS MATERIALIZED (
    SELECT
        *,
        EXTRACT(YEAR FROM AGE(date_of_birth)) AS age
    FROM
        person
    JOIN
        prospects_first_pass
    ON
        person.id = prospect_person_id
), prospects_second_pass AS (
    SELECT
        *
    FROM
        joined_prospects AS prospect
    WHERE
        EXISTS (
            SELECT 1
            FROM search_preference_gender AS preference
            WHERE
                preference.person_id = %(searcher_person_id)s AND
                preference.gender_id = prospect.gender_id
            LIMIT 1
        )
    AND
        EXISTS (
            SELECT 1
            FROM search_preference_orientation AS preference
            WHERE
                preference.person_id      = %(searcher_person_id)s AND
                preference.orientation_id = prospect.orientation_id
            LIMIT 1
        )
    AND EXISTS (
            SELECT 1
            FROM search_preference_age AS preference
            WHERE
                preference.person_id = %(searcher_person_id)s AND
                COALESCE(preference.min_age, 0)   <= prospect.age AND
                COALESCE(preference.max_age, 999) >= prospect.age
            LIMIT 1
        )
    AND EXISTS (
            SELECT 1
            FROM search_preference_height_cm AS preference
            WHERE
                preference.person_id = %(searcher_person_id)s AND
                COALESCE(preference.min_height_cm, 0)   <= COALESCE(prospect.height_cm, 0) AND
                COALESCE(preference.max_height_cm, 999) >= COALESCE(prospect.height_cm, 999)
            LIMIT 1
        )
    AND EXISTS (
            SELECT 1
            FROM search_preference_has_profile_picture AS preference
            WHERE
                preference.person_id              = %(searcher_person_id)s AND
                preference.has_profile_picture_id = prospect.has_profile_picture_id
            LIMIT 1
        )
    AND EXISTS (
            SELECT 1
            FROM search_preference_looking_for AS preference
            WHERE
                preference.person_id      = %(searcher_person_id)s AND
                preference.looking_for_id = prospect.looking_for_id
            LIMIT 1
        )
    AND EXISTS (
            SELECT 1
            FROM search_preference_smoking AS preference
            WHERE
                preference.person_id  = %(searcher_person_id)s AND
                preference.smoking_id = prospect.smoking_id
            LIMIT 1
        )
    AND EXISTS (
            SELECT 1
            FROM search_preference_drinking AS preference
            WHERE
                preference.person_id  = %(searcher_person_id)s AND
                preference.drinking_id = prospect.drinking_id
            LIMIT 1
        )
    AND EXISTS (
            SELECT 1
            FROM search_preference_drugs AS preference
            WHERE
                preference.person_id = %(searcher_person_id)s AND
                preference.drugs_id  = prospect.drugs_id
            LIMIT 1
        )
    AND EXISTS (
            SELECT 1
            FROM search_preference_long_distance AS preference
            WHERE
                preference.person_id         = %(searcher_person_id)s AND
                preference.long_distance_id  = prospect.long_distance_id
            LIMIT 1
        )
    AND EXISTS (
            SELECT 1
            FROM search_preference_relationship_status AS preference
            WHERE
                preference.person_id               = %(searcher_person_id)s AND
                preference.relationship_status_id  = prospect.relationship_status_id
            LIMIT 1
        )
    AND EXISTS (
            SELECT 1
            FROM search_preference_has_kids AS preference
            WHERE
                preference.person_id   = %(searcher_person_id)s AND
                preference.has_kids_id = prospect.has_kids_id
            LIMIT 1
        )
    AND EXISTS (
            SELECT 1
            FROM search_preference_wants_kids AS preference
            WHERE
                preference.person_id     = %(searcher_person_id)s AND
                preference.wants_kids_id = prospect.wants_kids_id
            LIMIT 1
        )
    AND EXISTS (
            SELECT 1
            FROM search_preference_exercise AS preference
            WHERE
                preference.person_id   = %(searcher_person_id)s AND
                preference.exercise_id = prospect.exercise_id
            LIMIT 1
        )
    AND EXISTS (
            SELECT 1
            FROM search_preference_religion AS preference
            WHERE
                preference.person_id   = %(searcher_person_id)s AND
                preference.religion_id = prospect.religion_id
            LIMIT 1
        )
    AND EXISTS (
            SELECT 1
            FROM search_preference_star_sign AS preference
            WHERE
                preference.person_id    = %(searcher_person_id)s AND
                preference.star_sign_id = prospect.star_sign_id
            LIMIT 1
        )
    AND NOT EXISTS (
            SELECT 1
            FROM search_preference_messaged AS preference
            JOIN messaged
            ON
                preference.person_id       = %(searcher_person_id)s AND
                preference.messaged_id     = 2 AND
                messaged.subject_person_id = %(searcher_person_id)s AND
                messaged.object_person_id  = prospect_person_id
            LIMIT 1
        )
    AND NOT EXISTS (
            SELECT 1
            FROM search_preference_hidden AS preference
            JOIN hidden
            ON
                preference.person_id     = %(searcher_person_id)s AND
                preference.hidden_id     = 2 AND
                hidden.subject_person_id = %(searcher_person_id)s AND
                hidden.object_person_id  = prospect_person_id
            LIMIT 1
        )
    AND NOT EXISTS (
            SELECT 1
            FROM search_preference_blocked AS preference
            JOIN blocked
            ON
                preference.person_id      = %(searcher_person_id)s AND
                preference.blocked_id     = 2 AND
                blocked.subject_person_id = %(searcher_person_id)s AND
                blocked.object_person_id  = prospect_person_id
            LIMIT 1
        )
    AND NOT EXISTS (
            SELECT 1
            FROM blocked
            WHERE
                blocked.subject_person_id = prospect_person_id AND
                blocked.object_person_id  = %(searcher_person_id)s
            LIMIT 1
        )
    AND EXISTS (
            (
                SELECT 1 WHERE NOT prospect.hide_me_from_strangers
            ) UNION ALL (
                SELECT 1
                FROM search_preference_messaged AS preference
                JOIN messaged
                ON
                    messaged.subject_person_id = prospect_person_id AND
                    messaged.object_person_id = %(searcher_person_id)s
                WHERE
                    prospect.hide_me_from_strangers
                LIMIT 1
            )
            LIMIT 1
        )
), prospects_third_pass AS (
    SELECT
        *
    FROM
        prospects_second_pass AS prospect
    WHERE
        -- NOT EXISTS an answer contrary to the searcher's preference...
        NOT EXISTS (
            SELECT 1
            FROM search_preference_answer pref
            LEFT JOIN answer ans
            ON
                ans.person_id = prospect_person_id AND
                ans.question_id = pref.question_id AND
                pref.person_id = %(searcher_person_id)s
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
), prospects_with_details AS (
    SELECT
        id AS prospect_person_id,
        (
            SELECT uuid
            FROM photo
            WHERE
                person_id = prospect_person_id
            ORDER BY
                position
            LIMIT 1
        ) AS profile_photo_uuid,
        name,
        CASE WHEN show_my_age THEN age ELSE NULL END AS age,
    CLAMP(0, 99, 100 * (1 - negative_dot_prod) / 2)::SMALLINT AS match_percentage
    FROM
        prospects_third_pass AS prospect
), updated_search_cache AS (
    INSERT INTO search_cache (
        searcher_person_id,
        position,
        prospect_person_id,
        profile_photo_uuid,
        name,
        age,
        match_percentage
    )
    SELECT
        %(searcher_person_id)s,
        ROW_NUMBER() OVER (
            ORDER BY
                (profile_photo_uuid IS NOT NULL) DESC,
                match_percentage DESC
        ) AS position,
        *
    FROM
        prospects_with_details
    RETURNING *
)
SELECT
    prospect_person_id,
    profile_photo_uuid,
    name,
    age,
    match_percentage
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
    profile_photo_uuid,
    name,
    age,
    match_percentage
FROM
    search_cache
WHERE
    searcher_person_id = %(searcher_person_id)s AND
    position >  %(o)s AND
    position <= %(o)s + %(n)s
ORDER BY
    position
"""
