-- Denormalize human-readable location names onto person
ALTER TABLE person
ADD COLUMN IF NOT EXISTS location_short_friendly TEXT,
ADD COLUMN IF NOT EXISTS location_long_friendly  TEXT;

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
    location_short_friendly = COALESCE(p.location_short_friendly, n.location_short),
    location_long_friendly  = COALESCE(p.location_long_friendly,  n.location_long)
FROM nearest n
WHERE p.id = n.person_id;

-- Ensure non-null for new rows by defaulting to empty string to simplify selects
ALTER TABLE person
ALTER COLUMN location_short_friendly SET NOT NULL;
ALTER TABLE person
ALTER COLUMN location_long_friendly  SET NOT NULL;
