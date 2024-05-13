#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

setup () {
  q "delete from person"

  ../util/create-user.sh user1 0 0
  ../util/create-user.sh user2 0 0

  user1id=$(q "select id from person where email = 'user1@example.com'")
  user2id=$(q "select id from person where email = 'user2@example.com'")

  user2uuid=$(q "select uuid from person where email = 'user2@example.com'")
}

non_private_profile_is_accessible () {
  setup

  # User 1 can get user 2's profile
  assume_role user1
  c GET "/prospect-profile/${user2uuid}"
}

skipping () {
  setup

  # User 2 skips user 1
  assume_role user2
  c POST "/skip/${user1id}"

  # User 1 can no longer get user 2's profile
  assume_role user1
  ! c GET "/prospect-profile/${user2uuid}"
}

deactivating () {
  setup

  # User 2 deactivates their profile
  assume_role user2
  c POST '/deactivate'

  # User 1 can no longer get user 2's profile
  assume_role user1
  ! c GET "/prospect-profile/${user2uuid}"
}

hide_me_from_strangers () {
  setup

  # User 2 hides their profile from strangers
  assume_role user2
  jc PATCH /profile-info -d '{ "hide_me_from_strangers": "Yes" }'

  # User 1 can no longer get user 2's profile
  assume_role user1
  ! c GET "/prospect-profile/${user2uuid}"

  # User 2 messages user 1
  q "
    insert into messaged (subject_person_id, object_person_id)
    values (${user2id}, ${user1id})"

  # User 1 can now view user 2's profile
  assume_role user1
  c GET "/prospect-profile/${user2uuid}"
}

non_private_profile_is_accessible
skipping
deactivating
hide_me_from_strangers
