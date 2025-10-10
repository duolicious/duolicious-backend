#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

club_idempotence () {
  echo 'Joining a club twice is the same as joining it once'

  q "delete from person"
  q "delete from person_club"
  q "delete from club"

  ../util/create-user.sh user1 0 0
  ../util/create-user.sh user2 0 0

  assume_role user1
  jc POST /join-club -d '{ "name": "my-club-1" }'
  jc POST /join-club -d '{ "name": "my-club-1" }'

  assume_role user2
  results=$(c GET '/search-clubs?q=my-club')
  expected=$(
    jq -r . <<< "[ \
      {\"count_members\": 1, \"name\": \"my-club-1\"}, \
      {\"count_members\": 0, \"name\": \"my-club\"}
    ]"
  )
  [[ "$results" == "$expected" ]]
}

club_quota_without_gold () {
  echo 'You can join no more than 50 clubs without gold'

  q "delete from person"
  q "delete from person_club"
  q "delete from club"

  ../util/create-user.sh user1 0 0
  ../util/create-user.sh user2 0 0

  q "update person set has_gold = false"

  assume_role user1
  for i in {1..50}
  do
    jc POST /join-club -d '{ "name": "my-club-'$i'" }'
  done
  ! jc POST /join-club -d '{ "name": "my-club-101" }' || exit 1

  assume_role user2
  jc POST /join-club -d '{ "name": "my-club-1" }'
}

club_quota_with_gold () {
  echo 'You can join no more than 100 clubs with gold'

  q "delete from person"
  q "delete from person_club"
  q "delete from club"

  ../util/create-user.sh user1 0 0
  ../util/create-user.sh user2 0 0

  assume_role user1
  for i in {1..100}
  do
    jc POST /join-club -d '{ "name": "my-club-'$i'" }'
  done
  ! jc POST /join-club -d '{ "name": "my-club-101" }' || exit 1

  assume_role user2
  jc POST /join-club -d '{ "name": "my-club-1" }'
}

club_count_when_deleted () {
  echo 'Club count(s) decrement when member deletes their account'

  q "delete from person"
  q "delete from person_club"
  q "delete from club"

  ../util/create-user.sh user1 0 0
  ../util/create-user.sh user2 0 0
  ../util/create-user.sh user3 0 0
  ../util/create-user.sh user4 0 0

  assume_role user1
  jc POST /join-club -d '{ "name": "my-club-1" }'
  jc POST /join-club -d '{ "name": "my-club-2" }'
  jc POST /join-club -d '{ "name": "my-club-3" }'
  jc POST /join-club -d '{ "name": "my-club-4" }'

  assume_role user2
  jc POST /join-club -d '{ "name": "my-club-1" }'
  jc POST /join-club -d '{ "name": "my-club-2" }'

  assume_role user3
  jc POST /join-club -d '{ "name": "my-club-2" }'
  jc POST /join-club -d '{ "name": "my-club-3" }'

  assume_role user4
  results=$(c GET '/search-clubs?q=my-club')
  expected=$(
    jq -r . <<< "[ \
      {\"count_members\": 3, \"name\": \"my-club-2\"}, \
      {\"count_members\": 2, \"name\": \"my-club-1\"}, \
      {\"count_members\": 2, \"name\": \"my-club-3\"}, \
      {\"count_members\": 1, \"name\": \"my-club-4\"}, \
      {\"count_members\": 0, \"name\": \"my-club\"} \
    ]"
  )
  [[ "$results" == "$expected" ]]

  assume_role user3
  c DELETE /account

  assume_role user4

  results=$(c GET '/search-clubs?q=my-club')
  expected=$(
    jq -r . <<< "[ \
      {\"count_members\": 2, \"name\": \"my-club-1\"}, \
      {\"count_members\": 2, \"name\": \"my-club-2\"}, \
      {\"count_members\": 1, \"name\": \"my-club-3\"}, \
      {\"count_members\": 1, \"name\": \"my-club-4\"}, \
      {\"count_members\": 0, \"name\": \"my-club\"} \
    ]"
  )
  [[ "$results" == "$expected" ]]
}

