Q_SELECT_UNMODERATED_PERSON_ABOUT = """
WITH bot_account AS (
    SELECT
        uuid AS subject_uuid
    FROM
        person
    WHERE
        roles @> ARRAY['bot']
    ORDER BY
        roles
    LIMIT
        1
)
SELECT
    bot_account.subject_uuid AS subject_uuid,
    person.uuid AS object_uuid,
    person.about AS about
FROM
    person
JOIN
    unmoderated_person
ON
    person.id = unmoderated_person.person_id
CROSS JOIN
    bot_account
WHERE
    unmoderated_person.trait = 'about'
"""

Q_DELETE_UNMODERATED_PERSON = """
DELETE FROM
    unmoderated_person
USING
    person
WHERE
    person.id = unmoderated_person.person_id
AND
    person.uuid = %(uuid)s
"""
