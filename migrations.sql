--------------------------------------------------------------------------------
-- 1) person.last_visitor_check_time
--------------------------------------------------------------------------------

-- Add the column (nullable first to avoid wide table rewrite on large tables)
ALTER TABLE person
    ADD COLUMN IF NOT EXISTS last_visitor_check_time TIMESTAMP;

-- Backfill any NULLs with the current timestamp
UPDATE person
SET last_visitor_check_time = NOW()
WHERE last_visitor_check_time IS NULL;

-- Enforce NOT NULL and set the default for future inserts
ALTER TABLE person
    ALTER COLUMN last_visitor_check_time SET NOT NULL,
    ALTER COLUMN last_visitor_check_time SET DEFAULT NOW();

--------------------------------------------------------------------------------
-- 2) visited table
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS visited (
    subject_person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    object_person_id  INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),

    PRIMARY KEY (subject_person_id, object_person_id)
);

--------------------------------------------------------------------------------
-- 3) visited indexes
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx__visited__object_person_id
    ON visited(object_person_id);
