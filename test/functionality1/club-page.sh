#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

# The club-stats and description crons run on a 1s poll in the test compose
# (DUO_CRON_CLUB_STATS_POLL_SECONDS / DUO_CRON_CLUB_SEO_POLL_SECONDS), and the
# description cron uses DUO_CRON_CLUB_SEO_MOCK_DESCRIPTION instead of OpenAI.
MOCK_DESCRIPTION='A friendly test description for this club.'

# Poll a SQL predicate that should return '1', up to ~30s. Used to wait for
# the crons to populate club_stats / club_seo before hitting the API, so we
# never cache a premature 404 (get_club memoises its result per 5-min TTL).
wait_for () {
  local sql=$1
  for _ in $(seq 1 60); do
    [[ "$(q "$sql")" == "1" ]] && return 0
    sleep 0.5
  done
  echo "wait_for timed out: $sql" >&2
  return 1
}

reset_db () {
  q "delete from person"
  q "delete from person_club"
  q "delete from club_stats"
  q "delete from club_stats_dirty"
  q "delete from club_seo"
  q "delete from club"
}

club_page_is_precomputed_and_served () {
  echo 'An eligible club gets a precomputed, single-row /club/<name> page'

  reset_db

  # 51 members (>= MIN_CLUB_PAGE_MEMBERS = 50). create-user.sh onboards every
  # user with gender "Other" and age 26, so the demographic cells are
  # deterministic and clear the MIN_CLUB_CELL_SIZE = 5 floor.
  for i in $(seq 1 51); do
    ../util/create-user.sh "clubber$i" 0 0
  done
  for i in $(seq 1 51); do
    assume_role "clubber$i"
    jc POST /join-club -d '{ "name": "anime" }'
  done

  # The stats cron precomputes club_stats; the description cron then fills in
  # club_seo.description (mocked).
  #
  # We wait on the exact stored member_count (not just the row's existence)
  # because the cron can race the join loop: the first tick that fires after
  # the 50th join writes a club_stats row with member_count = 50, the 51st
  # join then re-marks the club dirty, but get_club's lru_cache would lock
  # that stale row in for its 5-minute TTL if the API saw it before the next
  # recompute. Waiting for member_count = 51 here guarantees the API's first
  # read (and thus the cached result) reflects every join.
  wait_for "select 1 from club_stats where club_name = 'anime' and (stats_json->>'member_count')::int = 51"
  wait_for "select (description is not null)::int from club_seo where club_name = 'anime'"

  result=$(c GET /club/anime)

  [[ "$(jq -r .name         <<< "$result")" == "anime" ]]
  [[ "$(jq -r .member_count <<< "$result")" == "51" ]]
  [[ "$(jq -r .description  <<< "$result")" == "$MOCK_DESCRIPTION" ]]

  # Demographics are computed from members: all 51 are gender "Other".
  [[ "$(jq -r '.demographics.gender[0].label' <<< "$result")" == "Other" ]]
  [[ "$(jq -r '.demographics.gender[0].count' <<< "$result")" == "51" ]]

  # All members are 26 -> the 25-34 age bucket.
  [[ "$(jq -r '.demographics.age_buckets[0].label' <<< "$result")" == "25-34" ]]
  [[ "$(jq -r '.demographics.age_buckets[0].count' <<< "$result")" == "51" ]]

  # Empty categories are present as empty arrays, never null.
  [[ "$(jq -r '.demographics.religion | type' <<< "$result")" == "array" ]]
  [[ "$(jq -r '.personality   | type'        <<< "$result")" == "array" ]]
  [[ "$(jq -r '.related_clubs | type'        <<< "$result")" == "array" ]]
}

small_club_is_not_a_page () {
  echo 'A club below the member threshold has no precomputed page and 404s'

  reset_db

  for i in $(seq 1 3); do
    ../util/create-user.sh "tiny$i" 0 0
  done
  for i in $(seq 1 3); do
    assume_role "tiny$i"
    jc POST /join-club -d '{ "name": "tinyclub" }'
  done

  # Give the crons a moment; they must NOT produce a page for an ineligible
  # club. (count_members = 3 < MIN_CLUB_PAGE_MEMBERS = 50.)
  sleep 3

  [[ "$(q "select count(*) from club_stats where club_name = 'tinyclub'")" == "0" ]]
  ! c GET /club/tinyclub || exit 1
}

missing_club_404s () {
  echo 'A club that does not exist 404s'

  ! c GET /club/this-club-does-not-exist || exit 1
}

sitemap_reflects_eligibility () {
  echo 'The sitemap lists eligible clubs and the static pages, but not small ones'

  # get_sitemap_xml is memoised for an hour, so this test makes the only
  # /sitemap.xml call in the file and checks every condition against it.
  reset_db

  for i in $(seq 1 51); do
    ../util/create-user.sh "sitemapper$i" 0 0
  done
  for i in $(seq 1 51); do
    assume_role "sitemapper$i"
    jc POST /join-club -d '{ "name": "gaming" }'
  done

  ../util/create-user.sh sitemap-tiny 0 0
  assume_role sitemap-tiny
  jc POST /join-club -d '{ "name": "sitemap-tinyclub" }'

  # See the comment in club_page_is_precomputed_and_served on why we wait
  # for the exact stored member_count rather than the row's existence.
  wait_for "select 1 from club_stats where club_name = 'gaming' and (stats_json->>'member_count')::int = 51"
  sleep 2  # ensure the ineligible club has had a chance (and been skipped)

  sitemap=$(c GET /sitemap.xml)
  grep -q '<loc>https://duolicious.app/</loc>' <<< "$sitemap"
  grep -q '/club/gaming' <<< "$sitemap"
  ! grep -q '/club/sitemap-tinyclub' <<< "$sitemap" || exit 1
}

related_clubs_are_ranked_by_overlap () {
  echo 'A club lists overlapping clubs as related (via the club_overlap cron)'

  # Fresh club names: get_club memoises per name for its TTL, so reusing a
  # name GET in an earlier test would return a stale (empty-related) result.
  reset_db

  for i in $(seq 1 52); do
    ../util/create-user.sh "knitter$i" 0 0
  done

  # All 52 join "knitting"; the first 51 also join "crochet". Both clear the
  # MIN_CLUB_PAGE_MEMBERS = 50 eligibility bar (so crochet shows up in the
  # related list, which is gated on it) and share 51 members.
  for i in $(seq 1 52); do
    assume_role "knitter$i"
    jc POST /join-club -d '{ "name": "knitting" }'
  done
  for i in $(seq 1 51); do
    assume_role "knitter$i"
    jc POST /join-club -d '{ "name": "crochet" }'
  done

  # Wait for stats to reflect all 52 joins (see comment in
  # club_page_is_precomputed_and_served), and for the overlap rebuild to
  # have seen all 51 shared members before we issue the cached GET.
  wait_for "select 1 from club_stats where club_name = 'knitting' and (stats_json->>'member_count')::int = 52"
  wait_for "select 1 from club_overlap where club_a = 'knitting' and club_b = 'crochet' and overlap = 51"

  result=$(c GET /club/knitting)
  [[ "$(jq -r '.related_clubs[0].name'          <<< "$result")" == "crochet" ]]
  [[ "$(jq -r '.related_clubs[0].count_members' <<< "$result")" == "51" ]]
}

club_page_is_precomputed_and_served
small_club_is_not_a_page
missing_club_404s
related_clubs_are_ranked_by_overlap
sitemap_reflects_eligibility
