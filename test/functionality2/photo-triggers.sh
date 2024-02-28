#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

img1=$(rand_image)
img2=$(rand_image)
img3=$(rand_image)

set -xe

echo Create a user who added two photos during onboarding
q "delete from banned_person"
q "delete from duo_session"
q "delete from person"
q "delete from onboardee"
q "delete from undeleted_photo"
../util/create-user.sh unchanged 0 2
../util/create-user.sh user1 0 2

[[ "$(q "select count(*) from photo")" == "4" ]]
[[ "$(q "select count(*) from person where has_profile_picture_id = 1")" == "2" ]]
[[ "$(q "select count(*) from onboardee_photo")" == "0" ]]
[[ "$(q "select count(*) from undeleted_photo")" == "0" ]]

assume_role user1

echo Change the first photo
jc PATCH /profile-info \
  -d "{
          \"base64_file\": {
              \"position\": 1,
              \"base64\": \"${img1}\",
              \"top\": 0,
              \"left\": 0
          }
      }"

[[ "$(q "select count(*) from photo")" == "4" ]]
[[ "$(q "select count(*) from person where has_profile_picture_id = 1")" == "2" ]]
[[ "$(q "select count(*) from onboardee_photo")" == "0" ]]
[[ "$(q "select count(*) from undeleted_photo")" == "1" ]]

echo Delete the first photo
jc DELETE /profile-info -d '{ "files": [1] }'

[[ "$(q "select count(*) from photo")" == "3" ]]
[[ "$(q "select count(*) from person where has_profile_picture_id = 1")" == "2" ]]
[[ "$(q "select count(*) from onboardee_photo")" == "0" ]]
[[ "$(q "select count(*) from undeleted_photo")" == "2" ]]

echo Change and delete photos during onboarding
q "delete from banned_person"
q "delete from duo_session"
q "delete from person"
q "delete from onboardee"
q "delete from undeleted_photo"
../util/create-user.sh unchanged 0 2

response=$(jc POST /request-otp -d '{ "email": "user1@example.com" }')
SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')
jc POST /check-otp -d '{ "otp": "000000" }'

echo Upload onboardee photos 1.jpg and 2.jpg
jc PATCH /onboardee-info \
  -d "{
          \"base64_file\": {
              \"position\": 1,
              \"base64\": \"${img1}\",
              \"top\": 0,
              \"left\": 0
          }
      }"

jc PATCH /onboardee-info \
  -d "{
          \"base64_file\": {
              \"position\": 2,
              \"base64\": \"${img2}\",
              \"top\": 0,
              \"left\": 0
          }
      }"

[[ "$(q "select count(*) from photo")" == "2" ]]
[[ "$(q "select count(*) from person where has_profile_picture_id = 1")" == "1" ]]
[[ "$(q "select count(*) from onboardee_photo")" == "2" ]]
[[ "$(q "select count(*) from undeleted_photo")" == "0" ]]

echo Change the first onboardee photo
jc PATCH /onboardee-info \
  -d "{
          \"base64_file\": {
              \"position\": 1,
              \"base64\": \"${img1}\",
              \"top\": 0,
              \"left\": 0
          }
      }"

[[ "$(q "select count(*) from photo")" == "2" ]]
[[ "$(q "select count(*) from person where has_profile_picture_id = 1")" == "1" ]]
[[ "$(q "select count(*) from onboardee_photo")" == "2" ]]
[[ "$(q "select count(*) from undeleted_photo")" == "1" ]]

echo Delete the first onboardee photo
jc DELETE /onboardee-info -d '{ "files": [1] }'

[[ "$(q "select count(*) from photo")" == "2" ]]
[[ "$(q "select count(*) from person where has_profile_picture_id = 1")" == "1" ]]
[[ "$(q "select count(*) from onboardee_photo")" == "1" ]]
[[ "$(q "select count(*) from undeleted_photo")" == "2" ]]

echo Self-deleted account
q "delete from banned_person"
q "delete from duo_session"
q "delete from person"
q "delete from onboardee"
q "delete from undeleted_photo"
../util/create-user.sh unchanged 0 2
../util/create-user.sh user1 0 2

