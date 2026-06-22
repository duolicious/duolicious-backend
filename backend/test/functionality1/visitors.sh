#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

setup_fresh_users () {
  q "delete from duo_session"
  q "delete from person"
  q "delete from club"
  q "delete from onboardee"
  q "delete from undeleted_photo"

  ../util/create-user.sh user1 0 0
  ../util/create-user.sh user2 0 0

  # Ensure privacy gating doesn't hide fields
  q "update person set privacy_verification_level_id = 1"
}

happy_path_visitors () {
  setup_fresh_users

  user1_uuid=$(q "select uuid from person where name = 'user1'")
  user2_uuid=$(q "select uuid from person where name = 'user2'")

  # Viewing a prospect profile records a visit
  assume_role user1
  c GET "/prospect-profile/${user2_uuid}" > /dev/null

  assume_role user2
  c GET "/prospect-profile/${user1_uuid}" > /dev/null

  # From user1's perspective: one in visited_you (user2), one in you_visited (user2)
  assume_role user1

  response=$(c GET "/visitors")

  visited_you_len=$(echo "$response" | jq '.visited_you | length')
  you_visited_len=$(echo "$response" | jq '.you_visited | length')
  [[ "$visited_you_len" -eq 1 ]]
  [[ "$you_visited_len" -eq 1 ]]

  # Validate key fields for visited_you[0]
  vu0=$(echo "$response" | jq '.visited_you[0]')
  [[ "$(echo "$vu0" | jq -r '.person_uuid')" == "$user2_uuid" ]]
  [[ "$(echo "$vu0" | jq -r '.name')" == "user2" ]]
  [[ "$(echo "$vu0" | jq -r '.gender')" == "Other" ]]
  [[ "$(echo "$vu0" | jq -r '.age')" == "26" ]]
  [[ "$(echo "$vu0" | jq -r '.is_verified')" == "false" ]]
  # is_new should be true before marking as checked
  [[ "$(echo "$vu0" | jq -r '.is_new')" == "true" ]]

  # Validate key fields for you_visited[0]
  yv0=$(echo "$response" | jq '.you_visited[0]')
  [[ "$(echo "$yv0" | jq -r '.person_uuid')" == "$user2_uuid" ]]
  [[ "$(echo "$yv0" | jq -r '.name')" == "user2" ]]
  [[ "$(echo "$yv0" | jq -r '.gender')" == "Other" ]]
  [[ "$(echo "$yv0" | jq -r '.age')" == "26" ]]
  [[ "$(echo "$yv0" | jq -r '.is_verified')" == "false" ]]

  # Mark visitors as checked; subsequent fetch should show is_new=false
  c POST "/mark-visitors-checked" > /dev/null

  # Ensure at least a tiny timestamp delta
  sleep 0.1 || true

  response=$(c GET "/visitors")

  [[ "$(echo "$response" | jq -r '.visited_you[0].is_new')" == "false" ]]
}

