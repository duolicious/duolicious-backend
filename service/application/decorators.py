from database import api_tx
from duohash import duo_uuid, sha512
from flask import request, Flask
from flask_limiter import Limiter
from flask_cors import CORS
import constants
import duotypes
import os
from pathlib import Path
from werkzeug.middleware.proxy_fix import ProxyFix
import ipaddress
import traceback

disable_rate_limit_file = (
    Path(__file__).parent.parent.parent /
    'test' /
    'input' /
    'disable-rate-limit')

def _is_private_ip() -> bool:
    """
    Check if the given IP address is private.
    :param ip: IP address in string format
    :return: True if IP is private, False otherwise
    """
    _remote_addr = request.remote_addr or "127.0.0.1"

    if disable_rate_limit_file.is_file():
        with disable_rate_limit_file.open() as file:
            if file.read().strip() == '1':
                return True

    try:
        return ipaddress.ip_address(_remote_addr).is_private
    except ValueError:
        return False

def _get_remote_address() -> str:
    """
    :return: the ip address for the current request
     (or 127.0.0.1 if none found)

    """
    _remote_addr = request.remote_addr or "127.0.0.1"

    if disable_rate_limit_file.is_file():
        with disable_rate_limit_file.open() as file:
            if file.read().strip() == '1':
                return duo_uuid()

    return _remote_addr

CORS_ORIGINS = os.environ.get('DUO_CORS_ORIGINS', '*')

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1)
app.config['MAX_CONTENT_LENGTH'] = constants.MAX_CONTENT_LENGTH;

limiter = Limiter(
    _get_remote_address,
    app=app,
    default_limits=["60 per minute", "12 per second"],
    storage_uri="redis://redis:6379",
    strategy="fixed-window",
    default_limits_exempt_when=_is_private_ip,
)

shared_otp_limit = limiter.shared_limit("1 per minute", scope="otp")
shared_test_rate_limit = limiter.shared_limit("4 per minute", scope="sharedtestratelimit")

CORS(app, origins=CORS_ORIGINS.split(','))

Q_GET_SESSION = """
SELECT
    duo_session.person_id,
    person.uuid AS person_uuid,
    duo_session.email,
    duo_session.signed_in
FROM
    duo_session
LEFT JOIN
    person
ON
    duo_session.person_id = person.id
WHERE
    session_token_hash = %(session_token_hash)s
AND
    session_expiry > NOW()
"""

def return_empty_string(func):
    def go(*args, **kwargs):
        result = func(*args, **kwargs)
        return result if result is not None else ''
    go.__name__ = func.__name__
    return go

def validate(RequestType):
    def go2(func):
        def go1(*args, **kwargs):
            if RequestType is None:
                return func(*args, **kwargs)
            try:
                j = request.get_json(silent=True)
                f = request.files

                j = j if j else {}
                f = { 'files': f } if f else {}

                if type(j) == list:
                    req = RequestType(*j, **f)
                elif type(j) == dict:
                    req = RequestType(**{**j, **f})
                else:
                    req = RequestType(j, **f)
            except:
                print(traceback.format_exc())
                return f'Bad Request', 400
            return func(req, *args, **kwargs)
        go1.__name__ = func.__name__
        return go1
    return go2

def require_auth(expected_onboarding_status, expected_sign_in_status):
    def go2(func):
        def go1(*args, **kwargs):
            auth_header = (request.headers.get('Authorization') or '').lower()
            try:
                bearer, session_token = auth_header.split()
                if bearer != 'bearer':
                    raise Exception()
            except:
                return 'Missing or malformed authorization header', 400

            session_token_hash = sha512(session_token)
            params = dict(session_token_hash=session_token_hash)
            row = None
            with api_tx('READ COMMITTED') as tx:
                row = tx.execute(Q_GET_SESSION, params).fetchone()

            if row:
                session_info = duotypes.SessionInfo(
                    email=row['email'],
                    person_id=row['person_id'],
                    person_uuid=str(row['person_uuid']),
                    signed_in=row['signed_in'],
                    session_token_hash=session_token_hash,
                )
            else:
                return 'Invalid session token', 401

            is_onboarding_complete = session_info.person_id is not None
            is_signed_in = session_info.signed_in

            has_expected_onboarding_status = (
                expected_onboarding_status is None or
                expected_onboarding_status is not None and
                expected_onboarding_status == is_onboarding_complete)

            has_expected_sign_in_status = (
                expected_sign_in_status is None or
                expected_sign_in_status is not None and
                expected_sign_in_status == is_signed_in)

            if has_expected_onboarding_status and has_expected_sign_in_status:
                result = func(session_info, *args, **kwargs)
                return result if result is not None else ''
            elif not has_expected_onboarding_status:
                if is_onboarding_complete:
                    return 'You are already onboarded', 403
                else:
                    return 'You must finish onboarding first', 403
            elif not has_expected_sign_in_status:
                if is_signed_in:
                    return 'You are already signed in', 403
                else:
                    return 'You must sign in', 401
            else:
                raise 'Unhandled authentication state'

        go1.__name__ = func.__name__
        return go1
    return go2

def make_decorator(flask_decorator):
    def go2(
            rule,
            limiter=None,
            **kwargs
    ):
        maybe_limiter = limiter or (lambda x: x)

        def go1(func):
            return flask_decorator(
                rule,
                strict_slashes=False,
                **kwargs,
            )(
                maybe_limiter(
                    return_empty_string(func)
                )
            )
        return go1
    return go2

def make_auth_decorator(flask_decorator):
    def go2(
            rule,
            limiter=None,
            expected_onboarding_status=True,
            expected_sign_in_status=True,
            **kwargs
    ):
        maybe_limiter = limiter or (lambda x: x)

        def go1(func):
            return flask_decorator(
                rule,
                strict_slashes=False,
                **kwargs,
            )(
                maybe_limiter(
                    require_auth(
                        expected_onboarding_status,
                        expected_sign_in_status
                    )(
                        return_empty_string(func)
                    )
                )
            )
        return go1
    return go2

delete = make_decorator(app.delete)
get = make_decorator(app.get)
patch = make_decorator(app.patch)
post = make_decorator(app.post)
put = make_decorator(app.put)

adelete = make_auth_decorator(app.delete)
aget = make_auth_decorator(app.get)
apatch = make_auth_decorator(app.patch)
apost = make_auth_decorator(app.post)
aput = make_auth_decorator(app.put)
