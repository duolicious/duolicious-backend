from collections.abc import Callable
from dataclasses import is_dataclass, asdict
from datetime import date, datetime, timezone
from decimal import Decimal
from email.utils import format_datetime
from typing import Protocol
from urllib.parse import parse_qsl
from uuid import UUID
from database import api_tx
from duohash import sha512
import constants
import duotypes
import os
from pathlib import Path
import ipaddress
import json
import re
import time
import traceback

from fastapi import FastAPI
from starlette.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Route
from starlette.types import ASGIApp, Receive, Scope, Send
from pydantic import ValidationError

from limits import parse_many
from limits.storage import storage_from_string
from limits.strategies import FixedWindowRateLimiter

from webcompat import (
    RequestData,
    g,
    request,
    reset_context,
    set_context,
)
from antiabuse.antispam.signupemail import normalize_email
from functools import lru_cache
import sessioncache

Endpoint = Callable
EndpointDecorator = Callable[[Endpoint], Endpoint]
LimiterDecorator = EndpointDecorator

class RouteDecorator(Protocol):
    def __call__(
        self,
        rule: str,
        limiter: LimiterDecorator | None = None,
        **kwargs: object,
    ) -> EndpointDecorator:
        ...


class AuthRouteDecorator(Protocol):
    def __call__(
        self,
        rule: str,
        limiter: LimiterDecorator | None = None,
        expected_onboarding_status: bool | None = True,
        expected_sign_in_status: bool | None = True,
        auth: str = 'required',
        **kwargs: object,
    ) -> EndpointDecorator:
        ...


def _endpoint_name(func: object) -> str:
    name = getattr(func, '__name__', None)
    return name if isinstance(name, str) else 'endpoint'


def _identity_endpoint(func: Endpoint) -> Endpoint:
    return func


def _set_endpoint_name(func: Endpoint, name: str) -> Endpoint:
    setattr(func, '__name__', name)
    return func

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
def _enable_mocking(ttl_hash: int | None = None) -> bool:
    if enable_mocking_file.is_file():
        with enable_mocking_file.open() as file:
            if file.read().strip() == '1':
                return True
    return False

def enable_mocking() -> bool:
    return _enable_mocking(ttl_hash=round(time.time()))

def disable_ip_rate_limit() -> bool:
    if not enable_mocking():
        return False

    if not disable_ip_rate_limit_file.is_file():
        return False

    with disable_ip_rate_limit_file.open() as file:
        if file.read().strip() == '1':
            return True

    return False

def disable_account_rate_limit() -> bool:
    if not enable_mocking():
        return False

    if not disable_account_rate_limit_file.is_file():
        return False

    with disable_account_rate_limit_file.open() as file:
        if file.read().strip() == '1':
            return True

    return False

def mock_ip_address() -> str | None:
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


# ---------------------------------------------------------------------------
# Rate limiting
#
# flask_limiter has no FastAPI equivalent, so we reimplement the slice of its
# API the app uses directly on top of the `limits` library it wrapped: a
# fixed-window strategy over a Redis store. A `_Limit` is usable both as a
# decorator (`limiter.limit(...)(func)`) and as a context manager
# (`with limiter.limit(...):`), exactly like flask_limiter's `Limit`.
# ---------------------------------------------------------------------------

class RateLimitExceeded(Exception):
    pass


