BEGIN;

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

COMMIT;
