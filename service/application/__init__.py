import os
from flask import request
import duotypes as t
from service import person, question, location
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
        try:
            tx.execute(init_sql_file)
        except psycopg.errors.DuplicateTable as e:
            print(e)

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
    return dict(onboarded=s.onboarded)

@aget('/search-locations', expected_onboarding_status=None, expected_sign_in_status=None)
def get_search_locations(_):
    return person.get_search_locations(request.args.get('q'))

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
        s,
        request.args.get('n', 10),
        request.args.get('o', 0),
    )

@apost('/view-question')
@validate(t.PostViewQuestion)
def post_view_question(req: t.PostViewQuestion, _):
    return question.post_view_question(req)

@apost('/answer')
@validate(t.PostAnswer)
def post_answer(req: t.PostAnswer, s: t.SessionInfo):
    return person.post_answer(req, s)

@adelete('/answer')
@validate(t.DeleteAnswer)
def delete_answer(req: t.DeleteAnswer, s: t.SessionInfo):
    return person.delete_answer(req, s)

@get('/personality/<int:person_id>')
def get_personality(person_id):
    return person.get_personality(person_id)

init_db()
location.init_db()
question.init_db()
person.init_db()
