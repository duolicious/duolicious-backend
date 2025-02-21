from database import api_tx
from typing import List
from batcher import Batcher


Q_INSERT_INTRO_HASH = """
INSERT INTO
    intro_hash (hash)
VALUES (%(hash)s)
ON CONFLICT DO NOTHING
"""


def process_batch(batch: List[str]):
    distinct_hashes = set(batch)

    params_seq = [dict(hash=hash) for hash in distinct_hashes]

    with api_tx('read committed') as tx:
        tx.executemany(Q_INSERT_INTRO_HASH, params_seq)


_batcher = Batcher[str](
    process_fn=process_batch,
    flush_interval=1.0,
    min_batch_size=1,
    max_batch_size=1000,
    retry=False,
)


_batcher.start()


def insert_intro_hash(hashed: str):
    _batcher.enqueue(hashed)
