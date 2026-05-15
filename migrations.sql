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
