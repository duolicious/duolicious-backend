ALTER TABLE person ADD COLUMN IF NOT EXISTS shadow_banned_at TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'person' AND column_name = 'shadow_banned'
  ) THEN
    UPDATE person SET shadow_banned_at = CASE WHEN shadow_banned THEN now() ELSE NULL END;
  END IF;
END $$;

ALTER TABLE person DROP COLUMN IF EXISTS shadow_banned;
