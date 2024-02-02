#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

q "delete from person"

../util/create-user.sh user1 0 0
../util/create-user.sh user2 0 0

set -xe

q "update person set activated = false where name = 'user1'"

response=$(c GET '/stats')

num_active_users=$(jq -r '.num_active_users' <<< "$response")

[[ "$num_active_users" -eq 1 ]]