hide_me_from_strangers_respected () {
  setup_fresh_users

  user1_uuid=$(q "select uuid from person where name = 'user1'")
  user2_uuid=$(q "select uuid from person where name = 'user2'")
  user1_id=$(q "select id from person where name = 'user1'")
  user2_id=$(q "select id from person where name = 'user2'")

  # user2 disables hide me from strangers
  assume_role user2
  jc PATCH /profile-info -d '{ "hide_me_from_strangers": "No" }'

  # user2 visits user1 with hide_me_from_strangers: No
  # (creates visited: user2 -> user1 with invisible=false)
  assume_role user2
  c GET "/prospect-profile/${user1_uuid}" > /dev/null

  # From user2's perspective, they should see who they visited
  assume_role user2
  response=$(c GET "/visitors")
  [[ "$(echo "$response" | jq '.you_visited | length')" -ge 1 ]]
  [[ "$(echo "$response" | jq -r '.you_visited[0].person_uuid')" == "$user1_uuid" ]]
  [[ "$(echo "$response" | jq -r '.you_visited[0].was_invisible')" == "false" ]]

  # From user1's perspective, user2 should appear in visited_you
  assume_role user1
  response=$(c GET "/visitors")
  [[ "$(echo "$response" | jq '.visited_you | length')" -eq 1 ]]

  # user2 enables hide me from strangers
  assume_role user2
  jc PATCH /profile-info -d '{ "hide_me_from_strangers": "Yes" }'

  # From user2's perspective, they should still see who they visited.
  # was_invisible should be false even though they'll stop seeing user2's
  # visit because user1 might have seen user2's visit before user2 hid themselves
  # from strangers
  assume_role user2
  response=$(c GET "/visitors")
  [[ "$(echo "$response" | jq '.you_visited | length')" -ge 1 ]]
  [[ "$(echo "$response" | jq -r '.you_visited[0].person_uuid')" == "$user1_uuid" ]]
  [[ "$(echo "$response" | jq -r '.you_visited[0].was_invisible')" == "false" ]]

  # From user1's perspective, user2 should appear NOT appear in visited_you
  assume_role user1
  response=$(c GET "/visitors")
  [[ "$(echo "$response" | jq '.visited_you | length')" -eq 0 ]]

  # user2 visits user1 with hide_me_from_strangers: Yes
  # (creates visited: user2 -> user1 with invisible=true)
  assume_role user2
  c GET "/prospect-profile/${user1_uuid}" > /dev/null
  response=$(c GET "/visitors")
  [[ "$(echo "$response" | jq '.you_visited | length')" -ge 1 ]]
  [[ "$(echo "$response" | jq -r '.you_visited[0].person_uuid')" == "$user1_uuid" ]]
  [[ "$(echo "$response" | jq -r '.you_visited[0].was_invisible')" == "true" ]]

  # user2 disables hide me from strangers
  assume_role user2
  jc PATCH /profile-info -d '{ "hide_me_from_strangers": "No" }'

  # From user1's perspective, user2 should still NOT appear in visited_you
  assume_role user1
  response=$(c GET "/visitors")
  [[ "$(echo "$response" | jq '.visited_you | length')" -eq 0 ]]
}

skip_respected () {
  # Case A: Prospect (user2) skipped checker (user1) -> user2 should not appear
  setup_fresh_users

  user1_uuid=$(q "select uuid from person where name = 'user1'")
  user2_uuid=$(q "select uuid from person where name = 'user2'")
  user1_id=$(q "select id from person where name = 'user1'")
  user2_id=$(q "select id from person where name = 'user2'")

  # Create reciprocal visits
  assume_role user1; c GET "/prospect-profile/${user2_uuid}" > /dev/null
  assume_role user2; c GET "/prospect-profile/${user1_uuid}" > /dev/null

  # user2 skips user1
  q "insert into skipped values (${user2_id}, ${user1_id}, false)"

  assume_role user1
  response=$(c GET "/visitors")
  [[ "$(echo "$response" | jq '.visited_you | length')" -eq 0 ]]
  [[ "$(echo "$response" | jq '.you_visited | length')" -eq 0 ]]

  # Case B: Checker (user1) skipped prospect (user2) -> hidden unless preference allows
  setup_fresh_users

  user1_uuid=$(q "select uuid from person where name = 'user1'")
  user2_uuid=$(q "select uuid from person where name = 'user2'")
  user1_id=$(q "select id from person where name = 'user1'")
  user2_id=$(q "select id from person where name = 'user2'")

  # Create reciprocal visits
  assume_role user1; c GET "/prospect-profile/${user2_uuid}" > /dev/null
  assume_role user2; c GET "/prospect-profile/${user1_uuid}" > /dev/null

  # user1 skips user2
  q "insert into skipped values (${user1_id}, ${user2_id}, false)"

  assume_role user1
  response=$(c GET "/visitors")
  [[ "$(echo "$response" | jq '.visited_you | length')" -eq 0 ]]
  [[ "$(echo "$response" | jq '.you_visited | length')" -eq 0 ]]

  # Enable viewing skipped in preferences (skipped_id = 1 means 'Yes')
  q "update search_preference_skipped set skipped_id = 1 where person_id = ${user1_id}"

  response=$(c GET "/visitors")
  [[ "$(echo "$response" | jq '.visited_you | length')" -eq 1 ]]
  [[ "$(echo "$response" | jq '.you_visited | length')" -eq 1 ]]
  [[ "$(echo "$response" | jq -r '.visited_you[0].person_uuid')" == "$user2_uuid" ]]
  [[ "$(echo "$response" | jq -r '.you_visited[0].person_uuid')" == "$user2_uuid" ]]
}

