import os
from database import transaction, fetchall_sets
from typing import Optional, Iterable, Tuple
import duotypes as t
import urllib.request
import json
import secrets
from duohash import sha512
from PIL import Image
import io
import boto3
from concurrent.futures import ThreadPoolExecutor, as_completed
from service.person.sql import *

ENV = os.environ['DUO_ENV']

EMAIL_KEY = os.environ['DUO_EMAIL_KEY']
EMAIL_URL = os.environ['DUO_EMAIL_URL']

R2_ACCT_ID = os.environ['DUO_R2_ACCT_ID']
R2_ACCESS_KEY_ID = os.environ['DUO_R2_ACCESS_KEY_ID']
R2_ACCESS_KEY_SECRET = os.environ['DUO_R2_ACCESS_KEY_SECRET']
R2_BUCKET_NAME = os.environ['DUO_R2_BUCKET_NAME']

s3 = boto3.resource(
    's3',
    endpoint_url = f'https://{R2_ACCT_ID}.r2.cloudflarestorage.com',
    aws_access_key_id = R2_ACCESS_KEY_ID,
    aws_secret_access_key = R2_ACCESS_KEY_SECRET,
)

bucket = s3.Bucket(R2_BUCKET_NAME)

def init_db():
    pass

def process_image(
    image: Image.Image,
    output_size: Optional[int] = None
) -> io.BytesIO:
    output_bytes = io.BytesIO()

    # Rotate the image according to EXIF data
    try:
        exif = image.getexif()
        orientation = exif[274] # 274 is the exif code for the orientation tag
    except:
        orientation = None

    if orientation is None:
        pass
    elif orientation == 1:
        # Normal, no changes needed
        pass
    elif orientation == 2:
        # Mirrored horizontally
        pass
    elif orientation == 3:
        # Rotated 180 degrees
        image = image.rotate(180, expand=True)
    elif orientation == 4:
        # Mirrored vertically
        pass
    elif orientation == 5:
        # Transposed
        image = image.rotate(-90, expand=True)
    elif orientation == 6:
        # Rotated -90 degrees
        image = image.rotate(-90, expand=True)
    elif orientation == 7:
        # Transverse
        image = image.rotate(90, expand=True)
    elif orientation == 8:
        # Rotated 90 degrees
        image = image.rotate(90, expand=True)

    # Crop the image to be square
    if output_size is not None:
        # Get the dimensions of the image
        width, height = image.size

        # Find the smaller dimension
        min_dim = min(width, height)

        # Compute the area to crop
        left = (width - min_dim) // 2
        top = (height - min_dim) // 2
        right = (width + min_dim) // 2
        bottom = (height + min_dim) // 2

        # Crop the image to be square
        image = image.crop((left, top, right, bottom))

    # Scale the image to the desired size
    if output_size is not None and output_size != min_dim:
        image = image.resize((output_size, output_size))

    image = image.convert('RGB')

    image.save(
        output_bytes,
        format='JPEG',
        quality=85,
        subsampling=2,
        progressive=True,
        optimize=True,
    )

    output_bytes.seek(0)

    return output_bytes

def put_object(key: str, io_bytes: io.BytesIO):
    bucket.put_object(Key=key, Body=io_bytes)

def delete_object(key: str):
    s3.Object(R2_BUCKET_NAME, key).delete()

def put_images_in_object_store(uuid_img: Iterable[Tuple[str, io.BytesIO]]):
    key_img = [
        (key, converted_img)
        for uuid, img in uuid_img
        for key, converted_img in [
            (f'original-{uuid}.jpg', process_image(img, output_size=None)),
            (f'900-{uuid}.jpg', process_image(img, output_size=900)),
            (f'450-{uuid}.jpg', process_image(img, output_size=450)),
        ]
    ]

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(put_object, key, img)
            for key, img in key_img}

        for future in as_completed(futures):
            future.result()

# TODO: Delete from the graveyard as a batch job
def delete_images_from_object_store(uuids: Iterable[str]):
    keys_to_delete = [
        key_to_delete
        for uuid in uuids
        for key_to_delete in [
            f'original-{uuid}.jpg',
            f'900-{uuid}.jpg',
            f'450-{uuid}.jpg',
        ]
        if uuid is not None
    ]

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(delete_object, key)
            for key in keys_to_delete}

        for future in as_completed(futures):
            try:
                future.result()
            except Exception as e:
                print(f'Failed to delete object:', e)


