DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'last_pkey'
  ) THEN
    ALTER TABLE last DROP CONSTRAINT last_pkey;
    ALTER TABLE last ADD  CONSTRAINT last_pkey PRIMARY KEY (username);
  END IF;
END$$;

DROP INDEX IF EXISTS duo_idx__last__username;



DROP INDEX IF EXISTS i_mam_server_user_name;

CREATE UNIQUE INDEX IF NOT EXISTS
    idx__mam_server_user__user_name
    ON mam_server_user(user_name);



DROP INDEX IF EXISTS i_mam_message_username_jid_origin_id;



DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inbox_pkey'
  ) THEN
    ALTER TABLE inbox DROP CONSTRAINT inbox_pkey;
    ALTER TABLE inbox ADD  CONSTRAINT inbox_pkey PRIMARY KEY (luser, remote_bare_jid);
  END IF;
END$$;


DROP INDEX IF EXISTS duo__idx__inbox__remote_bare_jid;



DROP INDEX IF EXISTS i_inbox_timestamp;

CREATE INDEX IF NOT EXISTS
    idx__inbox__luser__timestamp
    ON inbox(luser, timestamp);



DROP INDEX IF EXISTS i_inbox_us_box;

CREATE INDEX IF NOT EXISTS
    idx__inbox__luser__box
    ON inbox(luser, box);



DROP INDEX IF EXISTS i_inbox_box;



ALTER TABLE last DROP COLUMN IF EXISTS server;
ALTER TABLE last DROP COLUMN IF EXISTS state;

ALTER TABLE mam_server_user DROP COLUMN IF EXISTS server;

ALTER TABLE mam_message DROP COLUMN IF EXISTS remote_resource;
ALTER TABLE mam_message DROP COLUMN IF EXISTS origin_id;

ALTER TABLE inbox DROP COLUMN IF EXISTS lserver;
ALTER TABLE inbox DROP COLUMN IF EXISTS muted_until;
