#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

say "Configure RevenueCat auth token"
q "\
update
  funding
set
  token_hash_revenuecat = '$(printf 'valid-revenuecat-token' | sha512sum | cut -d' ' -f1)'
"

say "Reset core tables to a clean state"
q "delete from person"
q "delete from club"
q "delete from banned_person"

say "Create two users"
../util/create-user.sh rcuser1 0 0
../util/create-user.sh rcuser2 0 0

user1uuid=$(get_uuid 'rcuser1@example.com')
user2uuid=$(get_uuid 'rcuser2@example.com')

say "Missing Authorization header returns 400"
export SESSION_TOKEN=""
c \
  POST \
  /revenuecat \
  --header "Content-Type: application/json" \
  -d '{ "event": { "type": "EXPIRATION", "app_user_id": "'"$user1uuid"'" } }' \
  && exit 1

say "Invalid RevenueCat token returns 401"
export SESSION_TOKEN=""
c \
  POST \
  /revenuecat \
  --header "Authorization: Bearer invalid-token" \
  --header "Content-Type: application/json" \
  -d '{ "event": { "type": "EXPIRATION", "app_user_id": "'"$user1uuid"'" } }' \
  && exit 1

say "INITIAL_PURCHASE sets has_gold=true for existing user"
pre2_before_ip=$(q "select has_gold from person where uuid = '$user2uuid'::uuid")
export SESSION_TOKEN=""
response=$(
  c POST /revenuecat \
    --header "Authorization: Bearer valid-revenuecat-token" \
    --header "Content-Type: application/json" \
    -d '{ "api_version": "1", "event": { "type": "INITIAL_PURCHASE", "app_user_id": "'"$user1uuid"'" } }'
)

j_assert_length "$(echo "$response" | jq '.all_uuids')" 1
j_assert_length "$(echo "$response" | jq '.updated_uuids')" 1
j_assert_length "$(echo "$response" | jq '.ignored_uuids')" 0
[[ "$(echo "$response" | jq -r '.all_uuids[0]')" == "$user1uuid" ]]
[[ "$(echo "$response" | jq -r '.updated_uuids[0]')" == "$user1uuid" ]]

[[ "$(q "select has_gold from person where uuid = '$user1uuid'::uuid")" == t ]]
[[ "$(q "select has_gold from person where uuid = '$user2uuid'::uuid")" == "$pre2_before_ip" ]]

say "EXPIRATION sets has_gold=false for existing user"
pre2_before_exp=$(q "select has_gold from person where uuid = '$user2uuid'::uuid")
export SESSION_TOKEN=""
response=$(
  c POST /revenuecat \
    --header "Authorization: Bearer valid-revenuecat-token" \
    --header "Content-Type: application/json" \
    -d '{ "event": { "type": "EXPIRATION", "app_user_id": "'"$user1uuid"'" } }'
)

j_assert_length "$(echo "$response" | jq '.all_uuids')" 1
j_assert_length "$(echo "$response" | jq '.updated_uuids')" 1
j_assert_length "$(echo "$response" | jq '.ignored_uuids')" 0
[[ "$(echo "$response" | jq -r '.all_uuids[0]')" == "$user1uuid" ]]
[[ "$(echo "$response" | jq -r '.updated_uuids[0]')" == "$user1uuid" ]]

[[ "$(q "select has_gold from person where uuid = '$user1uuid'::uuid")" == f ]]
[[ "$(q "select has_gold from person where uuid = '$user2uuid'::uuid")" == "$pre2_before_exp" ]]

say "RENEWAL sets has_gold=true for existing user"
pre2_before_ren=$(q "select has_gold from person where uuid = '$user2uuid'::uuid")
export SESSION_TOKEN=""
response=$(
  c POST /revenuecat \
    --header "Authorization: Bearer valid-revenuecat-token" \
    --header "Content-Type: application/json" \
    -d '{ "event": { "type": "RENEWAL", "app_user_id": "'"$user1uuid"'" } }'
)

j_assert_length "$(echo "$response" | jq '.all_uuids')" 1
j_assert_length "$(echo "$response" | jq '.updated_uuids')" 1
j_assert_length "$(echo "$response" | jq '.ignored_uuids')" 0
[[ "$(echo "$response" | jq -r '.all_uuids[0]')" == "$user1uuid" ]]
[[ "$(echo "$response" | jq -r '.updated_uuids[0]')" == "$user1uuid" ]]

[[ "$(q "select has_gold from person where uuid = '$user1uuid'::uuid")" == t ]]
[[ "$(q "select has_gold from person where uuid = '$user2uuid'::uuid")" == "$pre2_before_ren" ]]

say "TRANSFER moves gold from user1 -> user2"
# Ensure user2 ends up with gold, user1 without
export SESSION_TOKEN=""
response=$(
  c POST /revenuecat \
    --header "Authorization: Bearer valid-revenuecat-token" \
    --header "Content-Type: application/json" \
    -d '{ "event": { "type": "TRANSFER", "transferred_to": ["'"$user2uuid"'"], "transferred_from": ["'"$user1uuid"'" ] } }' \
)

# Both UUIDs are referenced
j_assert_length "$(echo "$response" | jq '.all_uuids')" 2
# Both should be updated (they exist)
j_assert_length "$(echo "$response" | jq '.updated_uuids')" 2
j_assert_length "$(echo "$response" | jq '.ignored_uuids')" 0
# Ensure the exact UUID set matches
expected=$(printf "%s\n%s\n" "$user1uuid" "$user2uuid" | sort)
actual_all=$(echo "$response" | jq -r '.all_uuids[]' | sort)
actual_updated=$(echo "$response" | jq -r '.updated_uuids[]' | sort)
[[ "$actual_all" == "$expected" ]]
[[ "$actual_updated" == "$expected" ]]

[[ "$(q "select has_gold from person where uuid = '$user1uuid'::uuid")" == f ]]
[[ "$(q "select has_gold from person where uuid = '$user2uuid'::uuid")" == t ]]

say "Unknown/ignored events return 200 and perform no updates"
pre1=$(q "select has_gold from person where uuid = '$user1uuid'::uuid")
pre2=$(q "select has_gold from person where uuid = '$user2uuid'::uuid")
export SESSION_TOKEN=""
c \
  POST \
  /revenuecat \
  --header "Authorization: Bearer valid-revenuecat-token" \
  --header "Content-Type: application/json" \
  -d '{ "event": { "type": "SOME_UNKNOWN_EVENT", "foo": "bar" } }' > /dev/null
post1=$(q "select has_gold from person where uuid = '$user1uuid'::uuid")
post2=$(q "select has_gold from person where uuid = '$user2uuid'::uuid")
[[ "$pre1" == "$post1" ]]
[[ "$pre2" == "$post2" ]]
