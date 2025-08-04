from constants import ONLINE_RECENTLY_SECONDS

Q_UPSERT_SEARCH_PREFERENCE_CLUB = """
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
"""



Q_SEARCH_PREFERENCE = f"""
WITH delete_search_preference_club AS (
    DELETE FROM
        search_preference_club
    WHERE
        person_id = %(person_id)s
    AND
        %(club_name)s::TEXT IS NULL
    AND
        %(do_modify)s
), set_pending_club_name_to_null AS (
    UPDATE
        duo_session
    SET
        pending_club_name = NULL
    WHERE
        person_id = %(person_id)s
), upsert_search_preference_club AS (
    {Q_UPSERT_SEARCH_PREFERENCE_CLUB}
)
SELECT
    gender_id
FROM
    search_preference_gender
WHERE
    person_id = %(person_id)s
"""



Q_UNCACHED_SEARCH_1 = """
DELETE FROM
    search_cache
WHERE
    searcher_person_id = %(searcher_person_id)s
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
        ) AS club_preference,
        date_of_birth,
        count_answers
    FROM
        person
    WHERE
        person.id = %(searcher_person_id)s
), prospects_first_pass_without_club AS (
    SELECT
        id
    FROM
        person AS prospect
    CROSS JOIN
        searcher
    WHERE
        prospect.activated
    AND
        -- The prospect meets the searcher's gender preference
        prospect.gender_id = ANY(%(gender_preference)s::SMALLINT[])
    AND
        -- The prospect meets the searcher's location preference
        ST_DWithin(
            prospect.coordinates,
            searcher.coordinates,
            searcher.distance_preference
        )
    AND
        searcher.club_preference IS NULL

    LIMIT
        30000
), prospects_first_pass_with_club AS (
    SELECT
        person_id AS id
    FROM
        person_club AS prospect
    CROSS JOIN
        searcher
    WHERE
        prospect.activated
    AND
        -- The prospect meets the searcher's gender preference
        prospect.gender_id = ANY(%(gender_preference)s::SMALLINT[])
    AND
        -- The prospect meets the searcher's location preference
        ST_DWithin(
            prospect.coordinates,
            searcher.coordinates,
            searcher.distance_preference
        )
    AND
        prospect.club_name = searcher.club_preference

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
    CROSS JOIN
        searcher
    ORDER BY
        prospect.personality <#> searcher.personality
    LIMIT
        10000
), prospects_fourth_pass AS (
    SELECT
        prospect.id AS prospect_person_id,

        uuid AS prospect_uuid,

        name,

        prospect.personality,

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
            THEN EXTRACT(YEAR FROM AGE(prospect.date_of_birth))
            ELSE NULL
        END AS age,

        CLAMP(
            0,
            99,
            100 * (1 - (prospect.personality <#> searcher.personality)) / 2
        ) AS match_percentage,

        roles

    FROM
        person AS prospect
    JOIN
        prospects_third_pass
    ON
        prospects_third_pass.id = prospect.id
    CROSS JOIN
        searcher

    WHERE (
        -- The searcher meets the prospect's gender preference or
        -- the searcher is searching with in a club
        EXISTS (
            SELECT
                1
            FROM
                search_preference_gender AS preference
            WHERE
                preference.person_id = prospect.id
            AND
                preference.gender_id = searcher.gender_id
        )
        OR searcher.club_preference IS NOT NULL
    )

    AND (
        -- The searcher meets the prospect's location preference or
        -- the searcher is searching within a club
        ST_DWithin(
            prospect.coordinates,
            searcher.coordinates,
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
                        ),
                        1e9
                    )
            )
        )
        OR searcher.club_preference IS NOT NULL
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

    -- The searcher meets the prospect's age preference or
    -- the searcher is searching within a club
    AND (
       EXISTS (
            SELECT 1
            FROM search_preference_age AS preference
            WHERE
                preference.person_id = prospect.id
            AND
                searcher.date_of_birth <= (
                    CURRENT_DATE -
                    INTERVAL '1 year' *
                    COALESCE(preference.min_age, 0)
                )
            AND
                searcher.date_of_birth > (
                    CURRENT_DATE -
                    INTERVAL '1 year' *
                    (COALESCE(preference.max_age, 999) + 1)
                )
        )
        OR searcher.club_preference IS NOT NULL
    )

    -- The users have at least a 50%% match or
    -- the searcher is searching within a club
    AND (
        (prospect.personality <#> searcher.personality) < 1e-5
        OR searcher.club_preference IS NOT NULL
    )

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
        )

    -- Exclude users who should be verified but aren't
    AND (
            prospect.verification_level_id > 1
        OR
            NOT prospect.verification_required
    )

    ORDER BY
        -- If this is changed, other subqueries will need changing too
        verified DESC,
        match_percentage DESC

    LIMIT
        -- 500 + 2. The two extra records are the searcher and the moderation
        -- bot, which we'll filter out later so that we have 500 records to show
        -- the user. We don't filer them here to reduce the number of checks we
        -- need to do for 'bot' or 'self' status.
        502
), do_promote_verified AS (
    SELECT
        count(*) >= 250 AS x
    FROM
        prospects_fourth_pass
    WHERE
        profile_photo_uuid IS NOT NULL
    AND
        verified
    AND
        (SELECT count_answers > 0 FROM searcher)
)
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
            CASE
                WHEN (SELECT x FROM do_promote_verified)
                THEN
                    profile_photo_uuid IS NOT NULL AND verified
                ELSE
                    profile_photo_uuid IS NOT NULL
            END DESC,

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
WHERE
    prospects_fourth_pass.prospect_person_id != %(searcher_person_id)s
AND
    'bot' <> ALL(prospects_fourth_pass.roles)
ORDER BY
    position
LIMIT
    500
ON CONFLICT (searcher_person_id, position) DO UPDATE SET
    searcher_person_id = EXCLUDED.searcher_person_id,
    position = EXCLUDED.position,
    prospect_person_id = EXCLUDED.prospect_person_id,
    prospect_uuid = EXCLUDED.prospect_uuid,
    profile_photo_uuid = EXCLUDED.profile_photo_uuid,
    name = EXCLUDED.name,
    age = EXCLUDED.age,
    match_percentage = EXCLUDED.match_percentage,
    personality = EXCLUDED.personality,
    verified = EXCLUDED.verified
"""



