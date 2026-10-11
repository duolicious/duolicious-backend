-- Schema migrations, applied on every boot (see service/api/bootstrap.py),
-- after init-api.sql has created the base schema on a fresh database. Because
-- this file re-runs against an already-migrated database each time, every
-- statement here MUST be idempotent -- use IF NOT EXISTS / IF EXISTS (or an
-- equivalent guard) so re-running is a no-op.
--
-- Every change here must ALSO be made to init-api.sql, which is the schema a
-- fresh database is created from (this file only reaches existing databases).
-- init-api.sql is the source of truth for the current schema; migrations.sql
-- carries the same change to already-created databases.
--
-- Once a migration has run on production, it is generally fine to delete it
-- from this file: init-api.sql already carries the change for fresh databases.


CREATE TABLE IF NOT EXISTS ref_payment (
    provider gold_subscription_provider NOT NULL,
    provider_payment_id TEXT NOT NULL,
    provider_subscription_id TEXT NOT NULL,
    ref TEXT NOT NULL,
    plan TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT NOT NULL,
    paid_at TIMESTAMP NOT NULL,

    PRIMARY KEY (provider, provider_payment_id)
);

CREATE INDEX IF NOT EXISTS ref_payment__provider_subscription_id__idx
    ON ref_payment (provider, provider_subscription_id);

CREATE TABLE IF NOT EXISTS video_job (
    uuid TEXT PRIMARY KEY,
    person_id INT NOT NULL REFERENCES person(id) ON DELETE CASCADE ON UPDATE CASCADE,
    position SMALLINT NOT NULL,
    byte_size INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'uploading'
        CHECK (status IN ('uploading', 'queued', 'running', 'success', 'failure')),
    message TEXT NOT NULL DEFAULT '',
    attempts SMALLINT NOT NULL DEFAULT 0,
    photo_uuid TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    claimed_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx__video_job__person_id__busy
    ON video_job(person_id)
    WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS idx__video_job__person_id__created_at
    ON video_job(person_id, created_at);

CREATE INDEX IF NOT EXISTS idx__video_job__created_at__queued
    ON video_job(created_at)
    WHERE status = 'queued';
