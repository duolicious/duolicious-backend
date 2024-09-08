ALTER TABLE
    person
ADD COLUMN IF NOT EXISTS
    last_nag_time TIMESTAMP DEFAULT to_timestamp(0)
;
