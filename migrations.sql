DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'mam_message_person_id_fkey'
    ) THEN
        -- Populate `mam_message.person_id` with values linking it to the `person` table
        UPDATE
            mam_message
        SET
            person_id = person.id
        FROM
            mam_server_user
        JOIN
            person
        ON
            person.uuid = uuid_or_null(mam_server_user.user_name)
        WHERE
            mam_message.user_id = mam_server_user.id
        AND
            mam_message.person_id IS NULL
        ;

        CREATE INDEX IF NOT EXISTS idx__mam_message__person_id__remote_bare_jid__id
            ON mam_message
            (person_id, remote_bare_jid, id);

        -- DELETE orphaned `mam_message`s
        DELETE FROM
            mam_message
        WHERE
            person_id IS NULL
        ;

        -- Now that `mam_message.person_id` is populated, we can add a `NOT NULL`
        -- constraint
        ALTER TABLE
            mam_message
        ALTER COLUMN
            person_id SET NOT NULL
        ;

        -- Now that `mam_message.person_id` points to corresponding values in
        -- `person_id`, we can add a `FOREIGN KEY` constraint
        ALTER TABLE
            mam_message
        ADD CONSTRAINT
            mam_message_person_id_fkey
        FOREIGN KEY
            (person_id)
        REFERENCES
            person(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE;
    END IF;
END$$;

