ALTER TABLE
    person
ADD COLUMN IF NOT EXISTS
    last_nag_time TIMESTAMP DEFAULT to_timestamp(0)
;

CREATE TABLE IF NOT EXISTS funding (
    id SMALLINT PRIMARY KEY,
    estimated_end_date TIMESTAMP NOT NULL,

    CONSTRAINT id CHECK (id = 1)
);

INSERT INTO funding (id, estimated_end_date)
VALUES (1, '2024-09-15 14:06:14.128773+00')
ON CONFLICT (id) DO NOTHING;
