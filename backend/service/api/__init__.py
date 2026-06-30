from pathlib import Path
from typing import Optional
from starlette.requests import Request
import duotypes as t
import location
import person
import qanda
from qanda import question
import search
from auth import apple_oauth
from database import api_tx
import psycopg
from service.api.decorators import (
    app,
    adelete,
    aget,
    apatch,
    apost,
    aput,
    auth_rate_limit,
    client_ip,
    delete,
    get,
    patch,
    post,
    put,
    validate,
    limiter,
    shared_otp_limit,
    disable_ip_rate_limit,
    disable_account_rate_limit,
    limiter_account,
)
import time
from antiabuse.antispam.signupemail import normalize_email
import json

_init_sql_file = (
    Path(__file__).parent.parent.parent / 'init-api.sql')

_migrations_sql_file = (
    Path(__file__).parent.parent.parent / 'migrations.sql')

_email_domains_bad_file = (
    Path(__file__).parent.parent.parent / 'email-domains-bad.sql')

_email_domains_good_file = (
    Path(__file__).parent.parent.parent / 'email-domains-good.sql')

_banned_club_file = (
    Path(__file__).parent.parent.parent / 'banned-club.sql')

def get_ttl_hash(seconds: int = 10) -> int:
    """Return the same value withing `seconds` time period"""
    return round(time.time() / seconds)

def migrate_unnormalized_emails() -> None:
    """
    It'll probably be necessary to call this function again if/when
    `normalize_email` normalizes more address.
    """
    with api_tx() as tx:
        q = "SELECT 1 FROM person WHERE normalized_email ILIKE '%@googlemail.com' LIMIT 1"
        if tx.execute(q).fetchone():
            print('Unnormalized emails found. Normalizing...')
        else:
            print('Emails already normalized. Not performing normalization.')
            return

    with api_tx() as tx:
        print('Selecting emails')
        q = "SELECT email FROM person"
        tx.execute('SET LOCAL statement_timeout = 300000') # 5 minutes
        rows = tx.execute(q).fetchall()
        print('Done selecting emails')

    print('Computing normalized emails')
    params_seq = [
        row | dict(normalized_email=normalize_email(row['email']))
        for row in rows
    ]
    print('Done computing normalized emails')

    with api_tx('read committed') as tx:
        q = """
        UPDATE person SET
        normalized_email = %(normalized_email)s
        WHERE email = %(email)s
        """
        print('Updating normalized emails in `person` table')
        tx.execute('SET LOCAL statement_timeout = 300000') # 5 minutes
        tx.executemany(q, params_seq)
        print('Done updating normalized emails in `person` table')

        q = """
        UPDATE banned_person bp
        SET
            normalized_email = %(normalized_email)s
        WHERE
            normalized_email = %(email)s
        AND NOT EXISTS (
            SELECT
                1
            FROM
                banned_person
            WHERE
                normalized_email = %(normalized_email)s
            AND
                ip_address = bp.ip_address
        )
        """
        print('Updating normalized emails in `banned_person` table')
        tx.executemany(q, params_seq)
        print('Done updating normalized emails in `banned_person` table')

def maybe_run_init() -> None:
    with api_tx() as tx:
        row = tx.require_one("SELECT to_regclass('person')")

    if row ['to_regclass'] is not None:
        print('Database already initialized')
        return

    with open(_init_sql_file, 'r') as f:
        init_sql_file = f.read()

    with api_tx() as tx:
        tx.execute(init_sql_file)

def init_db() -> None:
    with open(_migrations_sql_file, 'r') as f:
        migrations_sql_file = f.read()

    with open(_email_domains_bad_file, 'r') as f:
        email_domains_bad_file = f.read()

    with open(_email_domains_good_file, 'r') as f:
        email_domains_good_file = f.read()

    with open(_banned_club_file, 'r') as f:
        banned_club_file = f.read()

    maybe_run_init()

    with api_tx() as tx:
        tx.execute('SET LOCAL statement_timeout = 300000') # 5 minutes
        tx.execute(migrations_sql_file)

    with api_tx() as tx:
        tx.execute(email_domains_bad_file)

    with api_tx() as tx:
        tx.execute(email_domains_good_file)

    with api_tx() as tx:
        tx.execute('SET LOCAL statement_timeout = 300000') # 5 minutes
        tx.execute(banned_club_file)

    migrate_unnormalized_emails()

