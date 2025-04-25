CREATE INDEX IF NOT EXISTS idx__duo_session__person_id
    ON duo_session(person_id);

ALTER TYPE person_event
    ADD VALUE IF NOT EXISTS 'added-voice-bio';