show_my_age_respected () {
  setup_fresh_users

  # user2 hides age
  assume_role user2
  jc PATCH /profile-info -d '{ "show_my_age": "No" }'

  user1_uuid=$(q "select uuid from person where name = 'user1'")
  user2_uuid=$(q "select uuid from person where name = 'user2'")

  # Create reciprocal visits
  assume_role user1; c GET "/prospect-profile/${user2_uuid}" > /dev/null
  assume_role user2; c GET "/prospect-profile/${user1_uuid}" > /dev/null

  # From user1's perspective, user2's age should be null in both lists
  assume_role user1
  response=$(c GET "/visitors")
  [[ "$(echo "$response" | jq '.visited_you | length')" -eq 1 ]]
  [[ "$(echo "$response" | jq '.you_visited | length')" -eq 1 ]]
  [[ "$(echo "$response" | jq -r '.visited_you[0].person_uuid')" == "$user2_uuid" ]]
  [[ "$(echo "$response" | jq -r '.you_visited[0].person_uuid')" == "$user2_uuid" ]]
  [[ "$(echo "$response" | jq -r '.visited_you[0].age')" == "null" ]]
  [[ "$(echo "$response" | jq -r '.you_visited[0].age')" == "null" ]]
}

show_my_location_respected () {
  setup_fresh_users

  # user2 hides location
  assume_role user2
  jc PATCH /profile-info -d '{ "show_my_location": "No" }'

  user1_uuid=$(q "select uuid from person where name = 'user1'")
  user2_uuid=$(q "select uuid from person where name = 'user2'")

  # Create reciprocal visits
  assume_role user1; c GET "/prospect-profile/${user2_uuid}" > /dev/null
  assume_role user2; c GET "/prospect-profile/${user1_uuid}" > /dev/null

  # From user1's perspective, user2's location should be null in both lists
  assume_role user1
  response=$(c GET "/visitors")
  [[ "$(echo "$response" | jq '.visited_you | length')" -eq 1 ]]
  [[ "$(echo "$response" | jq '.you_visited | length')" -eq 1 ]]
  [[ "$(echo "$response" | jq -r '.visited_you[0].person_uuid')" == "$user2_uuid" ]]
  [[ "$(echo "$response" | jq -r '.you_visited[0].person_uuid')" == "$user2_uuid" ]]
  [[ "$(echo "$response" | jq -r '.visited_you[0].location')" == "null" ]]
  [[ "$(echo "$response" | jq -r '.you_visited[0].location')" == "null" ]]
}

browse_invisibly_respected () {
  setup_fresh_users

  user1_uuid=$(q "select uuid from person where name = 'user1'")
  user2_uuid=$(q "select uuid from person where name = 'user2'")
  user1_id=$(q "select id from person where name = 'user1'")
  user2_id=$(q "select id from person where name = 'user2'")

  # user2 enables browse invisibly
  assume_role user2
  jc PATCH /profile-info -d '{ "browse_invisibly": "Yes" }'

  # user2 visits user1 (creates visited: user2 -> user1 with invisible=true)
  assume_role user2
  c GET "/prospect-profile/${user1_uuid}" > /dev/null

  # From user1's perspective, browse_invisibly user2 should NOT appear in visited_you
  assume_role user1
  response=$(c GET "/visitors")
  [[ "$(echo "$response" | jq '.visited_you | length')" -eq 0 ]]

  # user1 visits user2 (creates visited: user1 -> user2)
  assume_role user1
  c GET "/prospect-profile/${user2_uuid}" > /dev/null

  # From user2's perspective, even with browse_invisibly, they should see who they visited
  assume_role user2
  response=$(c GET "/visitors")
  [[ "$(echo "$response" | jq '.you_visited | length')" -ge 1 ]]
  [[ "$(echo "$response" | jq -r '.you_visited[0].person_uuid')" == "$user1_uuid" ]]
  [[ "$(echo "$response" | jq -r '.you_visited[0].was_invisible')" == "true" ]]

  # Disable browse invisibly now; past invisible visit should remain invisible to user1
  assume_role user2
  jc PATCH /profile-info -d '{ "browse_invisibly": "No" }'

  assume_role user1
  response=$(c GET "/visitors")
  [[ "$(echo "$response" | jq '.visited_you | length')" -eq 0 ]]
}