class _Limit:
    def __init__(
        self,
        limiter: 'Limiter',
        limit_value: str | Callable[[], str],
        scope: str | Callable[[], str] | None,
        key_func: Callable[[], str] | None,
        exempt_when: Callable[[], bool] | None,
    ) -> None:
        self._limiter = limiter
        self._limit_value = limit_value
        self._scope = scope
        self._key_func = key_func
        self._exempt_when = exempt_when

    def _check(self) -> None:
        if self._exempt_when is not None and self._exempt_when():
            return

        value = (
            self._limit_value()
            if callable(self._limit_value)
            else self._limit_value)
        scope = self._scope() if callable(self._scope) else self._scope
        key = self._key_func() if self._key_func else _get_remote_address()

        for item in parse_many(value):
            if not self._limiter._strategy.hit(item, scope or '', key):
                raise RateLimitExceeded()

    # Context-manager form: `with limiter.limit(...):`
    def __enter__(self) -> '_Limit':
        self._check()
        return self

    def __exit__(self, *exc: object) -> None:
        # Never suppress exceptions raised in the `with` body. (Returning a
        # plain `bool` would let mypy treat the block as exception-swallowing,
        # which then reports the enclosing handler as missing a return.)
        return None

    # Decorator form: `limiter.limit(...)(func)`
    def __call__(self, func: Endpoint) -> Endpoint:
        def go(*args: object, **kwargs: object) -> object:
            self._check()
            return func(*args, **kwargs)
        return _set_endpoint_name(go, _endpoint_name(func))


class _Exempt:
    """Sentinel limiter passed as `limiter=limiter.exempt` to opt a route out
    of the default per-endpoint limits (the `/health` check uses this). It is
    a no-op decorator so it satisfies the `LimiterDecorator` type; routes also
    test for it by identity to skip the default-limit check."""

    def __call__(self, func: Endpoint) -> Endpoint:
        return func


_EXEMPT = _Exempt()


class Limiter:
    exempt = _EXEMPT

    def __init__(
        self,
        key_func: Callable[[], str],
        default_limits: list[str],
        storage_uri: str,
        default_limits_exempt_when: Callable[[], bool],
    ) -> None:
        self._default_key_func = key_func
        self._default_limits = default_limits
        self._default_exempt_when = default_limits_exempt_when
        self._strategy = FixedWindowRateLimiter(storage_from_string(storage_uri))

    def limit(
        self,
        limit_value: str | Callable[[], str],
        scope: str | Callable[[], str] | None = None,
        key_func: Callable[[], str] | None = None,
        exempt_when: Callable[[], bool] | None = None,
    ) -> _Limit:
        return _Limit(self, limit_value, scope, key_func, exempt_when)

    def shared_limit(
        self,
        limit_value: str | Callable[[], str],
        scope: str | Callable[[], str],
        exempt_when: Callable[[], bool] | None = None,
    ) -> _Limit:
        return _Limit(self, limit_value, scope, None, exempt_when)

    def check_default(self, endpoint_name: str) -> None:
        """Apply the global per-endpoint default limits, keyed on the remote
        address (flask_limiter applies these to every non-exempt view)."""
        if self._default_exempt_when is not None and self._default_exempt_when():
            return

        key = self._default_key_func()
        for value in self._default_limits:
            for item in parse_many(value):
                if not self._strategy.hit(item, endpoint_name, key):
                    raise RateLimitExceeded()


default_limits = "60 per minute; 12 per second"

# Per-IP cap shared by every unauthenticated auth endpoint
# (/request-otp, /check-otp, /sign-in-with-*, /auth/apple/callback).
# Each endpoint scopes the bucket separately so they don't double-bill
# against the same allowance — change this string to retune them all
# at once.
auth_rate_limit = "40 per day"

limiter = Limiter(
    _get_remote_address,
    default_limits=[default_limits],
    storage_uri=f"redis://{REDIS_HOST}:{REDIS_PORT}",
    default_limits_exempt_when=_is_private_ip,
)

shared_otp_limit = limiter.shared_limit(
    "3 per minute",
    scope="otp",
    exempt_when=_is_private_ip,
)

def limiter_account() -> str:
    email = getattr(g, 'normalized_email', None)
    return email if isinstance(email, str) else _get_remote_address()


# ---------------------------------------------------------------------------
# ASGI app + middleware
# ---------------------------------------------------------------------------

app = FastAPI()

# Flask used `strict_slashes=False` so "/x" and "/x/" both resolve without a
# redirect. Starlette would 307-redirect by default; we disable that and
# register an explicit trailing-slash alias per route instead (see _register).
app.router.redirect_slashes = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS.split(','),
    allow_methods=['*'],
    allow_headers=['*'],
)


