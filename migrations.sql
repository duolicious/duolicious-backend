-- (5) Retire the legacy ETF `mam_message.message` column.
--
-- The chat service now reads (PR #963) and writes (this PR) only the structured
-- `body`/`stanza_id` columns. During a rolling deploy, pods running the previous
-- release still INSERT `message` while pods running this release omit it, so the
-- column has to stay present but nullable until the rollout finishes. This is a
-- metadata-only change (instant) and is guarded so it remains a no-op both after
-- the rollout (when it's already nullable) and after `message` is finally dropped
-- by migration/finalize_mam_message.sql.
--
-- Dropping the column and promoting `body` to NOT NULL are deliberately NOT done
-- here: `migrations.sql` runs inside a single transaction during deploy, and
-- validating ~38M rows for the NOT NULL constraint there would hold an
-- ACCESS EXCLUSIVE lock for the whole scan, freezing live chat. Those steps live
-- in migration/finalize_mam_message.sql, which is run once after the rollout.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'mam_message' AND column_name = 'message'
    ) THEN
        EXECUTE 'ALTER TABLE mam_message ALTER COLUMN message DROP NOT NULL';
    END IF;
END $$;
