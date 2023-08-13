#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

# TODO: Set search preferences via API calls instead of queries
# TODO: Performance testing. Should only need 1000 users...

setup () {
  q "delete from duo_session"
  q "delete from person"
  q "delete from onboardee"
  q "delete from photo_graveyard"

  ../util/create-user.sh searcher 0
  ../util/create-user.sh user1 0
  ../util/create-user.sh user2 0

  local response=$(jc POST /request-otp -d '{ "email": "searcher@example.com" }')
  SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')
  jc POST /check-otp -d '{ "otp": "000000" }'
}

set_basic () {
  local user=$1
  local basic_name=$2
  local basic_value=$3
  local enum=${4:-$basic_name}

  local query="
  update person
  set ${basic_name}_id = (select id from $enum where name = '$basic_value')
  where email = '$user@example.com'
  "

  q "$query"
}

exclude_basic () {
  local user=$1
  local basic_name=$2
  local basic_value=$3
  local enum=${4:-$basic_name}

  local query="
  delete from search_preference_${basic_name}
  where
    person_id = (select id from person where email = '${user}@example.com')
  and
    ${basic_name}_id = (select id from $enum where name = '${basic_value}')
  "

  q "$query"
}

search_names () {
  local n=${1:-10}
  local o=${2:-0}
  c GET "/search?n=${n}&o=${o}" | jq -r '[.[].name] | sort | join(" ")'
}

assert_search_names () {
  local names=$1
  local n=${2:-10}
  local o=${3:-0}
  [[ "$(search_names "${n}" "${o}")" = "${names}" ]]
}

test_basic () {
  local basic_name=$1
  local basic_value=$2
  local enum=${3:-$basic_name}

  setup
  assert_search_names 'user1 user2'
  set_basic user1 "$basic_name" "$basic_value" "$enum"
  exclude_basic searcher "$basic_name" "$basic_value" "$enum"
  assert_search_names 'user2'
}

test_range () {
  local basic_name=$1

  # Neither min age nor max age
  assert_search_names 'user1 user2'

  # Min ${basic_name}
  q "
  update search_preference_${basic_name} set min_${basic_name} = 50
  where person_id = (select id from person where email = 'searcher@example.com')"
  assert_search_names 'user1 user2'
  q "
  update search_preference_${basic_name} set min_${basic_name} = 51
  where person_id = (select id from person where email = 'searcher@example.com')"
  assert_search_names 'user2'

  # Unset preferences
  q "update search_preference_${basic_name} set min_${basic_name} = null"

  # Max ${basic_name}
  q "
  update search_preference_${basic_name} set max_${basic_name} = 60
  where person_id = (select id from person where email = 'searcher@example.com')"
  assert_search_names 'user1 user2'
  q "
  update search_preference_${basic_name} set max_${basic_name} = 59
  where person_id = (select id from person where email = 'searcher@example.com')"
  assert_search_names 'user1'

  # Min ${basic_name} and max ${basic_name} together
  q "
  update search_preference_${basic_name} set min_${basic_name} = 50
  where person_id = (select id from person where email = 'searcher@example.com')"
  q "
  update search_preference_${basic_name} set max_${basic_name} = 60
  where person_id = (select id from person where email = 'searcher@example.com')"
  assert_search_names 'user1 user2'

  q "
  update search_preference_${basic_name} set min_${basic_name} = 51
  where person_id = (select id from person where email = 'searcher@example.com')"
  q "
  update search_preference_${basic_name} set max_${basic_name} = 59
  where person_id = (select id from person where email = 'searcher@example.com')"
  assert_search_names ''
}

test_basic_age () {
  setup
  q "
  update person set date_of_birth = (now() - interval '50 years')::date
  where email = 'user1@example.com'"
  q "
  update person set date_of_birth = (now() - interval '60 years')::date
  where email = 'user2@example.com'"

  test_range age
}

test_basic_height () {
  setup
  q "update person set height_cm = 50 where email = 'user1@example.com'"
  q "update person set height_cm = 60 where email = 'user2@example.com'"

  test_range height_cm
}

