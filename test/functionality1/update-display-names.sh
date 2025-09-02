#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

q "delete from person"

../util/create-user.sh jordan 0 0

assume_role jordan

jc PATCH /profile-info -d '{ "name": "alex" }' && exit 1

q "update person set has_gold = true"

jc PATCH /profile-info -d '{ "name": "alex" }' || exit 1
