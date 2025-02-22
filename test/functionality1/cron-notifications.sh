#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -ex

################################################################################
#
# duo_api=# select * from last;
#  username |  seconds
# ----------+------------
#  2        | 1693678400
# (1 row)
#
################################################################################
#
# duo_api=# select * from inbox;
#  luser | remote_bare_jid  |                  msg_id                  |  box  | content |    timestamp     | unread_count
# -------+------------------+------------------------------------------+-------+---------+------------------+--------------
#  2     | 1@duolicious.app | Fv2SDTePaYDhaIANaCeqG8wDFFxHrQp6vTlGXB1Y | inbox |         | 1693678421648540 |            1
#  1     | 2@duolicious.app | Fv2SDTePaYDhaIANaCeqG8wDFFxHrQp6vTlGXB1Y | chats |         | 1693678421648540 |            0
# (2 rows)
#
################################################################################
#
# duo_api=# select id AS person_id, name, email, chats_drift_seconds, intros_drift_seconds from person;
# ...
# (? rows)
################################################################################
# duo_api=# select * from duo_last_notification;
#  username | intro_seconds | chat_seconds
# ----------+---------------+--------------
#  67       |    1693776210 |   1693778611
# (1 row)
#
################################################################################

setup () {
  q "delete from inbox"
  q "delete from person"
  q "delete from last"
  q "delete from duo_last_notification"
  q "delete from duo_push_token"

  delete_emails

  ../util/create-user.sh user1 0 0
  ../util/create-user.sh user2 0 0
  ../util/create-user.sh user3 0 0

  q "
  UPDATE person
  SET email = REPLACE(email, '@example.com', '@duolicious.app')
  "

  user1id=$(q "select uuid from person where email = 'user1@duolicious.app'")
  user2id=$(q "select uuid from person where email = 'user2@duolicious.app'")
  user3id=$(q "select uuid from person where email = 'user3@duolicious.app'")

  q "
  insert into last (username, seconds)
  values
    ('$user1id', 0),
    ('$user2id', 0),
    ('$user3id', 0)
  ON CONFLICT (username) DO UPDATE SET
    username = EXCLUDED.username,
    seconds  = EXCLUDED.seconds
  "
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

  [[ "$(q "select count(*) from duo_last_notification")" = 0 ]]

  q "
  insert into inbox
  values
    ('$user1id', '', '', 'inbox', '', ${time_interval}, 42),
    ('$user2id', '', '', 'inbox', '', ${time_interval}, 0)
  "

  sleep 2

  [[ "$(q " \
    select count(*) \
    from duo_last_notification \
    where \
    username = '$user1id' and \
    chat_seconds = 0 and \
    intro_seconds > 0")" = 1 ]]

  diff \
    <(get_emails) \
    ../../test/fixtures/cron-emails-happy-path-intros
}

test_happy_path_chats () {
  setup

  local time_interval=$(db_now as-microseconds '- 11 minutes')

  [[ "$(q "select count(*) from duo_last_notification")" = 0 ]]

  q "
  insert into inbox
  values
    ('$user1id', '', '', 'chats', '', ${time_interval}, 42),
    ('$user2id', '', '', 'chats', '', ${time_interval}, 0)
  "

  sleep 2

  [[ "$(q " \
    select count(*) \
    from duo_last_notification \
    where \
    username = '$user1id' and \
    chat_seconds > 0 and \
    intro_seconds = 0")" = 1 ]]

  diff \
    <(get_emails) \
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
    ('$user1id', $t2)
  "
  local rows=$(
    q "select count(*)
    from duo_last_notification
    where username = '$user1id'
    and chat_seconds = 0
    and intro_seconds = $t2"
  )
  [[ "$rows" = 1 ]]

  # Insert last message
  q "
  insert into inbox
  values
    ('$user1id', 'sender1', '', 'chats', '', ${t3}, 42),
    ('$user1id', 'sender2', '', 'inbox', '', ${t1},  0)
  "
  [[ "$(q "select count(*) from inbox")" = 2 ]]

  sleep 2

  # Cron service should still send chat notification
  local rows=$(
    q "select count(*)
    from duo_last_notification
    where username = '$user1id'
    and chat_seconds != 0
    and intro_seconds = $t2"
  )
  [[ "$rows" = 1 ]]

  diff \
    <(get_emails) \
    ../../test/fixtures/cron-emails-happy-path-chat-not-deffered-by-intro
}