test_search_cache () {
  setup
  q "delete from search_cache"

  # Ensure `user1` is ranked first in search results
  q "
  update person set personality = array_full(47, 1)
  where email IN ('searcher@example.com', 'user1@example.com')"

  assert_search_names ''            10 1
  assert_search_names 'user1 user2' 10 0
  assert_search_names       'user2' 10 1

  set_basic user2 gender Man
  exclude_basic searcher gender Man

  assert_search_names 'user2' 10 1
  assert_search_names 'user1' 10 0
  assert_search_names      '' 10 1
}

test_quiz_search () {
  setup

  local searcher_id=$(q "select id from person where email = 'searcher@example.com'")
  local user1_id=$(q "select id from person where email = 'user1@example.com'")
  local user2_id=$(q "select id from person where email = 'user2@example.com'")

  q "
  update person
  set has_profile_picture_id = (select id from yes_no where name = 'Yes')"

  # user1 has the higher match percentage
  q "
  update person set personality = array_full(47, 1)
  where id IN (${searcher_id}, ${user1_id})"
  response1=$(c GET /search | jq -r '[.[].prospect_person_id] | join(" ")')
  [[ "$response1" = "$user1_id" ]]

  # user1 has the lower match percentage
  q "
  update person set personality = array_full(47, -1)
  where id = ${user1_id}"
  response2=$(c GET /search | jq -r '[.[].prospect_person_id] | join(" ")')
  [[ "$response2" = "$user2_id" ]]

  # user2 has the highest match percentage but user2 is blocked by searcher
  q "
  insert into blocked (subject_person_id, object_person_id)
  values (${searcher_id}, ${user2_id})"
  response3=$(c GET /search | jq -r '[.[].prospect_person_id] | join(" ")')
  [[ "$response3" = "" ]]

  # user2 has the highest match percentage but searcher is blocked by user2
  q "
  update blocked
  set
    subject_person_id = object_person_id,
    object_person_id  = subject_person_id"
  response4=$(c GET /search | jq -r '[.[].prospect_person_id] | join(" ")')
  [[ "$response4" = "" ]]
}

test_deactivated () {
  setup

  assert_search_names 'user1 user2' 10 0

  q "
  update person
  set activated = FALSE
  where email = 'user1@example.com'"

  assert_search_names 'user2' 10 0

  q "
  update person
  set activated = TRUE
  where email = 'user1@example.com'"

  assert_search_names 'user1 user2' 10 0
}

test_photos_promoted () {
  setup
  ../util/create-user.sh user3 0
  ../util/create-user.sh user4 0

  assert_search_names 'user1 user2 user3 user4' 10 0

  q "
  update person
  set personality = array_full(47, 9e-2)
  where email IN ('searcher@example.com', 'user1@example.com')"
  q "
  update person
  set personality = array_full(47, 8e-2)
  where email IN ('user2@example.com')"
  q "
  update person
  set personality = array_full(47, 7e-2)
  where email IN ('user3@example.com')"
  q "
  update person
  set personality = array_full(47, 6e-2)
  where email IN ('user4@example.com')"

  response1=$(c GET '/search?n=10&o=0' | jq -r '[.[].name] | join(" ")')

  q "
  insert into photo (person_id, position, uuid)
  SELECT
    (select id from person where email = 'user3@example.com'),
    1,
    'user3-uuid'"
  q "
  insert into photo (person_id, position, uuid)
  select
    (select id from person where email = 'user4@example.com'),
    1,
    'user4-uuid'"

  response2=$(c GET '/search?n=10&o=0' | jq -r '[.[].name] | join(" ")')

  [[ "$response1" = "user1 user2 user3 user4" ]]
  [[ "$response2" = "user3 user4 user1 user2" ]]
}