mark_visitors_checked_respects_custom_time () {
  setup_fresh_users

  user1_uuid=$(q "select uuid from person where name = 'user1'")
  user2_uuid=$(q "select uuid from person where name = 'user2'")
  user1_id=$(q "select id from person where name = 'user1'")
  user2_id=$(q "select id from person where name = 'user2'")

  # user2 visits user1 (creates visited: user2 -> user1)
  assume_role user2
  c GET "/prospect-profile/${user1_uuid}" > /dev/null

  # From user1's perspective, the visitor should be marked new initially
  assume_role user1
  response=$(c GET "/visitors")
  [[ "$(echo "$response" | jq -r '.visited_you | length')" -eq 1 ]]
  [[ "$(echo "$response" | jq -r '.visited_you[0].is_new')" == "true" ]]

  # Force last_visitor_check_time into the past to open a safe window
  q "update person set last_visitor_check_time = now() - interval '2 hours' where id = ${user1_id}"
  prev_check=$(q "select iso8601_utc(last_visitor_check_time::timestamp) from person where id = ${user1_id}")

  # Choose a time strictly between previous value and now()
  between_time=$(q "select iso8601_utc((now() - interval '1 hour')::timestamp)")
  jc POST /mark-visitors-checked -d '{ "time": "'""${between_time}""'" }' > /dev/null

  # DB should reflect exactly the provided time (proves time is not ignored)
  actual_check=$(q "select iso8601_utc(last_visitor_check_time::timestamp) from person where id = ${user1_id}")
  [[ "${actual_check}" == "${between_time}" ]]

  # Sending an older timestamp should not regress last_visitor_check_time
  old_time=$(q "select iso8601_utc((now() - interval '1 day')::timestamp)")
  jc POST /mark-visitors-checked -d '{ "time": "'""${old_time}""'" }' > /dev/null
  actual_check_after_old=$(q "select iso8601_utc(last_visitor_check_time) from person where id = ${user1_id}")
  [[ "${actual_check_after_old}" == "${between_time}" ]]

  # Sending a future timestamp should clamp to now() (not the future value)
  future_time=$(q "select iso8601_utc((now() + interval '1 day')::timestamp)")
  jc POST /mark-visitors-checked -d '{ "time": "'""${future_time}""'" }' > /dev/null
  actual_check_after_future=$(q "select iso8601_utc(last_visitor_check_time) from person where id = ${user1_id}")
  now_after_future=$(q "select iso8601_utc(now()::timestamp)")
  # It should advance from between_time, must not equal the future_time, and must be <= now
  [[ "${actual_check_after_future}" != "${future_time}" ]]
  [[ "${actual_check_after_future}" > "${between_time}" ]]
  [[ "${actual_check_after_future}" < "${now_after_future}" || "${actual_check_after_future}" == "${now_after_future}" ]]
}

empty_visitors_returns_iso8601_last_visited_at () {
  setup_fresh_users

  # From user1's perspective, there should be no visitors yet
  assume_role user1
  response=$(c GET "/visitors")

  # Both lists should be empty
  [[ "$(echo "$response" | jq '.visited_you | length')" -eq 0 ]]
  [[ "$(echo "$response" | jq '.you_visited | length')" -eq 0 ]]
  [[ "$(echo "$response" | jq 'has("last_visited_at")')" = true ]]
}

empty_visitors_returns_iso8601_last_visited_at
mark_visitors_checked_respects_custom_time
happy_path_visitors
hide_me_from_strangers_respected
skip_respected
show_my_age_respected
show_my_location_respected
browse_invisibly_respected
