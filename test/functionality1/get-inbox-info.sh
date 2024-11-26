#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

q "delete from duo_session"
q "delete from person"
q "delete from onboardee"
q "delete from undeleted_photo"
q "delete from messaged"

../util/create-user.sh user1 0 0
../util/create-user.sh user2 0 0
../util/create-user.sh user3 0 0
../util/create-user.sh user4 0 1
../util/create-user.sh user5 0 0

user1_id=$(q "select id from person where email = 'user1@example.com'")
user2_id=$(q "select id from person where email = 'user2@example.com'")
user4_id=$(q "select id from person where email = 'user4@example.com'")

user1_uuid=$(q "select uuid from person where email = 'user1@example.com'")
user2_uuid=$(q "select uuid from person where email = 'user2@example.com'")
user4_uuid=$(q "select uuid from person where email = 'user4@example.com'")

q "update photo set uuid = 'my-uuid', blurhash = 'my-blurhash'"

assume_role user2

echo Test 1 - Nobody was messaged
response=$(jc POST "/inbox-info" -d "{ \"person_uuids\": [\"${user4_uuid}\", \"${user1_uuid}\"] }")

actual=$(jq -r 'sort_by(.name)' <<< "$response")
expected='[]'

[[ "$expected" = "$actual" ]]


echo Test 2 - user4 deactivated
q "update person set activated = false where name = 'user4'"
q "insert into messaged values (${user1_id}, ${user2_id})"
q "insert into messaged values (${user4_id}, ${user2_id})"

response=$(jc POST "/inbox-info" -d "{ \"person_uuids\": [\"${user4_uuid}\", \"${user1_uuid}\"] }")

actual=$(jq -r '.' <<< "$response")
expected=$(cat <<EOF
[
  {
    "conversation_location": "intros",
    "image_blurhash": null,
    "image_uuid": null,
    "match_percentage": 50,
    "name": "user1",
    "person_id": ${user1_id},
    "person_uuid": "${user1_uuid}",
    "verified": false
  },
  {
    "conversation_location": "archive",
    "image_blurhash": null,
    "image_uuid": null,
    "match_percentage": null,
    "name": null,
    "person_id": ${user4_id},
    "person_uuid": "${user4_uuid}",
    "verified": false
  }
]
EOF
)

[[ "$expected" = "$actual" ]]


echo Test 3 - user2 skipped by user4
q "update person set activated = true where name = 'user4'"
q "insert into skipped values (${user4_id}, ${user2_id}, true)"

response=$(jc POST "/inbox-info" -d "{ \"person_uuids\": [\"${user4_uuid}\", \"${user1_uuid}\"] }")

actual=$(jq -r '.' <<< "$response")
expected=$(cat <<EOF
[
  {
    "conversation_location": "intros",
    "image_blurhash": null,
    "image_uuid": null,
    "match_percentage": 50,
    "name": "user1",
    "person_id": ${user1_id},
    "person_uuid": "${user1_uuid}",
    "verified": false
  },
  {
    "conversation_location": "archive",
    "image_blurhash": null,
    "image_uuid": null,
    "match_percentage": null,
    "name": null,
    "person_id": ${user4_id},
    "person_uuid": "${user4_uuid}",
    "verified": false
  }
]
EOF
)

[[ "$expected" = "$actual" ]]

echo Test 4 - user4 skipped by user2
q "delete from skipped"
q "insert into skipped values (${user4_id}, ${user2_id}, false)"

response=$(jc POST "/inbox-info" -d "{ \"person_uuids\": [\"${user4_uuid}\", \"${user1_uuid}\"] }")

actual=$(jq -r '.' <<< "$response")
expected=$(cat <<EOF
[
  {
    "conversation_location": "intros",
    "image_blurhash": null,
    "image_uuid": null,
    "match_percentage": 50,
    "name": "user1",
    "person_id": ${user1_id},
    "person_uuid": "${user1_uuid}",
    "verified": false
  },
  {
    "conversation_location": "archive",
    "image_blurhash": null,
    "image_uuid": null,
    "match_percentage": null,
    "name": null,
    "person_id": ${user4_id},
    "person_uuid": "${user4_uuid}",
    "verified": false
  }
]
EOF
)

[[ "$expected" = "$actual" ]]

