ALTER TABLE duo_session ADD COLUMN IF NOT EXISTS push_token TEXT;

ALTER TABLE duo_session
    ADD COLUMN IF NOT EXISTS last_online_time TIMESTAMP NOT NULL DEFAULT NOW();

-- Existing sessions predate per-session presence tracking, so the column
-- default (NOW()) would falsely mark every dormant session as having just been
-- online and could suppress notifications. Backfill from the person's real
-- last-online time so the value reflects actual activity.
UPDATE duo_session
SET last_online_time = person.last_online_time
FROM person
WHERE duo_session.person_id = person.id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'person' AND column_name = 'push_token'
    ) THEN
        UPDATE duo_session
        SET push_token = person.push_token
        FROM person
        WHERE
            duo_session.person_id = person.id AND
            duo_session.signed_in AND
            person.push_token IS NOT NULL;
    END IF;
END $$;

ALTER TABLE person DROP COLUMN IF EXISTS push_token;
