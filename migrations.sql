-- Denormalize human-readable location names onto person
ALTER TABLE person
ADD COLUMN IF NOT EXISTS location_short TEXT,
ADD COLUMN IF NOT EXISTS location_long  TEXT;

-- Backfill existing rows using nearest location by coordinates
WITH nearest AS (
    SELECT
        p.id AS person_id,
        l.short_friendly AS location_short,
        l.long_friendly  AS location_long
    FROM person p
    JOIN LATERAL (
        SELECT short_friendly, long_friendly
        FROM location
        ORDER BY location.coordinates <-> p.coordinates
        LIMIT 1
    ) l ON TRUE
)
UPDATE person AS p
SET
    location_short = COALESCE(p.location_short, n.location_short),
    location_long  = COALESCE(p.location_long,  n.location_long)
FROM nearest n
WHERE p.id = n.person_id;

-- Ensure non-null for new rows by defaulting to empty string to simplify selects
ALTER TABLE person
ALTER COLUMN location_short SET DEFAULT '';
ALTER TABLE person
ALTER COLUMN location_long  SET DEFAULT '';

-- Optional: simple btree indexes for lookups/filtering
CREATE INDEX IF NOT EXISTS idx__person__location_short ON person(location_short);
CREATE INDEX IF NOT EXISTS idx__person__location_long  ON person(location_long);
