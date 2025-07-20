/* 1. Ensure lowercase target clubs exist (canonical form = lower(name)) */
INSERT INTO club (name, count_members)
SELECT DISTINCT lower(name) AS name, 0
FROM club
ON CONFLICT (name) DO NOTHING;

/* 2. Remove duplicate memberships that collapse after lowercasing.
      Strategy: delete any non-lowercase row that has a lowercase twin
      (for the same person & casefolded name). This avoids a full window sort. */
WITH ranked AS (
    SELECT
        ctid,
        person_id,
        club_name,
        lower(club_name) AS lower_name,
        ROW_NUMBER() OVER (
            PARTITION BY person_id, lower(club_name)
            ORDER BY (club_name = lower(club_name)) DESC, club_name ASC, ctid
        ) AS rn
    FROM person_club
)
DELETE FROM person_club p
USING ranked r
WHERE p.ctid = r.ctid
  AND r.rn > 1;

/* 3. Re-point remaining non-lowercase memberships */
UPDATE person_club
SET club_name = lower(club_name)
WHERE club_name <> lower(club_name);

/* 4. Drop obsolete mixed-case parent rows (now unreferenced) */
DELETE FROM club
WHERE name <> lower(name);

/* 5. Recompute member counts for *all* clubs (including zero-member) */
WITH agg AS (
    SELECT c.name, COUNT(pc.person_id)::int AS cnt
    FROM club c
    LEFT JOIN person_club pc ON pc.club_name = c.name
    GROUP BY c.name
)
UPDATE club c
SET count_members = agg.cnt
FROM agg
WHERE c.name = agg.name;
