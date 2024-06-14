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
  q "delete from undeleted_photo"

  ../util/create-user.sh searcher 0
  ../util/create-user.sh user1 0
  ../util/create-user.sh user2 0

  searcher_id=$(q "select id from person where email = 'searcher@example.com'")
  user1_id=$(q "select id from person where email = 'user1@example.com'")
  user2_id=$(q "select id from person where email = 'user2@example.com'")

  user1_uuid=$(q "select uuid from person where email = 'user1@example.com'")
  user2_uuid=$(q "select uuid from person where email = 'user2@example.com'")

  assume_role searcher
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
  q "update search_preference_age set min_age = NULL, max_age = NULL"
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

test_basic_furthest_distance () {
  setup

  assume_role user1
  jc PATCH /profile-info -d '{ "location": "Sydney, New South Wales, Australia" }'

  assume_role user2
  jc PATCH /profile-info -d '{ "location": "Timbuktu, Tombouctou, Mali" }'

  assume_role searcher
  jc PATCH /profile-info -d '{ "location": "Sydney Olympic Park, New South Wales, Australia" }'

  jc POST /search-filter -d '{ "furthest_distance": 50 }'
  assert_search_names user1

  jc POST /search-filter -d '{ "furthest_distance": null }'
  assert_search_names 'user1 user2'
}

test_search_cache () {
  setup
  q "delete from search_cache"

  # Ensure `user1` is ranked first in search results
  q "
  update
    person
  set
    personality = array_full(47, 1),
    count_answers = 1
  where
    email IN ('searcher@example.com', 'user1@example.com')"

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

  q "
  update person set personality = array_full(47, 1)
  where id = ${user1_id}"

  q "
  update person set personality = array_full(47, -1)
  where id = ${user2_id}"

  # Populate the search cache
  c GET '/search?n=1&o=0'

  # user1 has the higher match percentage
  q "
  update person set personality = array_full(47, 1)
  where id = ${searcher_id}"
  local response1=$(c GET /search | jq -r '[.[].prospect_person_id] | join(" ")')
  [[ "$response1" = "$user1_id" ]]

  # user1 has the lower match percentage
  q "
  update person set personality = array_full(47, -1)
  where id = ${searcher_id}"
  local response2=$(c GET /search | jq -r '[.[].prospect_person_id] | join(" ")')
  [[ "$response2" != "$user1_id" ]]

  # user2 has the highest match percentage but user2 is skipped by searcher
  c POST "/skip/${user2_id}"

  local response3=$(c GET /search | jq -r '[.[].prospect_person_id] | join(" ")')
  [[ "$response3" != "${user2_id}" ]]

  # Reset searcher's search cache
  c POST "/unskip/${user2_id}"
  c GET '/search?n=1&o=0'

  # user2 has the highest match percentage but searcher is skipped by user2
  assume_role user2
  c POST "/skip/${searcher_id}"
  assume_role searcher

  local response4=$(c GET /search | jq -r '[.[].prospect_person_id] | join(" ")')
  [[ "$response4" != "${user2_id}" ]]

  # Reset searcher's search cache
  assume_role user2
  c POST "/unskip/${searcher_id}"
  assume_role searcher
  c GET '/search?n=1&o=0'



  # user2 has the highest match percentage
  local response2=$(c GET /search | jq -r '[.[].prospect_person_id] | join(" ")')
  [[ "$response2" = "$user2_id" ]]

  # user2 has the highest match percentage but user2 is hidden by searcher
  c POST "/skip/${user2_id}"

  local response3=$(c GET /search | jq -r '[.[].prospect_person_id] | join(" ")')
  [[ "$response3" != "${user2_id}" ]]
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

  local response1=$(c GET '/search?n=10&o=0' | jq -r '[.[].name] | join(" ")')

  q "
  insert into photo (person_id, position, uuid, blurhash)
  SELECT
    (select id from person where email = 'user3@example.com'),
    1,
    'user3-uuid',
    ''"
  q "
  insert into photo (person_id, position, uuid, blurhash)
  select
    (select id from person where email = 'user4@example.com'),
    1,
    'user4-uuid',
    ''"

  local response2=$(c GET '/search?n=10&o=0' | jq -r '[.[].name] | join(" ")')

  [[ "$response1" = "user1 user2 user3 user4" ]]
  [[ "$response2" = "user3 user4 user1 user2" ]]
}

