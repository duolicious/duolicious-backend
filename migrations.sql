-- Used to time notifications appropriately
CREATE TABLE IF NOT EXISTS presence_histogram (
    person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    dow SMALLINT NOT NULL, -- 0=Sun .. 6=Sat
    hour SMALLINT NOT NULL, -- 0 .. 23 (UTC)
    score FLOAT4 NOT NULL,
    updated_at TIMESTAMP NOT NULL,

    PRIMARY KEY (person_id, dow, hour)
);
