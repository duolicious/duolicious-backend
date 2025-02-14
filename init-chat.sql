CREATE TABLE IF NOT EXISTS last (
    server varchar(250),
    username varchar(250),
    seconds integer NOT NULL,
    state text NOT NULL,
    PRIMARY KEY (server, username)
);

DO $$ BEGIN
CREATE TYPE mam_direction AS ENUM('I','O');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS mam_server_user(
  id SERIAL UNIQUE PRIMARY KEY,
  server    varchar(250) NOT NULL,
  user_name varchar(250) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS i_mam_server_user_name
    ON mam_server_user
    USING BTREE
    (server, user_name);

CREATE TABLE IF NOT EXISTS mam_message(
  -- Message UID (64 bits)
  -- A server-assigned UID that MUST be unique within the archive.
  id BIGINT NOT NULL,
  user_id INT NOT NULL,
  -- FromJID used to form a message without looking into stanza.
  -- This value will be send to the client "as is".
  from_jid varchar(250) NOT NULL,
  -- The remote JID that the stanza is to (for an outgoing message) or from (for an incoming message).
  -- This field is for sorting and filtering.
  remote_bare_jid varchar(250) NOT NULL,
  remote_resource varchar(250) NOT NULL,
  -- I - incoming, remote_jid is a value from From.
  -- O - outgoing, remote_jid is a value from To.
  -- Has no meaning for MUC-rooms.
  direction mam_direction NOT NULL,
  -- Term-encoded message packet
  message bytea NOT NULL,
  search_body text,
  origin_id varchar,
  PRIMARY KEY(user_id, id)
);

CREATE INDEX IF NOT EXISTS i_mam_message_username_jid_id
    ON mam_message
    USING BTREE
    (user_id, remote_bare_jid, id);

CREATE INDEX IF NOT EXISTS i_mam_message_username_jid_origin_id
    ON mam_message
    USING BTREE
    (user_id, remote_bare_jid, origin_id);


CREATE TABLE IF NOT EXISTS inbox (
    luser VARCHAR(250)               NOT NULL,
    lserver VARCHAR(250)             NOT NULL,
    remote_bare_jid VARCHAR(250)     NOT NULL,
    msg_id VARCHAR(250),
    box VARCHAR(64)                  NOT NULL DEFAULT 'inbox',
    content BYTEA                    NOT NULL,
    timestamp BIGINT                 NOT NULL,
    muted_until BIGINT               DEFAULT 0,
    unread_count INT                 NOT NULL,
    PRIMARY KEY(lserver, luser, remote_bare_jid)
);

CREATE INDEX IF NOT EXISTS i_inbox_timestamp ON inbox USING BTREE(lserver, luser, timestamp);
CREATE INDEX IF NOT EXISTS i_inbox_us_box ON inbox USING BTREE(lserver, luser, box);
CREATE INDEX IF NOT EXISTS i_inbox_box ON inbox (box) WHERE (box = 'bin');

CREATE TABLE IF NOT EXISTS intro_hash (
    hash TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS duo_last_notification (
    username TEXT NOT NULL,
    intro_seconds INT NOT NULL DEFAULT 0,
    chat_seconds INT NOT NULL DEFAULT 0,

    PRIMARY KEY (username)
);

CREATE TABLE IF NOT EXISTS duo_push_token (
    username TEXT NOT NULL,
    token TEXT,

    PRIMARY KEY (username)
);

CREATE INDEX IF NOT EXISTS duo_idx__inbox__timestamp__unread_count
ON inbox(timestamp, unread_count)
WHERE unread_count > 0;

CREATE INDEX IF NOT EXISTS duo_idx__last__username
ON last(username);

CREATE INDEX IF NOT EXISTS duo_idx__last__seconds
ON last(seconds);

CREATE INDEX IF NOT EXISTS duo_idx__mam_message__remote_bare_jid__id
ON mam_message(remote_bare_jid, id)
WHERE direction = 'I';

CREATE INDEX IF NOT EXISTS duo__idx__inbox__remote_bare_jid
ON inbox
USING BTREE(lserver, luser, remote_bare_jid);
