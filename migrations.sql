CREATE INDEX CONCURRENTLY IF NOT EXISTS idx__mam_message__person_id__remote_bare_jid__id
    ON mam_message
    (person_id, remote_bare_jid, id);

-- Populate `mam_message.person_id` with values linking it to the `person` table
CREATE PROCEDURE update_messages_proc()
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_updated INTEGER := 0;
    v_rows_updated INTEGER;
BEGIN
    LOOP
        WITH mam_message_to_update AS (
            SELECT
                mam_message.user_id,
                mam_message.id
            FROM
                mam_message
            WHERE
                mam_message.person_id IS NULL
            LIMIT
                1000
        ), updated_mam_message AS (
            SELECT
                mam_message_to_update.user_id,
                mam_message_to_update.id,
                COALESCE(person.id, -1) AS new_person_id
            FROM
                mam_message_to_update
            LEFT JOIN
                mam_server_user
            ON
                mam_message_to_update.user_id = mam_server_user.id
            LEFT JOIN
                person
            ON
                person.uuid = uuid_or_null(mam_server_user.user_name)
        )
        UPDATE
            mam_message
        SET
            person_id = updated_mam_message.new_person_id
        FROM
            updated_mam_message
        WHERE
            mam_message.id = updated_mam_message.id
          AND
            mam_message.user_id = updated_mam_message.user_id
        ;

        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        v_total_updated := v_total_updated + v_rows_updated;
        RAISE NOTICE 'Total rows updated: %', v_total_updated;

        IF v_rows_updated = 0 THEN
            COMMIT;  -- Commit any remaining work before exiting
            EXIT;
        END IF;

        COMMIT;  -- Commit the current batch; a new transaction will start automatically for the next iteration
    END LOOP;
END;
$$;

CALL update_messages_proc();

DROP PROCEDURE IF EXISTS update_messages_proc();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'mam_message_person_id_fkey'
    ) THEN
        -- DELETE orphaned `mam_message`s
        DELETE FROM
            mam_message
        WHERE
            person_id = -1
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

