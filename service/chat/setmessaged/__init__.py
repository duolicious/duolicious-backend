from typing import List
from dataclasses import dataclass
from database import api_tx
from functools import lru_cache
from batcher import Batcher


Q_SET_MESSAGED = """
INSERT INTO messaged (
    subject_person_id,
    object_person_id
) VALUES (
    %(from_id)s,
    %(to_id)s
) ON CONFLICT DO NOTHING
"""


@dataclass(frozen=True)
class Messaged:
    from_id: int
    to_id: int


def process_batch(batch: List[Messaged]):
    distinct_messaged = set(batch)

    params_seq = [
            dict(from_id=m.from_id, to_id=m.to_id)
            for m in distinct_messaged]

    with api_tx('read committed') as tx:
        tx.executemany(Q_SET_MESSAGED, params_seq)


_batcher = Batcher[Messaged](
    process_fn=process_batch,
    flush_interval=1.0,
    min_batch_size=1,
    max_batch_size=1000,
    retry=False,
)


_batcher.start()


@lru_cache(maxsize=1024)
def set_messaged(from_id: int, to_id: int) -> None:
    _batcher.enqueue(Messaged(from_id=from_id, to_id=to_id))
