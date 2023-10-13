#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

q "delete from duo_session"
q "delete from person"
q "delete from onboardee"
q "delete from undeleted_photo"
q "update question set count_yes = 0, count_no = 0"

response=$(jc POST /request-otp -d '{ "email": "MAIL@example.com" }')
SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')
jc POST /check-otp -d '{ "otp": "000000" }'

jc PATCH /onboardee-info -d '{ "name": "Jeff" }'
jc PATCH /onboardee-info -d '{ "date_of_birth": "1997-05-30" }'
jc PATCH /onboardee-info -d '{ "location": "Sydney, New South Wales, Australia" }'
jc PATCH /onboardee-info -d '{ "gender": "Man" }'
jc PATCH /onboardee-info -d '{ "other_peoples_genders": ["Man", "Woman", "Other"] }'

# Deliberately don't include "about"
# jc PATCH /onboardee-info -d '{ "about": "Im a reasonable person" }'

response=$(c POST /finish-onboarding)
[[ "$(echo "$response" | jq -r .units)" = Metric ]]

[[ "$(q "select count(*) from duo_session where person_id is null")" -eq 0 ]]
[[ "$(q "select count(*) from person where about = ''")" -eq 1 ]]
