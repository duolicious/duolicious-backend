#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

q "delete from person"

  ../util/create-user.sh user1 0 0

assume_role user1

! jc PATCH /profile-info -d '{ "education": "i hate minorities" }' || exit 1
  jc PATCH /profile-info -d '{ "education": "i love minorities" }'
