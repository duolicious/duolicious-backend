CREATE TABLE IF NOT EXISTS export_data_token (
    token UUID PRIMARY key default gen_random_uuid(),
    person_id INT REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);