def post_answer(req: t.PostAnswer, s: t.SessionInfo):
    params_add_yes_no_count = dict(
        question_id=req.question_id,
        add_yes=1 if req.answer is True else 0,
        add_no=1 if req.answer is False else 0,
    )

    params_update_answer = dict(
        person_id=s.person_id,
        question_id_to_delete=None,
        question_id_to_insert=req.question_id,
        answer=req.answer,
        public=req.public,
    )

    with transaction('READ COMMITTED') as tx:
        tx.execute(Q_ADD_YES_NO_COUNT, params_add_yes_no_count)

    with transaction() as tx:
        tx.execute(Q_UPDATE_ANSWER, params_update_answer)

def delete_answer(req: t.DeleteAnswer, s: t.SessionInfo):
    params = dict(
        person_id=s.person_id,
        question_id_to_delete=req.question_id,
        question_id_to_insert=None,
        answer=None,
        public=None,
    )

    with transaction() as tx:
        tx.execute(Q_UPDATE_ANSWER, params)

def _generate_otp():
    if ENV == 'dev':
        return '0' * 6
    else:
        return '{:06d}'.format(secrets.randbelow(10**6))

def _send_otp(email: str, otp: str):
    if ENV == 'dev':
        return

    headers = {
        'accept': 'application/json',
        'api-key': EMAIL_KEY,
        'content-type': 'application/json'
    }

    data = {
       "sender": {
          "name": "Duolicious",
          "email": "no-reply@duolicious.app"
       },
       "to": [ { "email": email } ],
       "subject": "Verify Your Email",
       "htmlContent": f"""
<html lang="en">
    <head>
        <title>Verify Your Email</title>
    </head>
    <body>
        <div style="padding: 20px; font-family: Helvetica, sans-serif; background-color: #70f; max-width: 600px; color: white; margin: 40px auto; text-align: center;">
            <p style="color: white; font-weight: 900;">Your Duolicious one-time password is</p>
            <strong style="font-weight: 900; display: inline-block; font-size: 200%; background-color: white; color: #70f; padding: 15px; margin: 10px;">{otp}</strong>
            <p style="color: white; font-weight: 900;">If you didn’t request this, you can ignore this message.</p>
        </div>
    </body>
</html>
"""
    }

    urllib_req = urllib.request.Request(
        EMAIL_URL,
        headers=headers,
        data=json.dumps(data).encode('utf-8')
    )

    with urllib.request.urlopen(urllib_req) as f:
        pass

def post_request_otp(req: t.PostRequestOtp):
    email = req.email
    otp = _generate_otp()
    session_token = secrets.token_hex(64)
    session_token_hash = sha512(session_token)

    params = dict(
        email=email,
        otp=otp,
        session_token_hash=session_token_hash,
    )

    with transaction() as tx:
        tx.execute(Q_INSERT_DUO_SESSION, params)

    _send_otp(email, otp)

    return dict(session_token=session_token)

def post_resend_otp(s: t.SessionInfo):
    otp = _generate_otp()

    params = dict(
        otp=otp,
        session_token_hash=s.session_token_hash,
    )

    _send_otp(s.email, otp)

    with transaction() as tx:
        tx.execute(Q_UPDATE_OTP, params)

def post_check_otp(req: t.PostCheckOtp, s: t.SessionInfo):
    params = dict(
        otp=req.otp,
        session_token_hash=s.session_token_hash,
    )

    with transaction() as tx:
        tx.execute(Q_MAYBE_DELETE_ONBOARDEE, params)
        tx.execute(Q_MAYBE_SIGN_IN, params)
        row = tx.fetchone()
        if row:
            return dict(
                person_id=row['person_id'],
                onboarded=row['person_id'] is not None,
                units=row['units'],
            )
        else:
            return 'Invalid OTP', 401

def post_sign_out(s: t.SessionInfo):
    params = dict(session_token_hash=s.session_token_hash)

    with transaction('READ COMMITTED') as tx:
        tx.execute(Q_DELETE_DUO_SESSION, params)

