#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

q "delete from duo_session"
q "delete from person"
q "delete from club"
q "delete from person_club"
q "delete from onboardee"
q "delete from undeleted_photo"
q "update question set count_yes = 0, count_no = 0"

img1=$(rand_image)
img2=$(base64 -w 0 < ../fixtures/img.heic)
snd1=$(rand_sound)
snd2=$(const_sound)

../util/create-user.sh user1 0 0
../util/create-user.sh user2 0 0

assume_role user1

test_set () {
  local field_name=$1
  local field_value=$2
  local has_gold_value=${3:-true}

  q "update person set has_gold = ${has_gold_value}"

  jc PATCH /profile-info -d '{ "'"$field_name"'": "'"$field_value"'" }'
  new_field_value=$(
    set +x
    c GET /profile-info | jq -r ".[\"${field_name//_/\ }\"]"
  )
  [[ "$new_field_value" == "$field_value" ]]
}

test_club () {
  local clubs=$(
    set +x
    c GET /profile-info | jq -r ".[\"clubs\"] | sort_by(.name)"
  )
  local expected_clubs="[]"
  [[ "$clubs" == "$expected_clubs" ]]

  jc POST /join-club -d '{ "name": "my-club" }'
  jc POST /join-club -d '{ "name": "my-other-club" }'
  local clubs=$(
    set +x
    c GET /profile-info | jq -r ".[\"clubs\"] | sort_by(.name)"
  )
  local expected_clubs=$(
    jq -r . <<< "[\
      {\"count_members\": 1, \"name\": \"my-club\"}, \
      {\"count_members\": 1, \"name\": \"my-other-club\"}\
    ] | sort_by(.name)"
  )
  [[ "$clubs" == "$expected_clubs" ]]

  assume_role user2
  jc POST /join-club -d '{ "name": "my-other-club" }'
  local clubs=$(
    set +x
    c GET /profile-info | jq -r ".[\"clubs\"] | sort_by(.name)"
  )
  local expected_clubs=$(
    jq -r . <<< "[\
      {\"count_members\": 2, \"name\": \"my-other-club\"}\
    ] | sort_by(.name)"
  )
  [[ "$clubs" == "$expected_clubs" ]]

  assume_role user1
  local clubs=$(
    set +x
    c GET /profile-info | jq -r ".[\"clubs\"] | sort_by(.name)"
  )
  local expected_clubs=$(
    jq -r . <<< "[\
      {\"count_members\": 1, \"name\": \"my-club\"}, \
      {\"count_members\": 2, \"name\": \"my-other-club\"}\
    ] | sort_by(.name)"
  )
  [[ "$clubs" == "$expected_clubs" ]]

  # /leave-club is basically correct
  jc POST /leave-club -d '{ "name": "my-club" }'
  local clubs=$(
    set +x
    c GET /profile-info | jq -r ".[\"clubs\"] | sort_by(.name)"
  )
  local expected_clubs=$(
    jq -r . <<< "[\
      {\"count_members\": 2, \"name\": \"my-other-club\"}\
    ] | sort_by(.name)"
  )
  [[ "$clubs" == "$expected_clubs" ]]

  # /leave-club is idempotent
  jc POST /leave-club -d '{ "name": "my-club" }'
  local clubs=$(
    set +x
    c GET /profile-info | jq -r ".[\"clubs\"] | sort_by(.name)"
  )
  local expected_clubs=$(
    jq -r . <<< "[\
      {\"count_members\": 2, \"name\": \"my-other-club\"}\
    ] | sort_by(.name)"
  )
  [[ "$clubs" == "$expected_clubs" ]]
}

test_photo () {
  jc PATCH /profile-info \
    -d "{
            \"base64_file\": {
                \"position\": 1,
                \"base64\": \"${img1}\",
                \"top\": 0,
                \"left\": 0
            }
        }"

  jc PATCH /profile-info \
    -d "{
            \"base64_file\": {
                \"position\": 2,
                \"base64\": \"${img2}\",
                \"top\": 0,
                \"left\": 0
            }
        }"

  wait_for_creation_by_uuid "$(q "select uuid from photo where position = 1")"

  wait_for_creation_by_uuid "$(q "select uuid from photo where position = 2")"

  [[ "$(q "select COUNT(*) from photo")" -eq 2 ]]

  jc DELETE /profile-info -d '{ "files": [1] }'

  [[ "$(q "select COUNT(*) from photo")" -eq 1 ]]

  jc DELETE /profile-info -d '{ "files": [2] }'

  [[ "$(q "select COUNT(*) from photo")" -eq 0 ]]
}

