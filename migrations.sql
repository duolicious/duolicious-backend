ALTER TABLE
    person
ADD COLUMN IF NOT EXISTS
    flair TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE
    person
ADD COLUMN IF NOT EXISTS
    roles TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS unmoderated_person (
    person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    trait TEXT NOT NULL,

    PRIMARY KEY (person_id, trait)
);

CREATE INDEX IF NOT EXISTS idx__person__roles
    ON person
    USING GIN (roles);
