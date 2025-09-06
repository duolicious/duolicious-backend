#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -ex

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
  q "delete from inbox"
  q "delete from club"

  ../util/create-user.sh will-be-deactivated 0 0

  ../util/create-user.sh will-remain-active1 0 0
  ../util/create-user.sh will-remain-active2 0 0
  ../util/create-user.sh will-remain-active3 0 0

  q "
  update person set
    email = REPLACE(
      email,
      '@example.com',
      '@duolicious.app'),
    normalized_email = REPLACE(
      normalized_email,
      '@example.com',
      '@duolicious.app')
  "

  assume_role 'will-remain-active1@duolicious.app'
  jc POST /join-club -d '{ "name": "my-club-1" }'
  jc POST /join-club -d '{ "name": "my-club-2" }'
  jc POST /join-club -d '{ "name": "my-club-3" }'
  jc POST /join-club -d '{ "name": "my-club-4" }'

  assume_role 'will-remain-active2@duolicious.app'
  jc POST /join-club -d '{ "name": "my-club-1" }'
  jc POST /join-club -d '{ "name": "my-club-2" }'

  assume_role 'will-be-deactivated@duolicious.app'
  jc POST /join-club -d '{ "name": "my-club-2" }'
  jc POST /join-club -d '{ "name": "my-club-3" }'

  assume_role 'will-remain-active3@duolicious.app'
  results=$(c GET '/search-clubs?q=my-club')
  expected=$(
    jq -r . <<< "[ \
      {\"count_members\": 3, \"name\": \"my-club-2\"}, \
      {\"count_members\": 2, \"name\": \"my-club-1\"}, \
      {\"count_members\": 2, \"name\": \"my-club-3\"}, \
      {\"count_members\": 1, \"name\": \"my-club-4\"}, \
      {\"count_members\": 0, \"name\": \"my-club\"} \
    ]"
  )
  diff <(echo "$results") <(echo "$expected")

  delete_emails

  q "
  update person set
    -- In case one of the other cron modules deactivated the accounts
    activated = true,

    -- There's a mechanism which prevents accounts from being re-deactivated
    -- immediately after signing in again. This overrides that mechanism.
    sign_in_time = now() - interval '20 minutes'
  "

  q "update person set last_online_time = now() - interval '31 days' where email like 'will-be-deactivated%'"
  q "update person set last_online_time = now() - interval '21 days' where email like 'will-remain-active1%'"
  q "update person set last_online_time = now() - interval '11 days' where email like 'will-remain-active2%'"
  q "update person set last_online_time = now() - interval ' 0 days' where email like 'will-remain-active3%'"

  sleep 2

  [[ "$(q "select 1 from person where activated = false and email like 'will-be-deactivated%' ")" = "1" ]]
  [[ "$(q "select 1 from person where activated = true  and email like 'will-remain-active1%' ")" = "1" ]]
  [[ "$(q "select 1 from person where activated = true  and email like 'will-remain-active2%' ")" = "1" ]]
  [[ "$(q "select 1 from person where activated = true  and email like 'will-remain-active3%' ")" = "1" ]]
  [[ "$(q "select count(*) from duo_session where email like 'will-be-deactivated%'")" = "0" ]]

  diff \
    <(get_emails) \
    ../../test/fixtures/cron-autodeactivate2-email

  results=$(c GET '/search-clubs?q=my-club')
  expected=$(
    jq -r . <<< "[ \
      {\"count_members\": 2, \"name\": \"my-club-1\"}, \
      {\"count_members\": 2, \"name\": \"my-club-2\"}, \
      {\"count_members\": 1, \"name\": \"my-club-3\"}, \
      {\"count_members\": 1, \"name\": \"my-club-4\"}, \
      {\"count_members\": 0, \"name\": \"my-club\"} \
    ]"
  )

  diff <(echo "$results") <(echo "$expected")
}

do_test
