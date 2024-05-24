#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

setup () {
  local num_photos=${1:-0}
  local make_bystander=${2:-false}

  q "delete from duo_session"
  q "delete from person"
  q "delete from onboardee"
  q "delete from banned_person"
  q "delete from banned_person_admin_token"
  q "delete from deleted_photo_admin_token"

  ../util/create-user.sh reporter 0 "${num_photos}"
  ../util/create-user.sh accused 0 "${num_photos}"
  if [[ "${make_bystander}" == true ]]
  then
    ../util/create-user.sh bystander 0 "${num_photos}"
  fi

  reporter_id=$(
    q "select id from person where email = 'reporter@example.com'")

  accused_id=$(
    q "select id from person where email = 'accused@example.com'")

  bystander_id=$(
    q "select id from person where email = 'bystander@example.com'")
}

tear_down () {
  q "delete from banned_person"
  q "delete from banned_person_admin_token"
  q "delete from deleted_photo_admin_token"
}

trap tear_down EXIT

ban_token () {
  q "select token from banned_person_admin_token where person_id = ${accused_id}"
}

deleted_photo_token () {
  q "
  select token
  from deleted_photo_admin_token
  join photo
  on photo.uuid = deleted_photo_admin_token.photo_uuid
  where person_id = ${accused_id}
  "
}

set -xe

# A banned email can't get an OTP
no_otp_when_email_banned () {
  setup

  assume_role reporter

  jc POST "/skip/${accused_id}" -d '{ "report_reason": "n/a" }'

  c GET "/admin/ban/$(ban_token)"

  q "update banned_person set ip_address = '255.255.255.255'"

  ! ../util/create-user.sh accused 0 0
}

# A banned ip can't get an OTP
no_otp_when_ip_banned () {
  setup

  assume_role reporter

  jc POST "/skip/${accused_id}" -d '{ "report_reason": "n/a" }'

  c GET "/admin/ban/$(ban_token)"

  q "update banned_person set email = 'nobody@example.com'"

  ! ../util/create-user.sh accused 0 0
}

# Banning one user doesn't ban everyone
otp_when_others_are_banned () {
  setup

  assume_role reporter

  jc POST "/skip/${accused_id}" -d '{ "report_reason": "n/a" }'

  c GET "/admin/ban/$(ban_token)"

  q "update banned_person set ip_address = '255.255.255.255'"
  q "update banned_person set email = 'nobody@example.com'"

  ../util/create-user.sh accused 0 0
}

# Ban expiry is respected
ban_expiry () {
  setup

  assume_role reporter

  jc POST "/skip/${accused_id}" -d '{ "report_reason": "n/a" }'

  c GET "/admin/ban/$(ban_token)"

  q "update banned_person set expires_at = NOW() + interval '1 day'"
  ! ../util/create-user.sh accused 0 0

  q "update banned_person set expires_at = NOW() - interval '1 day'"
  ../util/create-user.sh accused 0 0
}

# token expiry is respected for bans
ban_token_expiry () {
  setup

  assume_role reporter

  jc POST "/skip/${accused_id}" -d '{ "report_reason": "n/a" }'

  q "update banned_person_admin_token set expires_at = NOW() - interval '1 day'"
  ! c GET "/admin/ban/$(ban_token)"
}

# token expiry is respected for photos
photo_token_expiry () {
  setup

  assume_role reporter

  jc POST "/skip/${accused_id}" -d '{ "report_reason": "n/a" }'

  q "update deleted_photo_admin_token set expires_at = NOW() - interval '1 day'"
  ! c GET "/admin/delete-photo/$(deleted_photo_token)"
}

# Only the person who should have been banned is deleted
specific_person_is_banned () {
  setup 0 true

  assume_role reporter

  jc POST "/skip/${accused_id}" -d '{ "report_reason": "my target" }'
  jc POST "/skip/${bystander_id}" -d '{ "report_reason": "collateral damage" }'

  [[ "$(q "select count(*) from person")" -eq 3 ]]

  c GET "/admin/ban/$(ban_token)"

  [[ "$(q "select count(*) from person")" -eq 2 ]]

  [[ "$(q "select count(*) from person where id = ${accused_id}")" -eq 0 ]]

  [[ "$(q "select report_reasons \
    from banned_person \
    where email = 'accused@example.com'")" == '{"my target"}' ]]
}

# Only the photo which should have been deleted is delete
specific_photo_is_banned () {
  setup 1 true

  assume_role reporter

  jc POST "/skip/${accused_id}" -d '{ "report_reason": "n/a" }'

  [[ "$(q "select count(*) from photo")" -eq 3 ]]

  c GET "/admin/delete-photo/$(deleted_photo_token)"

  [[ "$(q "select count(*) from photo")" -eq 2 ]]
}

# Execute tests
no_otp_when_email_banned
no_otp_when_ip_banned
otp_when_others_are_banned
ban_expiry
ban_token_expiry
photo_token_expiry
specific_person_is_banned
specific_photo_is_banned
