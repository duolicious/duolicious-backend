from database import api_tx
from typing import List
from batcher import Batcher


Q_SELECT_INTRO_HASH = """
SELECT
    1
FROM
    intro_hash
WHERE
    hash = %(hash)s
AND
    last_used_at > now() - interval '7 days'
"""


Q_UPSERT_INTRO_HASH = """
INSERT INTO intro_hash (
    hash,
    last_used_at
) VALUES (
    %(hash)s,
    now()
)
ON CONFLICT (hash) DO UPDATE SET
    last_used_at = now()
"""


def process_batch(batch: List[str]):
    distinct_hashes = set(batch)

    params_seq = [dict(hash=hash) for hash in distinct_hashes]

    with api_tx('read committed') as tx:
        tx.executemany(Q_UPSERT_INTRO_HASH, params_seq)


_batcher = Batcher[str](
    process_fn=process_batch,
    flush_interval=1.0,
    min_batch_size=1,
    max_batch_size=1000,
    retry=False,
)


_batcher.start()


def upsert_intro_hash(hashed: str):
    _batcher.enqueue(hashed)
