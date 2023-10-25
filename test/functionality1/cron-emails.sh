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
# duo_chat=# select * from inbox;
#  luser |    lserver     | remote_bare_jid  |                  msg_id                  |  box  | content |    timestamp     | muted_until | unread_count
# -------+----------------+------------------+------------------------------------------+-------+---------+------------------+-------------+--------------
#  2     | duolicious.app | 1@duolicious.app | Fv2SDTePaYDhaIANaCeqG8wDFFxHrQp6vTlGXB1Y | inbox |         | 1693678421648540 |           0 |            1
#  1     | duolicious.app | 2@duolicious.app | Fv2SDTePaYDhaIANaCeqG8wDFFxHrQp6vTlGXB1Y | chats |         | 1693678421648540 |           0 |            0
# (2 rows)
#
################################################################################
#
# duo_api=# select id AS person_id, name, email, chats_drift_seconds, intros_drift_seconds from person;
# ...
# (? rows)
################################################################################
# duo_chat=# select * from duo_last_notification;
#  username | intro_seconds | chat_seconds
# ----------+---------------+--------------
#  67       |    1693776210 |   1693778611
# (1 row)
#
################################################################################

setup () {
  q "delete from inbox" duo_chat
  q "delete from person"
  q "delete from last" duo_chat
  q "delete from duo_last_notification" duo_chat

  mkdir -p    ../../test/output/
  printf '' > ../../test/output/cron-emails

  ../util/create-user.sh user1 0 0
  ../util/create-user.sh user2 0 0
  ../util/create-user.sh user3 0 0

  q "
  UPDATE person
  SET email = REPLACE(email, '@example.com', '@duolicious.app')
  "

  user1id=$(get_id 'user1@duolicious.app')
  user2id=$(get_id 'user2@duolicious.app')
  user3id=$(get_id 'user3@duolicious.app')

  q "
  insert into last (server, username, seconds, state)
  values
    ('duolicious.app', '$user1id', 0, ''),
    ('duolicious.app', '$user2id', 0, ''),
    ('duolicious.app', '$user3id', 0, '')
  ON CONFLICT (server, username) DO UPDATE SET
    server   = EXCLUDED.server,
    username = EXCLUDED.username,
    seconds  = EXCLUDED.seconds,
    state    = EXCLUDED.state
  " duo_chat
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

  local time_interval=$(db_now as-microseconds '- 11 minutes')

  [[ "$(q "select count(*) from duo_last_notification" duo_chat)" = 0 ]]

  q "
  insert into inbox
  values
    ($user1id, '', '', '', 'inbox', '', ${time_interval}, 0, 42),
    ($user2id, '', '', '', 'inbox', '', ${time_interval}, 0, 0)
  " duo_chat

  sleep 2

  [[ "$(q "select count(*) from duo_last_notification" duo_chat)" = 1 ]]

  diff \
    ../../test/output/cron-emails \
    ../../test/fixtures/cron-emails-happy-path-intros
}

test_happy_path_chats () {
  setup

  local time_interval=$(db_now as-microseconds '- 11 minutes')

  [[ "$(q "select count(*) from duo_last_notification" duo_chat)" = 0 ]]

  q "
  insert into inbox
  values
    ($user1id, '', '', '', 'chats', '', ${time_interval}, 0, 42),
    ($user2id, '', '', '', 'chats', '', ${time_interval}, 0, 0)
  " duo_chat

  sleep 2

  [[ "$(q "select count(*) from duo_last_notification" duo_chat)" = 1 ]]

  diff \
    ../../test/output/cron-emails \
    ../../test/fixtures/cron-emails-happy-path-chats
}

test_happy_path_chat_not_deferred_by_intro () {
  setup

  # Default drift period for intros (i.e. inbox messages) is 1 day = 86400 s.
  local t1=$(db_now as-microseconds '- 50 minutes') # last intro
  local t2=$(db_now as-seconds      '- 40 minutes') # last notification
  local t3=$(db_now as-microseconds '- 30 minutes') # last chat

  # Insert last notification
  q "
  insert into duo_last_notification
  values
    ($user1id, $t2)
  " duo_chat
  local rows=$(
    q "select count(*)
    from duo_last_notification
    where username = '$user1id'
    and chat_seconds = 0
    and intro_seconds = $t2" duo_chat
  )
  [[ "$rows" = 1 ]]

  # Insert last message
  q "
  insert into inbox
  values
    ($user1id, '', 'sender1', '', 'chats', '', ${t3}, 0, 42),
    ($user1id, '', 'sender2', '', 'inbox', '', ${t1}, 0,  0)
  " duo_chat
  [[ "$(q "select count(*) from inbox" duo_chat)" = 2 ]]

  sleep 2

  # Cron service should still send chat notification
  local rows=$(
    q "select count(*)
    from duo_last_notification
    where username = '$user1id'
    and chat_seconds != 0
    and intro_seconds = $t2" duo_chat
  )
  [[ "$rows" = 1 ]]

  diff \
    ../../test/output/cron-emails \
    ../../test/fixtures/cron-emails-happy-path-chat-not-deffered-by-intro
}

