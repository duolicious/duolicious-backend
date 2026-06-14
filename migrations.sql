--
-- The url_slug column was added (nullable) and backfilled by a previous
-- release, and every person row now has a slug: it's assigned in the same
-- transaction that inserts the person at finish-onboarding. Promote it to NOT
-- NULL now that the backfill is complete. Idempotent: a no-op once applied.
--
-- This migration FAILS if any url_slug is still NULL, so it must only ship
-- after the backfill has run to completion.

ALTER TABLE person
    ALTER COLUMN url_slug SET NOT NULL;

-- Onboardees reserve their url_slug here as they pick a display name, so
-- finish-onboarding mints exactly the slug the user was shown and concurrent
-- sign-ups treat it as taken. Nullable (not every onboardee has reached the
-- name step); the partial unique index keeps two onboardees from reserving the
-- same slug. Metadata-only add over an all-NULL column, so the index is instant.

ALTER TABLE onboardee
    ADD COLUMN IF NOT EXISTS url_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx__onboardee__url_slug
    ON onboardee(url_slug)
    WHERE url_slug IS NOT NULL;
