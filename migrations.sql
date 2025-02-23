DO
$$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'  -- adjust schema if needed
      AND table_name = 'mam_server_user'
  ) THEN

    -- DELETE orphaned `mam_server_user`s
    DELETE FROM
        mam_server_user
    WHERE
        user_name NOT IN (SELECT DISTINCT uuid FROM person)
    ;

    -- DELETE orphaned `mam_message`s
    DELETE FROM
        mam_message
    WHERE
        user_id NOT IN (SELECT DISTINCT id FROM mam_server_user)
    ;

    -- Add a column to `mam_message` which will reference `person(id)` and replace
    -- `mam_message.user_id`.
    ALTER TABLE
        mam_message
    ADD COLUMN IF NOT EXISTS
        person_id INT
    ;

    -- Populate `mam_message.person_id` with values linking it to the `person` table
    UPDATE
        mam_message
    SET
        person_id = (
            SELECT
                id
            FROM
                person
            WHERE
                uuid = (
                    SELECT
                        user_name
                    FROM
                        mam_server_user
                    WHERE
                        mam_server_user.id = mam_message.user_id
                )
        )
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

    -- The `idx__mam_server_user__user_name` table index is no longer needed
    DROP INDEX IF EXISTS idx__mam_server_user__user_name;

    -- The `mam_server_user` table is no longer needed
    DROP TABLE IF EXISTS mam_server_user;
  END IF;
END
$$;















-- The `mam_message.user_id` column is no longer needed as it has been replace
-- with `mam_message.person_id`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mam_message_pkey'
  ) THEN
    ALTER TABLE mam_message DROP CONSTRAINT mam_message_pkey;
    ALTER TABLE mam_message ADD  CONSTRAINT mam_message_pkey PRIMARY KEY (person_id, id);
  END IF;
END$$;



DROP INDEX IF EXISTS i_mam_message_username_jid_id;


CREATE INDEX IF NOT EXISTS idx__mam_message__person_id__remote_bare_jid__id
    ON mam_message
    (person_id, remote_bare_jid, id);


ALTER TABLE
    mam_message
DROP COLUMN IF EXISTS
    user_id
;