club_count_when_activated_or_deactivated () {
  echo 'Club count(s) decrement when member (de)activates their account'

  q "delete from person"
  q "delete from person_club"
  q "delete from club"

  ../util/create-user.sh user1 0 0
  ../util/create-user.sh user2 0 0
  ../util/create-user.sh user3 0 0
  ../util/create-user.sh user4 0 0

  assume_role user1
  jc POST /join-club -d '{ "name": "my-club-1" }'
  jc POST /join-club -d '{ "name": "my-club-2" }'
  jc POST /join-club -d '{ "name": "my-club-3" }'
  jc POST /join-club -d '{ "name": "my-club-4" }'

  assume_role user2
  jc POST /join-club -d '{ "name": "my-club-1" }'
  jc POST /join-club -d '{ "name": "my-club-2" }'

  assume_role user3
  jc POST /join-club -d '{ "name": "my-club-2" }'
  jc POST /join-club -d '{ "name": "my-club-3" }'

  assume_role user4
  results=$(c GET '/search-clubs?q=my-club')
  expected=$(
    jq -r . <<< "[ \
      {\"count_members\": 3, \"name\": \"my-club-2\"}, \
      {\"count_members\": 2, \"name\": \"my-club-1\"}, \
      {\"count_members\": 2, \"name\": \"my-club-3\"}, \
      {\"count_members\": 1, \"name\": \"my-club-4\"}, \
      {\"count_members\": 0, \"name\": \"my-club\"} \
    ]"
  )
  [[ "$results" == "$expected" ]]

  assume_role user3
  c POST /deactivate

  assume_role user4

  results=$(c GET '/search-clubs?q=my-club')
  expected=$(
    jq -r . <<< "[ \
      {\"count_members\": 2, \"name\": \"my-club-1\"}, \
      {\"count_members\": 2, \"name\": \"my-club-2\"}, \
      {\"count_members\": 1, \"name\": \"my-club-3\"}, \
      {\"count_members\": 1, \"name\": \"my-club-4\"}, \
      {\"count_members\": 0, \"name\": \"my-club\"} \
    ]"
  )
  [[ "$results" == "$expected" ]]

  assume_role user3 # Activate account again

  assume_role user4
  results=$(c GET '/search-clubs?q=my-club')
  expected=$(
    jq -r . <<< "[ \
      {\"count_members\": 3, \"name\": \"my-club-2\"}, \
      {\"count_members\": 2, \"name\": \"my-club-1\"}, \
      {\"count_members\": 2, \"name\": \"my-club-3\"}, \
      {\"count_members\": 1, \"name\": \"my-club-4\"}, \
      {\"count_members\": 0, \"name\": \"my-club\"} \
    ]"
  )
  [[ "$results" == "$expected" ]]
}

banned_clubs () {
  echo "banned clubs aren't displayed and are unjoinable"

  q "delete from person"
  q "delete from person_club"
  q "delete from club"

  ../util/create-user.sh user1 0 0

  assume_role user1

  results=$(c GET '/search-clubs?q=I+HATE+MINORITIES')
  expected='[]'
  [[ "$results" == "$expected" ]]

  results=$(c GET '/search-clubs?q=did+you+know+I+HATE+MINORITIES')
  expected='[]'
  [[ "$results" == "$expected" ]]

  ! jc POST /join-club -d '{ "name": "I HATE MINORITIES" }' || exit 1
  ! jc POST /join-club -d '{ "name": "did you know I HATE MINORITIES" }' || exit 1
}

empty_club_search_string () {
  echo 'An empty search string returns the most popular clubs'

  q "delete from person"
  q "delete from person_club"
  q "delete from club"

  ../util/create-user.sh user1 0 0
  ../util/create-user.sh user2 0 0
  ../util/create-user.sh user3 0 0
  ../util/create-user.sh user4 0 0

  assume_role user1
  jc POST /join-club -d '{ "name": "my-club-1" }'
  jc POST /join-club -d '{ "name": "my-club-2" }'
  jc POST /join-club -d '{ "name": "my-club-3" }'

  assume_role user2
  jc POST /join-club -d '{ "name": "my-club-1" }'
  jc POST /join-club -d '{ "name": "my-club-2" }'

  assume_role user3
  jc POST /join-club -d '{ "name": "my-club-1" }'

  assume_role user4

  results=$(SESSION_TOKEN='' c GET '/search-public-clubs')
  expected=$(
    jq -r . <<< "[ \
      {\"count_members\": 3, \"name\": \"my-club-1\"}, \
      {\"count_members\": 2, \"name\": \"my-club-2\"}, \
      {\"count_members\": 1, \"name\": \"my-club-3\"} \
    ]"
  )
  [[ "$results" == "$expected" ]]
}

public_club_search () {
  echo 'Public club search returns something'

  q "delete from person"
  q "delete from person_club"
  q "delete from club"

  ../util/create-user.sh user1 0 0
  ../util/create-user.sh user2 0 0
  ../util/create-user.sh user3 0 0
  ../util/create-user.sh user4 0 0

  assume_role user1
  jc POST /join-club -d '{ "name": "my-club-1" }'
  jc POST /join-club -d '{ "name": "my-club-2" }'
  jc POST /join-club -d '{ "name": "my-club-3" }'

  assume_role user2
  jc POST /join-club -d '{ "name": "my-club-1" }'
  jc POST /join-club -d '{ "name": "my-club-2" }'

  assume_role user3
  jc POST /join-club -d '{ "name": "my-club-1" }'

  assume_role user4

  results1=$(c GET '/search-clubs?q=my-club-3')
  results2=$(SESSION_TOKEN='' c GET '/search-public-clubs?q=my-club-3')
  expected=$(
    jq -r . <<< "[ \
      {\"count_members\": 1, \"name\": \"my-club-3\"}, \
      {\"count_members\": 3, \"name\": \"my-club-1\"}, \
      {\"count_members\": 2, \"name\": \"my-club-2\"} \
    ]"
  )

  [[ "$results1" == "$expected" ]]
  [[ "$results1" == "$results2" ]]
}

public_club_search
empty_club_search_string
club_idempotence
club_quota_without_gold
club_quota_with_gold
club_count_when_deleted
club_count_when_activated_or_deactivated
banned_clubs
