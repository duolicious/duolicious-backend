#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

printf 0 > ../../test/input/disable-ip-rate-limit
printf 0 > ../../test/input/disable-account-rate-limit

set -xe

  jc POST /request-otp -d '{ "email": "user1@example.com" }'
  jc POST /request-otp -d '{ "email": "user1@example.com" }'
  jc POST /request-otp -d '{ "email": "user1@example.com" }'
! jc POST /request-otp -d '{ "email": "user2@example.com" }'

printf 1 > ../../test/input/disable-ip-rate-limit
printf 1 > ../../test/input/disable-account-rate-limit
q 'delete from person'
../util/create-user.sh user1 0 0
../util/create-user.sh user2 0 0
user2id=$(q "select id from person where name = 'user2'")
user2uuid=$(q "select uuid from person where name = 'user2'")
assume_role user1
printf 0 > ../../test/input/disable-ip-rate-limit
printf 1 > ../../test/input/disable-account-rate-limit

echo Only the global rate limit should apply for regular skips
c POST "/skip/by-uuid/${user2uuid}"
c POST "/unskip/${user2id}"
c POST "/skip/by-uuid/${user2uuid}"

echo The stricter rate limit should apply for reports
  jc POST "/skip/by-uuid/${user2uuid}" -d '{ "report_reason": "smells bad" }'
   c POST "/unskip/${user2id}"
! jc POST "/skip/by-uuid/${user2uuid}" -d '{ "report_reason": "bad hair" }'

echo Uncached search should be heavily rate-limited
for x in {1..15}
do
  c GET '/search?n=1&o=0'
done
! c GET '/search?n=1&o=0'

echo "Cached search shouldn't be heavily rate-limited"
c GET '/search?n=1&o=1'
c GET '/search?n=1&o=1'
c GET '/search?n=1&o=1'

echo "Rate limit should apply independently to clubs"
jc POST /join-club -d '{ "name": "Anime" }'
jc POST /join-club -d '{ "name": "Manga" }'
for x in {1..15}
do
  c GET '/search?n=1&o=0&club=Anime'
done
! c GET '/search?n=1&o=0&club=Anime'
  c GET '/search?n=1&o=0&club=Manga'

echo Account-based rate limit should apply even if the IP address changes
printf 1 > ../../test/input/disable-ip-rate-limit
printf 0 > ../../test/input/disable-account-rate-limit
for x in {1..10}
do
  printf "256.256.256.${x}" > ../../test/input/mock-ip-address
  c GET '/search?n=1&o=0'
  c POST "/skip/by-uuid/${user2uuid}"
done
! c GET '/search?n=1&o=0'
! c POST "/skip/by-uuid/${user2uuid}"

echo "The rate limit doesn't apply to other accounts"
../util/create-user.sh user3 0 0
c GET '/search?n=1&o=0'

echo Account-based rate limit applies to /verify endpoint when IP changes
printf 1 > ../../test/input/disable-ip-rate-limit
printf 0 > ../../test/input/disable-account-rate-limit
true     > ../../test/input/verification-mock-response-file
for x in {1..15}
do
  printf "256.256.256.${x}" > ../../test/input/mock-ip-address
  c POST /verify
  sleep 0.1 # Avoid hitting the global rate limit
done
! c POST /verify

echo "The rate limit doesn't apply to other accounts"
assume_role user3
c POST /verify
