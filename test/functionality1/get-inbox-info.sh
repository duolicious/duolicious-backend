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
../util/create-user.sh user3 0 0
../util/create-user.sh user4 0 1
../util/create-user.sh user5 0 0

user1_id=$(q "select id from person where email = 'user1@example.com'")
user2_id=$(q "select id from person where email = 'user2@example.com'")
user4_id=$(q "select id from person where email = 'user4@example.com'")
q "update photo set uuid = 'my-uuid'"

response=$(jc POST /request-otp -d '{ "email": "user2@example.com" }')
SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')
jc POST /check-otp -d '{ "otp": "000000" }'

# TODO: Delete v
response=$(c GET "/inbox-info?prospect-person-id=${user4_id}&prospect-person-id=${user1_id}")

actual=$(jq -r 'sort_by(.name)' <<< "$response")
expected=$(cat <<EOF
[
  {
    "image_uuid": null,
    "match_percentage": 50,
    "name": "user1",
    "person_id": ${user1_id}
  },
  {
    "image_uuid": "my-uuid",
    "match_percentage": 50,
    "name": "user4",
    "person_id": ${user4_id}
  }
]
EOF
)

[[ "$expected" = "$actual" ]]
# TODO: Delete ^

echo Test 1
response=$(jc POST "/inbox-info" -d "{ \"person_ids\": [${user4_id}, ${user1_id}] }")

actual=$(jq -r 'sort_by(.name)' <<< "$response")
expected=$(cat <<EOF
[
  {
    "image_uuid": null,
    "match_percentage": 50,
    "name": "user1",
    "person_id": ${user1_id}
  },
  {
    "image_uuid": "my-uuid",
    "match_percentage": 50,
    "name": "user4",
    "person_id": ${user4_id}
  }
]
EOF
)

[[ "$expected" = "$actual" ]]


echo Test 2
q "update person set activated = false where name = 'user4'"

response=$(jc POST "/inbox-info" -d "{ \"person_ids\": [${user4_id}, ${user1_id}] }")

actual=$(jq -r 'sort_by(.name)' <<< "$response")
expected=$(cat <<EOF
[
  {
    "image_uuid": null,
    "match_percentage": 50,
    "name": "user1",
    "person_id": ${user1_id}
  }
]
EOF
)

[[ "$expected" = "$actual" ]]


echo Test 3
q "update person set activated = true where name = 'user4'"
q "insert into blocked values (${user4_id}, ${user2_id})"

response=$(jc POST "/inbox-info" -d "{ \"person_ids\": [${user4_id}, ${user1_id}] }")

actual=$(jq -r 'sort_by(.name)' <<< "$response")
expected=$(cat <<EOF
[
  {
    "image_uuid": null,
    "match_percentage": 50,
    "name": "user1",
    "person_id": ${user1_id}
  }
]
EOF
)

[[ "$expected" = "$actual" ]]

echo Test 4
q "delete from blocked where subject_person_id = ${user4_id}"
q "insert into hidden values (${user4_id}, ${user2_id})"

response=$(jc POST "/inbox-info" -d "{ \"person_ids\": [${user4_id}, ${user1_id}] }")

actual=$(jq -r 'sort_by(.name)' <<< "$response")
expected=$(cat <<EOF
[
  {
    "image_uuid": null,
    "match_percentage": 50,
    "name": "user1",
    "person_id": ${user1_id}
  }
]
EOF
)

[[ "$expected" = "$actual" ]]

echo Test 5
q "delete from blocked where subject_person_id = ${user4_id}"
q "delete from hidden where subject_person_id = ${user4_id}"

q "insert into blocked values (${user2_id}, ${user4_id})"
q "insert into hidden values (${user2_id}, ${user4_id})"

response=$(jc POST "/inbox-info" -d "{ \"person_ids\": [${user4_id}, ${user1_id}] }")

actual=$(jq -r 'sort_by(.name)' <<< "$response")
expected=$(cat <<EOF
[
  {
    "image_uuid": null,
    "match_percentage": 50,
    "name": "user1",
    "person_id": ${user1_id}
  },
  {
    "image_uuid": "my-uuid",
    "match_percentage": 50,
    "name": "user4",
    "person_id": ${user4_id}
  }
]
EOF
)

[[ "$expected" = "$actual" ]]
