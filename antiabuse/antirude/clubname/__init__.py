from database import api_tx
from commonsql import Q_IS_ALLOWED_CLUB_NAME

def is_allowed_club_name(club_name: str) -> bool:
    q = Q_IS_ALLOWED_CLUB_NAME.replace('%()s', '%(club_name)s')

    params = dict(club_name=club_name)

    with api_tx() as tx:
        row = tx.execute(q, params).fetchone()
        return bool(row['is_allowed_club_name'])
