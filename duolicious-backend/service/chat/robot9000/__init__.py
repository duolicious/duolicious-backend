from database import api_tx
from typing import List
from batcher import Batcher
from collections import Counter


Q_SELECT_INTRO_HASH = """
SELECT
    used_count
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
    used_count,
    last_used_at
) VALUES (
    %(hash)s,
    %(used_count)s,
    now()
)
ON CONFLICT (hash) DO UPDATE SET
    used_count = intro_hash.used_count + EXCLUDED.used_count,
    last_used_at = now()
"""


def process_batch(batch: List[str]) -> None:
    hash_counts = Counter(batch)

    params_seq = [
        dict(hash=hash, used_count=used_count)
        for hash, used_count in hash_counts.items()
    ]

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


def upsert_intro_hash(hashed: str) -> None:
    _batcher.enqueue(hashed)
