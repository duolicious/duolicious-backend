from antirude.normalize import normalize_string
from database import api_tx
from sql import Q_IS_ALLOWED_CLUB_NAME

def _is_allowed_club_name(club_name: str) -> bool:
    q = Q_IS_ALLOWED_CLUB_NAME.replace('%()s', '%(club_name)s')

    params = dict(club_name=club_name)

    with api_tx() as tx:
        row = tx.execute(q, params).fetchone()
        return bool(row['is_allowed_club_name'])

def is_rude(name: str) -> bool:
    normalized_name = normalize_string(name)

    return not _is_allowed_club_name(normalized_name)
