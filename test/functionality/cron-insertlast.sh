#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -ex

################################################################################
#
# duo_chat=# select * from last;
#      server     | username |  seconds   | state
# ----------------+----------+------------+-------
#  duolicious.app | 2        | 1693678400 |
# (1 row)
#
################################################################################

db_now () {
  local units=${1:-as-seconds}
  local interval=${2:-'0 minutes'}
  local conversion_factor

  if [[ "$units" = 'as-seconds' ]]; then
    conversion_factor=1
  elif [[ "$units" = 'as-microseconds' ]]; then
    conversion_factor=1000000
  else
    return 1
  fi

  q "select (extract(epoch from now() + interval '${interval}') * ${conversion_factor})::bigint"
}

do_test () {
  q "delete from person"
  q "delete from duo_session"
  q "delete from last" duo_chat

  ../util/create-user.sh will-be-inserted 0 0
  ../util/create-user.sh wont-be-inserted-cuz-late 0 0
  ../util/create-user.sh wont-be-inserted-cuz-exists 0 0

  user1id=$(get_id 'will-be-inserted@example.com')
  user2id=$(get_id 'wont-be-inserted-cuz-late@example.com')
  user3id=$(get_id 'wont-be-inserted-cuz-exists@example.com')

  q "
  update person
  set
    sign_up_time = NOW() - INTERVAL '1 second' * 2 - INTERVAL '365 day' - INTERVAL '1 second' * 42
  where id = $user2id"
  q "delete from last" duo_chat

  q "
  insert into last (server, username, seconds, state)
  values
    ('duolicious.app', '$user3id', 42, '')
  ON CONFLICT (server, username) DO UPDATE SET
    server   = EXCLUDED.server,
    username = EXCLUDED.username,
    seconds  = EXCLUDED.seconds,
    state    = EXCLUDED.state
  " duo_chat

  sleep 2

  [[ "$(q "select 1 from last where username = '${user1id}'                  " duo_chat)" = "1" ]]
  [[ "$(q "select 1 from last where username = '${user2id}'                  " duo_chat)" = "" ]]
  [[ "$(q "select 1 from last where username = '${user3id}' and seconds = 42 " duo_chat)" = "1" ]]
}

do_test
