#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

q "delete from person"

../util/create-user.sh user1 0 0 || exit 1
../util/create-user.sh user2 0 0 || exit 1

q "update person set roles = '{\"bot\"}' where name = 'user1'"

assume_role user1 && exit 1
assume_role user2

q "update person set roles = '{}' where name = 'user1'"

assume_role user1
assume_role user2
