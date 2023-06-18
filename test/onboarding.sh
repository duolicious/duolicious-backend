#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source setup.sh

response=$(
  c POST /request-otp \
    --header "Content-Type: application/json" \
    -d '{ "email": "mail@example.com" }'
)

SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')

otp_expiry1=$(q "SELECT otp_expiry FROM duo_session order by otp_expiry desc limit 1")
[[ -n "$otp_expiry1" ]]

c POST /resend-otp

otp_expiry2=$(q "SELECT otp_expiry FROM duo_session order by otp_expiry desc limit 1")
[[ -n "$otp_expiry2" ]]

[[ "$otp_expiry1" != "$otp_expiry2" ]]

c POST /check-otp \
  --header "Content-Type: application/json" \
  -d '{ "otp": "000000" }'

c PATCH /onboardee-info \
  --header "Content-Type: application/json" \
  -d '{ "name": "Jeff" }'

c PATCH /onboardee-info \
  --header "Content-Type: application/json" \
  -d '{ "date_of_birth": "1997-05-30" }'

c GET /search-locations?q=Syd

c PATCH /onboardee-info \
  --header "Content-Type: application/json" \
  -d '{ "location": "Sydney, Australia" }'

c PATCH /onboardee-info \
  --header "Content-Type: application/json" \
  -d '{ "gender": "Man" }'

c PATCH /onboardee-info \
  --header "Content-Type: application/json" \
  -d '{ "other_peoples_genders": ["Woman"] }'

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

c GET "https://user-images.duolicious.app/original-$(q "select uuid from onboardee_photo limit 1").jpg" > /dev/null
c GET "https://user-images.duolicious.app/900-$(q "select uuid from onboardee_photo limit 1").jpg" > /dev/null
c GET "https://user-images.duolicious.app/450-$(q "select uuid from onboardee_photo limit 1").jpg" > /dev/null

[[ "$(q "select COUNT(*) from onboardee_photo")" -eq 3 ]]

c DELETE /onboardee-info \
  --header "Content-Type: application/json" \
  -d '{ "files": [2, 6] }'

[[ "$(q "select COUNT(*) from onboardee_photo")" -eq 2 ]]

c DELETE /onboardee-info \
  --header "Content-Type: application/json" \
  -d '{ "files": [1, 3] }'

[[ "$(q "select COUNT(*) from onboardee_photo")" -eq 0 ]]

c PATCH /onboardee-info \
  --header "Content-Type: application/json" \
  -d '{ "about": "Im a reasonable person" }'

[[ "$(q "select count(*) from duo_session where person_id is null")" -eq 1 ]]

! c GET /next-questions
c POST /complete-onboarding

[[ "$(q "select count(*) from duo_session where person_id is null")" -eq 0 ]]

c GET /next-questions > /dev/null
! c POST /complete-onboarding
