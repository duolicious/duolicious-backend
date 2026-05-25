from constants import (
    MIN_CLUB_PAGE_MEMBERS,
    MIN_CLUB_CELL_SIZE,
    MIN_CLUB_ANSWERS_PER_QUESTION,
    MIN_ANSWER_DIVERGENCE_PCT,
    MAX_CLUB_TOP_ANSWERS,
    MAX_CLUB_SAMPLE_MEMBERS,
    MAX_CLUBS_PER_PERSON_FOR_OVERLAP,
)

# Queries owned by the club-SEO crons. They live here (not in
# service/person/sql) so the cron process never imports the API's
# `service.person` package, which builds a boto3 client and pulls in
# Flask/PIL/etc. at import time. The API only ever runs the tiny read
# queries in service/person/sql; all the heavy aggregation is here, run by
# the background workers. Shared tunables come from the dependency-free
# `constants` module so both sides agree.
#
# Three workers use these:
#   - the club-stats worker runs Q_CLUB_STATS_BATCH to (re)compute every
#     eligible, dirty/stale club's full page payload in one grouped pass and
#     store it in club_stats;
#   - the club-overlap worker rebuilds club_overlap (co-membership counts)
#     wholesale, on a slow cadence, for the related-clubs lift ranking;
#   - the description worker reads the stored stats (no aggregation) and
#     fills in club_seo.description via the LLM.
#
# Note on the personality maths below: `person.personality` is a 47-dim
# vector (46 traits + 1 constant padding dim), unit-normalised then scaled
# by an answer-count weight. A per-trait mean rescaled by SQRT(47) and
# clamped to +/-100 maps an evenly-spread unit component to ~+/-100, giving
# a rough lean for display. Lookup tables store id = 1 as "Unanswered" for
# every attribute except `gender` (where id = 1 is a real value, "Man"), so
# the demographic CTEs exclude id = 1 everywhere except gender.

