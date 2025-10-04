CREATE INDEX IF NOT EXISTS idx__visited__object_person_id__updated_at
    ON visited(object_person_id, updated_at);

CREATE INDEX IF NOT EXISTS idx__visited__subject_person_id__updated_at
    ON visited(subject_person_id, updated_at);

DROP INDEX IF EXISTS idx__visited__object_person_id;
