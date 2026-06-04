-- One-off finalizer for the `mam_message.message` retirement (PR series step 5).
--
-- Run this ONCE, after the release containing this PR has fully rolled out, so
-- that no running process still writes the legacy `message` column.
--
-- Run it with psql so that each top-level statement executes in its own
-- autocommit transaction:
--
--     PGPASSWORD=... psql -U postgres -h <host> -p 5432 -d duo_api \
--         -f migration/finalize_mam_message.sql
--
-- Do NOT pass --single-transaction: the point of running the statements in
-- separate transactions is that the ~38M-row validation scan (step 3) then runs
-- under a SHARE UPDATE EXCLUSIVE lock that does NOT block concurrent reads or
-- writes. If the constraint were added and validated in the same transaction,
-- the ADD CONSTRAINT's brief ACCESS EXCLUSIVE lock would be held for the whole
-- scan and freeze live chat.
--
-- Every statement is guarded, so the script is idempotent and safe to re-run.

-- 1. Drop the legacy ETF column. Metadata-only; the ACCESS EXCLUSIVE lock is
--    momentary. Safe now that nothing reads or writes it.
ALTER TABLE mam_message DROP COLUMN IF EXISTS message;

-- 2. Introduce the NOT NULL invariant as a NOT VALID CHECK constraint. This is
--    metadata-only (no scan) and immediately enforces the invariant for every
--    new and updated row. Skipped if `body` is already NOT NULL.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_attribute
        WHERE attrelid = 'mam_message'::regclass
          AND attname = 'body'
          AND attnotnull
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'mam_message'::regclass
          AND conname = 'mam_message_body_not_null'
    ) THEN
        ALTER TABLE mam_message
            ADD CONSTRAINT mam_message_body_not_null
            CHECK (body IS NOT NULL) NOT VALID;
    END IF;
END $$;

-- 3. Validate the existing rows. Runs under SHARE UPDATE EXCLUSIVE, which does
--    not block reads or writes. Because this is its own transaction, the scan
--    does not inherit step 2's ACCESS EXCLUSIVE lock.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'mam_message'::regclass
          AND conname = 'mam_message_body_not_null'
          AND NOT convalidated
    ) THEN
        ALTER TABLE mam_message VALIDATE CONSTRAINT mam_message_body_not_null;
    END IF;
END $$;

-- 4. Promote to a real column-level NOT NULL. With the validated CHECK present,
--    Postgres (>= 12) skips the table scan, so the ACCESS EXCLUSIVE lock is
--    momentary.
ALTER TABLE mam_message ALTER COLUMN body SET NOT NULL;

-- 5. Drop the now-redundant CHECK constraint; the column NOT NULL subsumes it.
ALTER TABLE mam_message DROP CONSTRAINT IF EXISTS mam_message_body_not_null;
