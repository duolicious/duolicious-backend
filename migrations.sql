-- TODO: Probably need to index on audio_uuid to efficiently delete audio files
-- TODO: Test this migration on copy of prod DB

ALTER TABLE
    mam_message
ADD COLUMN IF NOT EXISTS
    audio_uuid TEXT
;

CREATE INDEX IF NOT EXISTS idx__mam_message__audio_uuid
    ON mam_message
    (audio_uuid);
