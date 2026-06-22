#!/usr/bin/env bash

# A user's personality vector must come out identical regardless of *how* their
# answers reach their profile:
#
#   1. one at a time, via authenticated POST /answer; versus
#   2. all at once at sign-up, collected while unauthenticated and flushed onto
#      the profile when the session resolves to a person — either when a *new*
#      user finishes onboarding (/finish-onboarding) or an *existing* user signs
#      back in (/check-otp).
#
# Each user answers the same fixed questions the same way, so their stored
# `presence_score`, `absence_score`, `count_answers` and `personality` vectors
# must match exactly. (`sign_in`, `answer` and `snapshot_user_personality` come from
# ../util/setup.sh.)

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

# The shared answer set: question_id, answer, public. A mix of yes/no and
# public/private, plus a skip (null) which is stored but doesn't count towards
# the personality.
ANSWERS=(
  "1 true  true"
  "2 false true"
  "3 true  false"
  "4 null  true"
  "5 false false"
  "6 true  true"
  "7 false true"
)

reset_db () {
  q "delete from duo_session"
  q "delete from person"
  q "delete from onboardee"
  q "delete from undeleted_photo"
  q "update question set count_yes = 0, count_no = 0"
}

# The shared answer set rendered as the JSON array accepted by /request-otp.
answers_json () {
  local items=()
  local qid ans pub

  for a in "${ANSWERS[@]}"; do
    read -r qid ans pub <<< "$a"
    items+=("{ \"question_id\": $qid, \"answer\": $ans, \"public\": $pub }")
  done

  local IFS=,
  echo "[${items[*]}]"
}

# The canonical baseline: an onboarded user signs in and answers one question at
# a time via POST /answer.
answer_one_at_a_time () {
  local email=$1
  local qid ans pub

  sign_in "$email"

  for a in "${ANSWERS[@]}"; do
    read -r qid ans pub <<< "$a"
    answer "$qid" "$ans" "$pub"
  done
}

# Onboard a brand-new user, passing the shared answers to /request-otp so they
# get flushed onto the new profile by /finish-onboarding.
onboard_with_answers () {
  local email=$1

  local response=$(jc POST /request-otp -d '{
    "email": "'"$email"'",
    "answers": '"$(answers_json)"'
  }')
  SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')

  jc POST /check-otp -d '{ "otp": "000000" }' > /dev/null
  jc PATCH /onboardee-info -d '{ "name": "Newbie" }'
  jc PATCH /onboardee-info -d '{ "date_of_birth": "1997-05-30" }'
  jc PATCH /onboardee-info -d '{ "location": "Sydney, New South Wales, Australia" }'
  jc PATCH /onboardee-info -d '{ "gender": "Man" }'
  jc PATCH /onboardee-info -d '{ "other_peoples_genders": ["Man", "Woman", "Other"] }'
  c POST /finish-onboarding > /dev/null
}

# Sign an existing user back in, passing the shared answers to /request-otp so
# they get flushed onto their (already-existing) profile by /check-otp.
sign_in_with_answers () {
  local email=$1

  local response=$(jc POST /request-otp -d '{
    "email": "'"$email"'",
    "answers": '"$(answers_json)"'
  }')
  SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')

  jc POST /check-otp -d '{ "otp": "000000" }' > /dev/null
}

# Fail (printing a diff) unless two users have identical stored vectors.
assert_same_personality () {
  diff <(snapshot_user_personality "$1" snapshot) <(snapshot_user_personality "$2" snapshot)
}

# A new user's sign-up answers produce the same personality as answering one at
# a time.
onboarding_flush_matches_one_at_a_time () {
  reset_db

  ../util/create-user.sh baseline 0
  answer_one_at_a_time baseline@example.com

  onboard_with_answers newbie@example.com

  assert_same_personality baseline@example.com newbie@example.com
}

# An existing user's sign-up answers, flushed at /check-otp, produce the same
# personality as answering one at a time.
signin_flush_matches_one_at_a_time () {
  reset_db

  ../util/create-user.sh baseline 0
  answer_one_at_a_time baseline@example.com

  ../util/create-user.sh returning 0
  sign_in_with_answers returning@example.com

  assert_same_personality baseline@example.com returning@example.com
}

onboarding_flush_matches_one_at_a_time
signin_flush_matches_one_at_a_time
