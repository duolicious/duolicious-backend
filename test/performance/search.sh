#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../setup.sh

# TODO: Replace me with a database that's 1000 times bigger
time bash -c 'seq 1000 | parallel -j16 ../functionality/create-user.sh "user{}" 0 0'

# Make prospects appear in `search_for_quiz_prospects`
q "update person set has_profile_picture_id = 1"

# I realise this isn't a great performance test but I need a bigger DB once
# development has settled down.
for n in $(seq 100)
do
  response=$(jc POST /request-otp -d '{ "email": "user'$n'@example.com" }')
  SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')
  jc POST /check-otp -d '{ "otp": "000000" }' > /dev/null

  time c GET '/search'
  time c GET '/search?n=1&o=0'
  time c GET '/search?n=1&o=999'
done
