ALTER TABLE
    person
ADD COLUMN IF NOT EXISTS
    browse_invisibly BOOLEAN NOT NULL DEFAULT FALSE
;

-- Add visited.invisible to track invisible visits
ALTER TABLE
    visited
ADD COLUMN IF NOT EXISTS
    invisible BOOLEAN NOT NULL DEFAULT FALSE
;

UPDATE
    visited
SET
    invisible = person.hide_me_from_strangers
FROM
    person
WHERE
    person.id = visited.subject_person_id
;