class MaxBodySizeMiddleware:
    """Enforce Flask's old `MAX_CONTENT_LENGTH` via the Content-Length header."""

    def __init__(self, app: ASGIApp, max_size: int) -> None:
        self.app = app
        self.max_size = max_size

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope['type'] == 'http':
            for name, value in scope.get('headers', []):
                if name == b'content-length':
                    try:
                        too_large = int(value) > self.max_size
                    except ValueError:
                        too_large = False
                    if too_large:
                        response = Response(
                            'Request entity too large', status_code=413)
                        await response(scope, receive, send)
                        return
        await self.app(scope, receive, send)


app.add_middleware(MaxBodySizeMiddleware, max_size=constants.MAX_CONTENT_LENGTH)


# ---------------------------------------------------------------------------
# Response normalisation
#
# Handlers return Flask-style values: dict/list (-> JSON), str (-> text/html),
# None (-> empty body), `(body, status)` tuples, or a Starlette `Response`
# (e.g. from send_file/redirect). We serialise JSON the way Flask's default
# provider did (Decimal/UUID -> str, dates -> HTTP-date, sorted keys, trailing
# newline) to keep responses byte-comparable for clients.
#
# JSON is pretty-printed (indent=2, the same shape as `jq`'s output, which the
# functionality test suite compares against). This is identical in dev and
# prod.
# ---------------------------------------------------------------------------

def _flask_json_default(o: object) -> object:
    if isinstance(o, datetime):
        if o.tzinfo is None:
            o = o.replace(tzinfo=timezone.utc)
        return format_datetime(o, usegmt=True)
    if isinstance(o, date):
        return format_datetime(
            datetime(o.year, o.month, o.day, tzinfo=timezone.utc), usegmt=True)
    if isinstance(o, (Decimal, UUID)):
        return str(o)
    if is_dataclass(o) and not isinstance(o, type):
        return asdict(o)
    if hasattr(o, '__html__'):
        return str(o.__html__())
    raise TypeError(
        f'Object of type {type(o).__name__} is not JSON serializable')


def _json_dumps(obj: object) -> str:
    body = json.dumps(
        obj,
        default=_flask_json_default,
        sort_keys=True,
        ensure_ascii=True,
        indent=2,
    )
    return body + '\n'


_HTML_MIME = 'text/html; charset=utf-8'


def _make_response(result: object) -> Response:
    status = 200

    if isinstance(result, tuple) and len(result) == 2:
        body, code = result
        result = body
        if isinstance(code, int):
            status = code

    if isinstance(result, Response):
        return result

    if result is None or isinstance(result, str):
        return Response(
            content=result or '', status_code=status, media_type=_HTML_MIME)

    if isinstance(result, bytes):
        return Response(
            content=result,
            status_code=status,
            media_type='application/octet-stream')

    return Response(
        content=_json_dumps(result),
        status_code=status,
        media_type='application/json',
    )


