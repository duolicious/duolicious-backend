ALTER TABLE IF EXISTS verification_job
    ALTER COLUMN expires_at
    SET DEFAULT (NOW() + INTERVAL '3 days');
