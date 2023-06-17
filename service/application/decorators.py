from database import transaction
from duohash import sha512
from flask import request, Flask
from flask_cors import CORS
import constants
import duotypes

app = Flask(__name__)

app.config['MAX_CONTENT_LENGTH'] = constants.MAX_CONTENT_LENGTH;

CORS(app)

Q_GET_SESSION = """
SELECT person_id, email, signed_in
FROM duo_session
WHERE
    session_token_hash = %(session_token_hash)s AND
    session_expiry > NOW()
"""

def return_empty_string(func):
    def go(*args, **kwargs):
        return func(*args, **kwargs) or ''
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
            except Exception as e:
                print(e)
                return f'Malformed request', 400
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
            with transaction() as tx:
                tx.execute(Q_GET_SESSION, params)
                row = tx.fetchone()

            if row:
                session_info = duotypes.SessionInfo(
                    email=row['email'],
                    person_id=row['person_id'],
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
                return func(session_info, *args, **kwargs) or ''
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
    def go2(*args, **kwargs):
        def go1(func):
            return flask_decorator(*args, **kwargs)(return_empty_string(func))
        return go1
    return go2

def make_auth_decorator(flask_decorator):
    def go2(
            *args,
            expected_onboarding_status=True,
            expected_sign_in_status=True,
            **kwargs
    ):
        def go1(func):
            return flask_decorator(*args, **kwargs)(
                require_auth(
                    expected_onboarding_status,
                    expected_sign_in_status
                )(return_empty_string(func)))
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
