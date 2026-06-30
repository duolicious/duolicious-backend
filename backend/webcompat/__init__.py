"""
Small Flask-compatibility shim used by the FastAPI-based API service.

The API service's request handlers (and a few helpers in `person` and
`auth`) were originally written against Flask's thread-local `request`/`g`
and its `send_file`/`redirect` helpers. Rather than rewrite every handler
when moving the service to FastAPI/Starlette, we expose the same names
here, backed by a `contextvars.ContextVar` that the ASGI dispatch layer in
`service.api.decorators` populates once per request.

Only the slice of Flask's surface the codebase actually relies on is
implemented:

  * request.args               -> query params (Starlette QueryParams)
  * request.headers            -> headers (case-insensitive)
  * request.remote_addr        -> client IP, honouring X-Forwarded-For with a
                                  single trusted hop (matching the old
                                  werkzeug ProxyFix(x_for=1))
  * request.get_json(silent=)  -> parsed JSON body
  * request.form               -> parsed urlencoded form (the Apple OAuth
                                  callback is the only user)
  * request.files              -> always empty: photos/audio are uploaded as
                                  base64 inside the JSON body, never multipart
  * send_file(...)             -> Starlette Response (attachment download)
  * redirect(...)              -> Starlette RedirectResponse
"""
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Optional
import io
import json

from starlette.datastructures import Headers, QueryParams
from starlette.responses import RedirectResponse, Response


@dataclass
class RequestData:
    """The per-request data the dispatch layer reads off the ASGI request
    before handing control to the (synchronous) Flask-style handlers."""
    method: str
    query_params: QueryParams
    headers: Headers
    client_host: Optional[str]
    raw_body: bytes = b""
    form: Optional[dict] = None
    path_params: dict = field(default_factory=dict)


_request_var: ContextVar[RequestData] = ContextVar("duo_request")
_g_var: ContextVar[dict] = ContextVar("duo_g")


class _Request:
    """A per-request view over `RequestData`, mimicking the parts of Flask's
    global `request` object the codebase uses."""

    @property
    def _data(self) -> RequestData:
        return _request_var.get()

    @property
    def args(self) -> QueryParams:
        return self._data.query_params

    @property
    def headers(self) -> Headers:
        return self._data.headers

    @property
    def remote_addr(self) -> Optional[str]:
        # Mirror werkzeug's ProxyFix(x_for=1): trust a single proxy hop and
        # take the right-most entry of X-Forwarded-For (the address our
        # nearest proxy observed). Fall back to the socket peer otherwise.
        xff = self._data.headers.get("x-forwarded-for")
        if xff:
            parts = [p.strip() for p in xff.split(",") if p.strip()]
            if parts:
                return parts[-1]
        return self._data.client_host

    @property
    def form(self) -> dict:
        return self._data.form or {}

    @property
    def files(self) -> dict:
        # The API receives images/audio as base64 inside the JSON body, so
        # there are never multipart file uploads to surface here.
        return {}

    def get_json(self, silent: bool = False) -> object:
        body = self._data.raw_body
        if not body:
            if silent:
                return None
            raise ValueError("Request body is empty")
        try:
            return json.loads(body)
        except Exception:
            if silent:
                return None
            raise


class _G:
    """Stand-in for Flask's request-global `g`, backed by a per-request dict."""

    def __getattr__(self, name: str) -> object:
        try:
            return _g_var.get()[name]
        except KeyError:
            raise AttributeError(name)

    def __setattr__(self, name: str, value: object) -> None:
        _g_var.get()[name] = value


request = _Request()
g = _G()


def set_context(data: RequestData) -> tuple:
    """Bind `request`/`g` for the current context. Returns reset tokens to be
    passed to `reset_context` once the request is done."""
    request_token = _request_var.set(data)
    g_token = _g_var.set({})
    return request_token, g_token


def reset_context(tokens: tuple) -> None:
    request_token, g_token = tokens
    _request_var.reset(request_token)
    _g_var.reset(g_token)


def send_file(
    file_obj: 'io.BytesIO | bytes',
    mimetype: Optional[str] = None,
    as_attachment: bool = False,
    download_name: Optional[str] = None,
) -> Response:
    """Minimal stand-in for `flask.send_file` for the in-memory buffers the
    API serves (e.g. the data export)."""
    content = file_obj.read() if isinstance(file_obj, io.BytesIO) else file_obj

    headers = {}
    if download_name:
        disposition = "attachment" if as_attachment else "inline"
        headers["Content-Disposition"] = f'{disposition}; filename="{download_name}"'

    return Response(content=content, media_type=mimetype, headers=headers)


def redirect(location: str, code: int = 302) -> RedirectResponse:
    """Minimal stand-in for `flask.redirect`."""
    return RedirectResponse(url=location, status_code=code)
