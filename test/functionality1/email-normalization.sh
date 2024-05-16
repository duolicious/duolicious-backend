#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

q "delete from duo_session"
q "delete from person"
q "delete from onboardee"
q "delete from undeleted_photo"

q "insert into person (email, normalized_email, name, date_of_birth, coordinates, gender_id, about, unit_id) values ('user+1@example.com', 'user@gmail.com', 'user+1', '1997-05-30', 'POINT(0 0)', 2, 'cool', 1)"
q "insert into person (email, normalized_email, name, date_of_birth, coordinates, gender_id, about, unit_id) values ('user+2@example.com', 'user@gmail.com', 'user+2', '1997-05-30', 'POINT(0 0)', 2, 'cool', 1)"

q "insert into person (email, normalized_email, name, date_of_birth, coordinates, gender_id, about, unit_id) values ('otheruser+1@example.com', 'otheruser@gmail.com', 'otheruser+1', '1997-05-30', 'POINT(0 0)', 2, 'cool', 1)"

# Can login to accounts with different emails but same normalized email (that were created before normalization)
login_to_existing () {
    response=$(jc POST /request-otp -d '{ "email": "user+1@example.com" }')
    SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')
    response2=$(jc POST /check-otp -d '{ "otp": "000000" }')
    uuid=$(echo "$response2" | jq -r '.person_uuid')

    response=$(jc POST /request-otp -d '{ "email": "user+2@example.com" }')
    SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')
    response2=$(jc POST /check-otp -d '{ "otp": "000000" }')
    uuid2=$(echo "$response2" | jq -r '.person_uuid')

    [[ "$uuid" != "$uuid2" ]] # If they match, then we are logging into the same account on both reqs (Fail)
}

# Can create a new account with a different email but same normalized email
create_new () {
    existing_id=$(get_id 'otheruser+1@example.com')

    response=$(jc POST /request-otp -d '{ "email": "otheruser+2@example.com" }')
    SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')
    response2=$(jc POST /check-otp -d '{ "otp": "000000" }')
    new_id=$(echo "$response2" | jq -r '.person_id')

    [[ "$existing_id" = "$new_id" ]] # If they match, we aren't creating a new account (Pass)
}

login_to_existing
create_new