test_photo_assignments () {
  jc DELETE /profile-info -d '{ "files": [1, 2, 3, 4, 5, 6, 7] }'

  jc PATCH /profile-info \
    -d "{
            \"base64_file\": {
                \"position\": 1,
                \"base64\": \"${img1}\",
                \"top\": 0,
                \"left\": 0
            }
        }"

  jc PATCH /profile-info \
    -d "{
            \"base64_file\": {
                \"position\": 2,
                \"base64\": \"${img1}\",
                \"top\": 0,
                \"left\": 0
            }
        }"

  wait_for_creation_by_uuid "$(q "select uuid from photo where position = 1")"

  wait_for_creation_by_uuid "$(q "select uuid from photo where position = 2")"

  # Overwriting an occupied position isn't allowed
  ! jc PATCH /profile-info \
    -d "{ \"photo_assignments\": { \"1\": 2 } }" || exit 1

  [[ "$(q "select COUNT(DISTINCT uuid) from photo")" -eq 2 ]]

  # Moving many photos to one position isn't allowed
  ! jc PATCH /profile-info \
    -d "{ \"photo_assignments\": { \"1\": 3, \"2\": 3 } }" || exit 1

  [[ "$(q "select COUNT(DISTINCT uuid) from photo")" -eq 2 ]]

  # Moving an unoccupied position to an occupied one does nothing
  jc PATCH /profile-info \
    -d "{ \"photo_assignments\": { \"3\": 1 } }"

  [[ "$(q "select COUNT(DISTINCT uuid) from photo")" -eq 2 ]]

  # Files can be swapped
  jc PATCH /profile-info \
    -d "{ \"photo_assignments\": { \"1\": 2, \"2\": 1 } }"

  # Files can be moved to unoccupied positions
  jc PATCH /profile-info \
    -d "{ \"photo_assignments\": { \"1\": 3, \"2\": 4 } }"

  [[ "$(q "select COUNT(DISTINCT uuid) from photo")" -eq 2 ]]
}

test_audio () {
  jc PATCH /profile-info \
    -d "{ \"base64_audio_file\": { \"base64\": \"${snd1}\" } }"

  local snd1_uuid=$(q "select uuid from audio limit 1")

  wait_for_audio_creation_by_uuid "${snd1_uuid}"

  [[ "$(q "select COUNT(*) from audio")" -eq 1 ]]

  jc DELETE /profile-info -d '{ "audio_files": [-1] }'

  [[ "$(q "select COUNT(*) from audio")" -eq 0 ]]

  wait_for_audio_deletion_by_uuid "${snd1_uuid}"

  jc PATCH /profile-info \
    -d "{ \"base64_audio_file\": { \"base64\": \"${snd2}\" } }"

  local snd2_uuid=$(q "select uuid from audio limit 1")

  wait_for_audio_creation_by_uuid "${snd2_uuid}"
}

test_theme () {
  local has_gold_value=${1:-true}

  q "update person set has_gold = ${has_gold_value}"

  local value=$(cat << EOF
{
  "theme": {
    "background_color": "#012345",
    "body_color":       "#123456",
    "title_color":      "#abcdef"
  }
}
EOF
)

  jc PATCH /profile-info -d "$value"

  local new_field_value=$(
    set +x
    c GET /profile-info | jq -r 'with_entries(select(.key == "theme"))'
  )
  local formatted_original_value=$(jq -r <<< "$value")

  diff <(echo "$new_field_value") <(echo "$formatted_original_value")
}

test_flair () {
  local expected_value='{"flair": ["gold", "voice-bio"]}'

  local actual_value=$(
    set +x
    c GET /profile-info | jq -r 'with_entries(select(.key == "flair"))'
  )
  local formatted_expected_value=$(jq -r <<< "$expected_value")

  diff <(echo "$actual_value") <(echo "$formatted_expected_value")
}

test_verification_loss_gender () {
  jc PATCH /profile-info -d '{ "gender": "Man" }'

  q "
    update person
    set verified_age = true,
        verified_gender = true,
        verified_ethnicity = true,
        verification_level_id = 2"

  jc PATCH /profile-info -d '{ "gender": "Man" }'
  [[ "$(q "
    select count(*) from person \
    where uuid = '$USER_UUID' and verification_level_id = 2")" -eq 1 ]]
  [[ "$(q "
    select count(*) from person \
    where uuid = '$USER_UUID' and verified_gender")" -eq 1 ]]

  jc PATCH /profile-info -d '{ "gender": "Woman" }'
  [[ "$(q "
    select count(*) from person \
    where uuid = '$USER_UUID' and verification_level_id = 1")" -eq 1 ]]
  [[ "$(q "
    select count(*) from person \
    where uuid = '$USER_UUID' and not verified_gender")" -eq 1 ]]
}

