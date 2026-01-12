CREATE TABLE IF NOT EXISTS service_login (
    password_hash TEXT NOT NULL,
    person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,

    PRIMARY KEY (person_id)
);
