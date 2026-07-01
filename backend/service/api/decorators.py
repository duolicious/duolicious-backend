from collections.abc import Awaitable, Callable
from dataclasses import is_dataclass, asdict
from datetime import date, datetime, timezone
from decimal import Decimal
from email.utils import format_datetime
from typing import ParamSpec, Protocol, cast
from urllib.parse import parse_qsl
from uuid import UUID
from database import api_tx
from database.asyncdatabase import api_tx as async_api_tx
from duohash import sha512
import constants
import duotypes
import inspect
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

from antiabuse.antispam.signupemail import normalize_email
from functools import lru_cache, wraps
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

# `request` is accepted (and ignored) so these match the uniform
# `exempt_when(request)` signature the rate limiter calls them with.
def disable_ip_rate_limit(request: Request | None = None) -> bool:
    if not enable_mocking():
        return False

    if not disable_ip_rate_limit_file.is_file():
        return False

    with disable_ip_rate_limit_file.open() as file:
        if file.read().strip() == '1':
            return True

    return False

def disable_account_rate_limit(request: Request | None = None) -> bool:
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

def client_ip(request: Request) -> str | None:
    """The requesting client's IP, honouring X-Forwarded-For with a single
    trusted hop (the right-most entry, matching the old werkzeug
    ProxyFix(x_for=1)), falling back to the socket peer. No mock override —
    this is the real address used for ban / firehol checks."""
    xff = request.headers.get('x-forwarded-for')
    if xff:
        parts = [p.strip() for p in xff.split(',') if p.strip()]
        if parts:
            return parts[-1]
    return request.client.host if request.client else None

def _is_private_ip(request: Request) -> bool:
    """
    Check if the requesting IP address is private.
    """
    if disable_ip_rate_limit():
        return True

    _remote_addr = mock_ip_address() or client_ip(request) or "127.0.0.1"

    try:
        return ipaddress.ip_address(_remote_addr).is_private
    except ValueError:
        return False

def _get_remote_address(request: Request) -> str:
    """
    :return: the ip address used for rate-limit keys for the current request
     (mock-aware, or 127.0.0.1 if none found)
    """
    return mock_ip_address() or client_ip(request) or "127.0.0.1"

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


LimitValue = str | Callable[[], str]
ScopeArg = str | Callable[[], str] | None
KeyFunc = Callable[[Request], str]
ExemptWhen = Callable[[Request], bool]


class _Limit:
    """Decorator form of a rate limit, used to attach a shared/account limit to
    a route (`limiter.shared_limit(...)` / `account_limiter`). The wrapped
    endpoint receives `request` as its first argument, which is what the limit
    is keyed on."""

    def __init__(
        self,
        limiter: 'Limiter',
        limit_value: LimitValue,
        scope: ScopeArg,
        key_func: KeyFunc | None,
        exempt_when: ExemptWhen | None,
    ) -> None:
        self._limiter = limiter
        self._limit_value = limit_value
        self._scope = scope
        self._key_func = key_func
        self._exempt_when = exempt_when

    def __call__(self, func: Endpoint) -> Endpoint:
        def go(request: Request, *args: object, **kwargs: object) -> object:
            self._limiter.check(
                request,
                self._limit_value,
                scope=self._scope,
                key_func=self._key_func,
                exempt_when=self._exempt_when,
            )
            return func(request, *args, **kwargs)
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
        key_func: KeyFunc,
        default_limits: list[str],
        storage_uri: str,
        default_limits_exempt_when: ExemptWhen,
    ) -> None:
        self._default_key_func = key_func
        self._default_limits = default_limits
        self._default_exempt_when = default_limits_exempt_when
        self._strategy = FixedWindowRateLimiter(storage_from_string(storage_uri))

    def _enforce(
        self,
        request: Request,
        limit_value: LimitValue,
        scope: ScopeArg,
        key_func: KeyFunc | None,
        exempt_when: ExemptWhen | None,
    ) -> None:
        if exempt_when is not None and exempt_when(request):
            return

        value = limit_value() if callable(limit_value) else limit_value
        scope_str = scope() if callable(scope) else scope
        key = key_func(request) if key_func else _get_remote_address(request)

        for item in parse_many(value):
            if not self._strategy.hit(item, scope_str or '', key):
                raise RateLimitExceeded()

    def limit(
        self,
        limit_value: LimitValue,
        scope: ScopeArg = None,
        key_func: KeyFunc | None = None,
        exempt_when: ExemptWhen | None = None,
    ) -> _Limit:
        return _Limit(self, limit_value, scope, key_func, exempt_when)

    def shared_limit(
        self,
        limit_value: LimitValue,
        scope: ScopeArg,
        exempt_when: ExemptWhen | None = None,
    ) -> _Limit:
        return _Limit(self, limit_value, scope, None, exempt_when)

    def check(
        self,
        request: Request,
        limit_value: LimitValue,
        scope: ScopeArg = None,
        key_func: KeyFunc | None = None,
        exempt_when: ExemptWhen | None = None,
    ) -> None:
        """Inline rate-limit check used from within a handler (replaces the old
        `with limiter.limit(...):` blocks). Raises `RateLimitExceeded`."""
        self._enforce(request, limit_value, scope, key_func, exempt_when)

    def check_default(self, request: Request, endpoint_name: str) -> None:
        """Apply the global per-endpoint default limits, keyed on the remote
        address (flask_limiter applies these to every non-exempt view)."""
        if self._default_exempt_when is not None and self._default_exempt_when(request):
            return

        key = self._default_key_func(request)
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