@post('/request-otp', limiter=shared_otp_limit)
@validate(t.PostRequestOtp)
def post_request_otp(request: Request, req: t.PostRequestOtp) -> object:
    scope = "request_otp"

    limiter.check(
        request,
        auth_rate_limit,
        scope=scope,
        exempt_when=disable_ip_rate_limit)
    limiter.check(
        request,
        auth_rate_limit,
        scope=scope,
        key_func=limiter_account,
        exempt_when=disable_account_rate_limit)

    return person.post_request_otp(req, client_ip(request))

@apost(
    '/resend-otp',
    limiter=shared_otp_limit,
    expected_onboarding_status=None,
    expected_sign_in_status=False
)
def post_resend_otp(request: Request, s: t.SessionInfo) -> object:
    return person.post_resend_otp(s, client_ip(request))

@apost(
    '/check-otp',
    expected_onboarding_status=None,
    expected_sign_in_status=False
)
@validate(t.PostCheckOtp)
def post_check_otp(
    request: Request,
    req: t.PostCheckOtp,
    s: t.SessionInfo,
) -> object:
    scope = "check_otp"

    limiter.check(
        request,
        auth_rate_limit,
        scope=scope,
        exempt_when=disable_ip_rate_limit)
    limiter.check(
        request,
        auth_rate_limit,
        scope=scope,
        key_func=limiter_account,
        exempt_when=disable_account_rate_limit)

    return person.post_check_otp(req, s, client_ip(request))

@post('/sign-in-with-google')
@validate(t.PostSignInWithGoogle)
def post_sign_in_with_google(
    request: Request,
    req: t.PostSignInWithGoogle,
) -> object:
    scope = "social_sign_in"

    limiter.check(
        request,
        auth_rate_limit,
        scope=scope,
        exempt_when=disable_ip_rate_limit)

    return person.post_sign_in_with_google(
        token=req.id_token,
        pending_club_name=req.pending_club_name,
        remote_addr=client_ip(request),
    )

@post('/sign-in-with-apple')
@validate(t.PostSignInWithApple)
def post_sign_in_with_apple(
    request: Request,
    req: t.PostSignInWithApple,
) -> object:
    scope = "social_sign_in"

    limiter.check(
        request,
        auth_rate_limit,
        scope=scope,
        exempt_when=disable_ip_rate_limit)

    return person.post_sign_in_with_apple(
        token=req.identity_token,
        nonce=req.nonce,
        pending_club_name=req.pending_club_name,
        remote_addr=client_ip(request),
    )

# Apple Sign-In web/Android OAuth callback. Must be a `@post` (not
# `@apost`) — the request comes from Apple's authorize endpoint as an
# unauthenticated form_post, with no bearer token. See
# `auth/apple_oauth.py` for the rationale.
#
# This is on its own scope so it doesn't double-bill against
# `social_sign_in`: a single web/Android Apple sign-in hits this
# callback *and* /sign-in-with-apple, and we want the per-day budget
# to be "one sign-in = one slot" not "two slots".
@post('/auth/apple/callback')
def post_auth_apple_callback(request: Request) -> object:
    scope = "apple_oauth_callback"

    limiter.check(
        request,
        auth_rate_limit,
        scope=scope,
        exempt_when=disable_ip_rate_limit)

    return apple_oauth.handle_callback(
        id_token=request.state.form.get('id_token', ''),
        state=request.state.form.get('state', ''),
        error=request.state.form.get('error'),
    )

@apost('/sign-out', expected_onboarding_status=None)
def post_sign_out(request: Request, s: t.SessionInfo) -> object:
    person.post_sign_out(s)
    return None

@apost('/check-session-token', expected_onboarding_status=None)
def post_check_session_token(request: Request, s: t.SessionInfo) -> object:
    return person.post_check_session_token(s)

@aget(
    '/search-locations',
    expected_onboarding_status=None,
    expected_sign_in_status=None,
)
def get_search_locations(request: Request, _: object) -> object:
    return location.get_search_locations(q=request.query_params.get('q'))

@apatch('/onboardee-info', expected_onboarding_status=False)
@validate(t.PatchOnboardeeInfo)
def patch_onboardee_info(
    request: Request,
    req: t.PatchOnboardeeInfo,
    s: t.SessionInfo,
) -> object:
    return person.patch_onboardee_info(req, s)

