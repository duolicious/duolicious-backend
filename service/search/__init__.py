import duotypes as t
from database import transaction
from typing import Tuple, Optional
from service.search.sql import *

def _q_uncached_search_2(use_distance: bool) -> str:
    maybe_distance_fragment = (
        Q_UNCACHED_SEARCH_2_DISTANCE_FRAGMENT if use_distance else ''
    )

    query = Q_UNCACHED_SEARCH_2.replace(
        '[[maybe_distance_fragment]]',
        maybe_distance_fragment,
    )

    print(query, flush=True) # TODO

    return query

def _uncached_search_results(searcher_person_id: int, no: Tuple[int, int]):
    with transaction('READ COMMITTED') as tx:
        params_1 = dict(
            searcher_person_id=searcher_person_id,
        )

        row = tx.execute(Q_UNCACHED_SEARCH_1, params_1).fetchone()
        distance = row['distance']

        q_uncached_search_2 = _q_uncached_search_2(
            use_distance=distance is not None,
        )

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

    is no is None:
        return _quiz_search_results(searcher_person_id=s.person_id)
    elif no[1] = 0:
        return _uncached_search_results(searcher_person_id=s.person_id, no=no)
    else:
        return _cached_search_results(searcher_person_id=s.person_id, no=no)
