CREATE OR REPLACE FUNCTION age_gap_acceptability_odds(
    a double precision,
    b double precision
)
RETURNS double precision
LANGUAGE SQL
IMMUTABLE
STRICT
AS $$
  SELECT exp(-8.0 * d * d)
  FROM (
        SELECT
          1.0 - CASE
                  WHEN a > b
                       THEN (b - 13)::float8 / (a - 13)
                       ELSE (a - 13)::float8 / (b - 13)
                END
          AS d
       ) AS s;
$$;
