from database import api_tx

Q_IS_BANNED_PHOTO = """
SELECT
    1
FROM
    banned_photo_hash
WHERE
    hash = %(hash)s
"""

def is_banned_photo(md5_hash: str) -> bool:
    with api_tx() as tx:
        tx.execute(Q_IS_BANNED_PHOTO, dict(hash=md5_hash))
        return bool(tx.fetchall())
