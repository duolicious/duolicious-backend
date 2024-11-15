#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

data_export_fixture_path=$( readlink -m ../fixtures/data-export.json )

quietly_assume_role () {
  sign_in_count=$(q "select sign_in_count from person where name = '$1'")
  sign_in_time=$(q "select sign_in_time from person where name = '$1'")

  # Retry logic, while we wait for the DB to come back up
  while ! assume_role "$1"
  do
    sleep 0.1
  done

  q "update person set sign_in_count = $sign_in_count where name = '$1'"
  q "update person set sign_in_time = '$sign_in_time' where name = '$1'"
}

update_snapshot () {
  q "delete from person"

  ../util/create-user.sh user1 2 2

  # Wait for images to be given nsfw scores
  sleep 5

  qdump data-export

  quietly_assume_role user1

  export_data_token=$( c GET '/export-data-token' | jq -r '.token' )

  c GET "/export-data/$export_data_token" > "$data_export_fixture_path"
}

update_snapshot_or_restore () {
  if [[ "$1" = "update-snapshot" ]]
  then
    update_snapshot
  else
    q "delete from person"

    # Retry logic in case the first restore attempt fails
    while [[ "$(q "select count(*) from person")" = 0 ]]
    do
      qrestore data-export
    done
  fi
}

setup () {
  update_snapshot_or_restore "$@"

  quietly_assume_role user1
}

setup "$@"

export_data_token=$( c GET '/export-data-token' | jq -r '.token' )

diff -Z \
  "$data_export_fixture_path" \
  <( c GET "/export-data/$export_data_token" )
