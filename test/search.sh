#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source setup.sh

set -xe

setup () {
  q "delete from duo_session"
  q "delete from person"
  q "delete from onboardee"
  q "update question set count_yes = 0, count_no = 0, count_views = 0"

  ./create-user.sh searcher 0
  ./create-user.sh user1 0
  ./create-user.sh user2 0

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
  update person set personality = array_full(48, 1)
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

test_q_and_a_search () {
  setup

  q "
  update person set personality = array_full(48, 1)
  where email IN ('searcher@example.com', 'user1@example.com')"
  response1=$(c GET /search | jq -r '[.[].prospect_person_id] | join(" ")')

  q "
  update person set personality = array_full(48, -1)
  where email = 'user1@example.com'"
  response2=$(c GET /search | jq -r '[.[].prospect_person_id] | join(" ")')

  [[ "$response1" != "$response2" ]]
}

test_q_and_a_search

test_search_cache

test_basic gender Man
test_basic orientation Straight
test_basic_age
test_basic verified 'Yes' yes_no
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
