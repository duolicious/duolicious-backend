#!/usr/bin/env bash

# Tests for /sign-in-with-google and /sign-in-with-apple. Relies on the
# mocking-mode branch in service/auth/social.py — when
# test/input/enable-mocking is '1' the API skips JWT signature checks
# but still enforces iss/aud/exp, so we mint structurally-valid fake
# tokens with `mint_google_token` / `mint_apple_token` from setup.sh.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

reset_db () {
  local future
  future=$(q "select iso8601_utc((now() + interval '20 days')::timestamp)")
  q "delete from duo_session"
  q "delete from social_identity"
  q "delete from person"
  q "delete from onboardee"
  q "delete from banned_person"
  q "update funding set estimated_end_date = '$future'"
}

complete_onboarding_for_current_session () {
  jc PATCH /onboardee-info -d '{ "name": "Pat" }'
  jc PATCH /onboardee-info -d '{ "date_of_birth": "1997-05-30" }'
  c GET /search-locations?q=Syd
  jc PATCH /onboardee-info -d '{ "location": "Sydney, New South Wales, Australia" }'
  jc PATCH /onboardee-info -d '{ "gender": "Man" }'
  jc PATCH /onboardee-info -d '{ "other_peoples_genders": ["Woman"] }'
  c POST /finish-onboarding
}

# ---------------------------------------------------------------------------
# 1. Brand-new sign-up via Google → onboardee created, session signed-in,
#    pending_social_* set, social_identity row appears after
#    /finish-onboarding.
# ---------------------------------------------------------------------------
reset_db
SESSION_TOKEN=""

g_token=$(mint_google_token --sub google-sub-1 --email new1@example.com)
response=$(jc POST /sign-in-with-google -d "{ \"id_token\": \"${g_token}\" }")

[[ "$(jq -r .onboarded         <<< "$response")" = false ]]
[[ "$(jq -r .person_id         <<< "$response")" = null ]]
[[ "$(jq -r .session_token     <<< "$response")" != null ]]

SESSION_TOKEN=$(jq -r .session_token <<< "$response")

# Onboardee created with no name (we deliberately don't seed from provider).
[[ "$(q "select count(*) from onboardee where email = 'new1@example.com'")" -eq 1 ]]
[[ "$(q "select name is null from onboardee where email = 'new1@example.com'")" = t ]]

# Session is already signed-in and carries the pending social link.
[[ "$(q "select signed_in from duo_session where session_token_hash = encode(digest('$SESSION_TOKEN'::bytea, 'sha512'), 'hex')")" = t ]]
[[ "$(q "select pending_social_provider from duo_session where pending_social_provider is not null")" = google ]]
[[ "$(q "select pending_social_sub      from duo_session where pending_social_sub is not null")"      = google-sub-1 ]]

# No social_identity row yet — that only happens after onboarding completes.
[[ "$(q "select count(*) from social_identity")" -eq 0 ]]

complete_onboarding_for_current_session

# Now there's a person row and a matching social_identity link.
new1_id=$(get_id 'new1@example.com')
[[ "$(q "select count(*) from social_identity where provider = 'google' and provider_sub = 'google-sub-1' and person_id = $new1_id")" -eq 1 ]]

# ---------------------------------------------------------------------------
# 2. Returning sign-in: same Google sub → onboarded:true, no new
#    onboardee, sign_in_count increments, social_identity unchanged.
# ---------------------------------------------------------------------------
sign_in_count_before=$(q "select sign_in_count from person where id = $new1_id")
si_count_before=$(q "select count(*) from social_identity")

g_token=$(mint_google_token --sub google-sub-1 --email new1@example.com)
response=$(jc POST /sign-in-with-google -d "{ \"id_token\": \"${g_token}\" }")

[[ "$(jq -r .onboarded <<< "$response")" = true ]]
[[ "$(jq -r .person_id <<< "$response")" = "$new1_id" ]]
SESSION_TOKEN=$(jq -r .session_token <<< "$response")

# Sign-in metadata bumped exactly once.
sign_in_count_after=$(q "select sign_in_count from person where id = $new1_id")
[[ $((sign_in_count_after - sign_in_count_before)) -eq 1 ]]

# No duplicate onboardee, no duplicate social_identity.
[[ "$(q "select count(*) from onboardee where email = 'new1@example.com'")" -eq 0 ]]
[[ "$(q "select count(*) from social_identity")" -eq "$si_count_before" ]]

c POST /check-session-token > /dev/null

# ---------------------------------------------------------------------------
# 3. Auto-link: existing OTP user signs in with Google for the first
#    time. Verified email should match by normalized_email; backend
#    inserts a social_identity row and returns onboarded:true.
# ---------------------------------------------------------------------------
reset_db
SESSION_TOKEN=""

# Build an existing OTP-only user.
response=$(jc POST /request-otp -d '{ "email": "linkme@example.com" }')
SESSION_TOKEN=$(jq -r .session_token <<< "$response")
jc POST /check-otp -d '{ "otp": "000000" }'
complete_onboarding_for_current_session
linkme_id=$(get_id 'linkme@example.com')

# No social_identity link yet.
[[ "$(q "select count(*) from social_identity where person_id = $linkme_id")" -eq 0 ]]

SESSION_TOKEN=""
# Google sign-in for the same email (different case to exercise normalize_email).
g_token=$(mint_google_token --sub google-sub-2 --email LINKME@example.com)
response=$(jc POST /sign-in-with-google -d "{ \"id_token\": \"${g_token}\" }")

