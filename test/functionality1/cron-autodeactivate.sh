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

  ../util/create-user.sh will-be-deactivated 0 0
  ../util/create-user.sh will-remain-active1 0 0
  ../util/create-user.sh will-remain-active2 0 0

  q "
  UPDATE person
  SET
    email = 'will-remain-active1@duolicious.app'
  WHERE
    email = 'will-remain-active1@example.com'
  "

  user1id=$(get_id 'will-be-deactivated@example.com')
  user2id=$(get_id 'will-remain-active1@duolicious.app')
  user3id=$(get_id 'will-remain-active2@example.com')

  local days_ago_2=$(db_now as-seconds '- 2 days')
  local days_ago_3=$(db_now as-seconds '- 3 days - 1 minute')

  q "
  insert into last (server, username, seconds, state)
  values
    ('duolicious.app', '$user1id', $days_ago_3, ''),
    ('duolicious.app', '$user2id', $days_ago_3, ''),
    ('duolicious.app', '$user3id', $days_ago_2, '')
  ON CONFLICT (server, username) DO UPDATE SET
    server   = EXCLUDED.server,
    username = EXCLUDED.username,
    seconds  = EXCLUDED.seconds,
    state    = EXCLUDED.state
  " duo_chat

  sleep 2

  [[ "$(q "select 1 from person where activated = false and email like 'will-be-deactivated%' ")" = "1" ]]
  [[ "$(q "select 1 from person where activated = true  and email like 'will-remain-active1%' ")" = "1" ]]
  [[ "$(q "select 1 from person where activated = true  and email like 'will-remain-active2%' ")" = "1" ]]
  [[ "$(q "select count(*) from duo_session ")" = "2" ]]
}

do_test
