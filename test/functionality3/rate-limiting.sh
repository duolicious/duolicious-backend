#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

printf 0 > ../../test/input/disable-rate-limit

set -xe

  jc POST /request-otp -d '{ "email": "user1@example.com" }'
  jc POST /request-otp -d '{ "email": "user2@example.com" }'
  jc POST /request-otp -d '{ "email": "user3@example.com" }'
  jc POST /request-otp -d '{ "email": "user4@example.com" }'
  jc POST /request-otp -d '{ "email": "user5@example.com" }'
  jc POST /request-otp -d '{ "email": "user6@example.com" }'
  jc POST /request-otp -d '{ "email": "user7@example.com" }'
  jc POST /request-otp -d '{ "email": "user8@example.com" }'
! jc POST /request-otp -d '{ "email": "user9@example.com" }'
