from pathlib import Path
from flask import request
import duotypes as t
from service import (
    location,
    person,
    question,
    search,
)
from database import api_tx
import psycopg
from service.api.decorators import (
    app,
    adelete,
    aget,
    apatch,
    apost,
    aput,
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

def get_ttl_hash(seconds=10):
    """Return the same value withing `seconds` time period"""
    return round(time.time() / seconds)

def migrate_unnormalized_emails():
    """
    It'll probably be necessary to call this function again if/when
    `normalize_email` normalizes more address.
    """
    with api_tx() as tx:
        q = "SELECT 1 FROM person WHERE normalized_email = '' LIMIT 1"
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

    with api_tx() as tx:
        q = """
        UPDATE person SET
        normalized_email = %(normalized_email)s
        WHERE email = %(email)s
        """
        print('Updating normalized emails in `person` table')
        tx.execute('SET LOCAL statement_timeout = 300000') # 5 minutes
        tx.executemany(q, params_seq)
        print('Done updating normalized emails in `person` table')

    with api_tx() as tx:
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
        tx.execute('SET LOCAL statement_timeout = 300000') # 5 minutes
        tx.executemany(q, params_seq)
        print('Done updating normalized emails in `banned_person` table')

def maybe_run_init():
    with api_tx() as tx:
        row = tx.execute("SELECT to_regclass('person')").fetchone()

    if row ['to_regclass'] is not None:
        print('Database already initialized')
        return

    with open(_init_sql_file, 'r') as f:
        init_sql_file = f.read()

    with api_tx() as tx:
        tx.execute(init_sql_file)

def init_db():
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
def post_request_otp(req: t.PostRequestOtp):
    return person.post_request_otp(req)

@apost(
    '/resend-otp',
    limiter=shared_otp_limit,
    expected_onboarding_status=None,
    expected_sign_in_status=False
)
def post_resend_otp(s: t.SessionInfo):
    return person.post_resend_otp(s)

@apost(
    '/check-otp',
    expected_onboarding_status=None,
    expected_sign_in_status=False
)
@validate(t.PostCheckOtp)
def post_check_otp(req: t.PostCheckOtp, s: t.SessionInfo):
    limit = "50 per day"
    scope = "check_otp"

    with (
        limiter.limit(
            limit,
            scope=scope,
            exempt_when=disable_ip_rate_limit),
        limiter.limit(
            limit,
            scope=scope,
            key_func=limiter_account,
            exempt_when=disable_account_rate_limit)
    ):
        return person.post_check_otp(req, s)

@apost('/sign-out', expected_onboarding_status=None)
def post_sign_out(s: t.SessionInfo):
    return person.post_sign_out(s)

@apost('/check-session-token', expected_onboarding_status=None)
def post_check_session_token(s: t.SessionInfo):
    return person.post_check_session_token(s)

@aget(
    '/search-locations',
    expected_onboarding_status=None,
    expected_sign_in_status=None,
)
def get_search_locations(_):
    return location.get_search_locations(q=request.args.get('q'))

@apatch('/onboardee-info', expected_onboarding_status=False)
@validate(t.PatchOnboardeeInfo)
def patch_onboardee_info(req: t.PatchOnboardeeInfo, s: t.SessionInfo):
    return person.patch_onboardee_info(req, s)

@adelete('/onboardee-info', expected_onboarding_status=False)
@validate(t.DeleteOnboardeeInfo)
def delete_onboardee_info(req: t.DeleteOnboardeeInfo, s: t.SessionInfo):
    return person.delete_onboardee_info(req, s)

@apost('/finish-onboarding', expected_onboarding_status=False)
def post_finish_onboarding(s: t.SessionInfo):
    return person.post_finish_onboarding(s)

@aget('/next-questions')
def get_next_questions(s: t.SessionInfo):
    return question.get_next_questions(
        s=s,
        n=request.args.get('n', '10'),
        o=request.args.get('o', '0'),
    )

@apost('/answer')
@validate(t.PostAnswer)
def post_answer(req: t.PostAnswer, s: t.SessionInfo):
    return person.post_answer(req, s)

@adelete('/answer')
@validate(t.DeleteAnswer)
def delete_answer(req: t.DeleteAnswer, s: t.SessionInfo):
    return person.delete_answer(req, s)

@aget('/search')
def get_search(s: t.SessionInfo):
    n = request.args.get('n')
    o = request.args.get('o')

    rawClub = request.args.get('club')
    club = (
        search.ClubHttpArg(rawClub if rawClub != '\0' else None)
        if 'club' in request.args
        else None
    )

    search_type, _ = search.get_search_type(n, o)

    limit = "15 per 2 minutes"
    scope = json.dumps([search_type, rawClub])

    if search_type == 'uncached-search':
        with (
            limiter.limit(
                limit,
                scope=scope,
                exempt_when=disable_ip_rate_limit),
            limiter.limit(
                limit,
                scope=scope,
                key_func=limiter_account,
                exempt_when=disable_account_rate_limit)
        ):
            return search.get_search(s=s, n=n, o=o, club=club)
    else:
        return search.get_search(s=s, n=n, o=o, club=club)

@get('/health', limiter=limiter.exempt)
def get_health():
    return 'status: ok'

@aget('/me')
def get_me_by_session(s: t.SessionInfo):
    return person.get_me(person_id_as_int=s.person_id)

@get('/me/<person_id>')
def get_me_by_id(person_id: str):
    return person.get_me(person_id_as_str=person_id)

@aget('/prospect-profile/<prospect_uuid>')
def get_prospect_profile(s: t.SessionInfo, prospect_uuid: int):
    return person.get_prospect_profile(s, prospect_uuid)

@apost('/skip/by-uuid/<prospect_uuid>')
@validate(t.PostSkip)
def post_skip_by_uuid(req: t.PostSkip, s: t.SessionInfo, prospect_uuid: int):
    limit = "1 per 5 seconds; 30 per day"
    scope = "report"

    if req.report_reason:
        with (
            limiter.limit(
                limit,
                scope=scope,
                exempt_when=disable_ip_rate_limit),
            limiter.limit(
                limit,
                scope=scope,
                key_func=limiter_account,
                exempt_when=disable_account_rate_limit)
        ):
            return person.post_skip_by_uuid(req, s, prospect_uuid)
    else:
        return person.post_skip_by_uuid(req, s, prospect_uuid)

# TODO: Delete
@apost('/unskip/<int:prospect_person_id>')
def post_unskip(s: t.SessionInfo, prospect_person_id: int):
    return person.post_unskip(s, prospect_person_id)

@apost('/unskip/by-uuid/<prospect_uuid>')
def post_unskip_by_uuid(s: t.SessionInfo, prospect_uuid: str):
    return person.post_unskip_by_uuid(s, prospect_uuid)

@aget(
    '/compare-personalities'
    '/<int:prospect_person_id>'
    '/<any(mbti, big5, attachment, politics, other):topic>'
)
def get_compare_personalities(
    s: t.SessionInfo,
    prospect_person_id: int,
    topic: str
):
    return person.get_compare_personalities(s, prospect_person_id, topic)

@aget('/compare-answers/<int:prospect_person_id>')
def get_compare_answers(s: t.SessionInfo, prospect_person_id: int):
    return person.get_compare_answers(
        s,
        prospect_person_id,
        agreement=request.args.get('agreement'),
        topic=request.args.get('topic'),
        n=request.args.get('n', '10'),
        o=request.args.get('o', '0'),
    )

@apost('/inbox-info')
@validate(t.PostInboxInfo)
def post_inbox_info(req: t.PostInboxInfo, s: t.SessionInfo):
    return person.post_inbox_info(req, s)

@adelete('/account')
def delete_account(s: t.SessionInfo):
    return person.delete_or_ban_account(s=s)

@apost('/deactivate')
def post_deactivate(s: t.SessionInfo):
    return person.post_deactivate(s=s)

@aget('/profile-info')
def get_profile_info(s: t.SessionInfo):
    return person.get_profile_info(s)

@adelete('/profile-info')
@validate(t.DeleteProfileInfo)
def delete_profile_info(req: t.DeleteProfileInfo, s: t.SessionInfo):
    return person.delete_profile_info(req, s)

@apatch('/profile-info')
@validate(t.PatchProfileInfo)
def patch_profile_info(req: t.PatchProfileInfo, s: t.SessionInfo):
    return person.patch_profile_info(req, s)

@aget('/search-filters')
def get_search_filers(s: t.SessionInfo):
    return person.get_search_filters(s)

@apost('/search-filter')
@validate(t.PostSearchFilter)
def post_search_filter(req: t.PostSearchFilter, s: t.SessionInfo):
    return person.post_search_filter(req, s)

@aget('/search-filter-questions')
def get_search_filter_questions(s: t.SessionInfo):
    return question.get_search_filter_questions(
        s=s,
        q=request.args.get('q', ''),
        n=request.args.get('n', '10'),
        o=request.args.get('o', '0'),
    )

@apost('/search-filter-answer')
@validate(t.PostSearchFilterAnswer)
def post_search_filter_answer(req: t.PostSearchFilterAnswer, s: t.SessionInfo):
    return person.post_search_filter_answer(req, s)

@aget('/search-clubs')
def get_search_clubs(s: t.SessionInfo):
    return person.get_search_clubs(s=s, search_str=request.args.get('q', ''))

@get('/search-public-clubs')
def get_search_public_clubs():
    return person.get_search_clubs(
            s=None, search_str=request.args.get('q', ''), allow_empty=True)

@apost('/join-club')
@validate(t.PostJoinClub)
def post_join_club(req: t.PostJoinClub, s: t.SessionInfo):
    return person.post_join_club(req, s)

@apost('/leave-club')
@validate(t.PostLeaveClub)
def post_leave_club(req: t.PostLeaveClub, s: t.SessionInfo):
    return person.post_leave_club(req, s)

@get('/update-notifications')
def get_update_notifications():
    return person.get_update_notifications(
        email=request.args.get('email', ''),
        type=request.args.get('type', ''),
        frequency=request.args.get('frequency', ''),
    )

@apost('/verification-selfie')
@validate(t.PostVerificationSelfie)
def post_verification_selfie(req: t.PostVerificationSelfie, s: t.SessionInfo):
    return person.post_verification_selfie(req, s)

@apost('/verify')
def post_verify(s: t.SessionInfo):
    limit = "8 per day"
    scope = "verify"

    with (
        limiter.limit(
            limit,
            scope=scope,
            exempt_when=disable_ip_rate_limit),
        limiter.limit(
            limit,
            scope=scope,
            key_func=limiter_account,
            exempt_when=disable_account_rate_limit)
    ):
        return person.post_verify(s)

@aget('/check-verification')
def get_check_verification(s: t.SessionInfo):
    return person.get_check_verification(s=s)

@apost('/dismiss-donation')
def post_dismiss_donation(s: t.SessionInfo):
    return person.post_dismiss_donation(s=s)

@get('/stats')
def get_stats():
    return person.get_stats(
        ttl_hash=get_ttl_hash(seconds=60),
        club_name=request.args.get('club-name'))

@get('/gender-stats')
def get_gender_stats():
    return person.get_gender_stats(ttl_hash=get_ttl_hash(seconds=60))

@get('/admin/ban-link/<token>')
def get_admin_ban_link(token: str):
    return person.get_admin_ban_link(token)

@get('/admin/ban/<token>')
def get_admin_ban(token: str):
    return person.get_admin_ban(token)

@get('/admin/delete-photo-link/<token>')
def get_admin_delete_photo_link(token: str):
    return person.get_admin_delete_photo_link(token)

@get('/admin/delete-photo/<token>')
def get_admin_delete_photo(token: str):
    return person.get_admin_delete_photo(token)

@aget('/export-data-token')
def get_export_data_token(s: t.SessionInfo):
    limit = "3 per day"
    scope = "export_data_token"

    with (
        limiter.limit(
            limit,
            scope=scope,
            exempt_when=disable_ip_rate_limit),
        limiter.limit(
            limit,
            scope=scope,
            key_func=limiter_account,
            exempt_when=disable_account_rate_limit)
    ):
        return person.get_export_data_token(s=s)

@get('/export-data/<token>')
def get_export_data(token: str):
    return person.get_export_data(token=token)

@post('/kofi-donation')
def post_kofi_donation():
    try:
        data = request.form.get('data')
        j = json.loads(data)
        req = t.PostKofiData(**j)
    except:
        return '', 401
    return person.post_kofi_donation(req=req)
