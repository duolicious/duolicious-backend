#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

data_export_fixture_path=$( readlink -m ../fixtures/data-export.json )

quietly_assume_role () {
  sign_in_count=$(q "select sign_in_count from person where name = '$1'")
  sign_in_time=$(q "select sign_in_time from person where name = '$1'")

  while ! assume_role "$1"
  do
    sleep 0.1
  done

  q "update person set sign_in_count = $sign_in_count where name = '$1'"
  q "update person set sign_in_time = '$sign_in_time' where name = '$1'"

  q "
  DELETE FROM duo_session
  WHERE
    session_expiry = (
      SELECT MIN(session_expiry)
      FROM duo_session
      WHERE email = '$1@example.com'
    )
  AND
    email = '$1@example.com'
  "

  q "
    update duo_session
    set session_expiry = '2099-01-01'
    where email = '$1@example.com'"
}

update_snapshot () {
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
    qrestore data-export
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
