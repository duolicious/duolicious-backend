#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

# Simulate a case where the user already has multiple accounts whose
# `normalized_email`s are equal
setup () {
  q "delete from duo_session"
  q "delete from person"
  q "delete from onboardee"
  q "delete from undeleted_photo"

  ../util/create-user.sh user1 0 0
  ../util/create-user.sh user2 0 0

  q "
    UPDATE person
    SET
      email = 'user+1@gmail.com',
      normalized_email = 'user@gmail.com'
    WHERE
      email = 'user1@example.com'"

  q "
    UPDATE person
    SET
      email = 'user+2@gmail.com',
      normalized_email = 'user@gmail.com'
    WHERE
      email = 'user2@example.com'"

  ../util/create-user.sh 'otheruser+1@gmail.com' 0 0
}

# Can login to accounts with different emails but same normalized email (that
# were created before normalization)
login_to_existing () {
    assume_role 'user+1@gmail.com'
    USER_1_UUID=$USER_UUID

    assume_role 'user+2@gmail.com'
    USER_2_UUID=$USER_UUID

    # If they match, then we are logging into the same account on both reqs
    # (Fail)
    [[ "$USER_1_UUID" != "$USER_2_UUID" ]]
}

# Can create a new account with a different email but same normalized email
create_new () {
    existing_uuid=$(get_uuid 'otheruser+1@gmail.com')

    assume_role 'otheruser+2@gmail.com'

    # If they match, we aren't creating a new account (Pass)
    [[ "$existing_uuid" = "$USER_UUID" ]]
}

setup
login_to_existing
create_new
