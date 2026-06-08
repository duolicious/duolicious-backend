-- Shadow banning: accounts that behave normally for their owner but appear not
-- to exist from every other user's perspective.
--
-- A constant-default NOT NULL boolean is a metadata-only add in modern Postgres,
-- so no table rewrite.

ALTER TABLE person
    ADD COLUMN IF NOT EXISTS shadow_banned BOOLEAN NOT NULL DEFAULT FALSE;
