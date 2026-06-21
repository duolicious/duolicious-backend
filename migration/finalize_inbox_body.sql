-- One-off finalizer for the `inbox.content` -> `inbox.body` retirement
-- (inbox clean-up step 6), which also promotes `inbox.direction` to NOT NULL.
--
-- Run this ONCE, after the release containing this PR has fully rolled out, so
-- that no running process still reads or writes the legacy `content` column,
-- and after the `inbox.body`/`inbox.direction` back-fill has completed.
--
-- Run it with psql so that each top-level statement executes in its own
-- autocommit transaction:
--
--     PGPASSWORD=... psql -U postgres -h <host> -p 5432 -d duo_api \
--         -f migration/finalize_inbox_body.sql
--
-- Do NOT pass --single-transaction: the point of running the statements in
-- separate transactions is that the multi-million-row validation scans (steps 4
-- and 8) then run under a SHARE UPDATE EXCLUSIVE lock that does NOT block
-- concurrent reads or writes. If a constraint were added and validated in the
-- same transaction, the ADD CONSTRAINT's brief ACCESS EXCLUSIVE lock would be
-- held for the whole scan and freeze live chat.
--
-- Every statement is guarded, so the script is idempotent and safe to re-run.

-- 1. Drop the legacy XMPP-XML column. Metadata-only; the ACCESS EXCLUSIVE lock
--    is momentary. Safe now that nothing reads or writes it.
ALTER TABLE inbox DROP COLUMN IF EXISTS content;

-- 2. Drop the handful of rows the back-fill could not populate a `body` for
--    (malformed legacy `content`), so that `body` can be made NOT NULL. New
--    rows always carry a body. Runs under ROW EXCLUSIVE, which does not block
--    reads or writes. Guarded so re-runs don't pay for a full seq scan (there is
--    no index on `body`) once the column is already NOT NULL.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_attribute
        WHERE attrelid = 'inbox'::regclass
          AND attname = 'body'
          AND attnotnull
    ) THEN
        DELETE FROM inbox WHERE body IS NULL;
    END IF;
END $$;

-- 3. Introduce the `body` NOT NULL invariant as a NOT VALID CHECK constraint.
--    This is metadata-only (no scan) and immediately enforces the invariant for
--    every new and updated row. Skipped if `body` is already NOT NULL.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_attribute
        WHERE attrelid = 'inbox'::regclass
          AND attname = 'body'
          AND attnotnull
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'inbox'::regclass
          AND conname = 'inbox_body_not_null'
    ) THEN
        ALTER TABLE inbox
            ADD CONSTRAINT inbox_body_not_null
            CHECK (body IS NOT NULL) NOT VALID;
    END IF;
END $$;

-- 4. Validate `body`. Runs under SHARE UPDATE EXCLUSIVE, which does not block
--    reads or writes. Because this is its own transaction, the scan does not
--    inherit step 3's ACCESS EXCLUSIVE lock.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'inbox'::regclass
          AND conname = 'inbox_body_not_null'
          AND NOT convalidated
    ) THEN
        ALTER TABLE inbox VALIDATE CONSTRAINT inbox_body_not_null;
    END IF;
END $$;

-- 5. Promote `body` to a real column-level NOT NULL. With the validated CHECK
--    present, Postgres (>= 12) skips the table scan, so the ACCESS EXCLUSIVE
--    lock is momentary.
ALTER TABLE inbox ALTER COLUMN body SET NOT NULL;

-- 6. Drop the now-redundant `body` CHECK constraint; the column NOT NULL
--    subsumes it.
ALTER TABLE inbox DROP CONSTRAINT IF EXISTS inbox_body_not_null;

-- 7. Drop the rows whose `direction` the back-fill could not determine (legacy
--    `content` whose numeric-id JIDs map to no surviving person -- i.e. both
--    participants deleted their accounts), so that `direction` can be made
--    NOT NULL. New rows always carry a direction (the chat service forward-fills
--    it). Guarded like step 2.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_attribute
        WHERE attrelid = 'inbox'::regclass
          AND attname = 'direction'
          AND attnotnull
    ) THEN
        DELETE FROM inbox WHERE direction IS NULL;
    END IF;
END $$;

-- 8. Same NOT VALID CHECK dance for `direction` (the step-7 delete guarantees
--    there are no remaining NULLs to trip validation).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_attribute
        WHERE attrelid = 'inbox'::regclass
          AND attname = 'direction'
          AND attnotnull
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'inbox'::regclass
          AND conname = 'inbox_direction_not_null'
    ) THEN
        ALTER TABLE inbox
            ADD CONSTRAINT inbox_direction_not_null
            CHECK (direction IS NOT NULL) NOT VALID;
    END IF;
END $$;

-- 9. Validate `direction` (lock-light, see step 4).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'inbox'::regclass
          AND conname = 'inbox_direction_not_null'
          AND NOT convalidated
    ) THEN
        ALTER TABLE inbox VALIDATE CONSTRAINT inbox_direction_not_null;
    END IF;
END $$;

-- 10. Promote `direction` to a real column-level NOT NULL (see step 5).
ALTER TABLE inbox ALTER COLUMN direction SET NOT NULL;

-- 11. Drop the now-redundant `direction` CHECK constraint.
ALTER TABLE inbox DROP CONSTRAINT IF EXISTS inbox_direction_not_null;
