#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

nsfw_img=$(base64 -w 0 ../fixtures/nsfw.jpg)
sfw_img=$( base64 -w 0 ../fixtures/sfw.jpg)

set -ex

q "delete from photo"
q "delete from person"

../util/create-user.sh user1 0 0
assume_role user1

jc PATCH /profile-info \
  -d "{
          \"base64_file\": {
              \"position\": 1,
              \"base64\": \"${nsfw_img}\",
              \"top\": 0,
              \"left\": 0
          }
      }"

jc PATCH /profile-info \
  -d "{
          \"base64_file\": {
              \"position\": 2,
              \"base64\": \"${sfw_img}\",
              \"top\": 0,
              \"left\": 0
          }
      }"

sleep 2

[[ "$(q "select count(*) from photo where position = 1 and nsfw_score > 0.95")" = 1 ]]
[[ "$(q "select count(*) from photo where position = 2 and nsfw_score < 0.05")" = 1 ]]
