#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

img1=$(rand_image)
img2=$(rand_image)
img3=$(rand_image)

set -xe

echo Create a user who added a photo during onboarding
q "delete from duo_session"
q "delete from person"
q "delete from onboardee"
q "delete from undeleted_photo"
../util/create-user.sh unchanged 0 0
../util/create-user.sh user1 0 1

[[ "$(q "select count(*) from photo")" == "1" ]]
[[ "$(q "select count(*) from person where has_profile_picture_id = 1")" == "1" ]]
[[ "$(q "select count(*) from onboardee_photo")" == "0" ]]
[[ "$(q "select count(*) from undeleted_photo")" == "1" ]]

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

[[ "$(q "select count(*) from photo")" == "1" ]]
[[ "$(q "select count(*) from person where has_profile_picture_id = 1")" == "1" ]]
[[ "$(q "select count(*) from onboardee_photo")" == "0" ]]
[[ "$(q "select count(*) from undeleted_photo")" == "2" ]]

echo Delete the first photo
jc DELETE /profile-info -d '{ "files": [1] }'

[[ "$(q "select count(*) from photo")" == "0" ]]
[[ "$(q "select count(*) from person where has_profile_picture_id = 1")" == "0" ]]
[[ "$(q "select count(*) from onboardee_photo")" == "0" ]]
[[ "$(q "select count(*) from undeleted_photo")" == "2" ]]

echo Create a user who added a photo after onboarding
q "delete from duo_session"
q "delete from person"
q "delete from onboardee"
q "delete from undeleted_photo"
../util/create-user.sh unchanged 0 0
../util/create-user.sh user1 0 0

assume_role user1

[[ "$(q "select count(*) from photo")" == "0" ]]
[[ "$(q "select count(*) from person where has_profile_picture_id = 1")" == "0" ]]
[[ "$(q "select count(*) from onboardee_photo")" == "0" ]]
[[ "$(q "select count(*) from undeleted_photo")" == "0" ]]

echo Add a photo
jc PATCH /profile-info \
  -d "{
          \"base64_file\": {
              \"position\": 1,
              \"base64\": \"${img1}\",
              \"top\": 0,
              \"left\": 0
          }
      }"

[[ "$(q "select count(*) from photo")" == "1" ]]
[[ "$(q "select count(*) from person where has_profile_picture_id = 1")" == "1" ]]
[[ "$(q "select count(*) from onboardee_photo")" == "0" ]]
[[ "$(q "select count(*) from undeleted_photo")" == "1" ]]

echo Change and delete photos during onboarding
q "delete from duo_session"
q "delete from person"
q "delete from onboardee"
q "delete from undeleted_photo"
../util/create-user.sh unchanged 0 0

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

[[ "$(q "select count(*) from photo")" == "0" ]]
[[ "$(q "select count(*) from person where has_profile_picture_id = 1")" == "0" ]]
[[ "$(q "select count(*) from onboardee_photo")" == "2" ]]
[[ "$(q "select count(*) from undeleted_photo")" == "2" ]]

echo Upload onboardee photos 2.jpg and 3.jpg
jc PATCH /onboardee-info \
  -d "{
          \"base64_file\": {
              \"position\": 2,
              \"base64\": \"${img2}\",
              \"top\": 0,
              \"left\": 0
          }
      }"

jc PATCH /onboardee-info \
  -d "{
          \"base64_file\": {
              \"position\": 3,
              \"base64\": \"${img3}\",
              \"top\": 0,
              \"left\": 0
          }
      }"

[[ "$(q "select count(*) from photo")" == "0" ]]
[[ "$(q "select count(*) from person where has_profile_picture_id = 1")" == "0" ]]
[[ "$(q "select count(*) from onboardee_photo")" == "3" ]]
[[ "$(q "select count(*) from undeleted_photo")" == "4" ]]
