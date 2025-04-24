DO $$ BEGIN
    CREATE TYPE person_event AS ENUM (
        'added-photo',
        'joined',
        'updated-bio'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;



alter table person add column if not exists
    last_event_time TIMESTAMP NOT NULL DEFAULT NOW();

alter table person add column if not exists
    last_event_name person_event NOT NULL DEFAULT 'joined';

alter table person add column if not exists
    last_event_data JSONB NOT NULL DEFAULT '{}';



CREATE INDEX IF NOT EXISTS idx__person__last_event_time
    ON person(last_event_time);


--- Updates the last few thousand records
update
    person
set
    last_event_time = greatest(last_event_time, sign_up_time)
where
    id > 250000
;
