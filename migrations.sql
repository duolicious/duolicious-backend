ALTER TABLE duo_session ADD COLUMN IF NOT EXISTS push_token TEXT;

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
