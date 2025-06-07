CREATE TABLE IF NOT EXISTS rude_message (
    person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    message TEXT NOT NULL,

    PRIMARY KEY (person_id, created_at)
);
