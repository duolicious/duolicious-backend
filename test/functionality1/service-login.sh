#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

# Fixed plaintext password and its SHA-512 hash (precomputed with `sha512sum`).
SERVICE_PASSWORD='service-secret-123'
SERVICE_PASSWORD_HASH='c7bff1b8c920f8d9e6d4e497e953e2e09088f8c729c62a40ed876d8c054b8de2e24b866c2a77328517b6bc6176adc90ab284dee8d6d68b47683dd72394e9799b'

# Start from a clean slate.
q "delete from service_login"
q "delete from duo_session"
q "delete from person"
q "delete from onboardee"
q "delete from undeleted_photo"

# When no auth is provided, authenticated endpoints should return 401 with the
# new 'Authentication required' message. Use the `c` helper but temporarily
# clear SESSION_TOKEN so no Authorization header is sent. To keep `status_code`
# visible in this shell, avoid running `c` inside a subshell.
unauth_body_file="/tmp/service-login-unauth-body.$RANDOM"
set +e
SESSION_TOKEN= c GET /me > "$unauth_body_file"
unauth_rc=$?
set -e
unauth_body="$(cat "$unauth_body_file")"
[[ "$unauth_rc" -ne 0 ]]
[[ "$status_code" -eq 401 ]]
[[ "$unauth_body" == 'Authentication required' ]]

# Create a fully onboarded user to act as the service account.
../util/create-user.sh servicebot 0
SERVICE_PERSON_ID="$(get_id 'servicebot@example.com')"

# Map the fixed password hash to this service user.
q "
  insert into service_login (password_hash, person_id)
  values ('$SERVICE_PASSWORD_HASH', $SERVICE_PERSON_ID)
"

cookie_jar="/tmp/service-login-cookie.$RANDOM"

# Wrong password -> 401 Unauthorized, no valid cookie.
wrong_body_file="/tmp/service-login-wrong-body.$RANDOM"
set +e
SESSION_TOKEN= jc POST /service-login \
  -d '{"password":"wrong-password"}' \
  > "$wrong_body_file"
wrong_rc=$?
set -e
wrong_body="$(cat "$wrong_body_file")"
[[ "$wrong_rc" -ne 0 ]]
[[ "$status_code" -eq 401 ]]
[[ "$wrong_body" == 'Unauthorized' ]]

# Correct password -> 200, ok:true, and sets the duo_service_session cookie.
ok_body_file="/tmp/service-login-ok-body.$RANDOM"
SESSION_TOKEN= jc POST /service-login \
  -d '{"password":"'"$SERVICE_PASSWORD"'"}' \
  -c "$cookie_jar" \
  > "$ok_body_file"
ok_body="$(cat "$ok_body_file")"
[[ "$status_code" -eq 200 ]]
[[ "$(echo "$ok_body" | jq -r '.ok')" = true ]]
grep -q 'duo_service_session' "$cookie_jar"

# With only the service cookie (no Authorization header), `aget` routes should
# treat the request as authenticated and act as the mapped person. We verify
# this by checking that `/profile-info` returns the expected name.
authed_body_file="/tmp/service-login-authed-body.$RANDOM"
SESSION_TOKEN= c GET /profile-info -b "$cookie_jar" > "$authed_body_file"
authed_body="$(cat "$authed_body_file")"
[[ "$status_code" -eq 200 ]]
[[ "$(echo "$authed_body" | jq -r '.name')" = "servicebot" ]]

