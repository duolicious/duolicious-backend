import psycopg
import duotypes as t
from database import api_tx
from typing import Tuple, Optional
from service.search.sql import *
from dataclasses import dataclass

@dataclass
class ClubHttpArg:
    club: Optional[str]

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
        return tx.execute(Q_UNCACHED_SEARCH_2, params).fetchall()
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

def get_search_type(n: Optional[str], o: Optional[str]):
    n_: Optional[int] = n if n is None else int(n)
    o_: Optional[int] = o if o is None else int(o)

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
    n: Optional[str],
    o: Optional[str],
    club: Optional[ClubHttpArg],
):
    search_type, no = get_search_type(n, o)

    if no is not None and no[0] > 10:
        return 'n must be less than or equal to 10', 400

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
            return _quiz_search_results(
                tx=tx,
                searcher_person_id=s.person_id)

        elif search_type == 'uncached-search':
            return _uncached_search_results(
                tx=tx,
                searcher_person_id=s.person_id,
                no=no,
                gender_preference=gender_preference)

        elif search_type == 'cached-search':
            return _cached_search_results(
                tx=tx,
                searcher_person_id=s.person_id, no=no)

        else:
            raise Exception('Unexpected quiz type')
