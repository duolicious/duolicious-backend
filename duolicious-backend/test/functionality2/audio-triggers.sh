#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

snd1=$(rand_sound)
snd2=$(rand_sound)
snd3=$(rand_sound)

set -xe

echo Create a user who added two photos during onboarding
q "delete from person"
q "delete from banned_person"
q "delete from duo_session"
q "delete from undeleted_audio"
../util/create-user.sh unchanged 0 0 true
../util/create-user.sh user1 0 0 true

[[ "$(q "select count(*) from audio")" == "2" ]]
[[ "$(q "select count(*) from undeleted_audio")" == "0" ]]

assume_role user1

echo Change the voice bio
jc PATCH /profile-info \
  -d "{ \"base64_audio_file\": { \"base64\": \"${snd1}\" } }"

[[ "$(q "select count(*) from audio")" == "2" ]]
[[ "$(q "select count(*) from undeleted_audio")" == "1" ]]

echo Delete the audio bio
jc DELETE /profile-info -d '{ "audio_files": [-1] }'

[[ "$(q "select count(*) from audio")" == "1" ]]
[[ "$(q "select count(*) from undeleted_audio")" == "2" ]]

echo Self-deleted account
q "delete from person"
q "delete from banned_person"
q "delete from duo_session"
q "delete from undeleted_audio"
../util/create-user.sh unchanged 0 0 true
../util/create-user.sh user1 0 0 true

assume_role user1
c DELETE /account

[[ "$(q "select count(*) from audio")" == "1" ]]
[[ "$(q "select count(*) from undeleted_audio")" == "1" ]]

echo Admin-deleted account
q "delete from person"
q "delete from banned_person"
q "delete from duo_session"
q "delete from undeleted_audio"
../util/create-user.sh unchanged 0 0 true
../util/create-user.sh user1 0 0 true

uuid=$(q "select gen_random_uuid()")
user1id=$(q "select id from person where name = 'user1'")

q "insert into banned_person_admin_token values (
  '${uuid}', ${user1id}, now(), now() + interval '1 year')"

c GET "/admin/ban/${uuid}"

[[ "$(q "select count(*) from audio")" == "1" ]]
[[ "$(q "select count(*) from undeleted_audio")" == "1" ]]
