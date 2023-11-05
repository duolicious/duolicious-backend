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
#
# duo_chat=# select * from limit;
# luser |    lserver     | remote_bare_jid  | ... |    timestamp     | muted_until | unread_count 
# ------+----------------+------------------+-----+------------------+-------------+--------------
# 10    | duolicious.app | 2@duolicious.app | ... | 1693028207630107 |           0 |            0
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
  q "delete from inbox" duo_chat

  mkdir -p    ../../test/output/
  printf '' > ../../test/output/cron-autodeactivate2-email

  ../util/create-user.sh will-be-deactivated 0 0

  ../util/create-user.sh will-remain-active1 0 0
  ../util/create-user.sh will-remain-active2 0 0
  ../util/create-user.sh will-remain-active3 0 0
  ../util/create-user.sh will-remain-active4 0 0

  q "
  update person set
    email = REPLACE(email, '@example.com', '@duolicious.app');
  "

  q "
  update person set
    -- In case one of the other cron modules deactivated the accounts
    activated = true,

    -- There's a mechanism which prevents accounts from being re-deactivated
    -- immediately after signing in again. This overrides that mechanism.
    sign_in_time = now() - interval '20 minutes'
  "

  local user1id=$(get_id 'will-be-deactivated@duolicious.app')
  local user2id=$(get_id 'will-remain-active1@duolicious.app')
  local user3id=$(get_id 'will-remain-active2@duolicious.app')
  local user4id=$(get_id 'will-remain-active3@duolicious.app')
  local user5id=$(get_id 'will-remain-active4@duolicious.app')

  local days_ago_0=$( db_now as-seconds)
  local days_ago_3=$( db_now as-seconds '-  3 days')
  local days_ago_6=$( db_now as-seconds '-  6 days')
  local days_ago_9=$( db_now as-seconds '-  9 days')
  local days_ago_12=$(db_now as-seconds '- 12 days')
  local days_ago_15=$(db_now as-seconds '- 15 days')
  local days_ago_18=$(db_now as-seconds '- 18 days')
  local days_ago_21=$(db_now as-seconds '- 21 days')
  local days_ago_24=$(db_now as-seconds '- 24 days')
  local days_ago_27=$(db_now as-seconds '- 27 days')

  q "
  insert into last (server, username, seconds, state)
  values
    ('duolicious.app', '$user1id', $days_ago_15, ''),
    ('duolicious.app', '$user2id', $days_ago_15, ''),
    ('duolicious.app', '$user3id', $days_ago_15, ''),
    ('duolicious.app', '$user4id', $days_ago_15, ''),
    ('duolicious.app', '$user5id', $days_ago_0,  '')
  ON CONFLICT (server, username) DO UPDATE SET
    server   = EXCLUDED.server,
    username = EXCLUDED.username,
    seconds  = EXCLUDED.seconds,
    state    = EXCLUDED.state
  " duo_chat

  q "
  insert into inbox
    (luser, lserver, remote_bare_jid, msg_id, box, content, timestamp, muted_until, unread_count)
  values
    ('$user1id', 'duolicious.app',  '0@duolicious.app', '', 'inbox', '',  ${days_ago_0}::bigint * 1000000, 0, 0),
    ('$user1id', 'duolicious.app',  '3@duolicious.app', '', 'inbox', '',  ${days_ago_3}::bigint * 1000000, 0, 0),
    ('$user1id', 'duolicious.app',  '6@duolicious.app', '', 'inbox', '',  ${days_ago_6}::bigint * 1000000, 0, 0),
    ('$user1id', 'duolicious.app',  '9@duolicious.app', '', 'inbox', '',  ${days_ago_9}::bigint * 1000000, 0, 0),
    ('$user1id', 'duolicious.app', '12@duolicious.app', '', 'inbox', '', ${days_ago_12}::bigint * 1000000, 0, 0),
    ('$user1id', 'duolicious.app', '15@duolicious.app', '', 'inbox', '', ${days_ago_15}::bigint * 1000000, 0, 0),
    ('$user1id', 'duolicious.app', '18@duolicious.app', '', 'inbox', '', ${days_ago_18}::bigint * 1000000, 0, 0),
    ('$user1id', 'duolicious.app', '21@duolicious.app', '', 'inbox', '', ${days_ago_21}::bigint * 1000000, 0, 0),
    ('$user1id', 'duolicious.app', '24@duolicious.app', '', 'inbox', '', ${days_ago_24}::bigint * 1000000, 0, 0),
    ('$user1id', 'duolicious.app', '27@duolicious.app', '', 'inbox', '', ${days_ago_27}::bigint * 1000000, 0, 0),

    ('$user2id', 'duolicious.app',  '0@duolicious.app', '', 'inbox', '',  ${days_ago_0}::bigint * 1000000, 0, 0),
    ('$user2id', 'duolicious.app',  '3@duolicious.app', '', 'inbox', '',  ${days_ago_3}::bigint * 1000000, 0, 0),
    ('$user2id', 'duolicious.app',  '6@duolicious.app', '', 'inbox', '',  ${days_ago_6}::bigint * 1000000, 0, 0),
    ('$user2id', 'duolicious.app',  '9@duolicious.app', '', 'inbox', '',  ${days_ago_9}::bigint * 1000000, 0, 0),
 -- ('$user2id', 'duolicious.app', '12@duolicious.app', '', 'inbox', '', ${days_ago_12}::bigint * 1000000, 0, 0),
 -- ('$user2id', 'duolicious.app', '15@duolicious.app', '', 'inbox', '', ${days_ago_15}::bigint * 1000000, 0, 0),
    ('$user2id', 'duolicious.app', '18@duolicious.app', '', 'inbox', '', ${days_ago_18}::bigint * 1000000, 0, 0),
    ('$user2id', 'duolicious.app', '21@duolicious.app', '', 'inbox', '', ${days_ago_21}::bigint * 1000000, 0, 0),
    ('$user2id', 'duolicious.app', '24@duolicious.app', '', 'inbox', '', ${days_ago_24}::bigint * 1000000, 0, 0),
    ('$user2id', 'duolicious.app', '27@duolicious.app', '', 'inbox', '', ${days_ago_27}::bigint * 1000000, 0, 0),

 -- ('$user3id', 'duolicious.app',  '0@duolicious.app', '', 'inbox', '',  ${days_ago_0}::bigint * 1000000, 0, 0),
 -- ('$user3id', 'duolicious.app',  '3@duolicious.app', '', 'inbox', '',  ${days_ago_3}::bigint * 1000000, 0, 0),
 -- ('$user3id', 'duolicious.app',  '6@duolicious.app', '', 'inbox', '',  ${days_ago_6}::bigint * 1000000, 0, 0),
 -- ('$user3id', 'duolicious.app',  '9@duolicious.app', '', 'inbox', '',  ${days_ago_9}::bigint * 1000000, 0, 0),
 -- ('$user3id', 'duolicious.app', '12@duolicious.app', '', 'inbox', '', ${days_ago_12}::bigint * 1000000, 0, 0),
 -- ('$user3id', 'duolicious.app', '15@duolicious.app', '', 'inbox', '', ${days_ago_15}::bigint * 1000000, 0, 0),
    ('$user3id', 'duolicious.app', '18@duolicious.app', '', 'inbox', '', ${days_ago_18}::bigint * 1000000, 0, 0),
    ('$user3id', 'duolicious.app', '21@duolicious.app', '', 'inbox', '', ${days_ago_21}::bigint * 1000000, 0, 0),
    ('$user3id', 'duolicious.app', '24@duolicious.app', '', 'inbox', '', ${days_ago_24}::bigint * 1000000, 0, 0),
    ('$user3id', 'duolicious.app', '27@duolicious.app', '', 'inbox', '', ${days_ago_27}::bigint * 1000000, 0, 0)
  " duo_chat

  sleep 2

  [[ "$(q "select 1 from person where activated = false and email like 'will-be-deactivated%' ")" = "1" ]]
  [[ "$(q "select 1 from person where activated = true  and email like 'will-remain-active1%' ")" = "1" ]]
  [[ "$(q "select 1 from person where activated = true  and email like 'will-remain-active2%' ")" = "1" ]]
  [[ "$(q "select 1 from person where activated = true  and email like 'will-remain-active3%' ")" = "1" ]]
  [[ "$(q "select 1 from person where activated = true  and email like 'will-remain-active4%' ")" = "1" ]]
  [[ "$(q "select count(*) from duo_session ")" = "4" ]]

  diff \
    ../../test/output/cron-autodeactivate2-email \
    ../../test/fixtures/cron-autodeactivate2-email
}

do_test
