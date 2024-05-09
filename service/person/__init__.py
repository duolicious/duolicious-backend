import os
from database import api_tx, chat_tx, fetchall_sets
from typing import Any, Optional, Iterable, Tuple
import duotypes as t
import json
import secrets
from duohash import sha512
from PIL import Image
import io
import boto3
from concurrent.futures import ThreadPoolExecutor, as_completed
from service.person.sql import *
from service.person.template import otp_template, report_template
import traceback
import threading
import re
from smtp import aws_smtp
from flask import request
from dataclasses import dataclass
import psycopg
from functools import lru_cache
import random

@dataclass
class EmailEntry:
    email: str
    count: int

def parse_email_string(email_string):
    # Regular expression to match an email followed optionally by a number
    pattern = r'(\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b)(?:\s+(\d+))?'
    matches = re.findall(pattern, email_string)

    result = []
    for email, count in matches:
        # If no number is given, default to 1
        if count == '':
            count = 1
        else:
            count = int(count)
        result.append(EmailEntry(email, count))

    return result

DUO_ENV = os.environ['DUO_ENV']

REPORT_EMAIL = os.environ['DUO_REPORT_EMAIL']
REPORT_EMAILS = parse_email_string(REPORT_EMAIL)
print(REPORT_EMAILS)

R2_ACCT_ID = os.environ['DUO_R2_ACCT_ID']
R2_ACCESS_KEY_ID = os.environ['DUO_R2_ACCESS_KEY_ID']
R2_ACCESS_KEY_SECRET = os.environ['DUO_R2_ACCESS_KEY_SECRET']
R2_BUCKET_NAME = os.environ['DUO_R2_BUCKET_NAME']

BOTO_ENDPOINT_URL = os.getenv(
    'DUO_BOTO_ENDPOINT_URL',
    f'https://{R2_ACCT_ID}.r2.cloudflarestorage.com'
)

s3 = boto3.resource(
    's3',
    endpoint_url=BOTO_ENDPOINT_URL,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_ACCESS_KEY_SECRET,
)

bucket = s3.Bucket(R2_BUCKET_NAME)

def init_db():
    pass

def sample_email(email_entries):
    # Extract the emails and their respective weights from the list of EmailEntry instances
    emails = [entry.email for entry in email_entries]
    weights = [entry.count for entry in email_entries]

    # Use random.choices() to perform weighted sampling and return a single email
    sampled_email = random.choices(emails, weights=weights, k=1)[0]  # Get the first item from the result

    return sampled_email

@dataclass
class CropSize:
    top: int
    left: int

def _send_report(
    subject_person_id: int,
    object_person_id: int,
    report_reason: str,
    report: Any,
):
    report_email = sample_email(REPORT_EMAILS)

    try:
        aws_smtp.send(
            to=report_email,
            subject=f"Report: {subject_person_id} - {object_person_id}",
            body=report_template(
                report_json=report,
                subject_person_id=subject_person_id,
                object_person_id=object_person_id,
                report_reason=report_reason,
            ),
            from_addr=REPORT_EMAIL,
        )
    except:
        print(traceback.format_exc())