def limiter_account(request: Request) -> str:
    email = getattr(request.state, 'normalized_email', None)
    return email if isinstance(email, str) else _get_remote_address(request)


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
# (e.g. a RedirectResponse or a file download). We serialise JSON the way Flask's
# default provider did (Decimal/UUID -> str, dates -> HTTP-date, sorted keys,
# trailing newline) to keep responses byte-comparable for clients.
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
        def go1(request: Request, *args: object, **kwargs: object) -> object:
            if RequestType is None:
                return func(request, *args, **kwargs)
            try:
                j = request.state.json_body
                j = j if j else {}

                if isinstance(j, list):
                    req = RequestType(*j)
                elif isinstance(j, dict):
                    req = RequestType(**j)
                else:
                    req = RequestType(j)
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
            return func(request, req, *args, **kwargs)
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

        def call_anonymous(
            request: Request, *args: object, **kwargs: object
        ) -> object:
            result = rate_limited_func(request, None, *args, **kwargs)
            return result if result is not None else ''

        def go1(request: Request, *args: object, **kwargs: object) -> object:
            auth_header = (request.headers.get('Authorization') or '').lower()
            try:
                bearer, session_token = auth_header.split()
                if bearer != 'bearer':
                    raise Exception()
            except:
                if auth == 'optional':
                    return call_anonymous(request, *args, **kwargs)
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
                request.state.normalized_email = normalize_email(session_info.email)
            else:
                if auth == 'optional':
                    return call_anonymous(request, *args, **kwargs)
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
                result = rate_limited_func(request, session_info, *args, **kwargs)
                return result if result is not None else ''
            else:
                # A token that fails the onboarding/sign-in expectations is
                # treated as no-auth for `auth='optional'` rather than a 401.
                # Otherwise a half-onboarded user couldn't see public
                # endpoints they're entitled to, which would be surprising.
                if auth == 'optional':
                    return call_anonymous(request, *args, **kwargs)
                return 'Unauthorized', 401

        return _set_endpoint_name(go1, _endpoint_name(func))
    return go2


# ---------------------------------------------------------------------------
# FastAPI-native dispatch
#
# The building blocks for writing endpoints as idiomatic, `async def` FastAPI
# routes (see `GET /check-verification` in `service.api` for the reference
# example) instead of the manual `@get`/`@aget` chain above. Endpoints migrate
# to this style one at a time; the manual dispatch is retired once they all do.
#
#   @app.get('/thing')
#   @duo_route
#   async def get_thing(
#       _limited: None = Depends(default_rate_limit('get_thing')),
#       s: duotypes.SessionInfo = Depends(require_session()),
#   ) -> object:
#       async with async_api_tx() as tx:
#           ...
#       return result            # plain value, same convention as manual handlers
# ---------------------------------------------------------------------------

_P = ParamSpec('_P')


def duo_route(func: Callable[_P, object]) -> Callable[_P, Awaitable[Response]]:
    """Let a native handler keep the manual handlers' return convention: it
    returns a plain value (dict/list -> JSON, str -> text/html, `(body,
    status)`, None -> empty) and this adapter runs it through the same
    `_make_response`. Returning a `Response` also makes FastAPI skip its
    `jsonable_encoder`, so serialization stays byte-for-byte identical to the
    manual dispatch. `wraps` keeps the signature visible so FastAPI still
    resolves `Depends(...)`. Handles sync or async handlers."""
    @wraps(func)
    async def wrapper(*args: _P.args, **kwargs: _P.kwargs) -> Response:
        result = func(*args, **kwargs)
        if inspect.isawaitable(result):
            result = await cast(Awaitable[object], result)
        return _make_response(result)
    return wrapper


class AuthError(Exception):
    """Raised by `require_session` on missing/invalid auth. Rendered to the
    same plain-text bodies + status codes the manual chain returned (rather
    than FastAPI's default JSON `{"detail": ...}`)."""
    def __init__(self, message: str, status_code: int) -> None:
        self.message = message
        self.status_code = status_code


@app.exception_handler(AuthError)
async def _handle_auth_error(request: Request, exc: AuthError) -> Response:
    return _make_response((exc.message, exc.status_code))