def post_check_session_token(s: t.SessionInfo):
    params = dict(person_id=s.person_id)

    with transaction() as tx:
        row = tx.execute(Q_SELECT_UNITS, params).fetchone()
        if row:
            return dict(
                person_id=s.person_id,
                onboarded=s.onboarded,
                units=row['units'],
            )

def post_active(s: t.SessionInfo):
    params = dict(person_id=s.person_id)

    with transaction('READ COMMITTED') as tx:
            tx.execute(Q_UPDATE_ACTIVE, params)

def patch_onboardee_info(req: t.PatchOnboardeeInfo, s: t.SessionInfo):
    for field_name, field_value in req.dict().items():
        if field_value:
            break
    if not field_value:
        return f'No field set in {req.dict()}', 400

    if field_name in ['name', 'date_of_birth', 'about']:
        params = dict(
            email=s.email,
            field_value=field_value
        )

        q_set_onboardee_field = """
            INSERT INTO onboardee (
                email,
                $field_name
            ) VALUES (
                %(email)s,
                %(field_value)s
            ) ON CONFLICT (email) DO UPDATE SET
                $field_name = EXCLUDED.$field_name
            """.replace('$field_name', field_name)

        with transaction() as tx:
            tx.execute(q_set_onboardee_field, params)
    elif field_name == 'location':
        params = dict(
            email=s.email,
            long_friendly=field_value
        )

        q_set_onboardee_field = """
            INSERT INTO onboardee (
                email,
                coordinates
            ) SELECT
                %(email)s,
                coordinates
            FROM location
            WHERE long_friendly = %(long_friendly)s
            ON CONFLICT (email) DO UPDATE SET
                coordinates = EXCLUDED.coordinates
            """
        with transaction() as tx:
            tx.execute(q_set_onboardee_field, params)
            if tx.rowcount != 1:
                return 'Unknown location', 400
    elif field_name == 'gender':
        params = dict(
            email=s.email,
            gender=field_value
        )

        q_set_onboardee_field = """
            INSERT INTO onboardee (
                email,
                gender_id
            ) SELECT
                %(email)s,
                id
            FROM gender
            WHERE name = %(gender)s
            ON CONFLICT (email) DO UPDATE SET
                gender_id = EXCLUDED.gender_id
            """

        with transaction() as tx:
            tx.execute(q_set_onboardee_field, params)
    elif field_name == 'other_peoples_genders':
        params = dict(
            email=s.email,
            genders=field_value
        )

        q_set_onboardee_field = """
            INSERT INTO onboardee_search_preference_gender (
                email,
                gender_id
            )
            SELECT
                %(email)s,
                id
            FROM gender
            WHERE name = ANY(%(genders)s)
            ON CONFLICT (email, gender_id) DO UPDATE SET
                gender_id = EXCLUDED.gender_id
            """

        with transaction() as tx:
            tx.execute(q_set_onboardee_field, params)
    elif field_name == 'files':
        pos_uuid_img = [
            (pos, secrets.token_hex(32), img)
            for pos, img in field_value.items()
        ]

        params = [
            dict(email=s.email, position=pos, uuid=uuid)
            for pos, uuid, _ in pos_uuid_img
        ]

        # Create new onboardee photos. Because we:
        #   1. Create DB entries; then
        #   2. Create photos,
        # the DB might refer to DB entries that don't exist. The front end needs
        # to handle that possibility. Doing it like this makes later deletion
        # from the object store easier, which is important because storing
        # objects is expensive.
        q_set_onboardee_field = """
            INSERT INTO onboardee_photo (
                email,
                position,
                uuid
            ) VALUES (
                %(email)s,
                %(position)s,
                %(uuid)s
            ) ON CONFLICT (email, position) DO UPDATE SET
                uuid = EXCLUDED.uuid
            """

        with transaction() as tx:
            tx.executemany(q_set_onboardee_field, params)

        try:
            put_images_in_object_store(
                (uuid, img) for _, uuid, img in pos_uuid_img)
        except Exception as e:
            print('Upload failed with exception:', e)
            return '', 500

    else:
        return f'Invalid field name {field_name}', 400

def delete_onboardee_info(req: t.DeleteOnboardeeInfo, s: t.SessionInfo):
    params = [
        dict(email=s.email, position=position)
        for position in req.files
    ]

    with transaction() as tx:
        tx.executemany(Q_DELETE_ONBOARDEE_PHOTO, params)