def process_image(
    image: Image.Image,
    output_size: Optional[int] = None,
    crop_size: Optional[CropSize] = None,
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
        if crop_size is None:
            left = (width - min_dim) // 2
            top = (height - min_dim) // 2
            right = (width + min_dim) // 2
            bottom = (height + min_dim) // 2
        else:
            # Ensure the top left point is within range
            crop_size.top  = max(0, crop_size.top)
            crop_size.left = max(0, crop_size.left)

            crop_size.top  = min(height - min_dim, crop_size.top)
            crop_size.left = min(width  - min_dim, crop_size.left)

            # Compute the area to crop
            left = crop_size.left
            top = crop_size.top
            right = crop_size.left + min_dim
            bottom = crop_size.top + min_dim

        # Crop the image to be square
        crop_box = (left, top, right, bottom)
        image = image.crop(crop_box)

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

def put_image_in_object_store(
    uuid: str,
    img: Image.Image,
    crop_size: CropSize,
):
    key_img = [
        (key, converted_img)
        for key, converted_img in [
            (f'original-{uuid}.jpg', process_image(img, output_size=None)),
            (f'900-{uuid}.jpg', process_image(img, output_size=900, crop_size=crop_size)),
            (f'450-{uuid}.jpg', process_image(img, output_size=450, crop_size=crop_size)),
        ]
    ]

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(put_object, key, img)
            for key, img in key_img}

        for future in as_completed(futures):
            future.result()

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

    with api_tx('READ COMMITTED') as tx:
        tx.execute(Q_ADD_YES_NO_COUNT, params_add_yes_no_count)

    with api_tx() as tx:
        tx.execute(Q_UPDATE_ANSWER, params_update_answer)

def delete_answer(req: t.DeleteAnswer, s: t.SessionInfo):
    params = dict(
        person_id=s.person_id,
        question_id_to_delete=req.question_id,
        question_id_to_insert=None,
        answer=None,
        public=None,
    )

    with api_tx() as tx:
        tx.execute(Q_UPDATE_ANSWER, params)

def _send_otp(email: str, otp: str):
    if email.endswith('@example.com'):
        return

    aws_smtp.send(
        to=email,
        subject="Sign in to Duolicious",
        body=otp_template(otp)
    )

def post_request_otp(req: t.PostRequestOtp):
    email = req.email
    session_token = secrets.token_hex(64)
    session_token_hash = sha512(session_token)

    params = dict(
        email=email,
        is_dev=DUO_ENV == 'dev',
        session_token_hash=session_token_hash,
        ip_address=request.remote_addr or "127.0.0.1",
    )

    with api_tx() as tx:
        rows = tx.execute(Q_INSERT_DUO_SESSION, params).fetchall()

    try:
        row, *_ = rows
        otp = row['otp']
    except:
        return 'Banned', 403

    _send_otp(email, otp)

    return dict(session_token=session_token)

def post_resend_otp(s: t.SessionInfo):
    params = dict(
        email=s.email,
        is_dev=DUO_ENV == 'dev',
        session_token_hash=s.session_token_hash,
        ip_address=request.remote_addr or "127.0.0.1",
    )

    with api_tx() as tx:
        rows = tx.execute(Q_UPDATE_OTP, params).fetchall()

    try:
        row, *_ = rows
        otp = row['otp']
    except:
        return 'Banned', 403

    _send_otp(s.email, otp)

def post_check_otp(req: t.PostCheckOtp, s: t.SessionInfo):
    params = dict(
        otp=req.otp,
        session_token_hash=s.session_token_hash,
    )

    with api_tx() as tx:
        tx.execute(Q_MAYBE_DELETE_ONBOARDEE, params)
        tx.execute(Q_MAYBE_SIGN_IN, params)
        row = tx.fetchone()
        if not row:
            return 'Invalid OTP', 401

    params = dict(person_id=row['person_id'])

    with chat_tx() as tx:
        tx.execute(Q_UPDATE_LAST, params)

    return dict(
        person_id=row['person_id'],
        onboarded=row['person_id'] is not None,
        units=row['units'],
    )

def post_sign_out(s: t.SessionInfo):
    params = dict(session_token_hash=s.session_token_hash)

    with api_tx('READ COMMITTED') as tx:
        tx.execute(Q_DELETE_DUO_SESSION, params)

def post_check_session_token(s: t.SessionInfo):
    params = dict(person_id=s.person_id)

    with api_tx() as tx:
        row = tx.execute(Q_SELECT_UNITS, params).fetchone()
        if row:
            return dict(
                person_id=s.person_id,
                onboarded=s.onboarded,
                units=row['units'],
            )

