DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'funding'
      AND column_name  = 'token_hash'
  ) THEN
    EXECUTE 'ALTER TABLE public.funding RENAME COLUMN token_hash TO token_hash_kofi';
  END IF;
END $$;



ALTER TABLE
    funding
ADD COLUMN IF NOT EXISTS
    token_hash_revenuecat
TEXT NOT NULL DEFAULT ''
;