# ---------------------------------------------------------------------------
# Batch stats computation (Solutions B + C)
# ---------------------------------------------------------------------------
#
# Computes the full page payload for a *set* of clubs in one grouped pass
# rather than one query per club. The `target` CTE selects up to
# %(batch_size)s eligible clubs that are dirty (present in club_stats_dirty
# because their membership changed) or stale (older than %(max_age_days)s
# days, which catches slow answer drift the dirty flag doesn't track),
# missing ones first. Every member-level CTE is grouped by club_name, so a
# full backfill (all clubs dirty) becomes a handful of hash-aggregated scans
# instead of tens of thousands of nested lookups.
#
# `sampled` caps each club at MAX_CLUB_SAMPLE_MEMBERS members, chosen by a
# deterministic md5 ordering of person_id. Deterministic so the payload (and
# thus its hash) is stable when membership is stable; md5 so the sample is
# unbiased rather than skewed toward early joiners. Proportions from the
# sample match the full club closely, and cell suppression on a sample is
# conservative (sample count <= true count), so the privacy floor still
# holds. The displayed member_count is always the club's true count_members.
#
# The statement also upserts the results into club_stats and DELETEs the
# processed clubs from club_stats_dirty, all in one atomic statement (data-
# modifying CTEs share one snapshot). A join landing between this statement
# and the next batch re-queues the club; one landing *within* the statement
# races the queue clear and may be missed until the max-age refresh -- an
# accepted staleness bound. Using a separate queue table (not a column on
# `club`) means the cron's clear and the API's count_members UPDATE never
# touch the same row, which would otherwise serialization-fail on the API
# under REPEATABLE READ.
Q_CLUB_STATS_BATCH = f"""
WITH target AS MATERIALIZED (
    SELECT
        c.name,
        c.count_members,
        (d.club_name IS NOT NULL) AS is_dirty
    FROM
        club c
    LEFT JOIN
        club_stats cs ON cs.club_name = c.name
    LEFT JOIN
        club_stats_dirty d ON d.club_name = c.name
    WHERE
        c.count_members >= {MIN_CLUB_PAGE_MEMBERS}
    AND (
        d.club_name IS NOT NULL
        OR cs.club_name IS NULL
        OR cs.computed_at < NOW() - MAKE_INTERVAL(days => %(max_age_days)s)
    )
    ORDER BY
        (cs.club_name IS NULL) DESC,
        (d.club_name IS NOT NULL) DESC,
        cs.computed_at NULLS FIRST
    LIMIT %(batch_size)s
), sampled AS MATERIALIZED (
    SELECT club_name, person_id
    FROM (
        SELECT
            pc.club_name,
            pc.person_id,
            ROW_NUMBER() OVER (
                PARTITION BY pc.club_name
                ORDER BY MD5(pc.person_id::text)
            ) AS rn
        FROM
            person_club pc
        JOIN
            target t ON t.name = pc.club_name
        WHERE
            pc.activated
    ) z
    WHERE rn <= {MAX_CLUB_SAMPLE_MEMBERS}
), members AS MATERIALIZED (
    SELECT
        s.club_name,
        p.gender_id,
        p.orientation_id,
        p.ethnicity_id,
        p.religion_id,
        p.drinking_id,
        p.smoking_id,
        p.drugs_id,
        p.exercise_id,
        p.has_kids_id,
        p.wants_kids_id,
        p.relationship_status_id,
        p.date_of_birth,
        p.personality,
        p.count_answers
    FROM
        sampled s
    JOIN
        person p ON p.id = s.person_id
), gender_j AS (
    SELECT club_name, COALESCE(json_agg(json_build_object('label', name, 'count', cnt) ORDER BY cnt DESC), '[]'::json) AS j
    FROM (SELECT m.club_name, g.name, COUNT(*)::int AS cnt FROM members m JOIN gender g ON g.id = m.gender_id GROUP BY m.club_name, g.name HAVING COUNT(*) >= {MIN_CLUB_CELL_SIZE}) x
    GROUP BY club_name
), orientation_j AS (
    SELECT club_name, COALESCE(json_agg(json_build_object('label', name, 'count', cnt) ORDER BY cnt DESC), '[]'::json) AS j
    FROM (SELECT m.club_name, o.name, COUNT(*)::int AS cnt FROM members m JOIN orientation o ON o.id = m.orientation_id WHERE m.orientation_id <> 1 GROUP BY m.club_name, o.name HAVING COUNT(*) >= {MIN_CLUB_CELL_SIZE}) x
    GROUP BY club_name
), ethnicity_j AS (
    SELECT club_name, COALESCE(json_agg(json_build_object('label', name, 'count', cnt) ORDER BY cnt DESC), '[]'::json) AS j
    FROM (SELECT m.club_name, e.name, COUNT(*)::int AS cnt FROM members m JOIN ethnicity e ON e.id = m.ethnicity_id WHERE m.ethnicity_id <> 1 GROUP BY m.club_name, e.name HAVING COUNT(*) >= {MIN_CLUB_CELL_SIZE}) x
    GROUP BY club_name
), religion_j AS (
    SELECT club_name, COALESCE(json_agg(json_build_object('label', name, 'count', cnt) ORDER BY cnt DESC), '[]'::json) AS j
    FROM (SELECT m.club_name, r.name, COUNT(*)::int AS cnt FROM members m JOIN religion r ON r.id = m.religion_id WHERE m.religion_id <> 1 GROUP BY m.club_name, r.name HAVING COUNT(*) >= {MIN_CLUB_CELL_SIZE}) x
    GROUP BY club_name
), relationship_status_j AS (
    SELECT club_name, COALESCE(json_agg(json_build_object('label', name, 'count', cnt) ORDER BY cnt DESC), '[]'::json) AS j
    FROM (SELECT m.club_name, r.name, COUNT(*)::int AS cnt FROM members m JOIN relationship_status r ON r.id = m.relationship_status_id WHERE m.relationship_status_id <> 1 GROUP BY m.club_name, r.name HAVING COUNT(*) >= {MIN_CLUB_CELL_SIZE}) x
    GROUP BY club_name
), drinking_j AS (
    SELECT club_name, COALESCE(json_agg(json_build_object('label', name, 'count', cnt) ORDER BY cnt DESC), '[]'::json) AS j
    FROM (SELECT m.club_name, f.name, COUNT(*)::int AS cnt FROM members m JOIN frequency f ON f.id = m.drinking_id WHERE m.drinking_id <> 1 GROUP BY m.club_name, f.name HAVING COUNT(*) >= {MIN_CLUB_CELL_SIZE}) x
    GROUP BY club_name
), smoking_j AS (
    SELECT club_name, COALESCE(json_agg(json_build_object('label', name, 'count', cnt) ORDER BY cnt DESC), '[]'::json) AS j
    FROM (SELECT m.club_name, y.name, COUNT(*)::int AS cnt FROM members m JOIN yes_no_optional y ON y.id = m.smoking_id WHERE m.smoking_id <> 1 GROUP BY m.club_name, y.name HAVING COUNT(*) >= {MIN_CLUB_CELL_SIZE}) x
    GROUP BY club_name
), drugs_j AS (
    SELECT club_name, COALESCE(json_agg(json_build_object('label', name, 'count', cnt) ORDER BY cnt DESC), '[]'::json) AS j
    FROM (SELECT m.club_name, y.name, COUNT(*)::int AS cnt FROM members m JOIN yes_no_optional y ON y.id = m.drugs_id WHERE m.drugs_id <> 1 GROUP BY m.club_name, y.name HAVING COUNT(*) >= {MIN_CLUB_CELL_SIZE}) x
    GROUP BY club_name
), exercise_j AS (
    SELECT club_name, COALESCE(json_agg(json_build_object('label', name, 'count', cnt) ORDER BY cnt DESC), '[]'::json) AS j
    FROM (SELECT m.club_name, f.name, COUNT(*)::int AS cnt FROM members m JOIN frequency f ON f.id = m.exercise_id WHERE m.exercise_id <> 1 GROUP BY m.club_name, f.name HAVING COUNT(*) >= {MIN_CLUB_CELL_SIZE}) x
    GROUP BY club_name
), has_kids_j AS (
    SELECT club_name, COALESCE(json_agg(json_build_object('label', name, 'count', cnt) ORDER BY cnt DESC), '[]'::json) AS j
    FROM (SELECT m.club_name, y.name, COUNT(*)::int AS cnt FROM members m JOIN yes_no_optional y ON y.id = m.has_kids_id WHERE m.has_kids_id <> 1 GROUP BY m.club_name, y.name HAVING COUNT(*) >= {MIN_CLUB_CELL_SIZE}) x
    GROUP BY club_name
), wants_kids_j AS (
    SELECT club_name, COALESCE(json_agg(json_build_object('label', name, 'count', cnt) ORDER BY cnt DESC), '[]'::json) AS j
    FROM (SELECT m.club_name, y.name, COUNT(*)::int AS cnt FROM members m JOIN yes_no_maybe y ON y.id = m.wants_kids_id WHERE m.wants_kids_id <> 1 GROUP BY m.club_name, y.name HAVING COUNT(*) >= {MIN_CLUB_CELL_SIZE}) x
    GROUP BY club_name
), age_buckets_j AS (
    SELECT club_name, COALESCE(json_agg(json_build_object('label', bucket, 'count', cnt) ORDER BY bucket), '[]'::json) AS j
    FROM (
        SELECT
            club_name,
            CASE
                WHEN age < 25 THEN '18-24'
                WHEN age < 35 THEN '25-34'
                WHEN age < 45 THEN '35-44'
                WHEN age < 55 THEN '45-54'
                ELSE '55+'
            END AS bucket,
            COUNT(*)::int AS cnt
        FROM (
            SELECT club_name, DATE_PART('year', AGE(date_of_birth))::int AS age FROM members
        ) ages
        GROUP BY club_name, bucket
        HAVING COUNT(*) >= {MIN_CLUB_CELL_SIZE}
    ) b
    GROUP BY club_name
), median_age_j AS (
    SELECT
        club_name,
        ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY DATE_PART('year', AGE(date_of_birth))))::int AS median_age
    FROM members
    GROUP BY club_name
), personality_vec AS (
    -- pgvector's AVG aggregates element-wise; members with few answers have
    -- shorter (answer-count-weighted) vectors and so contribute less.
    SELECT club_name, (AVG(personality))::real[] AS arr
    FROM members
    WHERE count_answers > 0
    GROUP BY club_name
), personality_j AS (
    SELECT
        pv.club_name,
        COALESCE(
            json_agg(
                json_build_object(
                    'trait',     t.name,
                    'min_label', t.min_label,
                    'max_label', t.max_label,
                    'score',     GREATEST(-100, LEAST(100, ROUND((pv.arr[t.id] * SQRT(47) * 100)::numeric)::int))
                )
                ORDER BY t.id
            ),
            '[]'::json
        ) AS j
    FROM personality_vec pv
    CROSS JOIN trait t
    WHERE t.id <= 46 AND pv.arr IS NOT NULL
    GROUP BY pv.club_name
), club_answer AS (
    -- Drive from the sampled members into answer via its PK
    -- (person_id, question_id); never from question/answer first, which
    -- would touch the whole answer table.
    SELECT
        s.club_name,
        a.question_id,
        COUNT(*) FILTER (WHERE a.answer IS NOT NULL)::int AS total_cnt,
        COUNT(*) FILTER (WHERE a.answer IS TRUE)::int     AS yes_cnt
    FROM
        sampled s
    JOIN
        answer a ON a.person_id = s.person_id
    GROUP BY
        s.club_name, a.question_id
    HAVING
        COUNT(*) FILTER (WHERE a.answer IS NOT NULL) >= {MIN_CLUB_ANSWERS_PER_QUESTION}
), answer_ranked AS (
    SELECT
        ca.club_name,
        q.question,
        pct.club_yes_pct,
        pct.platform_yes_pct,
        ABS(pct.club_yes_pct - pct.platform_yes_pct) AS abs_delta,
        ROW_NUMBER() OVER (
            PARTITION BY ca.club_name
            ORDER BY ABS(pct.club_yes_pct - pct.platform_yes_pct) DESC
        ) AS rn
    FROM club_answer ca
    JOIN question q ON q.id = ca.question_id
    CROSS JOIN LATERAL (
        SELECT
            ca.yes_cnt::float8 / ca.total_cnt * 100 AS club_yes_pct,
            q.count_yes::float8 / NULLIF(q.count_yes + q.count_no, 0) * 100 AS platform_yes_pct
    ) pct
    WHERE pct.platform_yes_pct IS NOT NULL
      AND ABS(pct.club_yes_pct - pct.platform_yes_pct) >= {MIN_ANSWER_DIVERGENCE_PCT}
), top_answers_j AS (
    SELECT
        club_name,
        json_agg(
            json_build_object(
                'question',           question,
                'club_agree_pct',     ROUND(club_yes_pct::numeric)::int,
                'platform_agree_pct', ROUND(platform_yes_pct::numeric)::int
            )
            ORDER BY abs_delta DESC
        ) AS j
    FROM answer_ranked
    WHERE rn <= {MAX_CLUB_TOP_ANSWERS}
    GROUP BY club_name
), payload AS (
    SELECT
        t.name,
        json_build_object(
            'name',         t.name,
            'member_count', t.count_members,
            'median_age',   (SELECT median_age FROM median_age_j WHERE club_name = t.name),
            'demographics', json_build_object(
                'gender',              COALESCE((SELECT j FROM gender_j              WHERE club_name = t.name), '[]'::json),
                'orientation',         COALESCE((SELECT j FROM orientation_j         WHERE club_name = t.name), '[]'::json),
                'ethnicity',           COALESCE((SELECT j FROM ethnicity_j           WHERE club_name = t.name), '[]'::json),
                'religion',            COALESCE((SELECT j FROM religion_j            WHERE club_name = t.name), '[]'::json),
                'relationship_status', COALESCE((SELECT j FROM relationship_status_j WHERE club_name = t.name), '[]'::json),
                'age_buckets',         COALESCE((SELECT j FROM age_buckets_j         WHERE club_name = t.name), '[]'::json)
            ),
            'lifestyle', json_build_object(
                'drinking',   COALESCE((SELECT j FROM drinking_j   WHERE club_name = t.name), '[]'::json),
                'smoking',    COALESCE((SELECT j FROM smoking_j    WHERE club_name = t.name), '[]'::json),
                'drugs',      COALESCE((SELECT j FROM drugs_j      WHERE club_name = t.name), '[]'::json),
                'exercise',   COALESCE((SELECT j FROM exercise_j   WHERE club_name = t.name), '[]'::json),
                'has_kids',   COALESCE((SELECT j FROM has_kids_j   WHERE club_name = t.name), '[]'::json),
                'wants_kids', COALESCE((SELECT j FROM wants_kids_j WHERE club_name = t.name), '[]'::json)
            ),
            'personality',   COALESCE((SELECT j FROM personality_j  WHERE club_name = t.name), '[]'::json),
            'top_answers',   COALESCE((SELECT j FROM top_answers_j  WHERE club_name = t.name), '[]'::json)
            -- related_clubs is not stored here: it changes on the overlap
            -- cron's cadence, not this club's, so the read query computes it
            -- live from club_overlap to avoid stale lists between rebuilds.
        ) AS j
    FROM target t
), upserted AS (
    INSERT INTO club_stats (club_name, stats_json, computed_at)
    SELECT name, j, NOW() FROM payload
    ON CONFLICT (club_name) DO UPDATE SET
        stats_json  = EXCLUDED.stats_json,
        computed_at = NOW()
    RETURNING club_name
), cleaned AS (
    DELETE FROM club_stats_dirty
    WHERE club_name IN (SELECT name FROM target WHERE is_dirty)
    RETURNING club_name
)
SELECT
    (SELECT COUNT(*) FROM upserted) AS upserted_count,
    (SELECT COUNT(*) FROM cleaned)  AS cleaned_count
"""

