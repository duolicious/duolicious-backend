BEGIN;

CREATE TABLE IF NOT EXISTS intro_hash (
    hash TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS duo_last_notification (
    username text NOT NULL,
    intro_seconds INT NOT NULL DEFAULT 0,
    chat_seconds INT NOT NULL DEFAULT 0,

    PRIMARY KEY (username)
);

CREATE INDEX duo_idx__inbox__timestamp__unread_count
ON inbox(timestamp, unread_count)
WHERE unread_count > 0;

CREATE INDEX duo_idx__last__username
ON last(username);

COMMIT;