@adelete('/onboardee-info', expected_onboarding_status=False)
@validate(t.DeleteOnboardeeInfo)
def delete_onboardee_info(
    request: Request,
    req: t.DeleteOnboardeeInfo,
    s: t.SessionInfo,
) -> object:
    person.delete_onboardee_info(req, s)
    return None

@apost('/finish-onboarding', expected_onboarding_status=False)
def post_finish_onboarding(request: Request, s: t.SessionInfo) -> object:
    return person.post_finish_onboarding(s)

@aget('/next-questions')
def get_next_questions(request: Request, s: t.SessionInfo) -> object:
    return question.get_next_questions(
        s=s,
        n=request.query_params.get('n', '10'),
        o=request.query_params.get('o', '0'),
    )

@get('/public-next-questions')
def get_public_next_questions(request: Request) -> object:
    return question.get_public_next_questions(
        n=request.query_params.get('n', '10'),
        o=request.query_params.get('o', '0'),
    )

@apost('/answer')
@validate(t.PostAnswer)
def post_answer(request: Request, req: t.PostAnswer, s: t.SessionInfo) -> object:
    return qanda.post_answer(req, s)

@adelete('/answer')
@validate(t.DeleteAnswer)
def delete_answer(
    request: Request,
    req: t.DeleteAnswer,
    s: t.SessionInfo,
) -> object:
    return qanda.delete_answer(req, s)

@aget('/search')
def get_search(request: Request, s: t.SessionInfo) -> object:
    n = request.query_params.get('n')
    o = request.query_params.get('o')

    rawClub = request.query_params.get('club')
    lowerClub = None if rawClub is None else rawClub.lower().strip()

    club = (
        search.ClubHttpArg(lowerClub if lowerClub != '\0' else None)
        if 'club' in request.query_params
        else None
    )

    search_type, _ = search.get_search_type(n, o)

    limit = "15 per 2 minutes"
    scope = json.dumps([search_type, lowerClub])

    if search_type == 'uncached-search':
        limiter.check(
            request,
            limit,
            scope=scope,
            exempt_when=disable_ip_rate_limit)
        limiter.check(
            request,
            limit,
            scope=scope,
            key_func=limiter_account,
            exempt_when=disable_account_rate_limit)

    return search.get_search(s=s, n=n, o=o, club=club)

@get('/public-search')
def get_public_search(request: Request) -> object:
    return search.get_public_search(
        n=request.query_params.get('n'),
        o=request.query_params.get('o'),
        answers=request.query_params.get('answers'),
    )

@get('/health', limiter=limiter.exempt)
def get_health(request: Request) -> object:
    return 'status: ok'

@aget('/me')
def get_me_by_session(request: Request, s: t.SessionInfo) -> object:
    return person.get_me(person_id_as_int=s.person_id)

@get('/me/<person_id>')
def get_me_by_id(request: Request, person_id: str) -> object:
    return person.get_me(person_id_as_str=person_id)

@aget('/prospect-profile/<prospect_handle>', auth='optional')
def get_prospect_profile(
    request: Request,
    s: Optional[t.SessionInfo],
    prospect_handle: str,
) -> object:
    return person.get_prospect_profile(s, prospect_handle)

@aget('/conversation-prospect/<prospect_uuid>')
def get_conversation_prospect(
    request: Request,
    s: t.SessionInfo,
    prospect_uuid: str,
) -> object:
    return person.get_conversation_prospect(s, prospect_uuid)

@apost('/skip/by-uuid/<prospect_uuid>')
@validate(t.PostSkip)
def post_skip_by_uuid(
    request: Request,
    req: t.PostSkip,
    s: t.SessionInfo,
    prospect_uuid: str,
) -> object:
    limit = "1 per 5 seconds; 20 per day"
    scope = "report"

    if req.report_reason:
        limiter.check(
            request,
            limit,
            scope=scope,
            exempt_when=disable_ip_rate_limit)
        limiter.check(
            request,
            limit,
            scope=scope,
            key_func=limiter_account,
            exempt_when=disable_account_rate_limit)

    return person.post_skip_by_uuid(req, s, prospect_uuid)

