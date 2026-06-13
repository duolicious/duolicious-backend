#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

q "delete from duo_session"
q "delete from person"
q "delete from onboardee"

# Onboard a user with an explicit email and display name (create-user.sh derives
# the name from the username, so it can't produce a deliberate collision).
onboard () {
  local email=$1
  local name=$2

  local response=$(jc POST /request-otp -d '{ "email": "'"$email"'" }')
  SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')

  jc POST /check-otp -d '{ "otp": "000000" }' > /dev/null
  jc PATCH /onboardee-info -d '{ "name": "'"$name"'" }' > /dev/null
  jc PATCH /onboardee-info -d '{ "date_of_birth": "1997-05-30" }' > /dev/null
  jc PATCH /onboardee-info -d '{ "location": "New York, New York, United States" }' > /dev/null
  jc PATCH /onboardee-info -d '{ "gender": "Other" }' > /dev/null
  jc PATCH /onboardee-info -d '{ "other_peoples_genders": ["Man", "Woman"] }' > /dev/null
  c POST /finish-onboarding > /dev/null
}

# --- Onboardee preview: a free name previews the bare slug -------------------
response=$(jc POST /request-otp -d '{ "email": "preview@example.com" }')
SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')
jc POST /check-otp -d '{ "otp": "000000" }' > /dev/null
preview=$(jc PATCH /onboardee-info -d '{ "name": "Zelda" }')
[[ "$(jq -r .url_slug <<< "$preview")" = zelda ]]
[[ "$(jq -r .is_random <<< "$preview")" = false ]]

# --- First user gets the bare slug -------------------------------------------
onboard alice@example.com "Alice"
[[ "$(q "select url_slug from person where email='alice@example.com'")" = alice ]]

# --- A second distinct name gets its own bare slug ---------------------------
onboard bob@example.com "Bob"
[[ "$(q "select url_slug from person where email='bob@example.com'")" = bob ]]

# --- Spaces become underscores (spec step 2), other junk is stripped ---------
onboard spaced@example.com "John   Smith!"
[[ "$(q "select url_slug from person where email='spaced@example.com'")" = john___smith ]]

# --- Collision: a second "Alice" gets a random numeric suffix ----------------
onboard alice2@example.com "Alice"
slug2=$(q "select url_slug from person where email='alice2@example.com'")
[[ "$slug2" =~ ^alice[0-9]+$ ]]

# --- Onboardee preview of a taken name shows a concrete suffixed slug --------
response=$(jc POST /request-otp -d '{ "email": "preview2@example.com" }')
SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')
jc POST /check-otp -d '{ "otp": "000000" }' > /dev/null
preview=$(jc PATCH /onboardee-info -d '{ "name": "Alice" }')
[[ "$(jq -r .is_random <<< "$preview")" = true ]]
[[ "$(jq -r .url_slug  <<< "$preview")" =~ ^alice[0-9]+$ ]]

# --- Emoji-only name → numeric-only random slug ------------------------------
onboard emoji@example.com "🎉🎉"
slug_emoji=$(q "select url_slug from person where email='emoji@example.com'")
[[ "$slug_emoji" =~ ^[0-9]+$ ]]

# --- Reserved words are never minted bare ------------------------------------
# (profiles live at the top level, so a slug must not shadow an app route)
onboard settings@example.com "settings"
slug_settings=$(q "select url_slug from person where email='settings@example.com'")
[[ "$slug_settings" =~ ^settings[0-9]+$ ]]

onboard feed@example.com "Feed"
slug_feed=$(q "select url_slug from person where email='feed@example.com'")
[[ "$slug_feed" =~ ^feed[0-9]+$ ]]

# --- Lookup resolves by slug, by uuid, and case-insensitively ----------------
alice_uuid=$(q "select uuid from person where email='alice@example.com'")
alice_id=$(q "select id from person where email='alice@example.com'")
q "update person set privacy_verification_level_id = 1"

assume_role alice

[[ "$(c GET /prospect-profile/alice           | jq -r .person_id)" = "$alice_id" ]]
[[ "$(c GET /prospect-profile/ALICE           | jq -r .person_id)" = "$alice_id" ]]
[[ "$(c GET "/prospect-profile/$alice_uuid"   | jq -r .person_id)" = "$alice_id" ]]
[[ "$(c GET /prospect-profile/alice           | jq -r .url_slug)"  = alice ]]

# --- /profile-info exposes the viewer's own slug -----------------------------
[[ "$(c GET /profile-info | jq -r .url_slug)" = alice ]]

# --- Name change (gold) regenerates the slug and reports is_random -----------
q "update person set has_gold = true where email='bob@example.com'"
assume_role bob

# A free name → bare slug, not random.
resp=$(jc PATCH /profile-info -d '{ "name": "Carol" }')
[[ "$(jq -r .url_slug  <<< "$resp")" = carol ]]
[[ "$(jq -r .is_random <<< "$resp")" = false ]]

# A taken name (Alice is held by alice@example.com) → random suffix.
resp=$(jc PATCH /profile-info -d '{ "name": "Alice" }')
renamed_slug=$(jq -r .url_slug <<< "$resp")
[[ "$(jq -r .is_random <<< "$resp")" = true ]]
[[ "$renamed_slug" =~ ^alice[0-9]+$ ]]

# The original uuid URL still resolves after the rename.
[[ "$(c GET "/prospect-profile/$alice_uuid" | jq -r .person_id)" = "$alice_id" ]]

# --- A name that *is* a UUID can't shadow that uuid's owner -------------------
# slug_base leaves a uuid string intact, so without a guard the slug would equal
# alice's uuid and /prospect-profile/<alice_uuid> would match two rows.
onboard uuidname@example.com "$alice_uuid"
slug_uuid=$(q "select url_slug from person where email='uuidname@example.com'")
# Minted with a numeric suffix, so it's no longer uuid-shaped.
[[ "$slug_uuid" =~ ^${alice_uuid}[0-9]+$ ]]
# alice's canonical uuid URL still resolves to alice, not the impersonator.
[[ "$(c GET "/prospect-profile/$alice_uuid" | jq -r .person_id)" = "$alice_id" ]]
