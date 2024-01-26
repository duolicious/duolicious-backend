#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -e

rand_bool_or_null () {
  local rand=$(($RANDOM % 3))

  if [[ "$rand" == 0 ]]
  then
    echo true
  elif [[ "$rand" == 1 ]]
  then
    echo false
  else
    echo null
  fi
}

rand_bool () {
  if [[ "$(($RANDOM % 2))" == 1 ]]
  then
    echo true
  else
    echo false
  fi
}

answer_questions () {
  for question_id in $(seq 1 $1)
  do
    local json=$(cat << EOF
{
  "question_id": $question_id,
  "answer": $(rand_bool_or_null),
  "public": $(rand_bool)
}
EOF
)
    jc POST /answer -d "$json"
  done
}

add_photos () {
  for i in $(seq 1 $1)
  do
    local img=$(rand_image)

    jc PATCH /onboardee-info \
      -d "{
              \"base64_file\": {
                  \"position\": ${i},
                  \"base64\": \"${img}\",
                  \"top\": 0,
                  \"left\": 0
              }
          }"
  done
}

main () {
  local username=$1
  local num_questions=${2:-100}
  local num_photos=${3:-0}

  local response=$(jc POST /request-otp -d '{ "email": "'"$username"'@example.com" }')

  SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')

  jc POST /check-otp -d '{ "otp": "000000" }' > /dev/null
  jc PATCH /onboardee-info -d '{ "name": "'"$username"'" }'
  jc PATCH /onboardee-info -d '{ "date_of_birth": "1997-05-30" }'
  jc PATCH /onboardee-info -d '{ "location": "New York, New York, United States" }'
  jc PATCH /onboardee-info -d '{ "gender": "Other" }'
  jc PATCH /onboardee-info -d '{ "other_peoples_genders": ["Man", "Woman", "Agender", "Intersex", "Non-binary", "Transgender", "Trans woman", "Trans man", "Other"] }'
  jc PATCH /onboardee-info -d '{ "about": "Im a reasonable person" }'
  add_photos "${num_photos}"
  c POST /finish-onboarding

  answer_questions "$num_questions"

  echo "Created $username"
}

main "$@"
