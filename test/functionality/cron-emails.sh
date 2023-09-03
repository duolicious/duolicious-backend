#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -ex

################################################################################
# duo_chat=# select * from last;
#      server     | username |  seconds   | state
# ----------------+----------+------------+-------
#  duolicious.app | 2        | 1693678400 |
# (1 row)
################################################################################
# duo_chat=# select * from inbox;
#  luser |    lserver     | remote_bare_jid  |                  msg_id                  |  box  | content |    timestamp     | muted_until | unread_count
# -------+----------------+------------------+------------------------------------------+-------+---------+------------------+-------------+--------------
#  2     | duolicious.app | 1@duolicious.app | Fv2SDTePaYDhaIANaCeqG8wDFFxHrQp6vTlGXB1Y | inbox |         | 1693678421648540 |           0 |            1
#  1     | duolicious.app | 2@duolicious.app | Fv2SDTePaYDhaIANaCeqG8wDFFxHrQp6vTlGXB1Y | chats |         | 1693678421648540 |           0 |            0
# (2 rows)
################################################################################
# duo_api=# select id AS person_id, name, email, chats_drift_seconds, intros_drift_seconds from person;
# ...
# (? rows)
################################################################################
# duo_chat=# select * from duo_last_notification;
#  username |  seconds
# ----------+------------
#  2        | 1693678935
# (1 row)
################################################################################

setup () {
  printf '' > ../../test/output/cron-emails
  q "delete from last" duo_chat
  q "delete from inbox" duo_chat
  q "delete from duo_last_notification" duo_chat
  q "delete from person"

  ../util/create-user.sh user1 0 0
  ../util/create-user.sh user2 0 0

  q "
  UPDATE person
  SET email = REPLACE(email, '@example.com', '@duolicious.app')
  "

  user1id=$(get_id 'user1@duolicious.app')
  user2id=$(get_id 'user2@duolicious.app')

  # TODO
  #q "
  #insert into last
  #values
  #  ('', $user1id, 0, '')
  #"

  #q "
  #insert into duo_last_notification
  #values
  #  ('', $user1id, 0, '')
  #"
}

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

test_happy_path_intros () {
  setup

  local eleven_minutes_ago=$(db_now as-microseconds '- 11 minutes')

  [[ -z "$(q "select * from duo_last_notification" duo_chat)" ]]

  q "
  insert into inbox
  values
    ($user1id, '', '', '', 'inbox', '', ${eleven_minutes_ago}, 0, 42)
  " duo_chat

  sleep 2

  [[ -n "$(q "select * from duo_last_notification" duo_chat)" ]]
}

test_happy_path_chats () {
  setup

  local eleven_minutes_ago=$(db_now as-microseconds '- 11 minutes')

  [[ -z "$(q "select * from duo_last_notification" duo_chat)" ]]

  q "
  insert into inbox
  values
    ($user1id, '', '', '', 'chats', '', ${eleven_minutes_ago}, 0, 42)
  " duo_chat

  sleep 2

  [[ -n "$(q "select * from duo_last_notification" duo_chat)" ]]
}

test_happy_path_intros
test_happy_path_chats