# TODO: Delete
@apost('/unskip/<int:prospect_person_id>')
def post_unskip(
    request: Request,
    s: t.SessionInfo,
    prospect_person_id: int,
) -> object:
    person.post_unskip(s, prospect_person_id)
    return None

@apost('/unskip/by-uuid/<prospect_uuid>')
def post_unskip_by_uuid(
    request: Request,
    s: t.SessionInfo,
    prospect_uuid: str,
) -> object:
    person.post_unskip_by_uuid(s, prospect_uuid)
    return None

@aget(
    '/compare-personalities'
    '/<int:prospect_person_id>'
    '/<any(mbti, big5, attachment, politics, other):topic>'
)
def get_compare_personalities(
    request: Request,
    s: t.SessionInfo,
    prospect_person_id: int,
    topic: str
) -> object:
    return person.get_compare_personalities(s, prospect_person_id, topic)

@aget('/compare-answers/<int:prospect_person_id>')
def get_compare_answers(
    request: Request,
    s: t.SessionInfo,
    prospect_person_id: int,
) -> object:
    return person.get_compare_answers(
        s,
        prospect_person_id,
        agreement=request.query_params.get('agreement'),
        topic=request.query_params.get('topic'),
        n=request.query_params.get('n', '10'),
        o=request.query_params.get('o', '0'),
    )

@apost('/inbox-info')
@validate(t.PostInboxInfo)
def post_inbox_info(
    request: Request,
    req: t.PostInboxInfo,
    s: t.SessionInfo,
) -> object:
    return person.post_inbox_info(req, s)

@adelete('/account')
def delete_account(request: Request, s: t.SessionInfo) -> object:
    return person.delete_or_ban_account(s=s)

@apost('/deactivate')
def post_deactivate(request: Request, s: t.SessionInfo) -> object:
    person.post_deactivate(s=s)
    return None

@aget('/profile-info')
def get_profile_info(request: Request, s: t.SessionInfo) -> object:
    return person.get_profile_info(s)

@adelete('/profile-info')
@validate(t.DeleteProfileInfo)
def delete_profile_info(
    request: Request,
    req: t.DeleteProfileInfo,
    s: t.SessionInfo,
) -> object:
    person.delete_profile_info(req, s)
    return None

@apatch('/profile-info')
@validate(t.PatchProfileInfo)
def patch_profile_info(
    request: Request,
    req: t.PatchProfileInfo,
    s: t.SessionInfo,
) -> object:
    return person.patch_profile_info(req, s)

@aget('/search-filters')
def get_search_filers(request: Request, s: t.SessionInfo) -> object:
    return person.get_search_filters(s)

@apost('/search-filter')
@validate(t.PostSearchFilter)
def post_search_filter(
    request: Request,
    req: t.PostSearchFilter,
    s: t.SessionInfo,
) -> object:
    return person.post_search_filter(req, s)

@aget('/search-filter-questions')
def get_search_filter_questions(request: Request, s: t.SessionInfo) -> object:
    return question.get_search_filter_questions(
        s=s,
        q=request.query_params.get('q', ''),
        n=request.query_params.get('n', '10'),
        o=request.query_params.get('o', '0'),
    )

@apost('/search-filter-answer')
@validate(t.PostSearchFilterAnswer)
def post_search_filter_answer(
    request: Request,
    req: t.PostSearchFilterAnswer,
    s: t.SessionInfo,
) -> object:
    return person.post_search_filter_answer(req, s)

@aget('/search-clubs')
def get_search_clubs(request: Request, s: t.SessionInfo) -> object:
    return person.get_search_clubs(s=s, search_str=request.query_params.get('q', ''))

@get('/search-public-clubs')
def get_search_public_clubs(request: Request) -> object:
    return person.get_search_clubs(
            s=None, search_str=request.query_params.get('q', ''), allow_empty=True)

@get('/club/<clubname:name>', merge_slashes=False)
def get_club(request: Request, name: str) -> object:
    result = person.get_club(
        name=name,
        ttl_hash=get_ttl_hash(seconds=300))
    if result is None:
        return '', 404
    return result

@apost('/join-club')
@validate(t.PostJoinClub)
def post_join_club(
    request: Request,
    req: t.PostJoinClub,
    s: t.SessionInfo,
) -> object:
    return person.post_join_club(req, s)

