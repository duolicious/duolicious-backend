ALTER TABLE
    person
ADD COLUMN IF NOT EXISTS
    privacy_verification_level_id SMALLINT REFERENCES verification_level(id) NOT NULL DEFAULT 1
;
