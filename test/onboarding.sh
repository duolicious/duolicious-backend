#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source setup.sh

set -xe

q "delete from duo_session"
q "delete from person"
q "delete from onboardee"
q "update question set count_yes = 0, count_no = 0, count_views = 0"

response=$(jc POST /request-otp -d '{ "email": "MAIL@example.com" }')

SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')

otp_expiry1=$(q "SELECT otp_expiry FROM duo_session order by otp_expiry desc limit 1")
[[ -n "$otp_expiry1" ]]

c POST /resend-otp

otp_expiry2=$(q "SELECT otp_expiry FROM duo_session order by otp_expiry desc limit 1")
[[ -n "$otp_expiry2" ]]

[[ "$otp_expiry1" != "$otp_expiry2" ]]

! jc POST /check-otp -d '{ "otp": "000001" }'

[[ "$(q "select COUNT(*) from onboardee")" -eq 0 ]]

jc POST /check-otp -d '{ "otp": "000000" }'

[[ "$(q "select COUNT(*) from onboardee")" -eq 1 ]]

jc PATCH /onboardee-info -d '{ "name": "Jeff" }'
jc PATCH /onboardee-info -d '{ "date_of_birth": "1997-05-30" }'
c GET /search-locations?q=Syd
jc PATCH /onboardee-info -d '{ "location": "Sydney, Australia" }'
jc PATCH /onboardee-info -d '{ "gender": "Man" }'
jc PATCH /onboardee-info -d '{ "other_peoples_genders": ["Man", "Woman", "Other"] }'

c PATCH /onboardee-info \
  --header "Content-Type: multipart/form-data" \
  -F "1.jpg=@profile-pic.png" \
  -F "2.jpg=@profile-pic.png"

c PATCH /onboardee-info \
  --header "Content-Type: multipart/form-data" \
  -F "3.jpg=@profile-pic.png"

c PATCH /onboardee-info \
  --header "Content-Type: multipart/form-data" \
  -F "1.jpg=@profile-pic.png"

c GET "https://test-user-images.duolicious.app/original-$(q "select uuid from onboardee_photo limit 1").jpg" > /dev/null
c GET "https://test-user-images.duolicious.app/900-$(q "select uuid from onboardee_photo limit 1").jpg" > /dev/null
c GET "https://test-user-images.duolicious.app/450-$(q "select uuid from onboardee_photo limit 1").jpg" > /dev/null

[[ "$(q "select COUNT(*) from onboardee_photo")" -eq 3 ]]

jc DELETE /onboardee-info -d '{ "files": [2, 6] }'

[[ "$(q "select COUNT(*) from onboardee_photo")" -eq 2 ]]

jc DELETE /onboardee-info -d '{ "files": [1, 3] }'

[[ "$(q "select COUNT(*) from onboardee_photo")" -eq 0 ]]

jc PATCH /onboardee-info -d '{ "about": "Im a reasonable person" }'

[[ "$(q "select count(*) from duo_session where person_id is null")" -eq 1 ]]

! c GET /next-questions
c POST /finish-onboarding

[[ "$(q "select count(*) from duo_session where person_id is null")" -eq 0 ]]

c GET /next-questions > /dev/null
! c POST /finish-onboarding

# Test signing out works
c POST /sign-out

[[ "$(q "select count(*) from duo_session where person_id is null")" -eq 0 ]]

! c GET /search-locations?q=Syd

# Can we sign back in?

response=$(jc POST /request-otp -d '{ "email": "mail@example.com" }')

SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')

! jc POST /check-otp -d '{ "otp": "000001" }'

! c GET /search-locations?q=Syd

[[ "$(q "select COUNT(*) from onboardee")" -eq 0 ]]

response=$(
  jc POST /check-otp -d '{ "otp": "000000" }'
)

[[ "$(echo "$response" | jq -r '.onboarded')" = true ]]

c GET /search-locations?q=Syd

jc POST /view-question -d '{ "question_id": 1001 }'
jc POST /view-question -d '{ "question_id": 1001 }'
jc POST /view-question -d '{ "question_id": 1002 }'

jc POST /answer -d '{ "question_id": 1001, "answer": true, "public": false }'
jc POST /answer -d '{ "question_id": 1002, "answer": false, "public": false }'

[[ "$(q "select count_yes   from question where id = 1001")" -eq 1 ]]
[[ "$(q "select count_no    from question where id = 1001")" -eq 0 ]]
[[ "$(q "select count_views from question where id = 1001")" -eq 2 ]]
[[ "$(q "select count_yes   from question where id = 1002")" -eq 0 ]]
[[ "$(q "select count_no    from question where id = 1002")" -eq 1 ]]
[[ "$(q "select count_views from question where id = 1002")" -eq 1 ]]