test_quiz_filters () {
  setup
  ../util/create-user.sh user3 2

  # Gotta set answers to something non-null. ../util/create-user.sh sometimes gives
  # null answers
  q "update answer set answer = false"

  q "
  insert into search_preference_answer (
    person_id,
    question_id,
    answer,
    accept_unanswered
  )
  select
    (select id from person where email = 'searcher@example.com'),
    (select question_id from answer order by question_id limit 1 offset 0),
    (select answer      from answer order by question_id limit 1 offset 0),
    false
  "
  q "
  insert into search_preference_answer (
    person_id,
    question_id,
    answer,
    accept_unanswered
  )
  select
    (select id from person where email = 'searcher@example.com'),
    (select question_id from answer order by question_id limit 1 offset 1),
    (select answer      from answer order by question_id limit 1 offset 1),
    false
  "

  assert_search_names 'user3'

  q "update search_preference_answer set accept_unanswered = true"

  assert_search_names 'user1 user2 user3'
}

test_interaction_in_standard_search () {
  local interaction_name=$1
  local do_endpoint=$2
  local undo_endpoint=$3

  setup

  local user1_id=$(q "select id from person where email = 'user1@example.com'")
  local user2_id=$(q "select id from person where email = 'user2@example.com'")

  # searcher messaged/blocked/etc'd user1
  if [[ -n "${do_endpoint}" ]]
  then
    c POST "${do_endpoint}/${user1_id}"
  else
    q "
    insert into ${interaction_name} (subject_person_id, object_person_id)
    values (
      (select id from person where email = 'searcher@example.com'),
      (select id from person where email = 'user1@example.com')
    )
    "
  fi

  q "
  update search_preference_${interaction_name}
  set
    ${interaction_name}_id = 1
  where
    person_id = (select id from person where email = 'searcher@example.com')"

  assert_search_names 'user1 user2'

  q "
  update search_preference_${interaction_name}
  set
    ${interaction_name}_id = 2
  where
    person_id = (select id from person where email = 'searcher@example.com')"

  assert_search_names 'user2'

  if [[ -n "${undo_endpoint}" ]]
  then
    c POST "${undo_endpoint}/${user1_id}"
    assert_search_names 'user1 user2'
  fi
}

test_hide_me_from_strangers () {
  setup

  # user1 asks to be hidden from strangers
  q "
  update person
  set hide_me_from_strangers = true
  where id = (select id from person where email = 'user1@example.com')
  "

  # searcher (a stranger to user1) can only see user2 in standard searches
  assert_search_names 'user2'
  # searcher (a stranger to user1) can only see user2 in quiz searches

  # searcher (a stranger to user1) can only see user2 in standard searches
  # user1 messaged the searcher
  q "
  insert into messaged (subject_person_id, object_person_id)
  values (
    (select id from person where email = 'user1@example.com'),
    (select id from person where email = 'searcher@example.com')
  )
  "

  # user1 is no longer a stranger to searcher
  assert_search_names 'user1 user2'
}

test_interaction_in_standard_search_blocked_symmetry() {
  setup

  # Everyone wants to see people they blocked
  q "update search_preference_blocked set blocked_id = 1"

  # Searcher can see everyone
  assert_search_names 'user1 user2'

  # But then... user1 blocks searcher :'(
  q "
  insert into blocked (subject_person_id, object_person_id)
  values (
    (select id from person where email = 'user1@example.com'),
    (select id from person where email = 'searcher@example.com')
  )
  "

  # Searcher can no longer see user1 </3
  assert_search_names 'user2'
}

test_quiz_search

test_hide_me_from_strangers

test_interaction_in_standard_search messaged
test_interaction_in_standard_search blocked /block /unblock
test_interaction_in_standard_search_blocked_symmetry
test_interaction_in_standard_search hidden /hide /unhide

test_quiz_filters

test_photos_promoted

test_deactivated

test_search_cache

test_basic gender Man
test_basic orientation Straight
test_basic_age
test_basic_height
test_basic has_profile_picture 'Yes' yes_no
test_basic looking_for 'Long-term dating'
test_basic smoking 'Yes' yes_no_optional
test_basic drinking 'Often' frequency
test_basic drugs 'No' yes_no_optional
test_basic long_distance 'Yes' yes_no_optional
test_basic relationship_status 'Seeing someone'
test_basic has_kids 'Yes' yes_no_optional
test_basic wants_kids 'No' yes_no_optional
test_basic exercise 'Never' frequency
test_basic religion 'Buddhist'
test_basic star_sign 'Leo'
