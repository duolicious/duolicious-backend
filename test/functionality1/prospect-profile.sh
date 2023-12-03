#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

q "delete from duo_session"
q "delete from person"
q "delete from person_club"
q "delete from club"

../util/create-user.sh user1 0 0
../util/create-user.sh user2 0 0

assume_role user1
response=$(c GET /prospect-profile/$(q "select id from person where name = 'user2'"))
expected=$(jq -r . << EOF
{
  "about": "Im a reasonable person",
  "age": 26,
  "count_answers": 0,
  "drinking": null,
  "drugs": null,
  "education": null,
  "exercise": null,
  "gender": "Other",
  "has_kids": null,
  "height_cm": null,
  "is_blocked": false,
  "is_hidden": false,
  "location": "New York, New York, United States",
  "long_distance": null,
  "looking_for": null,
  "match_percentage": 50,
  "mutual_clubs": [],
  "name": "user2",
  "occupation": null,
  "orientation": null,
  "other_clubs": [],
  "photo_uuids": null,
  "relationship_status": null,
  "religion": null,
  "smoking": null,
  "star_sign": null,
  "wants_kids": null
}
EOF
)
[[ "$response" == "$expected" ]]


assume_role user1
jc POST /join-club -d '{ "name": "my-club-shared-1" }'
jc POST /join-club -d '{ "name": "my-club-shared-2" }'
jc POST /join-club -d '{ "name": "my-club-unshared-10" }'
jc POST /join-club -d '{ "name": "my-club-unshared-20" }'

assume_role user2
jc POST /join-club -d '{ "name": "my-club-shared-1" }'
jc POST /join-club -d '{ "name": "my-club-shared-2" }'
jc POST /join-club -d '{ "name": "my-club-unshared-11" }'
jc POST /join-club -d '{ "name": "my-club-unshared-21" }'

assume_role user1
response=$(c GET /prospect-profile/$(q "select id from person where name = 'user2'"))
expected=$(jq -r . << EOF
{
  "about": "Im a reasonable person",
  "age": 26,
  "count_answers": 0,
  "drinking": null,
  "drugs": null,
  "education": null,
  "exercise": null,
  "gender": "Other",
  "has_kids": null,
  "height_cm": null,
  "is_blocked": false,
  "is_hidden": false,
  "location": "New York, New York, United States",
  "long_distance": null,
  "looking_for": null,
  "match_percentage": 50,
  "mutual_clubs": ["my-club-shared-1", "my-club-shared-2"],
  "name": "user2",
  "occupation": null,
  "orientation": null,
  "other_clubs": ["my-club-unshared-11", "my-club-unshared-21"],
  "photo_uuids": null,
  "relationship_status": null,
  "religion": null,
  "smoking": null,
  "star_sign": null,
  "wants_kids": null
}
EOF
)
[[ "$response" == "$expected" ]]