test_sad_sent_9_minutes_ago () {
  setup

  local time_interval=$(db_now as-microseconds '- 9 minutes')

  [[ "$(q "select count(*) from duo_last_notification")" = 0 ]]
  is_inbox_empty

  q "
  insert into inbox
  values
    ('$user1id', '', '', 'chats', '', ${time_interval}, 42),
    ('$user2id', '', '', 'inbox', '', ${time_interval}, 43)
  "
  [[ "$(q "select count(*) from inbox")" = 2 ]]

  sleep 2

  [[ "$(q "select count(*) from duo_last_notification")" = 0 ]]
  is_inbox_empty
}

test_sad_sent_11_days_ago () {
  setup

  local time_interval=$(db_now as-microseconds '- 11 days')

  [[ "$(q "select count(*) from duo_last_notification")" = 0 ]]
  is_inbox_empty

  q "
  insert into inbox
  values
    ('$user1id', '', '', 'chats', '', ${time_interval}, 42),
    ('$user2id', '', '', 'inbox', '', ${time_interval}, 43)
  "
  [[ "$(q "select count(*) from inbox")" = 2 ]]

  sleep 2

  [[ "$(q "select count(*) from duo_last_notification")" = 0 ]]
  is_inbox_empty
}

test_sad_only_read_messages () {
  setup

  local time_interval=$(db_now as-microseconds '- 11 minutes')

  [[ "$(q "select count(*) from duo_last_notification")" = 0 ]]
  is_inbox_empty

  q "
  insert into inbox
  values
    ('$user1id', '', '', 'chats', '', ${time_interval}, 0),
    ('$user2id', '', '', 'inbox', '', ${time_interval}, 0)
  "
  [[ "$(q "select count(*) from inbox")" = 2 ]]

  sleep 2

  [[ "$(q "select count(*) from duo_last_notification")" = 0 ]]
  is_inbox_empty
}

test_sad_still_online_at_poll_time () {
  setup

  local t1=$(db_now as-microseconds '- 11 minutes')
  local t2=$(db_now as-seconds      '-  9 minutes')

  [[ "$(q "select count(*) from duo_last_notification")" = 0 ]]

  q "
  insert into last
  values
    ('$user1id', $t2),
    ('$user2id', $t2)
  ON CONFLICT (username) DO UPDATE SET
    username = EXCLUDED.username,
    seconds  = EXCLUDED.seconds
  "

  q "
  insert into inbox
  values
    ('$user1id', '', '', 'chats', '', ${t1}, 42),
    ('$user2id', '', '', 'inbox', '', ${t1}, 43)
  "
  [[ "$(q "select count(*) from inbox")" = 2 ]]

  sleep 2

  [[ "$(q "select count(*) from duo_last_notification")" = 0 ]]

  is_inbox_empty
}

test_sad_still_online_after_message_time () {
  setup

  local t1=$(db_now as-microseconds '- 13 minutes')
  local t2=$(db_now as-seconds      '- 11 minutes')

  [[ "$(q "select count(*) from duo_last_notification")" = 0 ]]

  q "
  insert into last
  values
    ('$user1id', $t2),
    ('$user2id', $t2)
  ON CONFLICT (username) DO UPDATE SET
    username = EXCLUDED.username,
    seconds  = EXCLUDED.seconds
  "

  q "
  insert into inbox
  values
    ('$user1id', '', '', 'chats', '', ${t1}, 42),
    ('$user2id', '', '', 'inbox', '', ${t1}, 43)
  "
  [[ "$(q "select count(*) from inbox")" = 2 ]]

  sleep 2

  [[ "$(q "select count(*) from duo_last_notification")" = 0 ]]

  is_inbox_empty
}

