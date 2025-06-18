#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

img1=$(rand_image)
img2=$(rand_image)

setup () {
  local num_photos=${1:-0}
  local make_bystander=${2:-false}

  q "delete from duo_session"
  q "delete from person"
  q "delete from onboardee"
  q "delete from banned_person"
  q "delete from banned_person_admin_token"
  q "delete from deleted_photo_admin_token"
  q "delete from banned_photo_hash"

  ../util/create-user.sh 'reporter@gmail.com' 0 0
  assume_role 'reporter@gmail.com'
  add_photos "${num_photos}"

  ../util/create-user.sh 'accuse.d+1@gmail.com' 0 0
  assume_role 'accuse.d+1@gmail.com'
  add_photos "${num_photos}"

  if [[ "${make_bystander}" == true ]]
  then
    ../util/create-user.sh 'bystander@gmail.com' 0 "${num_photos}"
  fi

  accused_id=$(
    q "select id from person where email = 'accuse.d+1@gmail.com'")

  accused_uuid=$(
    q "select uuid from person where email = 'accuse.d+1@gmail.com'")

  bystander_uuid=$(
    q "select uuid from person where email = 'bystander@gmail.com'")
}

tear_down () {
  q "delete from banned_person"
  q "delete from banned_person_admin_token"
  q "delete from deleted_photo_admin_token"
}

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

  assume_role 'reporter@gmail.com'

  jc POST "/skip/by-uuid/${accused_uuid}" -d '{ "report_reason": "n/a" }'

  c GET "/admin/ban/$(ban_token)"

  q "update banned_person set ip_address = '255.255.255.255'"

  ! ../util/create-user.sh 'accused@gmail.com' 0 0
}

# A banned ip can't get an OTP
no_otp_when_ip_banned () {
  setup

  assume_role 'reporter@gmail.com'

  jc POST "/skip/by-uuid/${accused_uuid}" -d '{ "report_reason": "n/a" }'

  c GET "/admin/ban/$(ban_token)"

  q "update banned_person set normalized_email = 'nobody@example.com'"

  ! ../util/create-user.sh 'accused@gmail.com' 0 0
}

# Banning one user doesn't ban everyone
otp_when_others_are_banned () {
  setup

  assume_role 'reporter@gmail.com'

  jc POST "/skip/by-uuid/${accused_uuid}" -d '{ "report_reason": "n/a" }'

  c GET "/admin/ban/$(ban_token)"

  q "update banned_person set ip_address = '255.255.255.255'"
  q "update banned_person set normalized_email = 'nobody@example.com'"

  ../util/create-user.sh 'bystander@gmail.com' 0 0
}

# Ban expiry is respected
ban_expiry () {
  setup

  assume_role 'reporter@gmail.com'

  jc POST "/skip/by-uuid/${accused_uuid}" -d '{ "report_reason": "n/a" }'

  c GET "/admin/ban/$(ban_token)"

  q "update banned_person set expires_at = NOW() + interval '1 day'"
  ! ../util/create-user.sh 'accused@gmail.com' 0 0 || exit 1

  q "update banned_person set expires_at = NOW() - interval '1 day'"
  ../util/create-user.sh 'accused@gmail.com' 0 0
}

# token expiry is respected for bans
ban_token_expiry () {
  setup

  assume_role 'reporter@gmail.com'

  jc POST "/skip/by-uuid/${accused_uuid}" -d '{ "report_reason": "n/a" }'

  q "update banned_person_admin_token set expires_at = NOW() - interval '1 day'"
  ! c GET "/admin/ban/$(ban_token)"
}

# token expiry is respected for photos
photo_token_expiry () {
  setup

  assume_role 'reporter@gmail.com'

  jc POST "/skip/by-uuid/${accused_uuid}" -d '{ "report_reason": "n/a" }'

  q "update deleted_photo_admin_token set expires_at = NOW() - interval '1 day'"
  ! c GET "/admin/delete-photo/$(deleted_photo_token)"
}

# Only the person who should have been banned is deleted
specific_person_is_banned () {
  setup 0 true

  assume_role 'reporter@gmail.com'

  jc POST "/skip/by-uuid/${accused_uuid}" -d '{ "report_reason": "my target" }'
  jc POST "/skip/by-uuid/${bystander_uuid}" -d '{ "report_reason": "collateral damage" }'

  [[ "$(q "select count(*) from person")" -eq 3 ]]

  c GET "/admin/ban/$(ban_token)"

  [[ "$(q "select count(*) from person")" -eq 2 ]]

  [[ "$(q "select count(*) from person where id = ${accused_id}")" -eq 0 ]]

  [[ "$(q "select report_reasons \
    from banned_person \
    where normalized_email = 'accused@gmail.com'")" == '{"my target"}' ]]
}

# Only the photo which should have been deleted is delete
specific_photo_is_banned () {
  setup 1 true

  assume_role 'accuse.d+1@gmail.com'

  jc PATCH /profile-info \
    -d "{
            \"base64_file\": {
                \"position\": 1,
                \"base64\": \"${img1}\",
                \"top\": 0,
                \"left\": 0
            }
        }"

  assume_role 'reporter@gmail.com'

  jc POST "/skip/by-uuid/${accused_uuid}" -d '{ "report_reason": "n/a" }'

  [[ "$(q "select count(*) from photo")" -eq 3 ]]
  [[ "$(q "select count(*) from banned_photo_hash")" -eq 0 ]]
  [[ "$(q "select count(*) from person where last_event_name = 'added-photo'")" -eq 2 ]]

  c GET "/admin/delete-photo/$(deleted_photo_token)"

  [[ "$(q "select count(*) from photo")" -eq 2 ]]
  [[ "$(q "select count(*) from banned_photo_hash where hash <> ''")" -eq 1 ]]
  [[ "$(q "select count(*) from person where last_event_name = 'added-photo'")" -eq 1 ]]

  assume_role 'accuse.d+1@gmail.com'

  ! jc PATCH /profile-info \
    -d "{
            \"base64_file\": {
                \"position\": 2,
                \"base64\": \"${img1}\",
                \"top\": 0,
                \"left\": 0
            }
        }" || exit 1

  jc PATCH /profile-info \
    -d "{
            \"base64_file\": {
                \"position\": 3,
                \"base64\": \"${img2}\",
                \"top\": 0,
                \"left\": 0
            }
        }"

  [[ "$(q "select count(*) from photo")" -eq 3 ]]
}

bans_work_despite_no_active_sessions () {
  setup 0 true

  assume_role 'reporter@gmail.com'

  jc POST "/skip/by-uuid/${accused_uuid}" -d '{ "report_reason": "my target" }'
  jc POST "/skip/by-uuid/${bystander_uuid}" -d '{ "report_reason": "collateral damage" }'

  q "delete from duo_session"

  [[ "$(q "select count(*) from person")" -eq 3 ]]

  c GET "/admin/ban/$(ban_token)"

  [[ "$(q "select count(*) from person")" -eq 2 ]]

  [[ "$(q "select count(*) from person where id = ${accused_id}")" -eq 0 ]]

  [[ "$(q "select report_reasons \
    from banned_person \
    where normalized_email = 'accused@gmail.com'")" == '{"my target"}' ]]
}

# Execute tests
bans_work_despite_no_active_sessions
no_otp_when_email_banned
no_otp_when_ip_banned
otp_when_others_are_banned
ban_expiry
ban_token_expiry
photo_token_expiry
specific_person_is_banned
specific_photo_is_banned

tear_down