test_sad_sent_9_minutes_ago () {
  setup

  local time_interval=$(db_now as-microseconds '- 9 minutes')

  [[ "$(q "select count(*) from duo_last_notification" duo_chat)" = 0 ]]
  [[ ! -s ../../test/output/cron-emails ]]

  q "
  insert into inbox
  values
    ($user1id, '', '', '', 'chats', '', ${time_interval}, 0, 42),
    ($user2id, '', '', '', 'inbox', '', ${time_interval}, 0, 43)
  " duo_chat
  [[ "$(q "select count(*) from inbox" duo_chat)" = 2 ]]

  sleep 2

  [[ "$(q "select count(*) from duo_last_notification" duo_chat)" = 0 ]]
  [[ ! -s ../../test/output/cron-emails ]]
}

test_sad_sent_11_days_ago () {
  setup

  local time_interval=$(db_now as-microseconds '- 11 days')

  [[ "$(q "select count(*) from duo_last_notification" duo_chat)" = 0 ]]
  [[ ! -s ../../test/output/cron-emails ]]

  q "
  insert into inbox
  values
    ($user1id, '', '', '', 'chats', '', ${time_interval}, 0, 42),
    ($user2id, '', '', '', 'inbox', '', ${time_interval}, 0, 43)
  " duo_chat
  [[ "$(q "select count(*) from inbox" duo_chat)" = 2 ]]

  sleep 2

  [[ "$(q "select count(*) from duo_last_notification" duo_chat)" = 0 ]]
  [[ ! -s ../../test/output/cron-emails ]]
}

test_sad_only_old_messages () {
  setup

  local time_interval=$(db_now as-microseconds '- 11 minutes')

  [[ "$(q "select count(*) from duo_last_notification" duo_chat)" = 0 ]]
  [[ ! -s ../../test/output/cron-emails ]]

  q "
  insert into inbox
  values
    ($user1id, '', '', '', 'chats', '', ${time_interval}, 0, 0),
    ($user2id, '', '', '', 'inbox', '', ${time_interval}, 0, 0)
  " duo_chat
  [[ "$(q "select count(*) from inbox" duo_chat)" = 2 ]]

  sleep 2

  [[ "$(q "select count(*) from duo_last_notification" duo_chat)" = 0 ]]
  [[ ! -s ../../test/output/cron-emails ]]
}

test_sad_still_active () {
  setup

  local t1=$(db_now as-microseconds '- 11 minutes')
  local t2=$(db_now as-seconds      '-  9 minutes')

  [[ "$(q "select count(*) from duo_last_notification" duo_chat)" = 0 ]]

  q "
  insert into last
  values
    ('duolicious.app', $user1id, $t2, '')
  ON CONFLICT (server, username) DO UPDATE SET
    server   = EXCLUDED.server,
    username = EXCLUDED.username,
    seconds  = EXCLUDED.seconds,
    state    = EXCLUDED.state
  " duo_chat

  q "
  insert into inbox
  values
    ($user1id, '', '', '', 'chats', '', ${t1}, 0, 42),
    ($user2id, '', '', '', 'chats', '', ${t1}, 0, 0)
  " duo_chat
  [[ "$(q "select count(*) from inbox" duo_chat)" = 2 ]]

  sleep 2

  [[ "$(q "select count(*) from duo_last_notification" duo_chat)" = 0 ]]

  [[ ! -s ../../test/output/cron-emails ]]
}

