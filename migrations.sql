-- TODO: Delete
UPDATE
    person
SET
    verification_level_id =
        CASE
            WHEN
                EXISTS (
                    SELECT
                        1
                    FROM
                        photo
                    WHERE
                        person_id = person.id
                    AND
                        verified
                )
            THEN
                3

            ELSE
                2
        END
WHERE
    verification_level_id <> 1