def post_finish_onboarding(s: t.SessionInfo):
    params = dict(
        email=s.email
    )

    with transaction() as tx:
        return tx.execute(Q_FINISH_ONBOARDING, params).fetchone()

def get_me(person_id: int):
    params = dict(
        person_ids=[person_id],
        topic=None,
    )

    with transaction('READ COMMITTED') as tx:
        personality = tx.execute(Q_SELECT_PERSONALITY, params).fetchall()

    try:
        return {
            'name': personality[0]['person_name'],
            'person_id': person_id,
            'personality': [
                {
                    'trait_id': trait['trait_id'],
                    'name': trait['trait_name'],
                    'min_label': trait['min_label'],
                    'max_label': trait['max_label'],
                    'description': trait['description'],
                    'percentage': trait['percentage'],
                }
                for trait in personality
            ]
        }
    except:
        return '', 404

def get_prospect_profile(s: t.SessionInfo, prospect_person_id: int):
    params = dict(
        person_id=s.person_id,
        prospect_person_id=prospect_person_id,
    )

    with transaction('READ COMMITTED') as tx:
        row = tx.execute(Q_SELECT_PROSPECT_PROFILE, params).fetchone()
        if row:
            return row
        else:
            return '', 404
    return '', 500

def post_block(s: t.SessionInfo, prospect_person_id: int):
    params = dict(
        subject_person_id=s.person_id,
        object_person_id=prospect_person_id,
    )

    with transaction() as tx:
        tx.execute(Q_INSERT_BLOCKED, params)

def post_unblock(s: t.SessionInfo, prospect_person_id: int):
    params = dict(
        subject_person_id=s.person_id,
        object_person_id=prospect_person_id,
    )

    with transaction() as tx:
        tx.execute(Q_DELETE_BLOCKED, params)

def post_hide(s: t.SessionInfo, prospect_person_id: int):
    params = dict(
        subject_person_id=s.person_id,
        object_person_id=prospect_person_id,
    )

    with transaction() as tx:
        tx.execute(Q_INSERT_HIDDEN, params)

def post_unhide(s: t.SessionInfo, prospect_person_id: int):
    params = dict(
        subject_person_id=s.person_id,
        object_person_id=prospect_person_id,
    )

    with transaction() as tx:
        tx.execute(Q_DELETE_HIDDEN, params)

def get_compare_personalities(
    s: t.SessionInfo,
    prospect_person_id: int,
    topic: str
):
    url_topic_to_db_topic = {
        'mbti': 'MBTI',
        'big5': 'Big 5',
        'attachment': 'Attachment Style',
        'politics': 'Politics',
        'other': 'Other',
    }

    if topic not in url_topic_to_db_topic:
        return 'Topic not found', 404

    db_topic = url_topic_to_db_topic[topic]

    params = dict(
        person_ids=[s.person_id, prospect_person_id],
        topic=db_topic,
    )

    with transaction('READ COMMITTED') as tx:
        rows = tx.execute(Q_SELECT_PERSONALITY, params).fetchall()

    you_rows = [
            row for row in rows if row['person_id'] == s.person_id]
    prospect_rows = [
            row for row in rows if row['person_id'] == prospect_person_id]

    def rows_to_personality(you_row, prospect_row):
        assert you_row['trait_name'] == prospect_row['trait_name']
        assert you_row['min_label'] == prospect_row['min_label']
        assert you_row['max_label'] == prospect_row['max_label']
        assert you_row['description'] == prospect_row['description']

        return {
            'name1': 'You',
            'percentage1': you_row['percentage'],

            'name2': prospect_row['person_name'],
            'percentage2': prospect_row['percentage'],

            'name': (
                you_row['trait_name'] if
                topic != 'big5' else
                you_row['trait_name'].replace(
                    'Introversion/Extraversion',
                    'Extraversion'
                )
            ),
            'min_label': you_row['min_label'] if topic != 'big5' else None,
            'max_label': you_row['max_label'] if topic != 'big5' else None,

            'description': you_row['description'],
        }

    try:
        return [
            rows_to_personality(you_row, prospect_row)
            for you_row, prospect_row in zip(you_rows, prospect_rows)
        ]
    except:
        return '', 404

