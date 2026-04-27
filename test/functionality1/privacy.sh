#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

setup () {
  q "delete from person"

  ../util/create-user.sh user1 0 0
  ../util/create-user.sh user2 0 0

  q "update person set privacy_verification_level_id = 1"

  user1id=$(q "select id from person where email = 'user1@example.com'")
  user2id=$(q "select id from person where email = 'user2@example.com'")

  user1uuid=$(q "select uuid from person where email = 'user1@example.com'")
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
  c POST "/skip/by-uuid/${user1uuid}"

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

verified_privacy () {
  setup

  echo "User 2 hides their profile from people without verified basics"
  assume_role user2
  jc PATCH /profile-info -d '{ "verification_level": "Basics only" }'

  echo "User 1 can no longer get user 2's profile"
  assume_role user1
  ! c GET "/prospect-profile/${user2uuid}" || exit 1

  echo "User 1 gets verified basics"
  q "update person set verification_level_id = 2 where uuid = '${user1uuid}'"

  echo "User 1 can now view user 2's profile"
  assume_role user1
  c GET "/prospect-profile/${user2uuid}"

  echo "User 2 hides their profile from people without verified photos"
  assume_role user2
  jc PATCH /profile-info -d '{ "verification_level": "Photos" }'

  echo "User 1 can no longer get user 2's profile"
  assume_role user1
  ! c GET "/prospect-profile/${user2uuid}" || exit 1

  echo "User 1 gets verified basics"
  q "update person set verification_level_id = 3 where uuid = '${user1uuid}'"

  echo "User 1 can now view user 2's profile"
  assume_role user1
  c GET "/prospect-profile/${user2uuid}"

  echo "User 1 gets unverified"
  q "update person set verification_level_id = 1 where uuid = '${user1uuid}'"
  ! c GET "/prospect-profile/${user2uuid}" || exit 1

  echo "User 1 gets messaged by user 2"
  q "
    insert into messaged (subject_person_id, object_person_id)
    values (${user2id}, ${user1id})"
  c GET "/prospect-profile/${user2uuid}"
}

hide_me_from_strangers () {
  setup

  # User 2 hides their profile from strangers
  assume_role user2
  jc PATCH /profile-info -d '{ "hide_me_from_strangers": "Yes" }'

  # User 1 can no longer get user 2's profile
  assume_role user1
  c GET "/prospect-profile/${user2uuid}" && exit 1

  # User 2 messages user 1
  q "
    insert into messaged (subject_person_id, object_person_id)
    values (${user2id}, ${user1id})"

  # User 1 can now view user 2's profile
  assume_role user1
  c GET "/prospect-profile/${user2uuid}"
}

public_profile_anonymous_access () {
  setup

  echo "New sign-ups have public_profile = FALSE (the column default)"
  [[ "$(q "select public_profile from person where id = ${user2id}")" == 'f' ]]

  echo "Anonymous viewer is rejected by default"
  ! SESSION_TOKEN="" c GET "/prospect-profile/${user2uuid}" || exit 1

  echo "Authenticated user1 can still see user2 by default"
  assume_role user1
  c GET "/prospect-profile/${user2uuid}" > /dev/null

  echo "Toggling public_profile on via PATCH lets anonymous viewers in"
  assume_role user2
  jc PATCH /profile-info -d '{ "public_profile": "Yes" }'
  [[ "$(q "select public_profile from person where id = ${user2id}")" == 't' ]]

  local visited_before=$(q "select count(*) from visited where object_person_id = ${user2id}")

  SESSION_TOKEN="" c GET "/prospect-profile/${user2uuid}" > /tmp/anon-profile.json
  [[ "$(jq -r '.match_percentage'        /tmp/anon-profile.json)" == 'null' ]]
  [[ "$(jq -r '.gets_reply_percentage'   /tmp/anon-profile.json)" == 'null' ]]
  [[ "$(jq -r '.gives_reply_percentage'  /tmp/anon-profile.json)" == 'null' ]]
  [[ "$(jq -r '.is_skipped'              /tmp/anon-profile.json)" == 'false' ]]
  [[ "$(jq -r '.name'                    /tmp/anon-profile.json)" == 'user2' ]]

  echo "Anonymous viewing should not write to visited"
  [[ "$(q "select count(*) from visited where object_person_id = ${user2id}")" == "${visited_before}" ]]

  echo "Toggling public_profile back off via PATCH hides it again"
  jc PATCH /profile-info -d '{ "public_profile": "No" }'
  [[ "$(q "select public_profile from person where id = ${user2id}")" == 'f' ]]
  ! SESSION_TOKEN="" c GET "/prospect-profile/${user2uuid}" || exit 1
}

public_profile_anonymous_nonexistent_uuid () {
  setup

  echo "Anonymous viewer of a nonexistent UUID gets a 404"
  ! SESSION_TOKEN="" c GET "/prospect-profile/00000000-0000-0000-0000-000000000000" || exit 1
}

public_profile_other_settings_take_precedence () {
  setup

  echo "Anonymous baseline: opt user2 into public_profile, then verify reachable"
  assume_role user2
  jc PATCH /profile-info -d '{ "public_profile": "Yes" }'
  SESSION_TOKEN="" c GET "/prospect-profile/${user2uuid}" > /dev/null

  echo "hide_me_from_strangers takes precedence: anonymous is always a stranger"
  jc PATCH /profile-info -d '{ "hide_me_from_strangers": "Yes" }'
  ! SESSION_TOKEN="" c GET "/prospect-profile/${user2uuid}" || exit 1
  jc PATCH /profile-info -d '{ "hide_me_from_strangers": "No" }'

  echo "verification_level (Basics only) takes precedence over public_profile"
  jc PATCH /profile-info -d '{ "verification_level": "Basics only" }'
  ! SESSION_TOKEN="" c GET "/prospect-profile/${user2uuid}" || exit 1
  jc PATCH /profile-info -d '{ "verification_level": "No verification" }'

  echo "deactivation takes precedence over public_profile"
  c POST '/deactivate'
  ! SESSION_TOKEN="" c GET "/prospect-profile/${user2uuid}" || exit 1
}

public_profile_appears_in_profile_info () {
  setup

  assume_role user2
  local public_profile_setting=$(
    c GET /profile-info \
      | jq -r '."public profile"')
  [[ "$public_profile_setting" == 'No' ]]

  jc PATCH /profile-info -d '{ "public_profile": "Yes" }'

  public_profile_setting=$(
    c GET /profile-info \
      | jq -r '."public profile"')
  [[ "$public_profile_setting" == 'Yes' ]]
}

non_private_profile_is_accessible
skipping
deactivating
hide_me_from_strangers
verified_privacy
public_profile_anonymous_access
public_profile_anonymous_nonexistent_uuid
public_profile_other_settings_take_precedence
public_profile_appears_in_profile_info
