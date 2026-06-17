ALTER TABLE duo_session ADD COLUMN IF NOT EXISTS answers JSONB;

-- TODO: Execute in a follow-up PR
-- DROP FUNCTION IF EXISTS compute_personality_vectors(INT[], INT[], INT[], INT[], INT[], INT[], SMALLINT) CASCADE;
-- DROP FUNCTION IF EXISTS answer_score_vectors(INT, BOOLEAN) CASCADE;
-- DROP TYPE IF EXISTS personality_vectors CASCADE;
-- DROP TYPE IF EXISTS answer_score_vectors CASCADE;
-- 
-- DROP EXTENSION IF EXISTS plpython3u;