def get_compare_answers(
    s: t.SessionInfo,
    prospect_person_id: int,
    agreement: Optional[str],
    topic: Optional[str],
    n: Optional[str],
    o: Optional[str],
):
    valid_agreements = ['all', 'agree', 'disagree', 'unanswered']
    valid_topics = ['all', 'values', 'sex', 'interpersonal', 'other']

    if agreement not in valid_agreements:
        return 'Invalid agreement', 400

    if topic not in valid_topics:
        return 'Invalid topic', 400

    try:
        n_int = int(n)
    except:
        return 'Invalid n', 400

    try:
        o_int = int(o)
    except:
        return 'Invalid o', 400

    params = dict(
        person_id=s.person_id,
        prospect_person_id=prospect_person_id,
        agreement=agreement.capitalize(),
        topic=topic.capitalize(),
        n=n,
        o=o,
    )

    with transaction('READ COMMITTED') as tx:
        return tx.execute(Q_ANSWER_COMPARISON, params).fetchall()

def get_inbox_info(s: t.SessionInfo, prospect_person_ids: Iterable[int]):
    params = dict(
        person_id=s.person_id,
        prospect_person_ids=prospect_person_ids,
    )

    with transaction('READ COMMITTED') as tx:
        return tx.execute(Q_INBOX_INFO, params).fetchall()

def delete_account(s: t.SessionInfo):
    params = dict(person_id=s.person_id)

    with transaction() as tx:
        tx.execute(Q_DELETE_ACCOUNT, params)

def post_deactivate(s: t.SessionInfo):
    params = dict(person_id=s.person_id)

    with transaction() as tx:
        tx.execute(Q_POST_DEACTIVATE, params)

def get_profile_info(s: t.SessionInfo):
    params = dict(person_id=s.person_id)

    with transaction('READ COMMITTED') as tx:
        return tx.execute(Q_GET_PROFILE_INFO, params).fetchone()['j']

def delete_profile_info(req: t.DeleteProfileInfo, s: t.SessionInfo):
    params = [
        dict(person_id=s.person_id, position=position)
        for position in req.files
    ]

    with transaction() as tx:
        tx.executemany(Q_DELETE_PROFILE_INFO, params)

