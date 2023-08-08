import os
from flask import request
import duotypes as t
from service import (
    location,
    person,
    question,
    search,
)
from database import transaction
import psycopg
from service.application.decorators import (
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
)

_init_sql_file = os.path.join(
        os.path.dirname(__file__), '..', '..',
        'init.sql')

def init_db():
    with open(_init_sql_file, 'r') as f:
        init_sql_file = f.read()

    with transaction() as tx:
        tx.execute(init_sql_file)

@post('/request-otp')
@validate(t.PostRequestOtp)
def post_request_otp(req: t.PostRequestOtp):
    return person.post_request_otp(req)

@apost('/resend-otp', expected_onboarding_status=None, expected_sign_in_status=False)
def post_resend_otp(s: t.SessionInfo):
    return person.post_resend_otp(s)

@apost('/check-otp', expected_onboarding_status=None, expected_sign_in_status=False)
@validate(t.PostCheckOtp)
def post_check_otp(req: t.PostCheckOtp, s: t.SessionInfo):
    return person.post_check_otp(req, s)

@apost('/sign-out', expected_onboarding_status=None)
def post_sign_out(s: t.SessionInfo):
    return person.post_sign_out(s)

@apost('/check-session-token', expected_onboarding_status=None)
def post_check_session_token(s: t.SessionInfo):
    return person.post_check_session_token(s)

@apost('/active')
def post_active(s: t.SessionInfo):
    return person.post_active(s)

@aget('/search-locations', expected_onboarding_status=None, expected_sign_in_status=None)
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
    return search.get_search(
        s=s,
        n=request.args.get('n'),
        o=request.args.get('o')
    )

@get('/health')
def get_health():
    return 'status: ok'

@aget('/me')
def get_me_by_session(s: t.SessionInfo):
    return person.get_me(s.person_id)

@get('/me/<int:person_id>')
def get_me_by_id(person_id: int):
    return person.get_me(person_id)

@aget('/prospect-profile/<int:prospect_person_id>')
def get_prospect_profile(s: t.SessionInfo, prospect_person_id: int):
    return person.get_prospect_profile(s, prospect_person_id)

@apost('/block/<int:prospect_person_id>')
def post_block(s: t.SessionInfo, prospect_person_id: int):
    return person.post_block(s, prospect_person_id)

@apost('/unblock/<int:prospect_person_id>')
def post_unblock(s: t.SessionInfo, prospect_person_id: int):
    return person.post_unblock(s, prospect_person_id)

@apost('/hide/<int:prospect_person_id>')
def post_hide(s: t.SessionInfo, prospect_person_id: int):
    return person.post_hide(s, prospect_person_id)

@apost('/unhide/<int:prospect_person_id>')
def post_unhide(s: t.SessionInfo, prospect_person_id: int):
    return person.post_unhide(s, prospect_person_id)

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

@aget('/inbox-info')
def get_inbox_info(s: t.SessionInfo):
    return person.get_inbox_info(
        s=s,
        prospect_person_ids=request.args.getlist('prospect-person-id'),
    )

@adelete('/account')
def delete_account(s: t.SessionInfo):
    return person.delete_account(s=s)

@apost('/deactivate')
def post_deactivate(s: t.SessionInfo):
    return person.post_deactivate(s=s)
