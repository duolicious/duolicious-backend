#!/usr/bin/env bash

# Snapshot test for personality vectors.
#
# Two users answer a fixed set of questions (the same answers every run), then
# we snapshot the resulting `presence_score`, `absence_score`, `count_answers`
# and `personality` vector for each. The point is to pin down the *exact* output
# of the personality computation so it can be compared across a refactor:
#
#   1. On the base branch (before the refactor), run this once. The snapshot
#      file `test/fixtures/personality-snapshot.txt` doesn't exist yet, so it's
#      created from the current (old) output and the test passes. Commit it.
#   2. After rebasing the refactor on top, run it again. The recomputed vectors
#      are diffed against the committed snapshot; the test fails if anything
#      changed.
#
# To deliberately regenerate the snapshot (e.g. after an intended change to the
# matching algorithm), run `./personality-snapshot.sh update-snapshot`.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

SNAPSHOT_FILE="../fixtures/personality-snapshot.txt"

UPDATE_SNAPSHOT=""
if [[ "${1:-}" == update-snapshot ]]; then
  UPDATE_SNAPSHOT=1
fi

reset_db () {
  q "delete from duo_session"
  q "delete from person"
  q "delete from onboardee"
  q "delete from undeleted_photo"
}

# `sign_in`, `answer` and `snapshot_user_personality` live in ../util/setup.sh.

# Assert a person has exactly `$2` rows in the `answer` table.
assert_answer_count () {
  local email=$1
  local expected=$2
  local pid=$(q "select id from person where email = '$email'")

  [[ "$(q "select count(*) from answer where person_id = $pid")" -eq "$expected" ]]
}

# Assert one stored answer row matches what was submitted. `expected_answer` is
# psql's boolean output: 't', 'f', or '' for a skipped (null) answer.
assert_answer () {
  local email=$1
  local question_id=$2
  local expected_answer=$3
  local expected_public=$4
  local pid=$(q "select id from person where email = '$email'")

  [[ "$(q "
    select answer from answer
    where person_id = $pid and question_id = $question_id")" \
    == "$expected_answer" ]]
  [[ "$(q "
    select public_ from answer
    where person_id = $pid and question_id = $question_id")" \
    == "$expected_public" ]]
}

setup () {
  reset_db

  # `0` => onboard the users without answering any (random) questions, so the
  # only answers that feed into their personality are the fixed ones below.
  ../util/create-user.sh user1 0
  ../util/create-user.sh user2 0

  # Fixed answers. A mix of yes/no and public/private, spread over several
  # questions so the two users end up with distinct vectors. user1's skip (null)
  # is stored but doesn't count towards personality, so the two users also end
  # up with distinct `count_answers` (user1: 3, user2: 4).
  sign_in user1@example.com
  answer 1 true  true
  answer 2 false true
  answer 3 true  false
  answer 4 null  true

  sign_in user2@example.com
  answer 1 false true
  answer 2 true  false
  answer 5 true  true
  answer 6 false false
  answer 7 false false
  answer 9 false false
}

answers_are_recorded () {
  setup

  # user1: four rows, but the null answer (q4) isn't counted => count_answers 3.
  assert_answer_count user1@example.com 4
  assert_answer user1@example.com 1 t  t
  assert_answer user1@example.com 2 f  t
  assert_answer user1@example.com 3 t  f
  assert_answer user1@example.com 4 '' t
  [[ "$(q "select count_answers from person where email = 'user1@example.com'")" -eq 3 ]]

  # user2: four rows, all counted => count_answers 6.
  assert_answer_count user2@example.com 6
  assert_answer user2@example.com 1 f t
  assert_answer user2@example.com 2 t f
  assert_answer user2@example.com 5 t t
  assert_answer user2@example.com 6 f f
  [[ "$(q "select count_answers from person where email = 'user2@example.com'")" -eq 6 ]]
}

personality_snapshot_is_stable () {
  setup

  local actual
  actual=$(
    snapshot_user_personality user1@example.com user1
    snapshot_user_personality user2@example.com user2
  )

  if [[ "$UPDATE_SNAPSHOT" == 1 || ! -f "$SNAPSHOT_FILE" ]]; then
    printf '%s\n' "$actual" > "$SNAPSHOT_FILE"
    say "Wrote personality snapshot to $SNAPSHOT_FILE"
    return 0
  fi

  if ! diff -u "$SNAPSHOT_FILE" <(printf '%s\n' "$actual"); then
    say "Personality vectors changed from the committed snapshot ($SNAPSHOT_FILE)."
    say "If this change is intended, regenerate it with: $0 update-snapshot"
    exit 1
  fi
}

answers_are_recorded
personality_snapshot_is_stable