test_sad_already_notified_for_particular_message () {
  setup

  local t1=$(db_now as-microseconds '-  5 minutes') # 1st message to user1
  local t2=$(db_now as-seconds      '-  7 minutes') # 1st notification to user1
  local t3=$(db_now as-microseconds '- 11 minutes') # 1st message to user2
  local t4=$(db_now as-microseconds '- 13 minutes') # 1st message to user3

  [[ "$(q "select count(*) from duo_last_notification" duo_chat)" = 0 ]]
  [[ ! -s ../../test/output/cron-emails ]]

  q "
  insert into duo_last_notification
  values
    ($user1id, $t2)
  " duo_chat
  [[ "$(q "select count(*) from duo_last_notification" duo_chat)" = 1 ]]

  q "
  insert into inbox
  values
    ($user1id, '', '', '', 'chats', '', ${t1}, 0, 42),
    ($user2id, '', '', '', 'inbox', '', ${t3}, 0, 43),
    ($user3id, '', '', '', 'inbox', '', ${t4}, 0,  0)
  " duo_chat
  [[ "$(q "select count(*) from inbox" duo_chat)" = 3 ]]

  sleep 2

  [[ "$(q "select count(*) from duo_last_notification" duo_chat)" = 2 ]]

  diff \
    ../../test/output/cron-emails \
    ../../test/fixtures/cron-emails-sad-already-notified-for-particular-message
}

test_sad_already_notified_for_other_intro_in_drift_period () {
  setup

  # Default drift period for intros (i.e. inbox messages) is 1 day = 86400 s.
  local t1=$(db_now as-seconds      '- 40 minutes') # last notification
  local t2=$(db_now as-microseconds '- 30 minutes') # last message

  # Insert last notification
  q "
  insert into duo_last_notification
  values
    ($user1id, $t1)
  " duo_chat
  local rows=$(
    q "select count(*)
    from duo_last_notification
    where username = '$user1id'
    and chat_seconds = 0
    and intro_seconds = $t1" duo_chat
  )
  [[ "$rows" = 1 ]]

  # Insert last message
  q "
  insert into inbox
  values
    ($user1id, '', '', '', 'inbox', '', ${t2}, 0, 42),
    ($user2id, '', '', '', 'inbox', '', ${t2}, 0,  0)
  " duo_chat
  [[ "$(q "select count(*) from inbox" duo_chat)" = 2 ]]

  sleep 2

  # Cron service should prevent 2nd intros notification from being sent
  local rows=$(
    q "select count(*)
    from duo_last_notification
    where username = '$user1id'
    and chat_seconds = 0
    and intro_seconds = $t1" duo_chat
  )
  [[ "$rows" = 1 ]]

  [[ ! -s ../../test/output/cron-emails ]]
}

# The user has already received an intro in the past day and a chat in the past
# 10 minutes. They were notified about both of these. Then the user gets another
# chat within this same 10 minute window. The user should not be notified about
# this chat during this time.
test_sad_intro_within_day_and_chat_within_past_10_minutes () {
  setup

  # Default drift period for intros (i.e. inbox messages) is 1 day = 86400 s.
  local t1=$(db_now as-microseconds '- 13 hours             ') # last intro
  local t2=$(db_now as-seconds      '- 13 minutes + 1 second') # last intro notification
  local t3=$(db_now as-seconds      '-  5 minutes           ') # last chat notification
  local t4=$(db_now as-microseconds '-  3 minutes           ') # last chat

  # Insert last notification
  q "
  insert into duo_last_notification (username, intro_seconds, chat_seconds)
  values
    ($user1id, $t2, $t3)
  " duo_chat
  local rows=$(
    q "select count(*)
    from duo_last_notification
    where username = '$user1id'
    and intro_seconds = $t2
    and chat_seconds = $t3" duo_chat
  )
  [[ "$rows" = 1 ]]

  # Insert intro and chat
  q "
  insert into inbox
  values
    ($user1id, '', 'sender2', '', 'inbox', '', ${t1}, 0, 42),
    ($user1id, '', 'sender1', '', 'chats', '', ${t4}, 0, 43)
  " duo_chat
  [[ "$(q "select count(*) from inbox" duo_chat)" = 2 ]]

  sleep 2

  # Cron service should not send any notifications and duo_last_notification
  # should remain unchanged
  local rows=$(
    q "select count(*)
    from duo_last_notification
    where username = '$user1id'
    and intro_seconds = $t2
    and chat_seconds = $t3" duo_chat
  )
  [[ "$rows" = 1 ]]

  [[ ! -s ../../test/output/cron-emails ]]
}

test_happy_path_intros
test_happy_path_chats
test_happy_path_chat_not_deferred_by_intro

test_sad_sent_9_minutes_ago
test_sad_sent_11_days_ago
test_sad_only_old_messages
test_sad_still_active

test_sad_already_notified_for_particular_message
test_sad_already_notified_for_other_intro_in_drift_period

test_sad_intro_within_day_and_chat_within_past_10_minutes
