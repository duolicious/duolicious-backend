import psycopg
import duotypes as t
import sessioncache
from database import api_tx
from rediscache import redis_cache
from typing import Tuple
from search.sql import (
    Q_CACHED_SEARCH,
    Q_PUBLIC_SEARCH,
    Q_QUIZ_SEARCH,
    Q_SEARCH_PREFERENCE,
    Q_UNCACHED_SEARCH_1,
    Q_UNCACHED_SEARCH_2,
    Q_FEED,
)
from dataclasses import dataclass
from datetime import datetime


@dataclass
class ClubHttpArg:
    club: str | None


def _quiz_search_results(tx, searcher_person_id: int):
    params = dict(
        searcher_person_id=searcher_person_id,
    )

    return tx.execute(Q_QUIZ_SEARCH, params).fetchall()


def _uncached_search_results(
    tx,
    searcher_person_id: int,
    no: Tuple[int, int],
    gender_preference: list[int],
):
    n, o = no

    params = dict(
        searcher_person_id=searcher_person_id,
        n=n,
        o=o,
        gender_preference=gender_preference,
    )

    try:
        tx.execute(Q_UNCACHED_SEARCH_1, params)
        tx.execute(Q_UNCACHED_SEARCH_2, params)
        tx.execute(Q_CACHED_SEARCH, params)
        return tx.fetchall()
    except psycopg.errors.QueryCanceled:
        # The query probably timed-out because it was too specific
        return []


def _cached_search_results(tx, searcher_person_id: int, no: Tuple[int, int]):
    n, o = no

    params = dict(
        searcher_person_id=searcher_person_id,
        n=n,
        o=o
    )

    return tx.execute(Q_CACHED_SEARCH, params).fetchall()


def get_search_type(n: str | None, o: str | None):
    n_: int | None = n if n is None else int(n)
    o_: int | None = o if o is None else int(o)

    if n_ is not None and not n_ >= 0:
        raise ValueError('n must be >= 0')
    if o_ is not None and not o_ >= 0:
        raise ValueError('o must be >= 0')

    no = None if (n_ is None or o_ is None) else (n_, o_)

    if no is None:
        return 'quiz-search', no
    elif no[1] == 0:
        return 'uncached-search', no
    else:
        return 'cached-search', no


def get_search(
    s: t.SessionInfo,
    n: str | None,
    o: str | None,
    club: ClubHttpArg | None,
):
    search_type, no = get_search_type(n, o)

    if no is not None and no[0] > 10:
        return 'n must be less than or equal to 10', 400

    if s.person_id is None:
        return '', 500

    params = dict(
        person_id=s.person_id,
        club_name=club.club if club else None,
        do_modify=club is not None,
    )

    with api_tx('READ COMMITTED') as tx:
        tx.execute('SET LOCAL statement_timeout = 10000') # 10 seconds

        rows = tx.execute(Q_SEARCH_PREFERENCE, params).fetchall()

        gender_preference = [row['gender_id'] for row in rows]


        if search_type == 'quiz-search':
            result = _quiz_search_results(
                tx=tx,
                searcher_person_id=s.person_id)

        elif search_type == 'uncached-search':
            result = _uncached_search_results(
                tx=tx,
                searcher_person_id=s.person_id,
                no=no,
                gender_preference=gender_preference)

        elif search_type == 'cached-search':
            result = _cached_search_results(
                tx=tx,
                searcher_person_id=s.person_id, no=no)

        else:
            raise Exception('Unexpected quiz type')

    # Q_SEARCH_PREFERENCE clears `pending_club_name` for this person. Once the
    # transaction has committed, drop the now-stale cached session so the
    # cleared value is visible immediately on this device; other sessions of
    # the same person age out within the cache TTL. Skip the call when there
    # was nothing pending to clear.
    if s.pending_club_name is not None:
        sessioncache.delete_session(s.session_token_hash)

    return result


def get_public_search(n: str | None, o: str | None):
    n_: int = 10 if n is None else int(n)
    o_: int = 0 if o is None else int(o)

    if not n_ >= 0:
        raise ValueError('n must be >= 0')
    if not o_ >= 0:
        raise ValueError('o must be >= 0')

    if n_ > 10:
        return 'n must be less than or equal to 10', 400

    return _get_public_search()[o_:o_ + n_]


@redis_cache(ttl=60)
def _get_public_search():
    with api_tx('READ COMMITTED') as tx:
        return tx.execute(Q_PUBLIC_SEARCH).fetchall()


def get_feed(s: t.SessionInfo, before: datetime):
    params = dict(
        searcher_person_id=s.person_id,
        before=before,
    )

    with api_tx('READ COMMITTED') as tx:
        tx.execute('SET LOCAL jit = off')
        tx.execute("SET LOCAL work_mem = '32MB'")

        rows = tx.execute(Q_FEED, params).fetchall()

    return [row['j'] for row in rows]