# ---------------------------------------------------------------------------
# Description refresh (reads precomputed stats; no aggregation)
# ---------------------------------------------------------------------------

# Pick the eligible club whose description most needs attention: never
# attempted (no club_seo row) first, then by oldest generated_at. Only
# clubs that already have a club_stats row are considered, so the worker
# always has stats to describe. The worker hashes the facts it would feed
# the model and either touches generated_at (hash match -> no LLM), upserts
# a new description, or -- on failure -- marks the attempt so the club
# rotates to the back of the queue instead of blocking it.
Q_CLUB_SEO_NEXT_REFRESH = f"""
SELECT
    c.name,
    cs.stats_json,
    seo.stats_hash AS old_stats_hash,
    -- Age is computed against the DB's NOW() so it's measured in the same
    -- clock the generated_at column was written from. NULL when no
    -- club_seo row exists yet, which the worker treats as infinitely stale.
    EXTRACT(EPOCH FROM (NOW() - seo.generated_at)) / 86400.0 AS age_days
FROM
    club c
JOIN
    club_stats cs ON cs.club_name = c.name
LEFT JOIN
    club_seo seo ON seo.club_name = c.name
WHERE
    c.count_members >= {MIN_CLUB_PAGE_MEMBERS}
ORDER BY
    seo.club_name IS NULL DESC,
    seo.generated_at NULLS FIRST
LIMIT 1
"""

