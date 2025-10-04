CREATE INDEX IF NOT EXISTS idx__visited__object_person_id__updated_at
    ON visited(object_person_id, updated_at);

CREATE INDEX IF NOT EXISTS idx__visited__subject_person_id__updated_at
    ON visited(subject_person_id, updated_at);

DROP INDEX IF EXISTS idx__visited__object_person_id;

-- Add new columns to person for notification tracking and push token storage
ALTER TABLE person ADD COLUMN IF NOT EXISTS intro_seconds INT NOT NULL DEFAULT 0;
ALTER TABLE person ADD COLUMN IF NOT EXISTS chat_seconds INT NOT NULL DEFAULT 0;
ALTER TABLE person ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Backfill from duo_last_notification into person
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'duo_last_notification'
  ) THEN
    UPDATE person p
    SET
      intro_seconds = COALESCE(d.intro_seconds, p.intro_seconds),
      chat_seconds  = COALESCE(d.chat_seconds,  p.chat_seconds)
    FROM duo_last_notification d
    WHERE p.uuid::text = d.username;
  END IF;
END $$;

-- Backfill from duo_push_token into person
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'duo_push_token'
  ) THEN
    UPDATE person p
    SET push_token = d.token
    FROM duo_push_token d
    WHERE p.uuid::text = d.username;
  END IF;
END $$;

-- Drop legacy tables now that data is migrated
DROP TABLE IF EXISTS duo_last_notification;
DROP TABLE IF EXISTS duo_push_token;
