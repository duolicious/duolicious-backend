DROP INDEX IF EXISTS idx__mam_server_user__user_name;

DROP TABLE IF EXISTS mam_server_user;

ALTER TABLE mam_message DROP CONSTRAINT mam_message_pkey;

ALTER TABLE mam_message ADD  CONSTRAINT mam_message_pkey PRIMARY KEY (person_id, id);

DROP INDEX IF EXISTS i_mam_message_username_jid_id;

CREATE INDEX IF NOT EXISTS idx__mam_message__person_id__remote_bare_jid__id
    ON mam_message
    (person_id, remote_bare_jid, id);

ALTER TABLE
    mam_message
DROP COLUMN IF EXISTS
    user_id
;