@apost('/leave-club')
@validate(t.PostLeaveClub)
def post_leave_club(
    request: Request,
    req: t.PostLeaveClub,
    s: t.SessionInfo,
) -> object:
    person.post_leave_club(req, s)
    return None

@get('/update-notifications')
def get_update_notifications(request: Request) -> object:
    return person.get_update_notifications(
        email=request.query_params.get('email', ''),
        type=request.query_params.get('type', ''),
        frequency=request.query_params.get('frequency', ''),
    )

@aget('/feed')
def get_feed(request: Request, s: t.SessionInfo) -> object:
    valid_datetime = t.ValidDatetime.model_validate(
        {'datetime': request.query_params.get('before')}
    )

    return search.get_feed(s=s, before=valid_datetime.datetime)

@apost('/verification-selfie')
@validate(t.PostVerificationSelfie)
def post_verification_selfie(
    request: Request,
    req: t.PostVerificationSelfie,
    s: t.SessionInfo,
) -> object:
    return person.post_verification_selfie(req, s)

@apost('/verify')
def post_verify(request: Request, s: t.SessionInfo) -> object:
    limit = "8 per day"
    scope = "verify"

    limiter.check(
        request,
        limit,
        scope=scope,
        exempt_when=disable_ip_rate_limit)
    limiter.check(
        request,
        limit,
        scope=scope,
        key_func=limiter_account,
        exempt_when=disable_account_rate_limit)

    person.post_verify(s)
    return None

@aget('/check-verification')
def get_check_verification(request: Request, s: t.SessionInfo) -> object:
    return person.get_check_verification(s=s)

@apost('/dismiss-donation')
def post_dismiss_donation(request: Request, s: t.SessionInfo) -> object:
    person.post_dismiss_donation(s=s)
    return None

@get('/stats')
def get_stats(request: Request) -> object:
    return person.get_stats(
        ttl_hash=get_ttl_hash(seconds=60),
        club_name=request.query_params.get('club-name'))

@get('/gender-stats')
def get_gender_stats(request: Request) -> object:
    return person.get_gender_stats(ttl_hash=get_ttl_hash(seconds=60))

@get('/admin/ban-link/<token>')
def get_admin_ban_link(request: Request, token: str) -> object:
    return person.get_admin_ban_link(token)

@get('/admin/ban/<token>')
def get_admin_ban(request: Request, token: str) -> object:
    return person.get_admin_ban(token)

@get('/admin/delete-photo-link/<token>')
def get_admin_delete_photo_link(request: Request, token: str) -> object:
    return person.get_admin_delete_photo_link(token)

@get('/admin/delete-photo/<token>')
def get_admin_delete_photo(request: Request, token: str) -> object:
    return person.get_admin_delete_photo(token)

@aget('/export-data-token')
def get_export_data_token(request: Request, s: t.SessionInfo) -> object:
    limit = "3 per day"
    scope = "export_data_token"

    limiter.check(
        request,
        limit,
        scope=scope,
        exempt_when=disable_ip_rate_limit)
    limiter.check(
        request,
        limit,
        scope=scope,
        key_func=limiter_account,
        exempt_when=disable_account_rate_limit)

    return person.get_export_data_token(s=s)

@get('/export-data/<token>')
def get_export_data(request: Request, token: str) -> object:
    return person.get_export_data(token=token)

@post('/revenuecat')
@validate(t.PostRevenuecat)
def post_revenuecat(request: Request, req: t.PostRevenuecat) -> object:
    return person.post_revenuecat(
        req, request.headers.get('Authorization', ''))

# DEPRECATED: visitors are now delivered over the chat WebSocket -- a snapshot on
# connect (the `duo_query_visitors` stanza) plus live `duo_visitor` pushes from the
# profile-view write path. This endpoint is kept only so older clients, which still
# poll it, keep working. Remove once those clients age out.
@aget('/visitors')
def get_visitors(request: Request, s: t.SessionInfo) -> object:
    return person.get_visitors(s=s)

# DEPRECATED: superseded by the `duo_mark_visitors_checked` chat stanza. Kept for
# older clients that still POST here.
@apost('/mark-visitors-checked')
@validate(t.PostMarkVisitorsChecked)
def post_mark_visitors_checked(
    request: Request,
    req: t.PostMarkVisitorsChecked,
    s: t.SessionInfo,
) -> object:
    person.post_mark_visitors_checked(req=req, s=s)
    return None