@app.exception_handler(RateLimitExceeded)
async def _handle_rate_limit(request: Request, exc: RateLimitExceeded) -> Response:
    # Only native routes reach here — the manual dispatch catches
    # RateLimitExceeded itself and renders its own 429.
    return _make_response(('Too Many Requests', 429))


def require_session(
    expected_onboarding_status: bool | None = True,
    expected_sign_in_status: bool | None = True,
) -> Callable[[Request], Awaitable[duotypes.SessionInfo]]:
    """Native (async) equivalent of the `require_auth` decorator, as a
    dependency factory. Resolves the bearer token to a `SessionInfo` (async DB
    lookup, sync sessioncache offloaded to a thread) and enforces the expected
    onboarding/sign-in status, raising `AuthError` otherwise."""
    async def dependency(request: Request) -> duotypes.SessionInfo:
        auth_header = (request.headers.get('Authorization') or '').lower()
        try:
            bearer, session_token = auth_header.split()
            if bearer != 'bearer':
                raise ValueError
        except Exception:
            raise AuthError('Missing or malformed authorization header', 400)

        session_token_hash = sha512(session_token)

        # sessioncache is a fast *sync* Redis get/set; offload it so it doesn't
        # block the event loop. The session-row fallback uses the async DB.
        session_info = await run_in_threadpool(
            sessioncache.get_session, session_token_hash)

        if session_info is None:
            async with async_api_tx('READ COMMITTED') as tx:
                await tx.execute(
                    Q_GET_SESSION,
                    dict(session_token_hash=session_token_hash))
                row = await tx.fetchone()
            if row:
                session_info = duotypes.SessionInfo(
                    email=row['email'],
                    person_id=row['person_id'],
                    person_uuid=row['person_uuid'],
                    signed_in=row['signed_in'],
                    session_token_hash=session_token_hash,
                    pending_club_name=row['pending_club_name'],
                )
                await run_in_threadpool(
                    sessioncache.put_session,
                    session_info,
                    row['session_expiry_epoch'])

        if session_info is None:
            raise AuthError('Invalid session token', 401)

        is_onboarded = session_info.person_id is not None
        ok_onboarding = (
            expected_onboarding_status is None
            or expected_onboarding_status == is_onboarded)
        ok_sign_in = (
            expected_sign_in_status is None
            or expected_sign_in_status == session_info.signed_in)
        if not (ok_onboarding and ok_sign_in):
            raise AuthError('Unauthorized', 401)

        # Set for account-scoped rate limiting (see `limiter_account`), so an
        # account-keyed limit can compose as another dependency.
        request.state.normalized_email = normalize_email(session_info.email)
        return session_info

    return dependency


def default_rate_limit(
    endpoint_name: str,
) -> Callable[[Request], Awaitable[None]]:
    """The global per-endpoint default limit, as a dependency. Our limiter is
    sync (Redis-backed), so run its check off the event loop."""
    async def dependency(request: Request) -> None:
        await run_in_threadpool(limiter.check_default, request, endpoint_name)
    return dependency


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

    def _run_chain(request: Request) -> object:
        # Runs the synchronous decorator chain (default-limit check, auth,
        # validation, rate-limit, handler) in a threadpool worker.
        #
        # For a plain `def` handler this returns the handler's final value. For
        # an `async def` handler it returns the handler's *un-awaited* coroutine
        # -- calling an async function doesn't run its body -- which the caller
        # then awaits on the event loop. The upshot: the blocking auth/rate-limit
        # work always runs in the threadpool (off the loop), while an async
        # handler's own `await`s (async DB, S3, HTTP) run on the loop. Sync
        # handlers are unaffected.
        if not skip_default:
            limiter.check_default(request, endpoint_name)
        return wrapped(request, **request.path_params)

    async def asgi_endpoint(request: Request) -> Response:
        # Handlers may be synchronous (run in a threadpool) so the request body
        # (an async read) is consumed up-front and the parsed forms stashed on
        # `request.state` for the sync code to read.
        raw_body = await request.body()

        json_body: object = None
        if raw_body:
            try:
                json_body = json.loads(raw_body)
            except Exception:
                json_body = None

        form: dict = {}
        content_type = request.headers.get('content-type', '')
        if 'application/x-www-form-urlencoded' in content_type:
            form = dict(parse_qsl(
                raw_body.decode('utf-8', 'ignore'), keep_blank_values=True))

        request.state.json_body = json_body
        request.state.form = form

        try:
            result = await run_in_threadpool(_run_chain, request)
            # `async def` handlers return a coroutine from the (threadpooled)
            # chain; await it here so its body runs on the event loop.
            if inspect.isawaitable(result):
                result = await cast(Awaitable[object], result)
        except RateLimitExceeded:
            return _make_response(('Too Many Requests', 429))
        return _make_response(result)

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
