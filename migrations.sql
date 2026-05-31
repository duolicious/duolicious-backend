CREATE OR REPLACE FUNCTION iso8601_utc(ts timestamp)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  RETURNS NULL ON NULL INPUT
AS $$
    SELECT to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
$$;

-- Public Profile toggle. Opt-in for everyone: defaults to FALSE for both
-- existing rows and new sign-ups, and users flip it on themselves via the
-- "Public Profile" entry in privacy settings.
ALTER TABLE person
    ADD COLUMN IF NOT EXISTS public_profile BOOLEAN NOT NULL DEFAULT FALSE;

-- Social login (Google / Apple) added alongside OTP. Social sessions have
-- no OTP, so the column must be nullable. The pending_social_* columns
-- carry the provider identity through onboarding for new users; on
-- `/finish-onboarding` they get materialized into `social_identity`.
ALTER TABLE duo_session ALTER COLUMN otp DROP NOT NULL;
ALTER TABLE duo_session
    ADD COLUMN IF NOT EXISTS pending_social_provider TEXT,
    ADD COLUMN IF NOT EXISTS pending_social_sub TEXT;

CREATE TABLE IF NOT EXISTS social_identity (
    provider TEXT NOT NULL,
    provider_sub TEXT NOT NULL,
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (provider, provider_sub)
);

CREATE INDEX IF NOT EXISTS social_identity__person_id__idx
    ON social_identity (person_id);

-- Precomputed aggregate stats backing the /club/{name} page. Written by
-- the club-stats cron in grouped batches; the API serves `stats_json`
-- verbatim with a single-row read, so no aggregate is computed in the
-- request path. Excludes the LLM description, which lives in club_seo.
CREATE TABLE IF NOT EXISTS club_stats (
    club_name TEXT PRIMARY KEY REFERENCES club(name) ON DELETE CASCADE ON UPDATE CASCADE,
    stats_json JSONB NOT NULL,
    computed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Directed club co-membership counts, rebuilt wholesale by the club-overlap
-- cron; both directions stored so a club's related list is one `WHERE
-- club_a = X` PK range scan. The page read query ranks by `overlap /
-- count_members_b` (lift, modulo factors constant across a fixed A).
--
-- `count_members_b` is denormalised here so the read query doesn't need to
-- join `club` per related row -- a join the planner mis-routes through the
-- trigram GiST on club(name), costing ~50 ms per lookup × hundreds of rows.
-- The rebuild owns the snapshot of count_members_b; staleness between
-- rebuilds is bounded by the overlap cron cadence (hours), matching the
-- staleness already accepted for `overlap` itself.
--
-- club_a/club_b deliberately have NO foreign key to club. The FK's per-row
-- RI check on insert routes through the same trigram GiST that breaks the
-- page read; at cap=100 the rebuild emits >100k pairs, and 200k+ FK lookups
-- push the rebuild past its statement timeout. The table is fully derived
-- and rewritten every overlap-cron tick (DELETE + INSERT in one tx) from
-- person_club, which is itself FK'd to club -- so a deleted/renamed club
-- can leave stale rows for at most one cron interval before the next
-- rebuild prunes them.
CREATE TABLE IF NOT EXISTS club_overlap (
    club_a TEXT NOT NULL,
    club_b TEXT NOT NULL,
    overlap INT NOT NULL,
    count_members_b INT NOT NULL,
    PRIMARY KEY (club_a, club_b)
);
-- Defensive upgrade path for environments where club_overlap pre-dates the
-- denormalisation. Default 0 keeps the NOT NULL constraint satisfiable;
-- the next overlap-rebuild tick replaces every row with the correct value.
-- Related-club lists may be empty for the first ~6 hours after upgrade.
ALTER TABLE club_overlap
    ADD COLUMN IF NOT EXISTS count_members_b INT NOT NULL DEFAULT 0;
-- Drop the FKs if upgrading from an earlier schema; they make the rebuild
-- unaffordable at production cap settings. Names follow Postgres's autogen
-- pattern (table_column_fkey).
ALTER TABLE club_overlap DROP CONSTRAINT IF EXISTS club_overlap_club_a_fkey;
ALTER TABLE club_overlap DROP CONSTRAINT IF EXISTS club_overlap_club_b_fkey;

-- Quiz-answer divergences for /club/{name}: questions where this club's
-- agree-rate differs most from the platform average. Maintained by the
-- club-top-answers cron on its own (slow) cadence. Kept out of club_stats
-- because the answer-join is two orders of magnitude more expensive than
-- the demographic aggregation -- mixing them forced the whole stats batch
-- onto the slow cadence and made the cron livelock on initial backfill.
CREATE TABLE IF NOT EXISTS club_top_answers (
    club_name TEXT PRIMARY KEY REFERENCES club(name) ON DELETE CASCADE ON UPDATE CASCADE,
    answers_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    computed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- LLM-generated description for /club/{name}. `description`/`stats_hash`
-- are NULL between eligibility and the first successful generation, or
-- after a failed attempt: the row still exists so generated_at advances
-- and the club rotates to the back of the refresh queue instead of
-- blocking it. `stats_hash` digests the exact facts fed to the model.
CREATE TABLE IF NOT EXISTS club_seo (
    club_name TEXT PRIMARY KEY REFERENCES club(name) ON DELETE CASCADE ON UPDATE CASCADE,
    description TEXT,
    stats_hash TEXT,
    generated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Queue of clubs whose membership has changed since `club_stats` was last
-- computed. Kept in a separate table (rather than a flag on `club`) so the
-- cron's clear doesn't UPDATE the same row that /join-club and /leave-club
-- update for `count_members`: that race raises SerializationFailure on the
-- API side under REPEATABLE READ. Maintained by trigger_mark_club_stats_dirty;
-- seeded with every existing club so the cron computes them all on its
-- first pass.
CREATE TABLE IF NOT EXISTS club_stats_dirty (
    club_name TEXT PRIMARY KEY REFERENCES club(name) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE OR REPLACE FUNCTION
    mark_club_stats_dirty()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO club_stats_dirty (club_name) VALUES (OLD.club_name)
        ON CONFLICT DO NOTHING;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.activated IS DISTINCT FROM NEW.activated THEN
            INSERT INTO club_stats_dirty (club_name) VALUES (NEW.club_name)
            ON CONFLICT DO NOTHING;
        END IF;
        RETURN NEW;
    ELSE
        INSERT INTO club_stats_dirty (club_name) VALUES (NEW.club_name)
        ON CONFLICT DO NOTHING;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER
    trigger_mark_club_stats_dirty
AFTER INSERT OR DELETE OR UPDATE OF activated ON
    person_club
FOR EACH ROW EXECUTE FUNCTION
    mark_club_stats_dirty();

-- Serves `WHERE club_name = X` membership scans for club-stats computation.
-- The person_club PK is (person_id, club_name), so club_name alone has
-- no usable index; the existing GIST index is partial (WHERE activated)
-- and geo-oriented. Without this btree, club-stats batches seq-scan
-- person_club.
CREATE INDEX IF NOT EXISTS idx__person_club__club_name__person_id
    ON person_club(club_name, person_id);