Q_CACHED_SEARCH = """
WITH page AS (
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
        verified,
        (
            SELECT
                verification_level_id
            FROM
                person
            WHERE
                id = %(searcher_person_id)s
        ) AS searcher_verification_level_id,
        (
            SELECT
                privacy_verification_level_id
            FROM
                person
            WHERE
                id = prospect_person_id
        ) AS privacy_verification_level_id
    FROM
        search_cache
    WHERE
        searcher_person_id = %(searcher_person_id)s AND
        position >  %(o)s AND
        position <= %(o)s + %(n)s
    ORDER BY
        position
)
SELECT
    public_page.profile_photo_blurhash,
    public_page.name,
    public_page.age,
    public_page.match_percentage,
    public_page.person_messaged_prospect,
    public_page.prospect_messaged_person,
    public_page.verified,
    public_page.verification_required_to_view,

    private_page.prospect_person_id,
    private_page.prospect_uuid,
    private_page.profile_photo_uuid
FROM
    (
        SELECT
            *,

            CASE
                WHEN
                    searcher_verification_level_id >=
                    privacy_verification_level_id
                THEN NULL
                WHEN
                    privacy_verification_level_id = 2
                THEN 'basics'
                WHEN
                    privacy_verification_level_id = 3
                THEN 'photos'
            END AS verification_required_to_view
        FROM
            page
    ) AS public_page
LEFT JOIN
    (
        SELECT
            *
        FROM
            page
        WHERE
            searcher_verification_level_id >= privacy_verification_level_id
    ) AS private_page
ON
    private_page.prospect_person_id = public_page.prospect_person_id
"""

Q_QUIZ_SEARCH = f"""
WITH searcher AS (
    SELECT
        personality,
        count_answers
    FROM
        person
    WHERE
        person.id = %(searcher_person_id)s
), do_promote_verified AS (
    SELECT
        count(*) >= 250 AS x
    FROM
        search_cache,
        searcher
    WHERE
        searcher_person_id = %(searcher_person_id)s
    AND
        profile_photo_uuid IS NOT NULL
    AND
        verified
    AND
        (SELECT count_answers > 0 FROM searcher)
), page AS (
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
        )::SMALLINT AS match_percentage,
        (
            SELECT
                verification_level_id
            FROM
                person
            WHERE
                id = %(searcher_person_id)s
        ) AS searcher_verification_level_id,
        (
            SELECT
                privacy_verification_level_id
            FROM
                person
            WHERE
                id = prospect_person_id
        ) AS privacy_verification_level_id
    FROM
        search_cache
    WHERE
        searcher_person_id = %(searcher_person_id)s
    ORDER BY
        -- If this is changed, other subqueries will need changing too
        CASE
            WHEN (SELECT x FROM do_promote_verified)
            THEN
                profile_photo_uuid IS NOT NULL AND verified
            ELSE
                profile_photo_uuid IS NOT NULL
        END DESC,

        match_percentage DESC
    LIMIT
        1
)
SELECT
    public_page.profile_photo_blurhash,
    public_page.name,
    public_page.age,
    public_page.match_percentage,
    public_page.verification_required_to_view,

    private_page.prospect_person_id,
    private_page.prospect_uuid,
    private_page.profile_photo_uuid
FROM
    (
        SELECT
            *,

            CASE
                WHEN
                    searcher_verification_level_id >=
                    privacy_verification_level_id
                THEN NULL
                WHEN
                    privacy_verification_level_id = 2
                THEN 'basics'
                WHEN
                    privacy_verification_level_id = 3
                THEN 'photos'
            END AS verification_required_to_view
        FROM
            page
    ) AS public_page
LEFT JOIN
    (
        SELECT
            *
        FROM
            page
        WHERE
            searcher_verification_level_id >= privacy_verification_level_id
    ) AS private_page
ON
    private_page.prospect_person_id = public_page.prospect_person_id
"""

