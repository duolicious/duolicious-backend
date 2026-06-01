#!/usr/bin/env bash

# Regression test for the session cache (see sessioncache/ and
# `require_auth` in service/api/decorators.py).
#
# `delete_or_ban_account` calls `sessioncache.delete_session` so that a
# deleted account's bearer token stops authenticating immediately, instead of
# being served from the Redis cache until its TTL expires. This test guards
# that hook: it deletes an account and then reuses the same token.
#
# The probe endpoint matters. `/check-session-token` re-queries `person` in
# its handler and 401s on a missing row, so it would reject the token whether
# or not the cache was invalidated — it can't catch the regression.
# `/search-clubs` returns 200 from a valid session alone (its handler tolerates
# a missing person), so here `require_auth` is the only gate: a stale cache hit
# would let it succeed, while correct invalidation makes it 401.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$script_dir"

source ../util/setup.sh

set -xe

q "delete from duo_session"
q "delete from person"

../util/create-user.sh user1 0 0

# Sign in, then make an authed request so the session is resolved from Postgres
# and written into the cache.
assume_role user1
c GET '/search-clubs?q=my-club'

# Sanity check: the session is cached in Postgres before deletion.
[[ "$(q "select count(*) from duo_session where signed_in")" -eq 1 ]]

# Delete the account using this very session. The handler cascade-deletes the
# session row and must also evict the cached entry.
c DELETE /account

# The underlying session row is gone...
[[ "$(q "select count(*) from duo_session")" -eq 0 ]]

# ...and the same token must now be rejected at `require_auth` rather than
# served from a stale cache entry. Without the eviction, this would return 200
# until the cache TTL elapsed.
! c GET '/search-clubs?q=my-club' || exit 1