[[ "$(jq -r .onboarded <<< "$response")" = true ]]
[[ "$(jq -r .person_id <<< "$response")" = "$linkme_id" ]]
SESSION_TOKEN=$(jq -r .session_token <<< "$response")

# Auto-link inserted exactly one row.
[[ "$(q "select count(*) from social_identity where provider = 'google' and provider_sub = 'google-sub-2' and person_id = $linkme_id")" -eq 1 ]]

# ---------------------------------------------------------------------------
# 4. email_verified:false must NOT auto-link — even if email matches.
# ---------------------------------------------------------------------------
g_token=$(mint_google_token --sub google-sub-3 --email linkme@example.com --verified false)
response=$(jc POST /sign-in-with-google -d "{ \"id_token\": \"${g_token}\" }")
# Treated as a brand-new user: onboarded false, no link inserted.
[[ "$(jq -r .onboarded <<< "$response")" = false ]]
[[ "$(q "select count(*) from social_identity where provider_sub = 'google-sub-3'")" -eq 0 ]]

# ---------------------------------------------------------------------------
# 5. Apple basic sign-up.
# ---------------------------------------------------------------------------
reset_db
SESSION_TOKEN=""

a_token=$(mint_apple_token --sub apple-sub-1 --email apple1@example.com)
response=$(jc POST /sign-in-with-apple -d "{ \"identity_token\": \"${a_token}\" }")

[[ "$(jq -r .onboarded         <<< "$response")" = false ]]
[[ "$(jq -r .session_token     <<< "$response")" != null ]]
SESSION_TOKEN=$(jq -r .session_token <<< "$response")

[[ "$(q "select pending_social_provider from duo_session where pending_social_provider is not null")" = apple ]]

complete_onboarding_for_current_session
apple1_id=$(get_id 'apple1@example.com')
[[ "$(q "select count(*) from social_identity where provider = 'apple' and provider_sub = 'apple-sub-1' and person_id = $apple1_id")" -eq 1 ]]

# ---------------------------------------------------------------------------
# 6. Apple Hide-My-Email: privaterelay address never matches an existing
#    OTP account, so the user goes through onboarding as new.
# ---------------------------------------------------------------------------
# Pre-existing OTP user at a "real" address.
SESSION_TOKEN=""
response=$(jc POST /request-otp -d '{ "email": "real@example.com" }')
SESSION_TOKEN=$(jq -r .session_token <<< "$response")
jc POST /check-otp -d '{ "otp": "000000" }'
complete_onboarding_for_current_session
real_id=$(get_id 'real@example.com')

SESSION_TOKEN=""
relay_token=$(mint_apple_token --sub apple-sub-relay --email abc.def@privaterelay.appleid.com)
response=$(jc POST /sign-in-with-apple -d "{ \"identity_token\": \"${relay_token}\" }")

# Did NOT auto-link to real@example.com.
[[ "$(jq -r .onboarded <<< "$response")" = false ]]
[[ "$(q "select count(*) from social_identity where person_id = $real_id")" -eq 0 ]]
SESSION_TOKEN=$(jq -r .session_token <<< "$response")
complete_onboarding_for_current_session
relay_id=$(get_id 'abc.def@privaterelay.appleid.com')
[[ "$relay_id" -ne "$real_id" ]]

# ---------------------------------------------------------------------------
# 7. Banned user (by email) → 461.
# ---------------------------------------------------------------------------
reset_db
q "insert into banned_person (normalized_email, expires_at) values ('banned@example.com', now() + interval '1 month')"

g_token=$(mint_google_token --sub google-banned --email banned@example.com)
response_file=/tmp/social-banned.$$
status=$(curl -s -o "$response_file" -w "%{http_code}" \
  -X POST http://localhost:5000/sign-in-with-google \
  -H "Content-Type: application/json" \
  -d "{ \"id_token\": \"${g_token}\" }")
[[ "$status" = "461" ]]
rm -f "$response_file"

# ---------------------------------------------------------------------------
# 8. Bad audience → 401.
# ---------------------------------------------------------------------------
bad_aud=$(mint_google_token --sub x --email a@b.com --aud not-our-client-id)
status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:5000/sign-in-with-google \
  -H "Content-Type: application/json" \
  -d "{ \"id_token\": \"${bad_aud}\" }")
[[ "$status" = "401" ]]

# ---------------------------------------------------------------------------
# 9. Bad issuer (Apple-shaped token to /sign-in-with-google) → 401.
# ---------------------------------------------------------------------------
mismatched=$(mint_apple_token --sub x --email a@b.com)
status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:5000/sign-in-with-google \
  -H "Content-Type: application/json" \
  -d "{ \"id_token\": \"${mismatched}\" }")
[[ "$status" = "401" ]]

# ---------------------------------------------------------------------------
# 10. Pending club join works on social sign-up.
# ---------------------------------------------------------------------------
reset_db
SESSION_TOKEN=""

g_token=$(mint_google_token --sub google-club --email club@example.com)
response=$(jc POST /sign-in-with-google \
  -d "{ \"id_token\": \"${g_token}\", \"pending_club_name\": \"some-club\" }")
SESSION_TOKEN=$(jq -r .session_token <<< "$response")

# Pending club is recorded on the session and surfaces after onboarding.
[[ "$(q "select pending_club_name from duo_session where pending_club_name is not null")" = some-club ]]

complete_onboarding_for_current_session
club_id=$(get_id 'club@example.com')
[[ "$(q "select count(*) from person_club where person_id = $club_id and club_name = 'some-club'")" -eq 1 ]]

echo "social-login.sh OK"
