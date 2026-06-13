--
-- Nullable column is a metadata-only add (no rewrite). The partial unique index
-- is built here, not CONCURRENTLY in the backfill, because at migration time
-- url_slug is entirely NULL: the partial predicate (WHERE url_slug IS NOT NULL)
-- indexes zero rows, so the build is instant with no meaningful lock. Building
-- it now (rather than after the backfill) also guarantees the application's
-- slug assignment always has a uniqueness constraint to retry against, closing
-- the window in which concurrent sign-ups could otherwise mint duplicate slugs.

ALTER TABLE person
    ADD COLUMN IF NOT EXISTS url_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx__person__url_slug
    ON person(url_slug)
    WHERE url_slug IS NOT NULL;
