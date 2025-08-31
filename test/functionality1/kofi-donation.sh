#!/usr/bin/env bash

# This test is mostly intended to verify that the `verificationjobrunner` runs
# the jobs. The unit tests for the `verification` Python module are much
# more in-depth.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

q "
update
  funding
set
  estimated_end_date = '2024-09-17 15:02:10.866',
  token_hash_kofi = '$(printf 'valid-token' | sha512sum | cut -d' ' -f1)',
  cost_per_month_usd = 100.0
"



echo 'Invalid tokens are ignored'

SESSION_TOKEN="" c \
  POST \
  /kofi-donation \
  --header "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode 'data={"verification_token":"invalid-token","message_id":"8d737342-2311-429f-b920-f6e98cde402e","timestamp":"2024-12-26T12:32:57Z","type":"Donation","is_public":true,"from_name":"Jo Example","message":"Good luck with the integration!","amount":"3.00","url":"https://ko-fi.com/Home/CoffeeShop?txid=00000000-1111-2222-3333-444444444444","email":"jo.example@example.com","currency":"USD","is_subscription_payment":false,"is_first_subscription_payment":false,"kofi_transaction_id":"00000000-1111-2222-3333-444444444444","shop_items":null,"tier_name":null,"shipping":null}'

actual=$(q "select estimated_end_date from funding")
expected='2024-09-17 15:02:10.866'

diff <(echo "$actual") <(echo "$expected")



echo 'The estimated end date increases when adding 50.0 dollars'

test_token_hash=$(sha512sum <<< "test-token")

SESSION_TOKEN="" c \
  POST \
  /kofi-donation \
  --header "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode 'data={"verification_token":"valid-token","message_id":"8d737342-2311-429f-b920-f6e98cde402e","timestamp":"2024-12-26T12:32:57Z","type":"Donation","is_public":true,"from_name":"Jo Example","message":"Good luck with the integration!","amount":"50.00","url":"https://ko-fi.com/Home/CoffeeShop?txid=00000000-1111-2222-3333-444444444444","email":"jo.example@example.com","currency":"USD","is_subscription_payment":false,"is_first_subscription_payment":false,"kofi_transaction_id":"00000000-1111-2222-3333-444444444444","shop_items":null,"tier_name":null,"shipping":null}'

actual=$(q "select estimated_end_date from funding")
expected='2024-10-03 03:02:10.866'

diff <(echo "$actual") <(echo "$expected")