assume_role user1
c DELETE /account

[[ "$(q "select count(*) from photo")" == "2" ]]
[[ "$(q "select count(*) from person where has_profile_picture_id = 1")" == "1" ]]
[[ "$(q "select count(*) from onboardee_photo")" == "0" ]]
[[ "$(q "select count(*) from undeleted_photo")" == "2" ]]

echo Admin-deleted account
q "delete from banned_person"
q "delete from duo_session"
q "delete from person"
q "delete from onboardee"
q "delete from undeleted_photo"
../util/create-user.sh unchanged 0 2
../util/create-user.sh user1 0 2

uuid=$(q "select gen_random_uuid()")
user1id=$(q "select id from person where name = 'user1'")

q "insert into banned_person_admin_token values (
  '${uuid}', ${user1id}, now(), now() + interval '1 year')"

c GET "/admin/ban/${uuid}"

[[ "$(q "select count(*) from photo")" == "2" ]]
[[ "$(q "select count(*) from person where has_profile_picture_id = 1")" == "1" ]]
[[ "$(q "select count(*) from onboardee_photo")" == "0" ]]
[[ "$(q "select count(*) from undeleted_photo")" == "2" ]]

echo Admin-deleted photo
q "delete from banned_person"
q "delete from duo_session"
q "delete from person"
q "delete from onboardee"
q "delete from undeleted_photo"
../util/create-user.sh unchanged 0 2
../util/create-user.sh user1 0 2

uuid=$(q "select gen_random_uuid()")
user1id=$(q "select id from person where name = 'user1'")
photo_uuid=$(q "select uuid from photo where position = 1 and person_id = $user1id")

q "insert into deleted_photo_admin_token values (
  '${uuid}', '${photo_uuid}', now(), now() + interval '1 year')"

c GET "/admin/delete-photo/${uuid}"

[[ "$(q "select count(*) from photo")" == "3" ]]
[[ "$(q "select count(*) from person where has_profile_picture_id = 1")" == "2" ]]
[[ "$(q "select count(*) from onboardee_photo")" == "0" ]]
[[ "$(q "select count(*) from undeleted_photo")" == "1" ]]

echo Expired onboardee
q "delete from banned_person"
q "delete from duo_session"
q "delete from person"
q "delete from onboardee"
q "delete from undeleted_photo"

../util/create-user.sh unchanged 0 1

response=$(jc POST /request-otp -d '{ "email": "user1@example.com" }')
SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')
jc POST /check-otp -d '{ "otp": "000000" }'

echo Upload onboardee photos 1.jpg and 2.jpg for user1
jc PATCH /onboardee-info \
  -d "{
          \"base64_file\": {
              \"position\": 1,
              \"base64\": \"${img1}\",
              \"top\": 0,
              \"left\": 0
          }
      }"

jc PATCH /onboardee-info \
  -d "{
          \"base64_file\": {
              \"position\": 2,
              \"base64\": \"${img2}\",
              \"top\": 0,
              \"left\": 0
          }
      }"

response=$(jc POST /request-otp -d '{ "email": "user2@example.com" }')
SESSION_TOKEN=$(echo "$response" | jq -r '.session_token')
jc POST /check-otp -d '{ "otp": "000000" }'

echo Upload onboardee photos 1.jpg and 2.jpg for user2
jc PATCH /onboardee-info \
  -d "{
          \"base64_file\": {
              \"position\": 1,
              \"base64\": \"${img1}\",
              \"top\": 0,
              \"left\": 0
          }
      }"

jc PATCH /onboardee-info \
  -d "{
          \"base64_file\": {
              \"position\": 2,
              \"base64\": \"${img2}\",
              \"top\": 0,
              \"left\": 0
          }
      }"

q "
update
  onboardee
set
  created_at = now() - interval '1 year'
where
  email = 'user1@example.com'
"

sleep 2

[[ "$(q "select count(*) from photo")" == "1" ]]
[[ "$(q "select count(*) from person where has_profile_picture_id = 1")" == "1" ]]
[[ "$(q "select count(*) from onboardee_photo")" == "2" ]]
[[ "$(q "select count(*) from undeleted_photo")" == "2" ]]
