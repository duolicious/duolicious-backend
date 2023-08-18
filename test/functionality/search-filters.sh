#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

q "delete from duo_session"
q "delete from person"
q "delete from onboardee"
q "delete from photo_graveyard"
q "update question set count_yes = 0, count_no = 0"

../util/create-user.sh user1 0 0

response=$(jc POST /request-otp -d '{ "email": "user1@example.com" }')
SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')
jc POST /check-otp -d '{ "otp": "000000" }'

test_set () {
  local field_name=$1
  local field_value=$2

  jc POST /search-filter -d '{ "'"$field_name"'": '"$field_value"' }'

  new_field_value=$(
    set +x
    c GET /search-filters | jq -r ".${field_name}"
  )
  [[ "$(jq -cS <<< "$new_field_value")" == "$(jq -cS <<< "$field_value")" ]]
}

test_set answer '[
  {"question_id":  1, "answer": true, "accept_unanswered": false},
  {"question_id": 42, "answer": true, "accept_unanswered": true}
]'
test_set answer '[]'

test_set gender '["Trans man", "Other"]'
test_set orientation '["Unanswered", "Pansexual", "Other"]'
test_set age '{ "min_age": 42, "max_age": 56 }'
test_set furthest_distance 50
test_set height '{"min_height_cm": 142, "max_height_cm": 171}'
test_set has_a_profile_picture '["Yes", "No"]'
test_set looking_for '["Unanswered", "Short-term dating", "Friends"]'
test_set smoking '["Unanswered", "No"]'
test_set drinking '["Unanswered", "Never"]'
test_set drugs '["Unanswered", "No"]'
test_set long_distance '["Unanswered", "No"]'
test_set relationship_status '["Unanswered", "Engaged", "Other"]'
test_set has_kids '["Unanswered", "No"]'
test_set wants_kids '["Unanswered", "No", "Maybe"]'
test_set exercise '["Unanswered", "Never"]'
test_set religion '["Unanswered", "Buddhist"]'
test_set star_sign '["Unanswered", "Virgo"]'

test_set people_messaged '["Yes", "No"]'
test_set people_hidden '["Yes", "No"]'
test_set people_blocked '["Yes", "No"]'
