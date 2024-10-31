CREATE INDEX IF NOT EXISTS idx__messaged__object_person_id__subject_person_id
    ON messaged(object_person_id, subject_person_id);

CREATE INDEX IF NOT EXISTS idx__skipped__object_person_id__subject_person_id
    ON skipped(object_person_id, subject_person_id);
