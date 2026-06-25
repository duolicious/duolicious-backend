-- Gold-only "Show My 'Looking For'" privacy setting. Defaults to TRUE so
-- existing profiles keep showing their "Looking For" section until the owner
-- turns it off.
ALTER TABLE person
    ADD COLUMN IF NOT EXISTS show_my_looking_for BOOLEAN NOT NULL DEFAULT TRUE;