echo "Test 5a - user2 messaged user4 (user2's perspective)"
q "delete from skipped"
q "delete from messaged"
q "insert into messaged values (${user2_id}, ${user4_id})"

assume_role user2
response=$(jc POST "/inbox-info" -d "{ \"person_uuids\": [\"${user4_uuid}\", \"${user1_uuid}\"] }")

actual=$(jq -r '.' <<< "$response")
expected=$(cat <<EOF
[
  {
    "conversation_location": "nowhere",
    "image_blurhash": "my-blurhash",
    "image_uuid": "my-uuid",
    "match_percentage": 50,
    "name": "user4",
    "person_id": ${user4_id},
    "person_uuid": "${user4_uuid}",
    "verified": false
  }
]
EOF
)

[[ "$expected" = "$actual" ]]

echo "Test 5b - user2 messaged user4 (user4's perspective)"
assume_role user4
response=$(jc POST "/inbox-info" -d "{ \"person_uuids\": [\"${user2_uuid}\", \"${user1_uuid}\"] }")

actual=$(jq -r '.' <<< "$response")
expected=$(cat <<EOF
[
  {
    "conversation_location": "intros",
    "image_blurhash": null,
    "image_uuid": null,
    "match_percentage": 50,
    "name": "user2",
    "person_id": ${user2_id},
    "person_uuid": "${user2_uuid}",
    "verified": false
  }
]
EOF
)

[[ "$expected" = "$actual" ]]


echo "Test 6a - user4 replied to user2 (user2's perspective)"
q "delete from messaged"
q "delete from skipped"
q "insert into messaged values (${user2_id}, ${user4_id})"
q "insert into messaged values (${user4_id}, ${user2_id})"

assume_role user2
response=$(jc POST "/inbox-info" -d "{ \"person_uuids\": [\"${user4_uuid}\", \"${user1_uuid}\"] }")

actual=$(jq -r '.' <<< "$response")
expected=$(cat <<EOF
[
  {
    "conversation_location": "chats",
    "image_blurhash": "my-blurhash",
    "image_uuid": "my-uuid",
    "match_percentage": 50,
    "name": "user4",
    "person_id": ${user4_id},
    "person_uuid": "${user4_uuid}",
    "verified": false
  }
]
EOF
)

[[ "$expected" = "$actual" ]]


echo "Test 6b - user4 replied to user2 (user4's perspective)"
assume_role user4
response=$(jc POST "/inbox-info" -d "{ \"person_uuids\": [\"${user2_uuid}\", \"${user1_uuid}\"] }")

actual=$(jq -r '.' <<< "$response")
expected=$(cat <<EOF
[
  {
    "conversation_location": "chats",
    "image_blurhash": null,
    "image_uuid": null,
    "match_percentage": 50,
    "name": "user2",
    "person_id": ${user2_id},
    "person_uuid": "${user2_uuid}",
    "verified": false
  }
]
EOF
)

[[ "$expected" = "$actual" ]]

echo "Test 7a - user4 skipped user2's message (user2's perspective)"
q "delete from messaged"
q "delete from skipped"
q "insert into messaged values (${user2_id}, ${user4_id})"
q "insert into skipped  values (${user4_id}, ${user2_id})"

assume_role user2
response=$(jc POST "/inbox-info" -d "{ \"person_uuids\": [\"${user4_uuid}\", \"${user1_uuid}\"] }")

actual=$(jq -r '.' <<< "$response")
expected=$(cat <<EOF
[
  {
    "conversation_location": "nowhere",
    "image_blurhash": null,
    "image_uuid": null,
    "match_percentage": null,
    "name": null,
    "person_id": ${user4_id},
    "person_uuid": "${user4_uuid}",
    "verified": false
  }
]
EOF
)

[[ "$expected" = "$actual" ]]

echo "Test 7b - user4 skipped user2's message (user4's perspective)"

assume_role user4
response=$(jc POST "/inbox-info" -d "{ \"person_uuids\": [\"${user2_uuid}\", \"${user1_uuid}\"] }")

actual=$(jq -r '.' <<< "$response")
expected=$(cat <<EOF
[
  {
    "conversation_location": "archive",
    "image_blurhash": null,
    "image_uuid": null,
    "match_percentage": 50,
    "name": "user2",
    "person_id": ${user2_id},
    "person_uuid": "${user2_uuid}",
    "verified": false
  }
]
EOF
)

[[ "$expected" = "$actual" ]]
