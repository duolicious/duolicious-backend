#!/usr/bin/env bash

# Regression test for the session cache (see sessioncache/ and
# `require_auth` in service/api/decorators.py).
#
# `delete_or_ban_account` evicts the cached sessions of the deleted account so
# its bearer tokens stop authenticating immediately, instead of being served
# from the Redis cache until the TTL expires. It evicts *every* device's
# session (not just the calling one), so this test signs in twice for the same
# account and checks both tokens are rejected after deletion.
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

# Sign in on "device A", then make an authed request so the session is resolved
# from Postgres and written into the cache.
assume_role user1
c GET '/search-clubs?q=my-club'
token_a="$SESSION_TOKEN"

# Sign in again on "device B" (a second session for the same account) and cache
# it the same way.
assume_role user1
c GET '/search-clubs?q=my-club'
token_b="$SESSION_TOKEN"

# Two distinct signed-in sessions exist and are cached.
[[ "$(q "select count(*) from duo_session where signed_in")" -eq 2 ]]

# Delete the account using device B. The handler cascade-deletes both session
# rows and must evict both cached entries.
c DELETE /account

[[ "$(q "select count(*) from duo_session")" -eq 0 ]]

# The calling device's token must now be rejected at `require_auth`...
SESSION_TOKEN="$token_b"
! c GET '/search-clubs?q=my-club' || exit 1

# ...and so must the *other* device's token, rather than being served from a
# stale cache entry until the TTL elapsed.
SESSION_TOKEN="$token_a"
! c GET '/search-clubs?q=my-club' || exit 1