def patch_profile_info(req: t.PatchProfileInfo, s: t.SessionInfo):
    for field_name, field_value in req.dict().items():
        if field_value:
            break
    if not field_value:
        return f'No field set in {req.dict()}', 400

    params = dict(
        person_id=s.person_id,
        field_value=field_value,
    )

    with transaction() as tx:
        if field_name == 'files':
            pos_uuid_img = [
                (pos, secrets.token_hex(32), img)
                for pos, img in field_value.items()
            ]

            params = [
                dict(person_id=s.person_id, position=pos, uuid=uuid)
                for pos, uuid, _ in pos_uuid_img
            ]

            q = """
            INSERT INTO photo (
                person_id,
                position,
                uuid
            ) VALUES (
                %(person_id)s,
                %(position)s,
                %(uuid)s
            ) ON CONFLICT (person_id, position) DO UPDATE SET
                uuid = EXCLUDED.uuid
            """

            tx.executemany(q, params)

            try:
                put_images_in_object_store(
                    (uuid, img) for _, uuid, img in pos_uuid_img)
            except Exception as e:
                print('Upload failed with exception:', e)
                return '', 500

            return
        elif field_name == 'about':
            q = """
            UPDATE person
            SET about = %(field_value)s
            WHERE id = %(person_id)s
            """
        elif field_name == 'gender':
            q = """
            UPDATE person SET gender_id = gender.id
            FROM gender
            WHERE person.id = %(person_id)s
            AND gender.name = %(field_value)s
            """
        elif field_name == 'orientation':
            q = """
            UPDATE person SET orientation_id = orientation.id
            FROM orientation
            WHERE person.id = %(person_id)s
            AND orientation.name = %(field_value)s
            """
        elif field_name == 'location':
            q = """
            UPDATE person SET coordinates = location.coordinates
            FROM location
            WHERE person.id = %(person_id)s
            AND long_friendly = %(field_value)s
            """
        elif field_name == 'occupation':
            q = """
            UPDATE person SET occupation = %(field_value)s
            WHERE person.id = %(person_id)s
            """
        elif field_name == 'education':
            q = """
            UPDATE person SET education = %(field_value)s
            WHERE person.id = %(person_id)s
            """
        elif field_name == 'height':
            q = """
            UPDATE person SET height_cm = %(field_value)s
            WHERE person.id = %(person_id)s
            """
        elif field_name == 'looking_for':
            q = """
            UPDATE person SET looking_for_id = looking_for.id
            FROM looking_for
            WHERE person.id = %(person_id)s
            AND looking_for.name = %(field_value)s
            """
        elif field_name == 'smoking':
            q = """
            UPDATE person SET smoking_id = yes_no_optional.id
            FROM yes_no_optional
            WHERE person.id = %(person_id)s
            AND yes_no_optional.name = %(field_value)s
            """
        elif field_name == 'drinking':
            q = """
            UPDATE person SET drinking_id = frequency.id
            FROM frequency
            WHERE person.id = %(person_id)s
            AND frequency.name = %(field_value)s
            """
        elif field_name == 'drugs':
            q = """
            UPDATE person SET drugs_id = yes_no_optional.id
            FROM yes_no_optional
            WHERE person.id = %(person_id)s
            AND yes_no_optional.name = %(field_value)s
            """
        elif field_name == 'long_distance':
            q = """
            UPDATE person SET long_distance_id = yes_no_optional.id
            FROM yes_no_optional
            WHERE person.id = %(person_id)s
            AND yes_no_optional.name = %(field_value)s
            """
        elif field_name == 'relationship_status':
            q = """
            UPDATE person SET relationship_status_id = relationship_status.id
            FROM relationship_status
            WHERE person.id = %(person_id)s
            AND relationship_status.name = %(field_value)s
            """
        elif field_name == 'has_kids':
            q = """
            UPDATE person SET has_kids_id = yes_no_maybe.id
            FROM yes_no_maybe
            WHERE person.id = %(person_id)s
            AND yes_no_maybe.name = %(field_value)s
            """
        elif field_name == 'wants_kids':
            q = """
            UPDATE person SET wants_kids_id = yes_no_maybe.id
            FROM yes_no_maybe
            WHERE person.id = %(person_id)s
            AND yes_no_maybe.name = %(field_value)s
            """
        elif field_name == 'exercise':
            q = """
            UPDATE person SET exercise_id = frequency.id
            FROM frequency
            WHERE person.id = %(person_id)s
            AND frequency.name = %(field_value)s
            """
        elif field_name == 'religion':
            q = """
            UPDATE person SET religion_id = religion.id
            FROM religion
            WHERE person.id = %(person_id)s
            AND religion.name = %(field_value)s
            """
        elif field_name == 'star_sign':
            q = """
            UPDATE person SET star_sign_id = star_sign.id
            FROM star_sign
            WHERE person.id = %(person_id)s
            AND star_sign.name = %(field_value)s
            """
        elif field_name == 'units':
            q = """
            UPDATE person SET unit_id = unit.id
            FROM unit
            WHERE person.id = %(person_id)s
            AND unit.name = %(field_value)s
            """
        elif field_name == 'chats':
            q = """
            UPDATE person SET chats_notification = immediacy.id
            FROM immediacy
            WHERE person.id = %(person_id)s
            AND immediacy.name = %(field_value)s
            """
        elif field_name == 'intros':
            q = """
            UPDATE person SET intros_notification = immediacy.id
            FROM immediacy
            WHERE person.id = %(person_id)s
            AND immediacy.name = %(field_value)s
            """
        elif field_name == 'show_my_location':
            q = """
            UPDATE person
            SET show_my_location = (
                CASE WHEN %(field_value)s = 'Yes' THEN TRUE ELSE FALSE END)
            WHERE id = %(person_id)s
            """
        elif field_name == 'show_my_age':
            q = """
            UPDATE person
            SET show_my_age = (
                CASE WHEN %(field_value)s = 'Yes' THEN TRUE ELSE FALSE END)
            WHERE id = %(person_id)s
            """
        elif field_name == 'hide_me_from_strangers':
            q = """
            UPDATE person
            SET hide_me_from_strangers = (
                CASE WHEN %(field_value)s = 'Yes' THEN TRUE ELSE FALSE END)
            WHERE id = %(person_id)s
            """
        else:
            return f'Invalid field name {field_name}', 400

        tx.execute(q, params)
