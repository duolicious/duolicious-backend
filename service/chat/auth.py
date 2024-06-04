#!/usr/bin/env python3

import sys
import struct
from database import api_tx
from duohash import sha512

Q_CHECK_AUTH = """
SELECT
    1
FROM
    duo_session
LEFT JOIN
    person
ON
    duo_session.person_id = person.id
WHERE
    session_token_hash = %(session_token_hash)s
AND
    person.uuid = %(person_uuid)s
AND
    session_expiry > NOW()
LIMIT
    1
"""

Q_CHECK_IS_USER = """
SELECT
    1
FROM
    person
WHERE
    person.uuid = %(person_uuid)s
LIMIT
    1
"""

def deny():
    sys.stdout.buffer.write(b'\x00\x02\x00\x00')
    sys.stdout.flush()

def allow():
    sys.stdout.buffer.write(b'\x00\x02\x00\x01')
    sys.stdout.flush()

def check_auth(person_uuid, host, session_token):
    if host != 'duolicious.app':
        return False

    params = dict(
        person_uuid=person_uuid,
        session_token_hash = sha512(session_token),
    )

    with api_tx() as tx:
        return bool(tx.execute(Q_CHECK_AUTH, params=params).fetchone())

def check_is_user(person_uuid, host):
    if host != 'duolicious.app':
        return False

    params = dict(person_uuid=person_uuid)

    with api_tx() as tx:
        return bool(tx.execute(Q_CHECK_IS_USER, params=params).fetchone())

def handle_request(data):
    parts = data.split(':')

    try:
        op, person_uuid, host, session_token = parts
        assert op == 'auth'

        return check_auth(person_uuid, host, session_token)
    except (AssertionError, ValueError):
        pass

    try:
        op, person_uuid, host = parts
        assert op == 'isuser'

        return check_is_user(person_uuid, host)
    except (AssertionError, ValueError):
        pass

    return False

def main():
    while True:
        try:
            input_length_bytes = sys.stdin.buffer.read(2)
            if not input_length_bytes:
                deny()
                continue

            input_length = struct.unpack('!H', input_length_bytes)[0]

            data = sys.stdin.buffer.read(input_length).decode()

            if handle_request(data):
                allow()
            else:
                deny()
        except:
            deny()

if __name__ == "__main__":
    main()
