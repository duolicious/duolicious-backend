#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

q "delete from person"
q "delete from person_club"

../util/create-user.sh user1 0 0
../util/create-user.sh user2 0 0

user1_id=$(q "select id from person where email = 'user1@example.com'")
user2_id=$(q "select id from person where email = 'user2@example.com'")

check_consistency () {
  [[
    $(q " \
      select count(*) \
      from \
        person \
      join
        person_club \
      on \
        person_club.person_id = person.id \
      where \
        person_club.activated = person.activated \
      and \
        person_club.gender_id = person.gender_id \
      and \
        person_club.coordinates = person.coordinates") = 2
  ]]
}

check_uniqueness () {
  for column in gender_id activated coordinates
  do
    local val1=$(q "select ${column} from person where id = ${user1_id}")
    local val2=$(q "select ${column} from person where id = ${user2_id}")

    [[ "$val1" != "$val2" ]]

    local val1=$(
      q "select ${column} from person_club where person_id = ${user1_id}")
    local val2=$(
      q "select ${column} from person_club where person_id = ${user2_id}")

    [[ "$val1" != "$val2" ]]
  done
}

assume_role user1
jc POST /join-club -d '{ "name": "Anime" }'

assume_role user2
jc POST /join-club -d '{ "name": "Manga" }'

echo 'Triggers were triggered after creating the club'
check_consistency

echo 'Trigger: activated'
q "update person set activated = false where name = 'user1'"
check_consistency

q "update person set activated = true where name = 'user1'"
check_consistency

echo 'Trigger: gender_id'
q "update person set gender_id = 1 where name = 'user1'"
check_consistency

q "update person set gender_id = 2 where name = 'user1'"
check_consistency

echo 'Trigger: coordinates'
q "update person set \
  coordinates = (select coordinates from location where id = 1) \
  where name = 'user1'"
check_consistency

q "update person set \
  coordinates = (select coordinates from location where id = 2) \
  where name = 'user1'"
check_consistency

echo 'Triggers update the right rows'
q "update person set activated = false where name = 'user1'"
q "update person set activated = true where name = 'user2'"

q "update person set gender_id = 1 where name = 'user1'"
q "update person set gender_id = 2 where name = 'user2'"

q "update person set \
  coordinates = (select coordinates from location where id = 1) \
  where name = 'user1'"
q "update person set \
  coordinates = (select coordinates from location where id = 2) \
  where name = 'user2'"

check_uniqueness