test_sad_already_notified_for_particular_message () {
  setup

  local t1=$(db_now as-microseconds '-  5 minutes') # 1st message to user1
  local t2=$(db_now as-seconds      '-  7 minutes') # 1st notification to user1
  local t3=$(db_now as-microseconds '- 11 minutes') # 1st message to user2
  local t4=$(db_now as-microseconds '- 13 minutes') # 1st message to user3

  [[ "$(q "select count(*) from duo_last_notification")" = 0 ]]
  is_inbox_empty

  q "
  insert into duo_last_notification
  values
    ('$user1id', $t2)
  "
  [[ "$(q "select count(*) from duo_last_notification")" = 1 ]]

  q "
  insert into inbox
  values
    ('$user1id', '', '', 'chats', '', ${t1}, 42),
    ('$user2id', '', '', 'inbox', '', ${t3}, 43),
    ('$user3id', '', '', 'inbox', '', ${t4},  0)
  "
  [[ "$(q "select count(*) from inbox")" = 3 ]]

  sleep 2

  [[ "$(q " \
    select count(*) \
    from duo_last_notification \
    where \
    username = '$user1id' and \
    chat_seconds = 0 and \
    intro_seconds = $t2")" = 1 ]]

  [[ "$(q " \
    select count(*) \
    from duo_last_notification \
    where \
    username = '$user2id' and \
    chat_seconds = 0 and \
    intro_seconds > 0")" = 1 ]]

  diff \
    <(get_emails) \
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
    ('$user1id', $t1)
  "
  local rows=$(
    q "select count(*)
    from duo_last_notification
    where username = '$user1id'
    and chat_seconds = 0
    and intro_seconds = $t1"
  )
  [[ "$rows" = 1 ]]

  # Insert last message
  q "
  insert into inbox
  values
    ('$user1id', '', '', 'inbox', '', ${t2}, 42),
    ('$user2id', '', '', 'inbox', '', ${t2},  0)
  "
  [[ "$(q "select count(*) from inbox")" = 2 ]]

  sleep 2

  # Cron service should prevent 2nd intros notification from being sent
  local rows=$(
    q "select count(*)
    from duo_last_notification
    where username = '$user1id'
    and chat_seconds = 0
    and intro_seconds = $t1"
  )
  [[ "$rows" = 1 ]]

  is_inbox_empty
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
    ('$user1id', $t2, $t3)
  "
  local rows=$(
    q "select count(*)
    from duo_last_notification
    where username = '$user1id'
    and intro_seconds = $t2
    and chat_seconds = $t3"
  )
  [[ "$rows" = 1 ]]

  # Insert intro and chat
  q "
  insert into inbox
  values
    ('$user1id', 'sender2', '', 'inbox', '', ${t1}, 42),
    ('$user1id', 'sender1', '', 'chats', '', ${t4}, 43)
  "
  [[ "$(q "select count(*) from inbox")" = 2 ]]

  sleep 2

  # Cron service should not send any notifications and duo_last_notification
  # should remain unchanged
  local rows=$(
    q "select count(*)
    from duo_last_notification
    where username = '$user1id'
    and intro_seconds = $t2
    and chat_seconds = $t3"
  )
  [[ "$rows" = 1 ]]

  is_inbox_empty
}

test_sad_not_activated () {
  setup

  q "update person set activated = false where uuid = '$user1id'"

  local time_interval=$(db_now as-microseconds '- 11 minutes')

  [[ "$(q "select count(*) from duo_last_notification")" = 0 ]]

  q "
  insert into inbox
  values
    ('$user1id', '', '', 'inbox', '', ${time_interval}, 42),
    ('$user2id', '', '', 'inbox', '', ${time_interval}, 0)
  "

  sleep 2

  [[ "$(q "select count(*) from duo_last_notification")" = 0 ]]
}

test_low_active_users_notified_via_email () {
  setup

  [[ "$(q "select count(*) from duo_last_notification")" = 0 ]]

  local t1=$(db_now as-seconds '- 7 days')
  local t2=$(db_now as-seconds '- 9 days')

  q "
  INSERT INTO
    last
  VALUES
    ('$user1id', $t1),
    ('$user2id', $t2)
  ON CONFLICT (username) DO UPDATE SET
    username = EXCLUDED.username,
    seconds  = EXCLUDED.seconds
  "

  q "
  INSERT INTO
    duo_push_token (username, token)
  VALUES
    ('$user1id', 'token_1'),
    ('$user2id', 'token_2')
  ON CONFLICT (username) DO UPDATE SET
    username = EXCLUDED.username
  "

  local time_interval=$(db_now as-microseconds '- 11 minutes')

  echo 1 > ../../test/input/disable-mobile-notifications

  q "
  INSERT INTO
    inbox
  VALUES
    ('$user1id', '', '', 'inbox', '', ${time_interval}, 42),
    ('$user2id', '', '', 'inbox', '', ${time_interval}, 43)
  "

  sleep 2

  echo 0 > ../../test/input/disable-mobile-notifications

  [[ "$(q "select count(*) from duo_last_notification")" = 2 ]]

  diff \
    <(get_emails) \
    ../../test/fixtures/cron-emails-active-users-notified-via-email
}

test_happy_path_intros
test_happy_path_chats
test_happy_path_chat_not_deferred_by_intro

test_sad_sent_9_minutes_ago
test_sad_sent_11_days_ago
test_sad_only_read_messages
test_sad_still_online_at_poll_time
test_sad_still_online_after_message_time

test_sad_already_notified_for_particular_message
test_sad_already_notified_for_other_intro_in_drift_period

test_sad_intro_within_day_and_chat_within_past_10_minutes

test_sad_not_activated

test_low_active_users_notified_via_email