Q_FEED = f"""
WITH searcher AS (
    SELECT
        gender_id,
        date_of_birth,
        personality,
        verification_level_id
    FROM
        person
    WHERE
        person.id = %(searcher_person_id)s
), person_data AS (
    SELECT
        prospect.uuid AS person_uuid,
        prospect.name,
        photo_data.blurhash AS photo_blurhash,
        photo_data.uuid AS photo_uuid,
        prospect.verification_level_id > 1 AS is_verified,
        iso8601_utc(prospect.last_event_time) AS time,
        prospect.last_event_name AS type,
        prospect.last_event_data,
        CLAMP(
            0,
            99,
            100 * (
                1 - (prospect.personality <#> searcher.personality)
            ) / 2
        )::SMALLINT AS match_percentage
    FROM
        person AS prospect
    LEFT JOIN LATERAL (
        SELECT
            photo.uuid,
            photo.blurhash,
            photo.nsfw_score
        FROM
            photo
        WHERE
            photo.person_id = prospect.id
        ORDER BY
            photo.position
        LIMIT 1
    ) AS photo_data
    ON
        true
    CROSS JOIN
        searcher
    WHERE
        last_event_time < %(before)s
    AND
        last_event_time > now() - interval '1 month'
    AND
        activated
    AND NOT (
            last_event_name IN (
                'was-recently-online'::person_event,
                'recently-online-with-photo'::person_event,
                'recently-online-with-voice-bio'::person_event,
                'recently-online-with-bio'::person_event
            )
        AND
            last_event_time < now() - interval '{ONLINE_RECENTLY_SECONDS} seconds'
    )
    AND
        -- The searcher meets the prospects privacy_verification_level_id
        -- requirement
        prospect.privacy_verification_level_id <=
            searcher.verification_level_id
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
    -- Decrease users' odds of appearing in the feed if they're already getting
    -- lots of messages
    AND random() < (
        SELECT
            1.0 / (1.0 + count(*)::real) ^ 1.5
        FROM
            messaged
        WHERE
            object_person_id = prospect.id
        AND
            created_at > now() - interval '1 day'
    )
    -- Decrease users' odds of appearing in the feed as the age gap between them
    -- and the searcher grows
    AND random() < 1.0 / (
        1.0 +
        2.0 * -- Higher values of this coefficient increase selectivity
        ABS(searcher.date_of_birth - prospect.date_of_birth) / 365.0
    )
    -- The searcher meets the prospect's gender preference
    AND EXISTS (
        SELECT
            1
        FROM
            search_preference_gender
        WHERE
            search_preference_gender.person_id = prospect.id
        AND
            search_preference_gender.gender_id = searcher.gender_id
    )
    -- Exclude photos that might be NSFW
    AND NOT EXISTS (
        SELECT
            1
        FROM
            photo
        WHERE
            uuid = last_event_data->>'added_photo_uuid'
        AND
            nsfw_score > 0.2
    )
    -- Exclude users who were reported two or more times in the past day
    AND (
        SELECT
            count(*)
        FROM
            skipped
        WHERE
            object_person_id = prospect.id
        AND
            created_at > now() - interval '2 days'
        AND
            reported
    ) < 2
    -- Exclude users who aren't verified but are required to be
    AND (
            prospect.verification_level_id > 1
        OR
            NOT prospect.verification_required
    )
    -- Exclude users who don't seem human. A user seems human if:
    --   * They're verified; or
    --   * Their account is more than a month old; or
    --   * They've customized their account's color scheme
    --   * They've got an audio bio
    --   * They've got an otherwise well-completed profile
    AND (
            prospect.verification_level_id > 1

        OR
            prospect.sign_up_time < now() - interval '1 month'

        OR
            lower(prospect.title_color) <> '#000000'
        OR
            lower(prospect.body_color) <> '#000000'
        OR
            lower(prospect.background_color) <> '#ffffff'

        OR EXISTS (
            SELECT 1 FROM audio WHERE person_id = prospect.id
        )

        OR
            prospect.count_answers >= 25
        AND
            length(prospect.about) > 0
        AND EXISTS (
            SELECT 1 FROM person_club WHERE person_id = prospect.id
        )
    )
    ORDER BY
        last_event_time DESC
    LIMIT
        50
)
SELECT
    jsonb_build_object(
        'person_uuid', person_uuid,
        'name', name,
        'photo_uuid', photo_uuid,
        'photo_blurhash', photo_blurhash,
        'is_verified', is_verified,
        'time', time,
        'type', type,
        'match_percentage', match_percentage
    ) || last_event_data AS j
FROM
    person_data
"""
