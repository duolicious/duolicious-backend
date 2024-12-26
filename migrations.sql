ALTER TABLE
    funding
ADD COLUMN IF NOT EXISTS
    token_hash
TEXT NOT NULL DEFAULT
    '';

ALTER TABLE
    funding
ADD COLUMN IF NOT EXISTS
    cost_per_month_usd
FLOAT NOT NULL DEFAULT
    360.0;

ALTER TABLE
    funding
ALTER COLUMN
    cost_per_month_usd
DROP DEFAULT;
