from database import api_tx
from dataclasses import dataclass
from typing import Optional, Iterable
from batcher import Batcher


Q_SET_TOKEN = """
UPDATE person SET push_token = %(token)s WHERE uuid = uuid_or_null(%(username)s)
"""


Q_DELETE_TOKEN = """
UPDATE person SET push_token = NULL WHERE uuid = uuid_or_null(%(username)s)
"""


@dataclass(frozen=True)
class DuoPushToken:
    username: str
    token: Optional[str]


def execute_query(usernames: Iterable[DuoPushToken], has_token: bool):
    if not usernames:
        return

    params_seq = [
            dict(username=username.username, token=username.token)
            for username in usernames]

    q = Q_SET_TOKEN if has_token else Q_DELETE_TOKEN

    with api_tx('read committed') as tx:
        tx.executemany(q, params_seq)


def process_batch(batch: Iterable[DuoPushToken]):
    for has_token in (True, False):
        usernames = set(
            duo_push_token
            for duo_push_token in batch
            if bool(duo_push_token.token) is has_token)

        execute_query(usernames=usernames, has_token=has_token)


_batcher = Batcher[DuoPushToken](
    process_fn=process_batch,
    flush_interval=1.0,
    min_batch_size=1,
    max_batch_size=100,
    retry=False,
)

_batcher.start()

def maybe_register(parsed_xml, username):
    if not username:
        return False

    try:
        if parsed_xml.tag != 'duo_register_push_token':
            raise Exception('Not a duo_register_push_token message')

        token = parsed_xml.attrib.get('token')

        _batcher.enqueue(DuoPushToken(username=username, token=token))

        return True
    except:
        pass

    return False
