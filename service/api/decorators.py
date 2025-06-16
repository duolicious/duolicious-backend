from database import api_tx
from duohash import duo_uuid, sha512
from flask import request, Flask, g
from flask_limiter import Limiter
from flask_cors import CORS
import constants
import duotypes
import os
from pathlib import Path
from werkzeug.middleware.proxy_fix import ProxyFix
import ipaddress
import traceback
from antiabuse.antispam.signupemail import normalize_email
from pydantic import ValidationError
from functools import lru_cache
import time

enable_mocking_file = (
    Path(__file__).parent.parent.parent /
    'test' /
    'input' /
    'enable-mocking')

disable_ip_rate_limit_file = (
    Path(__file__).parent.parent.parent /
    'test' /
    'input' /
    'disable-ip-rate-limit')

disable_account_rate_limit_file = (
    Path(__file__).parent.parent.parent /
    'test' /
    'input' /
    'disable-account-rate-limit')

mock_ip_address_file = (
    Path(__file__).parent.parent.parent /
    'test' /
    'input' /
    'mock-ip-address')

@lru_cache()
def _enable_mocking(ttl_hash=None):
    if enable_mocking_file.is_file():
        with enable_mocking_file.open() as file:
            if file.read().strip() == '1':
                return True
    return False

def enable_mocking():
    return _enable_mocking(ttl_hash=round(time.time()))

def disable_ip_rate_limit():
    if not enable_mocking():
        return False

    if not disable_ip_rate_limit_file.is_file():
        return False

    with disable_ip_rate_limit_file.open() as file:
        if file.read().strip() == '1':
            return True

    return False

def disable_account_rate_limit():
    if not enable_mocking():
        return False

    if not disable_account_rate_limit_file.is_file():
        return False

    with disable_account_rate_limit_file.open() as file:
        if file.read().strip() == '1':
            return True

    return False

def mock_ip_address():
    if not enable_mocking():
        return None

    if not mock_ip_address_file.is_file():
        return None

    with mock_ip_address_file.open() as file:
        ip_address = file.read().strip()
        if ip_address:
            return ip_address

    return None

def _is_private_ip() -> bool:
    """
    Check if the given IP address is private.
    :param ip: IP address in string format
    :return: True if IP is private, False otherwise
    """
    if disable_ip_rate_limit():
        return True

    _remote_addr = mock_ip_address() or request.remote_addr or "127.0.0.1"

    try:
        return ipaddress.ip_address(_remote_addr).is_private
    except ValueError:
        return False

def _get_remote_address() -> str:
    """
    :return: the ip address for the current request
     (or 127.0.0.1 if none found)
    """
    return mock_ip_address() or request.remote_addr or "127.0.0.1"

CORS_ORIGINS = os.environ.get('DUO_CORS_ORIGINS', '*')
REDIS_HOST: str = os.environ.get("DUO_REDIS_HOST", "redis")
REDIS_PORT: int = int(os.environ.get("DUO_REDIS_PORT", 6379))

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1)
app.config['MAX_CONTENT_LENGTH'] = constants.MAX_CONTENT_LENGTH;

default_limits = "60 per minute; 12 per second"

limiter = Limiter(
    _get_remote_address,
    app=app,
    default_limits=[default_limits],
    storage_uri=f"redis://{REDIS_HOST}:{REDIS_PORT}",
    strategy="fixed-window",
    default_limits_exempt_when=_is_private_ip,
)

shared_otp_limit = limiter.shared_limit(
    "3 per minute",
    scope="otp",
    exempt_when=_is_private_ip,
)

def limiter_account():
    return getattr(g, 'normalized_email', _get_remote_address())


CORS(app, origins=CORS_ORIGINS.split(','))

Q_GET_SESSION = """
SELECT
    duo_session.person_id,
    person.uuid::TEXT AS person_uuid,
    duo_session.email,
    duo_session.signed_in,
    duo_session.pending_club_name
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

def account_limiter(func, limit=None):
    _account_limiter = limiter.limit(
        limit or default_limits,
        scope="account",
        key_func=limiter_account,
        exempt_when=disable_account_rate_limit,
    )

    def go1(*args, **kwargs):
        return _account_limiter(func)(*args, **kwargs)

    go1.__name__ = func.__name__

    return go1


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
            except ValidationError as e:
                json_err = e.json(
                    include_url=False,
                    include_context=False,
                    include_input=False
                )

                return json_err, 400
            except Exception as e:
                print(traceback.format_exc())
                return str(e), 500
            return func(req, *args, **kwargs)
        go1.__name__ = func.__name__
        return go1
    return go2

def require_auth(expected_onboarding_status, expected_sign_in_status):
    def go2(func):
        rate_limited_func = account_limiter(func)

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
                email=row['email']
                person_id=row['person_id']
                person_uuid=row['person_uuid']
                signed_in=row['signed_in']
                pending_club_name=row['pending_club_name']

                session_info = duotypes.SessionInfo(
                    email=email,
                    person_id=person_id,
                    person_uuid=person_uuid,
                    signed_in=signed_in,
                    session_token_hash=session_token_hash,
                    pending_club_name=pending_club_name,
                )

                g.normalized_email = normalize_email(email)
            else:
                return 'Invalid session token', 401

            is_onboarded = session_info.person_id is not None
            is_signed_in = session_info.signed_in

            has_expected_onboarding_status = (
                expected_onboarding_status is None or
                expected_onboarding_status is not None and
                expected_onboarding_status == is_onboarded)

            has_expected_sign_in_status = (
                expected_sign_in_status is None or
                expected_sign_in_status is not None and
                expected_sign_in_status == is_signed_in)

            if has_expected_onboarding_status and has_expected_sign_in_status:
                result = rate_limited_func(session_info, *args, **kwargs)
                return result if result is not None else ''
            else:
                return 'Unauthorized', 401

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