def patch_onboardee_info(req: t.PatchOnboardeeInfo, s: t.SessionInfo):
    [field_name] = req.__pydantic_fields_set__
    field_value = req.dict()[field_name]

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

        with api_tx() as tx:
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
        with api_tx() as tx:
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

        with api_tx() as tx:
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

        with api_tx() as tx:
            tx.execute(q_set_onboardee_field, params)
    elif field_name == 'base64_file':
        position = field_value['position']
        image = field_value['image']
        top = field_value['top']
        left = field_value['left']

        uuid = secrets.token_hex(32)

        params = dict(
            email=s.email,
            position=position,
            uuid=uuid,
        )

        # Create new onboardee photos. Because we:
        #   1. Create DB entries; then
        #   2. Create photos,
        # the DB might refer to DB entries that don't exist. The front end needs
        # to handle that possibility. Doing it like this makes later deletion
        # from the object store easier, which is important because storing
        # objects is expensive.
        q_set_onboardee_field = """
            WITH existing_uuid AS (
                SELECT
                    uuid
                FROM
                    onboardee_photo
                WHERE
                    email = %(email)s
                AND
                    position = %(position)s
            ), undeleted_photo_insertion AS (
                INSERT INTO undeleted_photo (
                    uuid
                )
                SELECT
                    uuid
                FROM
                    existing_uuid
            ), onboardee_photo_insertion AS (
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
            )
            SELECT 1
            """

        with api_tx() as tx:
            tx.execute(q_set_onboardee_field, params)

        try:
            put_image_in_object_store(uuid, image, CropSize(top=top, left=left))
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

    with api_tx() as tx:
        tx.executemany(Q_DELETE_ONBOARDEE_PHOTO, params)

def post_finish_onboarding(s: t.SessionInfo):
    api_params = dict(email=s.email)

    with api_tx() as tx:
        row = tx.execute(Q_FINISH_ONBOARDING, params=api_params).fetchone()

    chat_params = dict(person_id=row['person_id'])

    with chat_tx() as tx:
        tx.execute(Q_INSERT_LAST, params=chat_params)

    return row

