import duotypes as t
from database import transaction
from typing import Tuple, Optional
from service.search.sql import *

def _q_uncached_search_2(
    use_distance: bool,
    is_quiz_search: bool
) -> str:
    search_table = (
        'search_for_quiz_prospects' if
        is_quiz_search else
        'search_for_standard_prospects'
    )

    maybe_distance_fragment = (
        Q_UNCACHED_SEARCH_2_DISTANCE_FRAGMENT if use_distance else ''
    )

    first_pass_limit = '1' if is_quiz_search else '1000'

    later_passes_fragments = (
        Q_UNCACHED_SEARCH_2_QUIZ_FRAGMENT if
        is_quiz_search else
        Q_UNCACHED_SEARCH_2_STANDARD_FRAGMENT
    )

    return (
        Q_UNCACHED_SEARCH_2
            .replace('[[search_table]]', search_table)
            .replace('[[maybe_distance_fragment]]', maybe_distance_fragment)
            .replace('[[first_pass_limit]]', first_pass_limit)
            .replace('[[later_passes_fragments]]', later_passes_fragments)
    )

def _uncached_search_results(
    searcher_person_id: int,
    no: Optional[Tuple[int, int]]
):
    with transaction('READ COMMITTED') as tx:
        params_1 = dict(
            searcher_person_id=searcher_person_id,
        )

        tx.execute(Q_UNCACHED_SEARCH_1, params_1)

        row = tx.fetchone()
        distance = row['distance']

        is_quiz_search = no is None
        q_uncached_search_2 = _q_uncached_search_2(
            use_distance=distance is not None,
            is_quiz_search=is_quiz_search,
        )
        if no is None:
            params_2 = dict(
                searcher_person_id=searcher_person_id,
                distance=distance,
            )
        else:
            n, o = no
            params_2 = dict(
                searcher_person_id=searcher_person_id,
                distance=distance,
                n=n,
                o=o,
            )

        return tx.execute(q_uncached_search_2, params_2).fetchall()

def _cached_search_results(searcher_person_id: int, no: Tuple[int, int]):
    n, o = no

    params = dict(
        searcher_person_id=searcher_person_id,
        n=n,
        o=o
    )

    with transaction('READ COMMITTED') as tx:
        return tx.execute(Q_CACHED_SEARCH, params).fetchall()

def get_search(s: t.SessionInfo, n: Optional[str], o: Optional[str]):
    n_: Optional[int] = n if n is None else int(n)
    o_: Optional[int] = o if o is None else int(o)

    if n_ is not None and not n_ >= 0:
        raise ValueError('n must be >= 0')
    if o_ is not None and not o_ >= 0:
        raise ValueError('o must be >= 0')

    no = None if (n_ is None or o_ is None) else (n_, o_)

    is_regular_search_first_page = o_ == 0
    is_quiz_search = no is None

    if is_regular_search_first_page or is_quiz_search:
        return _uncached_search_results(
            searcher_person_id=s.person_id,
            no=no,
        )
    else:
        return _cached_search_results(
            searcher_person_id=s.person_id,
            no=no,
        )
