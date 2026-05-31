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

CREATE TABLE IF NOT EXISTS club_stats (
    club_name TEXT PRIMARY KEY REFERENCES club(name) ON DELETE CASCADE ON UPDATE CASCADE,
    stats_json JSONB NOT NULL,
    computed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Directed co-membership counts; both directions stored so a club's
-- related list is a single PK range scan.
--
-- `count_members_b` is denormalised so the page read doesn't need to join
-- `club` per related row -- the planner mis-routes equality lookups on
-- club(name) through the trigram GiST (~50 ms cold per lookup).
--
-- club_a/club_b deliberately have NO foreign key to club. The per-row RI
-- check routes through that same trigram GiST and at production cap
-- settings the rebuild emits >100k pairs, pushing it past its statement
-- timeout. The table is fully rewritten every overlap-cron tick from
-- person_club (which is FK'd to club), so a deleted or renamed club
-- leaves stale rows for at most one cron interval.
CREATE TABLE IF NOT EXISTS club_overlap (
    club_a TEXT NOT NULL,
    club_b TEXT NOT NULL,
    overlap INT NOT NULL,
    count_members_b INT NOT NULL,
    PRIMARY KEY (club_a, club_b)
);
-- Upgrade path for environments where club_overlap pre-dates the
-- denormalisation. Default 0 keeps the NOT NULL constraint satisfiable;
-- the next overlap-rebuild replaces every row.
ALTER TABLE club_overlap
    ADD COLUMN IF NOT EXISTS count_members_b INT NOT NULL DEFAULT 0;
-- Drop the FKs if upgrading from an earlier schema -- see club_overlap
-- comment above for why they can't stay.
ALTER TABLE club_overlap DROP CONSTRAINT IF EXISTS club_overlap_club_a_fkey;
ALTER TABLE club_overlap DROP CONSTRAINT IF EXISTS club_overlap_club_b_fkey;

CREATE TABLE IF NOT EXISTS club_top_answers (
    club_name TEXT PRIMARY KEY REFERENCES club(name) ON DELETE CASCADE ON UPDATE CASCADE,
    answers_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    computed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- `description`/`stats_hash` are NULL between eligibility and the first
-- successful generation, and after a failed attempt: the row still exists
-- so generated_at advances and the club rotates to the back of the
-- refresh queue instead of blocking it.
CREATE TABLE IF NOT EXISTS club_seo (
    club_name TEXT PRIMARY KEY REFERENCES club(name) ON DELETE CASCADE ON UPDATE CASCADE,
    description TEXT,
    stats_hash TEXT,
    generated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Queue of clubs needing a club_stats refresh. Maintained by
-- trigger_mark_club_stats_dirty. Kept in a separate table (rather than
-- a flag on `club`) so the cron's clear doesn't UPDATE the same row that
-- /join-club and /leave-club update for `count_members` -- that race
-- raises SerializationFailure on the API under REPEATABLE READ.
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

-- Lets the club-top-answers cron index-only-scan (person, question, answer)
-- instead of doing a heap fetch per row -- the PK is (person_id,
-- question_id) without `answer`. ~80 s -> ~3 s per popular club.
CREATE INDEX IF NOT EXISTS idx__answer__person_id_question_id_inc_answer
    ON answer(person_id, question_id) INCLUDE (answer);
