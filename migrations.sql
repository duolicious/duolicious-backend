alter table
    person
add column if not exists
    flair TEXT[] NOT NULL DEFAULT '{}';

alter table
    person
add column if not exists
    roles TEXT[] NOT NULL DEFAULT '{}';
