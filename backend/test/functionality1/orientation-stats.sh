#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

q "delete from person"

../util/create-user.sh user1 0 0
../util/create-user.sh user2 0 0
../util/create-user.sh user3 0 0
../util/create-user.sh user4 0 0
../util/create-user.sh user5 0 0

q "update person set orientation_id = 3 where name = 'user1'"
q "update person set orientation_id = 4 where name = 'user2'"
q "update person set orientation_id = 4 where name = 'user3'"
q "update person set orientation_id = 2 where name = 'user4'"
q "update person set orientation_id = 1 where name = 'user5'"

set -xe

flush_redis

response=$(c GET /stats)

[[ $(jq -r '.gay_percentage' <<< "$response") = '25.0' ]]
[[ $(jq -r '.lesbian_percentage' <<< "$response") = '50.0' ]]
