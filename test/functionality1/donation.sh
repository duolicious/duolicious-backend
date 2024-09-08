#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

q "delete from person"
q "delete from club"
q "delete from banned_person"

../util/create-user.sh user1 0 0

response=$(jc POST /request-otp -d '{ "email": "user1@example.com" }')
SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')

response=$( jc POST /check-otp -d '{ "otp": "000000" }' )

[[ "$(jq -r '.name' <<< "$response")" = user1 ]]
[[ "$(jq -r '.do_show_donation_nag' <<< "$response")" = false ]]
[[ "$(jq -r '.estimated_end_date' <<< "$response")" = '2024-09-17 15:02:10.866+00' ]]

# Satisfy conditions for .do_show_donation_nag to be true
q "update person set count_answers = 25"
q "update person set last_nag_time = now() - interval '2 days'"
q "update person set sign_up_time = now() - interval '2 days'"

response=$(c POST /check-session-token)
[[ "$(jq -r '.do_show_donation_nag' <<< "$response")" = true ]]

# Remove condition 1
q "update person set count_answers = 25"
q "update person set last_nag_time = now() - interval '2 days'"
q "update person set sign_up_time = now() - interval '2 days'"

q "update person set count_answers = 24"

response=$(c POST /check-session-token)
[[ "$(jq -r '.do_show_donation_nag' <<< "$response")" = false ]]

# Remove condition 2
q "update person set count_answers = 25"
q "update person set last_nag_time = now() - interval '2 days'"
q "update person set sign_up_time = now() - interval '2 days'"

q "update person set last_nag_time = now()"

response=$(c POST /check-session-token)
[[ "$(jq -r '.do_show_donation_nag' <<< "$response")" = false ]]

# Remove condition 3
q "update person set count_answers = 25"
q "update person set last_nag_time = now() - interval '2 days'"
q "update person set sign_up_time = now() - interval '2 days'"

q "update person set sign_up_time = now()"

response=$(c POST /check-session-token)
[[ "$(jq -r '.do_show_donation_nag' <<< "$response")" = false ]]
