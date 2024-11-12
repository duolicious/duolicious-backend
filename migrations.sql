CREATE TABLE IF NOT EXISTS audio (
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    position INT NOT NULL,
    uuid TEXT NOT NULL,

    PRIMARY KEY (person_id, position)
);

CREATE TABLE IF NOT EXISTS undeleted_audio (
    uuid TEXT PRIMARY KEY
);