Q_GET_SESSION = """
SELECT
    duo_session.person_id,
    person.uuid::TEXT AS person_uuid,
    duo_session.email,
    duo_session.signed_in,
    duo_session.pending_club_name,
    EXTRACT(EPOCH FROM duo_session.session_expiry)::double precision
        AS session_expiry_epoch
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

def account_limiter(
    func: Endpoint,
    limit: str | Callable[[], str] | None = None,
) -> Endpoint:
    _account_limiter = limiter.limit(
        limit or default_limits,
        scope="account",
        key_func=limiter_account,
        exempt_when=disable_account_rate_limit,
    )
    limited_func = _account_limiter(func)

    def go1(*args: object, **kwargs: object) -> object:
        return limited_func(*args, **kwargs)

    return _set_endpoint_name(go1, _endpoint_name(func))


def return_empty_string(func: Endpoint) -> Endpoint:
    def go(*args: object, **kwargs: object) -> object:
        result = func(*args, **kwargs)
        return result if result is not None else ''
    return _set_endpoint_name(go, _endpoint_name(func))

def validate(RequestType: Callable | None) -> EndpointDecorator:
    def go2(func: Endpoint) -> Endpoint:
        def go1(*args: object, **kwargs: object) -> object:
            if RequestType is None:
                return func(*args, **kwargs)
            try:
                j = request.get_json(silent=True)
                files = request.files

                j = j if j else {}
                files_payload = { 'files': files } if files else {}

                if isinstance(j, list):
                    req = RequestType(*j, **files_payload)
                elif isinstance(j, dict):
                    req = RequestType(**{**j, **files_payload})
                else:
                    req = RequestType(j, **files_payload)
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
        return _set_endpoint_name(go1, _endpoint_name(func))
    return go2

def require_auth(
    expected_onboarding_status: bool | None,
    expected_sign_in_status: bool | None,
    auth: str = 'required',
) -> EndpointDecorator:
    """
    Resolve the request's bearer token to a `SessionInfo` and forward it to
    `func`. With the default `auth='required'`, missing/invalid auth produces
    a 4xx response and `func` is never called. With `auth='optional'`, those
    same cases instead invoke `func(None, *args, **kwargs)` so that handlers
    can serve a degraded response to anonymous callers without ever touching
    the bearer header themselves - the bulk of the auth logic still lives
    here in the decorator.

    Handlers that opt in MUST type their first parameter as
    `Optional[SessionInfo]` so the type checker forces every read of `s` to
    handle the missing case.
    """
    if auth not in ('required', 'optional'):
        raise ValueError(f'auth must be "required" or "optional", got {auth!r}')

    def go2(func: Endpoint) -> Endpoint:
        rate_limited_func = account_limiter(func)

        def call_anonymous(*args: object, **kwargs: object) -> object:
            result = rate_limited_func(None, *args, **kwargs)
            return result if result is not None else ''

        def go1(*args: object, **kwargs: object) -> object:
            auth_header = (request.headers.get('Authorization') or '').lower()
            try:
                bearer, session_token = auth_header.split()
                if bearer != 'bearer':
                    raise Exception()
            except:
                if auth == 'optional':
                    return call_anonymous(*args, **kwargs)
                return 'Missing or malformed authorization header', 400

            session_token_hash = sha512(session_token)

            session_info = sessioncache.get_session(session_token_hash)

            row = None
            if session_info is None:
                params = dict(session_token_hash=session_token_hash)
                with api_tx('READ COMMITTED') as tx:
                    row = tx.execute(Q_GET_SESSION, params).fetchone()

            if row:
                session_info = duotypes.SessionInfo(
                    email=row['email'],
                    person_id=row['person_id'],
                    person_uuid=row['person_uuid'],
                    signed_in=row['signed_in'],
                    session_token_hash=session_token_hash,
                    pending_club_name=row['pending_club_name'],
                )
                sessioncache.put_session(
                    session_info,
                    session_expiry_epoch=row['session_expiry_epoch'],
                )

            if session_info is not None:
                g.normalized_email = normalize_email(session_info.email)
            else:
                if auth == 'optional':
                    return call_anonymous(*args, **kwargs)
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
                # A token that fails the onboarding/sign-in expectations is
                # treated as no-auth for `auth='optional'` rather than a 401.
                # Otherwise a half-onboarded user couldn't see public
                # endpoints they're entitled to, which would be surprising.
                if auth == 'optional':
                    return call_anonymous(*args, **kwargs)
                return 'Unauthorized', 401

        return _set_endpoint_name(go1, _endpoint_name(func))
    return go2


# ---------------------------------------------------------------------------
# Route registration
# ---------------------------------------------------------------------------

# Translate a Flask URL rule (e.g. "/unskip/<int:id>", "/club/<clubname:name>")
# into a Starlette path ("/unskip/{id:int}", "/club/{name:path}").
_RULE_PARAM_RE = re.compile(
    r'<(?:(?P<conv>[a-zA-Z_]+)(?:\([^)]*\))?:)?(?P<name>[a-zA-Z_][a-zA-Z0-9_]*)>')


def _rule_param_repl(m: 're.Match[str]') -> str:
    conv = m.group('conv')
    name = m.group('name')
    if conv == 'int':
        return '{%s:int}' % name
    if conv == 'clubname':
        # Club names may contain (and begin with) slashes once percent-decoded,
        # so they need Starlette's greedy `path` converter.
        return '{%s:path}' % name
    return '{%s}' % name


def _flask_rule_to_starlette(rule: str) -> str:
    return _RULE_PARAM_RE.sub(_rule_param_repl, rule)


def _register(
    method: str,
    rule: str,
    wrapped: Endpoint,
    skip_default: bool,
) -> None:
    path = _flask_rule_to_starlette(rule)
    endpoint_name = _endpoint_name(wrapped)

    def _dispatch_sync(data: RequestData) -> Response:
        tokens = set_context(data)
        try:
            try:
                if not skip_default:
                    limiter.check_default(endpoint_name)
                result = wrapped(**data.path_params)
            except RateLimitExceeded:
                return _make_response(('Too Many Requests', 429))
            return _make_response(result)
        finally:
            reset_context(tokens)

    async def asgi_endpoint(req: Request) -> Response:
        raw_body = await req.body()

        form = None
        content_type = req.headers.get('content-type', '')
        if 'application/x-www-form-urlencoded' in content_type:
            form = dict(parse_qsl(
                raw_body.decode('utf-8', 'ignore'), keep_blank_values=True))

        data = RequestData(
            method=req.method,
            query_params=req.query_params,
            headers=req.headers,
            client_host=req.client.host if req.client else None,
            raw_body=raw_body,
            form=form,
            path_params=dict(req.path_params),
        )

        return await run_in_threadpool(_dispatch_sync, data)

    app.router.routes.append(
        Route(path, asgi_endpoint, methods=[method]))

    # Emulate Flask's `strict_slashes=False`: also answer the trailing-slash
    # variant directly (no redirect). The `path` converter is already greedy,
    # so it needs no alias.
    if ':path}' not in path and not path.endswith('/'):
        app.router.routes.append(
            Route(path + '/', asgi_endpoint, methods=[method]))


def make_decorator(method: str) -> RouteDecorator:
    def go2(
            rule: str,
            limiter: LimiterDecorator | None = None,
            **kwargs: object
    ) -> EndpointDecorator:
        skip_default = limiter is Limiter.exempt
        maybe_limiter = (
            _identity_endpoint
            if (limiter is None or skip_default)
            else limiter)

        def go1(func: Endpoint) -> Endpoint:
            wrapped = maybe_limiter(return_empty_string(func))
            _register(method, rule, wrapped, skip_default)
            return func
        return go1
    return go2

def make_auth_decorator(method: str) -> AuthRouteDecorator:
    def go2(
            rule: str,
            limiter: LimiterDecorator | None = None,
            expected_onboarding_status: bool | None = True,
            expected_sign_in_status: bool | None = True,
            auth: str = 'required',
            **kwargs: object
    ) -> EndpointDecorator:
        skip_default = limiter is Limiter.exempt
        maybe_limiter = (
            _identity_endpoint
            if (limiter is None or skip_default)
            else limiter)

        def go1(func: Endpoint) -> Endpoint:
            wrapped = maybe_limiter(
                require_auth(
                    expected_onboarding_status,
                    expected_sign_in_status,
                    auth=auth,
                )(
                    return_empty_string(func)
                )
            )
            _register(method, rule, wrapped, skip_default)
            return func
        return go1
    return go2

delete = make_decorator('DELETE')
get = make_decorator('GET')
patch = make_decorator('PATCH')
post = make_decorator('POST')
put = make_decorator('PUT')

adelete = make_auth_decorator('DELETE')
aget = make_auth_decorator('GET')
apatch = make_auth_decorator('PATCH')
apost = make_auth_decorator('POST')
aput = make_auth_decorator('PUT')
