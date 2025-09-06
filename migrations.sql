ALTER TABLE
    person
ADD COLUMN IF NOT EXISTS
    last_online_time TIMESTAMP NOT NULL DEFAULT NOW()
;

DO $$
BEGIN
    -- change 'public.last' if it's in a different schema
    IF to_regclass('public.last') IS NOT NULL THEN
        UPDATE
            person
        SET
            last_online_time = COALESCE(
                (
                    SELECT
                        to_timestamp(last.seconds)
                    FROM
                        last
                    WHERE
                        last.username = person.uuid::TEXT
                ),
                person.sign_up_time
            )
        ;
    END IF;
END
$$;

DROP TABLE IF EXISTS last;

CREATE INDEX IF NOT EXISTS idx__person__last_online_time
    ON person(last_online_time);
