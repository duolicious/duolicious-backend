#!/usr/bin/env bash

# This test is mostly intended to verify that the `verificationjobrunner` runs
# the jobs. The unit tests for the `verification` Python module are much
# more in-depth.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

q "delete from person"

../util/create-user.sh user1 0 0
../util/create-user.sh user2 0 0
../util/create-user.sh user3 0 1
../util/create-user.sh user4 0 1


echo Set up user 1
q "
update
  person
set
  verified_age = false,
  verified_gender = false,
  verification_level_id = 1
where
  name = 'user1'
"

echo Set up user 2
q "
update
  person
set
  verified_age = true,
  verified_gender = true,
  verification_level_id = 2
where
  name = 'user2'
"


echo Set up user 3
q "
update
  person
set
  verified_age = true,
  verified_gender = true,
  verification_level_id = 2
where
  name = 'user3'
"

q "
update
  photo
set
  verified = true
where
  person_id in (select id from person where name = 'user3')
"

echo Set up user 4
q "
update
  person
set
  verified_age = true,
  verified_gender = true,
  verification_level_id = 3
where
  name = 'user4'
"

q "
update
  photo
set
  verified = false
where
  person_id in (select id from person where name = 'user4')
"

q "$(cat ../../migrations.sql)"

verification_level_ids=$(
  q "
  select
    verification_level_id
  from
    person
  order by
    name
  " | xargs # Neatens whitespace
)

[[ "$verification_level_ids" = '1 2 3 2' ]]
