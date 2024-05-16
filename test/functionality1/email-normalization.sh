#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

q "delete from duo_session"
q "delete from person"
q "delete from onboardee"
q "delete from undeleted_photo"

../util/create-user.sh user1 0 0
../util/create-user.sh user2 0 0

q "update person SET email = 'user+1@example.com' WHERE email = 'user1@example.com'"
q "update person SET email = 'user+2@example.com' WHERE email = 'user2@example.com'"

../util/create-user.sh otheruser+1 0 0

# Can login to accounts with different emails but same normalized email (that were created before normalization)
login_to_existing () {
    assume_role user+1
    USER_1_UUID=$USER_UUID

    assume_role user+2
    USER_2_UUID=$USER_UUID

    [[ "$USER_1_UUID" != "$USER_2_UUID" ]] # If they match, then we are logging into the same account on both reqs (Fail)
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