test_verification_loss_ethnicity () {
  jc PATCH /profile-info -d '{ "ethnicity": "East Asian" }'

  q "
    update person
    set verified_age = true,
        verified_gender = true,
        verified_ethnicity = true,
        verification_level_id = 2"

  jc PATCH /profile-info -d '{ "ethnicity": "East Asian" }'
  [[ "$(q "
    select count(*) from person \
    where uuid = '$USER_UUID' and verification_level_id = 2")" -eq 1 ]]
  [[ "$(q "
    select count(*) from person \
    where uuid = '$USER_UUID' and verified_ethnicity")" -eq 1 ]]

  jc PATCH /profile-info -d '{ "ethnicity": "Native American" }'
  [[ "$(q "
    select count(*) from person \
    where uuid = '$USER_UUID' and verification_level_id = 2")" -eq 1 ]]
  [[ "$(q "
    select count(*) from person \
    where uuid = '$USER_UUID' and not verified_ethnicity")" -eq 1 ]]
}

test_verification_loss_photo_changed () {
  jc DELETE /profile-info -d '{ "files": [1, 2, 3, 4, 5, 6, 7] }'

  jc PATCH /profile-info \
    -d "{
            \"base64_file\": {
                \"position\": 1,
                \"base64\": \"${img1}\",
                \"top\": 0,
                \"left\": 0
            }
        }"

  q "update photo set verified = TRUE"
  q "
    update person
    set verified_age = true,
        verified_gender = true,
        verification_level_id = 3"

  [[ "$(q "select COUNT(*) from photo where verified")" -eq 1 ]]
  [[ "$(q "
    select COUNT(*) from person \
    where uuid = '$USER_UUID' and verification_level_id = 3")" -eq 1 ]]

  jc PATCH /profile-info \
    -d "{
            \"base64_file\": {
                \"position\": 1,
                \"base64\": \"${img1}\",
                \"top\": 0,
                \"left\": 0
            }
        }"

  [[ "$(q "select COUNT(*) from photo where verified")" -eq 0 ]]
  [[ "$(q "
    select COUNT(*) from person \
    where uuid = '$USER_UUID' and verification_level_id = 2")" -eq 1 ]]
}

test_verification_loss_photo_removed () {
  jc DELETE /profile-info -d '{ "files": [1, 2, 3, 4, 5, 6, 7] }'

  jc PATCH /profile-info \
    -d "{
            \"base64_file\": {
                \"position\": 1,
                \"base64\": \"${img1}\",
                \"top\": 0,
                \"left\": 0
            }
        }"

  q "update photo set verified = TRUE"
  q "
    update person
    set verified_age = true,
        verified_gender = true,
        verification_level_id = 3"

  [[ "$(q "select COUNT(*) from photo where verified")" -eq 1 ]]
  [[ "$(q "
    select COUNT(*) from person \
    where uuid = '$USER_UUID' and verification_level_id = 3")" -eq 1 ]]

  jc DELETE /profile-info -d '{ "files": [1] }'

  [[ "$(q "select COUNT(*) from photo where verified")" -eq 0 ]]
  [[ "$(q "
    select COUNT(*) from person \
    where uuid = '$USER_UUID' and verification_level_id = 2")" -eq 1 ]]
}

test_verification_required () {
  [[ "$(q "select COUNT(*) from person where verification_required")" -eq 0 ]]
  test_set location "London, England, United Kingdom"
  [[ "$(q "select COUNT(*) from person where verification_required")" -eq 1 ]]
  test_set location "New York, New York, United States"
  [[ "$(q "select COUNT(*) from person where verification_required")" -eq 1 ]]
}


test_set name "Jeff" false && exit 1
test_set name "Jeff" true
test_set about "I'm a bad ass motherfuckin' DJ / This is why I walk and talk this way"
test_set gender Woman
test_set orientation Asexual
test_set ethnicity 'Pacific Islander'
test_set location "New York, New York, United States"
test_set occupation 'Wallnut milker'
test_set education MIT
test_set height 184
test_set looking_for 'Short-term dating'
test_set smoking Yes
test_set drinking Often
test_set drugs No
test_set long_distance Yes
test_set relationship_status Single
test_set has_kids No
test_set wants_kids Yes
test_set exercise Often
test_set religion Zoroastrian
test_set star_sign Sagittarius
test_set units Imperial
test_set chats 'Every 3 days'
test_set intros Weekly
test_set verification_level 'Basics only'
test_set show_my_location Yes
test_set show_my_age No
test_set hide_me_from_strangers Yes
test_set browse_invisibly Yes

test_club

test_photo

test_photo_assignments

test_audio

test_theme false && exit 1
test_theme true

test_verification_loss_gender
test_verification_loss_ethnicity
test_verification_loss_photo_changed
test_verification_loss_photo_removed

test_verification_required

test_flair
