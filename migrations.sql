CREATE INDEX IF NOT EXISTS
    idx__person_club__activated__club_name__person_id
    ON person_club (club_name, person_id)
    WHERE activated;