Q_CLUB_SEO_TOUCH = """
UPDATE
    club_seo
SET
    generated_at = NOW()
WHERE
    club_name = %(club_name)s
"""

Q_CLUB_SEO_UPSERT = """
INSERT INTO club_seo (club_name, description, stats_hash)
VALUES (%(club_name)s, %(description)s, %(stats_hash)s)
ON CONFLICT (club_name) DO UPDATE SET
    description  = EXCLUDED.description,
    stats_hash   = EXCLUDED.stats_hash,
    generated_at = NOW()
"""

# Record a failed generation attempt without disturbing any existing
# description/hash: it only advances generated_at so the club moves to the
# back of the refresh queue (retried after a full cycle) rather than being
# re-selected every tick and starving every other club.
Q_CLUB_SEO_MARK_ATTEMPTED = """
INSERT INTO club_seo (club_name, description, stats_hash, generated_at)
VALUES (%(club_name)s, NULL, NULL, NOW())
ON CONFLICT (club_name) DO UPDATE SET
    generated_at = NOW()
"""

# ---------------------------------------------------------------------------
# Global club-overlap precompute (related clubs)
# ---------------------------------------------------------------------------
#
# Co-membership counts for every pair of eligible clubs, in one grouped pass.
# Computing it globally (rather than per club, per stats batch) means each
# unordered pair is counted once instead of twice, and overlaps use full
# membership rather than the stats batch's per-club sample -- which matters
# because the lift ranking needs accurate counts. The page read query turns
# these counts into a lift ranking at request time.
#
# `eligible_members` is materialised once and self-joined. Members of more
# than MAX_CLUBS_PER_PERSON_FOR_OVERLAP clubs are dropped: a person in k
# clubs contributes k*(k-1) pairs, so without the cap a handful of
# hyper-joiners dominate the cost while adding only noise. Pairs sharing
# fewer than MIN_CLUB_CELL_SIZE members are discarded (privacy floor + noise
# floor). Both directions (a->b and b->a) are written so the read side is a
# single PK range scan.
#
# Rebuilt wholesale: the worker runs DELETE then INSERT inside one
# transaction, so readers keep seeing the previous snapshot (MVCC) until it
# commits -- no blocking and no empty window. The dead rows are reclaimed by
# autovacuum; the cadence is slow (hours), so churn is modest.
Q_CLUB_OVERLAP_DELETE = """
DELETE FROM club_overlap
"""

Q_CLUB_OVERLAP_REBUILD = f"""
WITH eligible_members AS MATERIALIZED (
    SELECT
        pc.person_id,
        pc.club_name
    FROM
        person_club pc
    JOIN
        club c ON c.name = pc.club_name AND c.count_members >= {MIN_CLUB_PAGE_MEMBERS}
    WHERE
        pc.activated
    AND
        pc.person_id IN (
            SELECT person_id
            FROM person_club
            WHERE activated
            GROUP BY person_id
            HAVING COUNT(*) <= {MAX_CLUBS_PER_PERSON_FOR_OVERLAP}
        )
)
INSERT INTO club_overlap (club_a, club_b, overlap)
SELECT
    a.club_name,
    b.club_name,
    COUNT(*)::int
FROM
    eligible_members a
JOIN
    eligible_members b
ON
    b.person_id = a.person_id
AND
    b.club_name <> a.club_name
GROUP BY
    a.club_name, b.club_name
HAVING
    COUNT(*) >= {MIN_CLUB_CELL_SIZE}
"""