def get_me(
    person_id_as_int: int | None = None,
    person_id_as_str: str | None = None,
):
    if person_id_as_int is None and person_id_as_str is None:
        raise ValueError('pass an arg, please')

    params = dict(
        person_id_as_int=person_id_as_int,
        person_id_as_str=person_id_as_str,
        prospect_person_id=None,
        topic=None,
    )

    with api_tx('READ COMMITTED') as tx:
        personality = tx.execute(Q_SELECT_PERSONALITY, params).fetchall()

    try:
        return {
            'name': personality[0]['person_name'],
            'person_id': personality[0]['person_id'],
            'personality': [
                {
                    'trait_name': trait['trait_name'],
                    'trait_min_label': trait['trait_min_label'],
                    'trait_max_label': trait['trait_max_label'],
                    'trait_description': trait['trait_description'],
                    'person_percentage': trait['person_percentage'],
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

    with api_tx('READ COMMITTED') as tx:
        row = tx.execute(Q_SELECT_PROSPECT_PROFILE, params).fetchone()
        if not row:
            return '', 404

        profile = row.get('j')
        if not profile:
            return '', 404

        return profile
    return '', 500

def post_skip(req: t.PostSkip, s: t.SessionInfo, prospect_person_id: int):
    agents = dict(
        subject_person_id=s.person_id,
        object_person_id=prospect_person_id,
    )

    params = agents | dict(reported=bool(req.report_reason))

    with api_tx() as tx:
        tx.execute(Q_INSERT_SKIPPED, params=params)

    if req.report_reason:
        with api_tx() as tx:
            report = tx.execute(Q_MAKE_REPORT, params=agents).fetchall()

        threading.Thread(
            target=_send_report,
            kwargs=agents | dict(report_reason=req.report_reason, report=report)
        ).start()

def post_unskip(s: t.SessionInfo, prospect_person_id: int):
    params = dict(
        subject_person_id=s.person_id,
        object_person_id=prospect_person_id,
    )

    with api_tx() as tx:
        tx.execute(Q_DELETE_SKIPPED, params)

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
        person_id_as_int=s.person_id,
        person_id_as_str=None,
        prospect_person_id=prospect_person_id,
        topic=db_topic,
    )

    with api_tx('READ COMMITTED') as tx:
        return tx.execute(Q_SELECT_PERSONALITY, params).fetchall()

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

    with api_tx('READ COMMITTED') as tx:
        return tx.execute(Q_ANSWER_COMPARISON, params).fetchall()

def post_inbox_info(req: t.PostInboxInfo, s: t.SessionInfo):
    params = dict(
        person_id=s.person_id,
        prospect_person_ids=req.person_ids
    )

    with api_tx('READ COMMITTED') as tx:
        return tx.execute(Q_INBOX_INFO, params).fetchall()

def delete_account(s: t.SessionInfo):
    params = dict(person_id=s.person_id)

    with api_tx() as tx:
        tx.execute(Q_DELETE_ACCOUNT, params)

def post_deactivate(s: t.SessionInfo):
    params = dict(person_id=s.person_id)

    with api_tx() as tx:
        tx.execute(Q_POST_DEACTIVATE, params)

def get_profile_info(s: t.SessionInfo):
    params = dict(person_id=s.person_id)

    with api_tx('READ COMMITTED') as tx:
        return tx.execute(Q_GET_PROFILE_INFO, params).fetchone()['j']

def delete_profile_info(req: t.DeleteProfileInfo, s: t.SessionInfo):
    params = [
        dict(person_id=s.person_id, position=position)
        for position in req.files
    ]

    with api_tx() as tx:
        tx.executemany(Q_DELETE_PROFILE_INFO, params)

def patch_profile_info(req: t.PatchProfileInfo, s: t.SessionInfo):
    [field_name] = req.__pydantic_fields_set__
    field_value = req.dict()[field_name]

    params = dict(
        person_id=s.person_id,
        field_value=field_value,
    )

    if field_name == 'base64_file':
        position = field_value['position']
        image = field_value['image']
        top = field_value['top']
        left = field_value['left']

        uuid = secrets.token_hex(32)

        params = dict(
            person_id=s.person_id,
            email=s.email,
            position=position,
            uuid=uuid,
        )

        q = """
        WITH existing_uuid AS (
            SELECT
                uuid
            FROM
                photo
            WHERE
                person_id = %(person_id)s
            AND
                position = %(position)s
        ), undeleted_photo_insertion AS (
            INSERT INTO undeleted_photo (
                uuid
            )
            SELECT
                uuid
            FROM
                existing_uuid
        ), photo_insertion AS (
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
        )
        SELECT 1
        """

        with api_tx() as tx:
            tx.execute(q, params)

        try:
            put_image_in_object_store(
                uuid, image, CropSize(top=top, left=left))
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

    with api_tx() as tx:
        tx.execute(q, params)

def get_search_filters(s: t.SessionInfo):
    params = dict(person_id=s.person_id)

    with api_tx('READ COMMITTED') as tx:
        return tx.execute(Q_GET_SEARCH_FILTERS, params).fetchone()['j']

def post_search_filter(req: t.PostSearchFilter, s: t.SessionInfo):
    [field_name] = req.__pydantic_fields_set__
    field_value = req.dict()[field_name]

    # Modify `field_value` for certain `field_name`s
    if field_name in ['age', 'height']:
        field_value = json.dumps(field_value)

    params = dict(
        person_id=s.person_id,
        field_value=field_value,
    )

    with api_tx() as tx:
        if field_name == 'gender':
            q1 = """
            DELETE FROM search_preference_gender
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_gender (
                person_id, gender_id
            )
            SELECT %(person_id)s, id
            FROM gender WHERE name = ANY(%(field_value)s)
            """
        elif field_name == 'orientation':
            q1 = """
            DELETE FROM search_preference_orientation
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_orientation (
                person_id, orientation_id
            )
            SELECT %(person_id)s, id
            FROM orientation WHERE name = ANY(%(field_value)s)
            """
        elif field_name == 'age':
            q1 = """
            DELETE FROM search_preference_age
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_age (
                person_id, min_age, max_age
            ) SELECT
                %(person_id)s,
                (json_data->>'min_age')::SMALLINT,
                (json_data->>'max_age')::SMALLINT
            FROM to_json(%(field_value)s::json) AS json_data"""
        elif field_name == 'furthest_distance':
            q1 = """
            DELETE FROM search_preference_distance
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_distance (person_id, distance)
            VALUES (%(person_id)s, %(field_value)s)
            """
        elif field_name == 'height':
            q1 = """
            DELETE FROM search_preference_height_cm
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_height_cm (
                person_id, min_height_cm, max_height_cm
            ) SELECT
                %(person_id)s,
                (json_data->>'min_height_cm')::SMALLINT,
                (json_data->>'max_height_cm')::SMALLINT
            FROM to_json(%(field_value)s::json) AS json_data"""
        elif field_name == 'has_a_profile_picture':
            q1 = """
            DELETE FROM search_preference_has_profile_picture
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_has_profile_picture (
                person_id, has_profile_picture_id
            ) SELECT %(person_id)s, id
            FROM yes_no WHERE name = ANY(%(field_value)s)
            """
        elif field_name == 'looking_for':
            q1 = """
            DELETE FROM search_preference_looking_for
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_looking_for (
                person_id, looking_for_id
            ) SELECT %(person_id)s, id
            FROM looking_for WHERE name = ANY(%(field_value)s)
            """
        elif field_name == 'smoking':
            q1 = """
            DELETE FROM search_preference_smoking
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_smoking (
                person_id, smoking_id
            )
            SELECT %(person_id)s, id
            FROM yes_no_optional WHERE name = ANY(%(field_value)s)
            """
        elif field_name == 'drinking':
            q1 = """
            DELETE FROM search_preference_drinking
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_drinking (
                person_id, drinking_id
            )
            SELECT %(person_id)s, id
            FROM frequency WHERE name = ANY(%(field_value)s)
            """
        elif field_name == 'drugs':
            q1 = """
            DELETE FROM search_preference_drugs
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_drugs (
                person_id, drugs_id
            )
            SELECT %(person_id)s, id
            FROM yes_no_optional WHERE name = ANY(%(field_value)s)
            """
        elif field_name == 'long_distance':
            q1 = """
            DELETE FROM search_preference_long_distance
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_long_distance (
                person_id, long_distance_id
            )
            SELECT %(person_id)s, id
            FROM yes_no_optional WHERE name = ANY(%(field_value)s)
            """
        elif field_name == 'relationship_status':
            q1 = """
            DELETE FROM search_preference_relationship_status
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_relationship_status (
                person_id, relationship_status_id
            )
            SELECT %(person_id)s, id
            FROM relationship_status WHERE name = ANY(%(field_value)s)
            """
        elif field_name == 'has_kids':
            q1 = """
            DELETE FROM search_preference_has_kids
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_has_kids (
                person_id, has_kids_id
            )
            SELECT %(person_id)s, id
            FROM yes_no_optional WHERE name = ANY(%(field_value)s)
            """
        elif field_name == 'wants_kids':
            q1 = """
            DELETE FROM search_preference_wants_kids
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_wants_kids (
                person_id, wants_kids_id
            )
            SELECT %(person_id)s, id
            FROM yes_no_maybe WHERE name = ANY(%(field_value)s)
            """
        elif field_name == 'exercise':
            q1 = """
            DELETE FROM search_preference_exercise
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_exercise (
                person_id, exercise_id
            )
            SELECT %(person_id)s, id
            FROM frequency WHERE name = ANY(%(field_value)s)
            """
        elif field_name == 'religion':
            q1 = """
            DELETE FROM search_preference_religion
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_religion (
                person_id, religion_id
            )
            SELECT %(person_id)s, id
            FROM religion WHERE name = ANY(%(field_value)s)
            """
        elif field_name == 'star_sign':
            q1 = """
            DELETE FROM search_preference_star_sign
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_star_sign (
                person_id, star_sign_id
            )
            SELECT %(person_id)s, id
            FROM star_sign WHERE name = ANY(%(field_value)s)
            """
        elif field_name == 'people_you_messaged':
            q1 = """
            DELETE FROM search_preference_messaged
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_messaged (
                person_id, messaged_id
            )
            SELECT %(person_id)s, id
            FROM yes_no WHERE name = %(field_value)s
            """
        elif field_name == 'people_you_skipped':
            q1 = """
            DELETE FROM search_preference_skipped
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_skipped (
                person_id, skipped_id
            )
            SELECT %(person_id)s, id
            FROM yes_no WHERE name = %(field_value)s
            """
        else:
            return f'Invalid field name {field_name}', 400

        tx.execute(q1, params)
        tx.execute(q2, params)

def post_search_filter_answer(req: t.PostSearchFilterAnswer, s: t.SessionInfo):
    max_search_filter_answers = 20
    error = f'You can’t set more than {max_search_filter_answers} Q&A filters'

    params = dict(
        person_id=s.person_id,
        question_id=req.question_id,
        answer=req.answer,
        accept_unanswered=req.accept_unanswered,
    )

    if req.answer is None:
        q = f"""
        WITH deleted_answer AS (
            DELETE FROM search_preference_answer
            WHERE
                person_id = %(person_id)s AND
                question_id = %(question_id)s
            RETURNING *
        )
        SELECT COALESCE(
            array_agg(
                json_build_object(
                    'question_id', question_id,
                    'question', question,
                    'topic', topic,
                    'answer', answer,
                    'accept_unanswered', accept_unanswered
                )
                ORDER BY question_id
            ),
            ARRAY[]::JSON[]
        ) AS j
        FROM search_preference_answer
        LEFT JOIN question
        ON question.id = question_id
        WHERE
            person_id = %(person_id)s AND
            question_id != (SELECT question_id FROM deleted_answer)
        """
    else:
        q = f"""
        WITH existing_search_preference_answer AS (
            SELECT
                person_id,
                question_id,
                answer,
                accept_unanswered,
                0 AS precedence
            FROM search_preference_answer
            WHERE person_id = %(person_id)s
        ), new_search_preference_answer AS (
            SELECT
                %(person_id)s AS person_id,
                %(question_id)s AS question_id,
                %(answer)s AS answer,
                %(accept_unanswered)s AS accept_unanswered,
                1 AS precedence
        ), updated_search_preference_answer AS (
            SELECT DISTINCT ON (person_id, question_id)
                person_id,
                question_id,
                answer,
                accept_unanswered
            FROM (
                (SELECT * from existing_search_preference_answer)
                UNION
                (SELECT * from new_search_preference_answer)
            ) AS t
            ORDER BY person_id, question_id, precedence DESC
        ), inserted_search_preference_answer AS (
            INSERT INTO search_preference_answer (
                person_id, question_id, answer, accept_unanswered
            ) SELECT
                person_id, question_id, answer, accept_unanswered
            FROM
                new_search_preference_answer
            WHERE (
                SELECT COUNT(*) FROM updated_search_preference_answer
            ) <= {max_search_filter_answers}
            ON CONFLICT (person_id, question_id) DO UPDATE SET
                answer            = EXCLUDED.answer,
                accept_unanswered = EXCLUDED.accept_unanswered
        )
        SELECT array_agg(
            json_build_object(
                'question_id', question_id,
                'question', question,
                'topic', topic,
                'answer', answer,
                'accept_unanswered', accept_unanswered
            )
            ORDER BY question_id
        ) AS j
        FROM updated_search_preference_answer
        LEFT JOIN question
        ON question.id = question_id
        WHERE (
            SELECT COUNT(*) FROM updated_search_preference_answer
        ) <= {max_search_filter_answers}
        """

    with api_tx() as tx:
        answer = tx.execute(q, params).fetchone().get('j')
        if answer is None:
            return dict(error=error), 400
        else:
            return dict(answer=answer)

def get_search_clubs(s: t.SessionInfo, q: str):
    if not re.match(t.CLUB_PATTERN, q) or not len(q) <= t.CLUB_MAX_LEN:
        return []

    params = dict(
        person_id=s.person_id,
        search_string=q,
    )

    with api_tx('READ COMMITTED') as tx:
        return tx.execute(Q_SEARCH_CLUBS, params).fetchall()

def post_join_club(req: t.PostJoinClub, s: t.SessionInfo):
    params = dict(
        person_id=s.person_id,
        club_name=req.name,
    )

    with api_tx() as tx:
        tx.execute(Q_JOIN_CLUB, params)

def post_leave_club(req: t.PostLeaveClub, s: t.SessionInfo):
    params = dict(
        person_id=s.person_id,
        club_name=req.name,
    )

    with api_tx() as tx:
        tx.execute(Q_LEAVE_CLUB, params)

def get_update_notifications(email: str, type: str, frequency: str):
    params = dict(
        email=email,
        frequency=frequency,
    )

    if type == 'Intros':
        queries = [Q_UPDATE_INTROS_NOTIFICATIONS]
    elif type == 'Chats':
        queries = [Q_UPDATE_CHATS_NOTIFICATIONS]
    elif type == 'Every':
        queries = [Q_UPDATE_INTROS_NOTIFICATIONS, Q_UPDATE_CHATS_NOTIFICATIONS]
    else:
        return 'Invalid type', 400

    with api_tx('READ COMMITTED') as tx:
        query_results = [tx.execute(q, params).fetchone()['ok'] for q in queries]

    if all(query_results):
        return (
            f"✅ "
            f"<b>{type}</b> notification frequency set to "
            f"<b>{frequency}</b> for "
            f"<b>{email}</b>")
    else:
        return 'Invalid email address or notification frequency', 400

@lru_cache()
def get_stats(ttl_hash=None):
    with api_tx('READ COMMITTED') as tx:
        return tx.execute(Q_STATS).fetchone()

def get_admin_ban_link(token: str):
    params = dict(token=token)

    try:
        with api_tx('READ COMMITTED') as tx:
            rows = tx.execute(Q_CHECK_ADMIN_BAN_TOKEN, params).fetchall()
    except psycopg.errors.InvalidTextRepresentation:
        return 'Invalid token', 401

    if rows:
        link = f'https://api.duolicious.app/admin/ban/{token}'
        return f'<a href="{link}">{link}</a>'
    else:
        return 'Invalid token', 401

def get_admin_ban(token: str):
    params = dict(token=token)

    with api_tx('READ COMMITTED') as tx:
        rows = tx.execute(Q_ADMIN_BAN, params).fetchall()

    if rows:
        return f'Banned {rows}'
    else:
        return 'Ban failed', 401

def get_admin_delete_photo_link(token: str):
    params = dict(token=token)

    try:
        with api_tx('READ COMMITTED') as tx:
            rows = tx.execute(
                Q_CHECK_ADMIN_DELETE_PHOTO_TOKEN,
                params
            ).fetchall()
    except psycopg.errors.InvalidTextRepresentation:
        return 'Invalid token', 401

    if rows:
        link = f'https://api.duolicious.app/admin/delete-photo/{token}'
        return f'<a href="{link}">{link}</a>'
    else:
        return 'Invalid token', 401

def get_admin_delete_photo(token: str):
    params = dict(token=token)

    with api_tx('READ COMMITTED') as tx:
        rows = tx.execute(Q_ADMIN_DELETE_PHOTO, params).fetchall()

    if rows:
        return f'Deleted photo {rows}'
    else:
        return 'Photo deletion failed', 401
