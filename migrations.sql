-- TODO: Delete
CREATE INDEX IF NOT EXISTS idx__messaged__object_person_id__subject_person_id__created_at
    ON messaged(object_person_id, subject_person_id, created_at);

DROP INDEX IF EXISTS idx__messaged__object_person_id__subject_person_id;