test_quiz_filters () {
  setup
  ../util/create-user.sh user3 2

  # Gotta set answers to something non-null; ../util/create-user.sh sometimes gives
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

  q "update search_preference_answer set accept_unanswered = true"
  assume_role searcher
  assert_search_names 'user1 user2 user3'
  assume_role user1
  assert_search_names 'searcher user2 user3'

  q "update search_preference_answer set accept_unanswered = false"
  assume_role searcher
  assert_search_names 'user3'
  assume_role user1
  assert_search_names 'searcher user2 user3'
}

test_interaction_in_standard_search () {
  local interaction_name=$1
  local do_endpoint=$2
  local undo_endpoint=$3

  setup

  # searcher messaged/blocked/etc'd user1
  if [[ -n "${do_endpoint}" ]]
  then
    c POST "${do_endpoint}/${user1_id}"
  else
    q "
    insert into ${interaction_name} (subject_person_id, object_person_id)
    values (${searcher_id}, ${user1_id})
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
  else
    q "
    delete from ${interaction_name} where
      subject_person_id = ${searcher_id} and
      object_person_id  = ${user1_id}
    "
  fi

  assert_search_names 'user1 user2'
}

test_hide_me_from_strangers () {
  setup

  q "update person set has_profile_picture_id = 1"

  # user1 asks to be hidden from strangers
  q "
  update person
  set hide_me_from_strangers = true
  where id = (select id from person where email = 'user1@example.com')
  "

  # searcher (a stranger to user1) can only see user2 in standard searches
  assert_search_names 'user2'
  # searcher (a stranger to user1) can only see user2 in quiz searches
  assert_search_names 'user2' ''

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

test_interaction_in_standard_search_skipped_symmetry() {
  setup

  # Everyone wants to see people they skipped
  q "update search_preference_skipped set skipped_id = 1"

  # Searcher can see everyone
  assert_search_names 'user1 user2'

  # But then... user1 skips searcher :'(
  q "
  insert into skipped (subject_person_id, object_person_id)
  values (
    (select id from person where email = 'user1@example.com'),
    (select id from person where email = 'searcher@example.com')
  )
  "

  # Searcher can no longer see user1 </3
  assert_search_names 'user2'
}

test_mutual_club_members_promoted () {
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

  local response1=$(c GET '/search?n=10&o=0' | jq -r '[.[].name] | join(" ")')

  assume_role user3
  jc POST /join-club -d '{ "name": "my-club-shared-1" }'
  jc POST /join-club -d '{ "name": "my-club-unshared-10" }'
  jc POST /join-club -d '{ "name": "my-club-unshared-20" }'

  assume_role user4
  jc POST /join-club -d '{ "name": "my-club-shared-2" }'
  jc POST /join-club -d '{ "name": "my-club-unshared-11" }'
  jc POST /join-club -d '{ "name": "my-club-unshared-21" }'

  assume_role searcher
  jc POST /join-club -d '{ "name": "my-club-shared-1" }'
  jc POST /join-club -d '{ "name": "my-club-shared-2" }'
  jc POST /join-club -d '{ "name": "my-club-unshared-12" }'
  jc POST /join-club -d '{ "name": "my-club-unshared-22" }'

  local response2=$(c GET '/search?n=10&o=0' | jq -r '[.[].name] | join(" ")')

  [[ "$response1" = "user1 user2 user3 user4" ]]
  [[ "$response2" = "user3 user4 user1 user2" ]]
}

test_json_format () {
  setup

  # Ensure `user1` is ranked first in search results
  q "
  update
    person
  set
    personality = array_full(47, 1),
    count_answers = 1
  where
    email IN ('searcher@example.com', 'user1@example.com')"

  # Q_UNCACHED_SEARCH_2 yields the right format
  local response=$(c GET '/search?n=1&o=0')
  local expected=$(jq -r . << EOF
[
  {
    "age": 26,
    "match_percentage": 99,
    "name": "user1",
    "person_messaged_prospect": false,
    "profile_photo_blurhash": null,
    "profile_photo_uuid": null,
    "prospect_messaged_person": false,
    "prospect_person_id": ${user1_id},
    "prospect_uuid": "${user1_uuid}",
    "verified": false
  }
]
EOF
)
  [[ "$response" == "$expected" ]]

  # Q_CACHED_SEARCH yields the right format
  local response=$(c GET '/search?n=1&o=1')
  local expected=$(jq -r . << EOF
[
  {
    "age": 26,
    "match_percentage": 50,
    "name": "user2",
    "person_messaged_prospect": false,
    "profile_photo_blurhash": null,
    "profile_photo_uuid": null,
    "prospect_messaged_person": false,
    "prospect_person_id": ${user2_id},
    "prospect_uuid": "${user2_uuid}",
    "verified": false
  }
]
EOF
)
  [[ "$response" == "$expected" ]]

  # Q_QUIZ_SEARCH yields the right format
  local response=$(c GET '/search')
  local expected=$(jq -r . << EOF
[
  {
    "age": 26,
    "match_percentage": 99,
    "name": "user1",
    "profile_photo_blurhash": null,
    "profile_photo_uuid": null,
    "prospect_person_id": ${user1_id},
    "prospect_uuid": "${user1_uuid}"
  }
]
EOF
)
  [[ "$response" == "$expected" ]]
}

test_bidirectional_gender_filter () {
  setup

  assume_role user1
  jc PATCH /profile-info  -d '{ "gender": "Man" }'
  jc POST  /search-filter -d '{ "gender": ["Woman"] }'

  assume_role user2
  jc PATCH /profile-info  -d '{ "gender": "Non-binary" }'
  jc POST  /search-filter -d '{ "gender": ["Woman"] }'

  assume_role searcher
  jc PATCH /profile-info  -d '{ "gender": "Woman" }'
  jc POST  /search-filter -d '{ "gender": ["Man"] }'

  assume_role user1
  assert_search_names "searcher"

  assume_role user2
  assert_search_names ""

  assume_role searcher
  assert_search_names "user1"
}

test_bidirectional_location_filter () {
  setup

  assume_role user1
  jc PATCH /profile-info  -d '{ "location": "Brisbane, Queensland, Australia" }'
  jc POST  /search-filter -d '{ "furthest_distance": 1000 }'

  assume_role user2
  jc PATCH /profile-info  -d '{ "location": "Sydney, New South Wales, Australia" }'
  jc POST  /search-filter -d '{ "furthest_distance": 1000 }'

  assume_role searcher
  jc PATCH /profile-info  -d '{ "location": "Canberra, ACT, Australia" }'
  jc POST  /search-filter -d '{ "furthest_distance": 500 }'

  assume_role user1
  assert_search_names "user2"

  assume_role user2
  assert_search_names "searcher user1"

  assume_role searcher
  assert_search_names "user2"

  assume_role user1
  jc POST  /search-filter -d '{ "furthest_distance": 5000 }'

  assume_role user2
  jc POST  /search-filter -d '{ "furthest_distance": 500 }'

  assume_role searcher
  jc POST  /search-filter -d '{ "furthest_distance": null }'

  assume_role user1
  assert_search_names "searcher"

  assume_role user2
  assert_search_names "searcher"

  assume_role searcher
  assert_search_names "user1 user2"
}

test_bidirectional_age_filter () {
  setup

  assume_role user1
  q "
  update person
  set date_of_birth = now() - interval '50 years'
  where name = 'user1'"
  jc POST  /search-filter -d '{ "age": { "min_age": 20, "max_age": 60 }}'

  assume_role user2
  q "
  update person
  set date_of_birth = now() - interval '30 years'
  where name = 'user2'"
  jc POST  /search-filter -d '{ "age": { "min_age": 20, "max_age": 35 }}'

  assume_role searcher
  q "
  update person
  set date_of_birth = now() - interval '20 years'
  where name = 'searcher'"
  jc POST  /search-filter -d '{ "age": { "min_age": null, "max_age": null }}'

  assume_role user1
  assert_search_names "searcher"

  assume_role user2
  assert_search_names "searcher"

  assume_role searcher
  assert_search_names "user1 user2"
}

test_search_page_size_limit () {
  setup

  ! search_names 11
  search_names 10
}

test_quiz_search

test_hide_me_from_strangers

test_interaction_in_standard_search skipped /skip /unskip
test_interaction_in_standard_search_skipped_symmetry

test_quiz_filters

test_photos_promoted

test_deactivated

test_search_cache

test_basic gender Man
test_basic orientation Straight
test_basic ethnicity 'Middle Eastern'
test_basic_age
test_basic_furthest_distance
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

test_bidirectional_gender_filter
test_bidirectional_location_filter
test_bidirectional_age_filter

test_mutual_club_members_promoted

test_json_format

test_search_page_size_limit
