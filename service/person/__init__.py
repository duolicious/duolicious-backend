import os
from database import api_tx, fetchall_sets
from typing import Any, Optional, Iterable, Tuple, Literal
import duotypes as t
import json
import secrets
from duohash import sha512
from PIL import Image
import io
import boto3
from concurrent.futures import ThreadPoolExecutor, as_completed
from service.person.sql import *
from service.search.sql import *
from commonsql import *
from service.person.template import otp_template
import traceback
import re
from smtp import aws_smtp
from flask import request, send_file
from dataclasses import dataclass
import psycopg
from functools import lru_cache
from antiabuse.antispam.signupemail import (
    check_and_update_bad_domains,
    normalize_email,
)
from antiabuse.lodgereport import (
    skip_by_uuid,
)
from antiabuse.firehol import firehol
import blurhash
import numpy
import erlastic
from datetime import datetime, timezone
from duoaudio import put_audio_in_object_store
from service.person.aboutdiff import diff_addition_with_context
from verification.messages import (
    V_QUEUED,
    V_REUSED_SELFIE,
    V_UPLOADING_PHOTO,
)


class BytesEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, bytes):
            try:
                return obj.decode('utf-8')
            except:
                return str(obj)

        return super().default(obj)

DUO_ENV = os.environ['DUO_ENV']

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

@dataclass
class CropSize:
    top: int
    left: int

def process_image_as_image(
    image: Image.Image,
    output_size: Optional[int] = None,
    crop_size: Optional[CropSize] = None,
) -> io.BytesIO:
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

    return image.convert('RGB')

def process_image_as_bytes(
    base64_file: t.Base64File,
    format: Literal['raw', 'jpeg'],
    output_size: Optional[int] = None,
    crop_size: Optional[CropSize] = None,
) -> io.BytesIO:
    if format == 'raw':
        return io.BytesIO(base64_file.bytes)

    output_bytes = io.BytesIO()

    image = process_image_as_image(base64_file.image, output_size, crop_size)

    image.save(
        output_bytes,
        format=format,
        quality=85,
        subsampling=2,
        progressive=True,
        optimize=True,
    )

    output_bytes.seek(0)

    return output_bytes

def compute_blurhash(image: Image.Image, crop_size: Optional[CropSize] = None):
    image = process_image_as_image(image, output_size=32, crop_size=crop_size)

    return blurhash.encode(numpy.array(image.convert("RGB")))

def put_image_in_object_store(
    uuid: str,
    base64_file: t.Base64File,
    crop_size: CropSize,
    sizes: list[Literal[None, 900, 450]] = [None, 900, 450],
):
    key_img = [
        (
            f'{size if size else "original"}-{uuid}.jpg',
            process_image_as_bytes(
                base64_file=base64_file,
                format='jpeg',
                output_size=size,
                crop_size=None if size is None else crop_size
            )
        )
        for size in sizes
    ]

    if base64_file.image.format == 'GIF' and None in sizes:
        key_img.append((
            f'{uuid}.gif',
            process_image_as_bytes(base64_file=base64_file, format='raw')
        ))

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(bucket.put_object, Key=key, Body=img)
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
        subject="Sign in to Duolicious",
        body=otp_template(otp),
        to_addr=email,
        from_addr='noreply-otp@duolicious.app',
    )

def post_request_otp(req: t.PostRequestOtp):
    if not request.remote_addr or firehol.matches(request.remote_addr):
        return 'IP address blocked', 460

    if not check_and_update_bad_domains(req.email):
        return 'Disposable email', 400

    session_token = secrets.token_hex(64)
    session_token_hash = sha512(session_token)

    params = dict(
        email=req.email,
        normalized_email=normalize_email(req.email),
        pending_club_name=req.pending_club_name,
        is_dev=DUO_ENV == 'dev',
        session_token_hash=session_token_hash,
        ip_address=request.remote_addr,
    )

    with api_tx() as tx:
        rows = tx.execute(Q_INSERT_DUO_SESSION, params).fetchall()

    try:
        row, *_ = rows
        otp = row['otp']
    except:
        return 'Banned', 403

    _send_otp(req.email, otp)

    return dict(session_token=session_token)

def post_resend_otp(s: t.SessionInfo):
    if not request.remote_addr or firehol.matches(request.remote_addr):
        return 'IP address blocked', 460

    params = dict(
        email=s.email,
        normalized_email=normalize_email(s.email),
        is_dev=DUO_ENV == 'dev',
        session_token_hash=s.session_token_hash,
        ip_address=request.remote_addr,
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
    if not request.remote_addr or firehol.matches(request.remote_addr):
        return 'IP address blocked', 460

    params = dict(
        otp=req.otp,
        session_token_hash=s.session_token_hash,
        pending_club_name=s.pending_club_name,
    )

    with api_tx() as tx:
        tx.execute(Q_MAYBE_DELETE_ONBOARDEE, params)
        tx.execute(Q_MAYBE_SIGN_IN, params)
        row = tx.fetchone()

        if not row:
            return 'Invalid OTP', 401

        club_params = dict(
            person_id=s.person_id,
            club_name=s.pending_club_name,
            pending_club_name=s.pending_club_name,
            do_modify=True,
        )

        if \
                club_params['person_id'] is not None and \
                club_params['club_name'] is not None:
            tx.execute(Q_JOIN_CLUB, club_params)
            tx.execute(Q_UPSERT_SEARCH_PREFERENCE_CLUB, club_params)

        clubs = tx.execute(Q_GET_SESSION_CLUBS, club_params).fetchone()

    params = dict(person_uuid=row['person_uuid'])

    with api_tx('read committed') as tx:
        tx.execute(Q_UPSERT_LAST, params)

    return dict(
        onboarded=row['person_id'] is not None,
        **row,
        **clubs,
    )

def post_sign_out(s: t.SessionInfo):
    params = dict(session_token_hash=s.session_token_hash)

    with api_tx('READ COMMITTED') as tx:
        tx.execute(Q_DELETE_DUO_SESSION, params)

def post_check_session_token(s: t.SessionInfo):
    params = dict(
        person_id=s.person_id,
        pending_club_name=s.pending_club_name,
    )

    with api_tx() as tx:
        row = tx.execute(Q_CHECK_SESSION_TOKEN, params).fetchone()

        if not row:
            return 'Invalid token', 401

        club_params = dict(
            person_id=s.person_id,
            pending_club_name=s.pending_club_name,
        )

        clubs = tx.execute(Q_GET_SESSION_CLUBS, club_params).fetchone()

        return dict(
            person_id=s.person_id,
            person_uuid=s.person_uuid,
            onboarded=s.onboarded,
            **row,
            **clubs,
        )

def patch_onboardee_info(req: t.PatchOnboardeeInfo, s: t.SessionInfo):
    [field_name] = req.__pydantic_fields_set__
    field_value = req.dict()[field_name]

    if field_name in ['name', 'date_of_birth']:
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
        base64_file = t.Base64File(**field_value)

        crop_size = CropSize(
                top=base64_file.top,
                left=base64_file.left)
        uuid = secrets.token_hex(32)
        blurhash_ = compute_blurhash(base64_file.image, crop_size=crop_size)
        extra_exts = ['gif'] if base64_file.image.format == 'GIF' else []

        params = dict(
            email=s.email,
            position=base64_file.position,
            uuid=uuid,
            blurhash=blurhash_,
            extra_exts=extra_exts,
            hash=base64_file.md5_hash,
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
                    uuid,
                    blurhash,
                    extra_exts,
                    hash
                ) VALUES (
                    %(email)s,
                    %(position)s,
                    %(uuid)s,
                    %(blurhash)s,
                    %(extra_exts)s,
                    %(hash)s
                ) ON CONFLICT (email, position) DO UPDATE SET
                    uuid = EXCLUDED.uuid,
                    blurhash = EXCLUDED.blurhash,
                    extra_exts = EXCLUDED.extra_exts
            )
            SELECT 1
            """

        with api_tx() as tx:
            tx.execute(q_set_onboardee_field, params)

        try:
            put_image_in_object_store(uuid, base64_file, crop_size)
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
    api_params = dict(
        email=s.email,
        normalized_email=normalize_email(s.email),
        pending_club_name=s.pending_club_name,
    )

    with api_tx() as tx:
        tx.execute('SET LOCAL statement_timeout = 15000') # 15 seconds
        tx.execute(Q_FINISH_ONBOARDING, params=api_params)
        row = tx.fetchone()

        club_params = dict(
            person_id=row['person_id'],
            club_name=s.pending_club_name,
            pending_club_name=s.pending_club_name,
            do_modify=True,
        )

        if \
                club_params['person_id'] is not None and \
                club_params['club_name'] is not None:
            tx.execute(Q_JOIN_CLUB, club_params)
            tx.execute(Q_UPSERT_SEARCH_PREFERENCE_CLUB, club_params)

        clubs = tx.execute(Q_GET_SESSION_CLUBS, club_params).fetchone()

    chat_params = dict(
        person_id=row['person_id'],
        person_uuid=row['person_uuid'],
    )

    with api_tx('read committed') as tx:
        tx.execute(Q_UPSERT_LAST, params=chat_params)

    return dict(**row, **clubs)

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

def get_prospect_profile(s: t.SessionInfo, prospect_uuid):
    params = dict(
        person_id=s.person_id,
        prospect_uuid=prospect_uuid,
    )

    with api_tx('READ COMMITTED') as tx:
        api_row = tx.execute(Q_SELECT_PROSPECT_PROFILE, params).fetchone()
        if not api_row:
            return '', 404

        profile = api_row.get('j')
        if not profile:
            return '', 404

    # Timeout in case someone with lots of messages hogs CPU time
    try:
        with api_tx('READ COMMITTED') as tx:
            tx.execute('SET LOCAL statement_timeout = 1000') # 1 second

            message_stats = tx.execute(Q_MESSAGE_STATS, params).fetchone()
    except psycopg.errors.QueryCanceled:
        message_stats = dict(
            gets_reply_percentage=None,
            gives_reply_percentage=None,
        )

    with api_tx('READ COMMITTED') as tx:
        chat_row = tx.execute(Q_LAST_ONLINE, params).fetchone()

    # Sometimes the chat service might not register a last online time. In that
    # case, we fall back to the less-accurate recording given by the API
    # database.
    profile['seconds_since_last_online'] = int(
        chat_row.get('seconds_since_last_online')
        or
        profile['seconds_since_last_online']
    )

    profile.update(message_stats)

    return profile

def post_skip_by_uuid(req: t.PostSkip, s: t.SessionInfo, prospect_uuid: str):
    if not s.person_uuid:
        return 'Authentication required', 401

    skip_by_uuid(
        subject_uuid=s.person_uuid,
        object_uuid=prospect_uuid,
        reason=req.report_reason or '',
    )


def post_unskip(s: t.SessionInfo, prospect_person_id: int):
    params = dict(
        subject_person_id=s.person_id,
        object_person_id=prospect_person_id,
    )

    with api_tx() as tx:
        tx.execute(Q_DELETE_SKIPPED, params)

def post_unskip_by_uuid(s: t.SessionInfo, prospect_uuid: str):
    params = dict(
        subject_person_id=s.person_id,
        prospect_uuid=prospect_uuid,
    )

    with api_tx() as tx:
        tx.execute(Q_DELETE_SKIPPED_BY_UUID, params)

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
        prospect_person_uuids=req.person_uuids
    )

    with api_tx('READ COMMITTED') as tx:
        return tx.execute(Q_INBOX_INFO, params).fetchall()

def delete_or_ban_account(
    s: Optional[t.SessionInfo],
    admin_ban_token: Optional[str] = None,
):
    with api_tx() as tx:
        tx.execute('SET LOCAL statement_timeout = 30_000')  # 30 seconds

        if admin_ban_token:
            rows = tx.execute(
                Q_ADMIN_BAN,
                params=dict(token=admin_ban_token)
            ).fetchall()
        elif s:
            rows = [
                dict(
                    person_id=s.person_id,
                    person_uuid=s.person_uuid
                )
            ]
        else:
            raise ValueError('At least one parameter must not be None')

        tx.executemany(Q_DELETE_ACCOUNT, params_seq=rows)

    return rows

def post_deactivate(s: t.SessionInfo):
    params = dict(person_id=s.person_id)

    with api_tx() as tx:
        tx.execute(Q_POST_DEACTIVATE, params)

def get_profile_info(s: t.SessionInfo):
    params = dict(person_id=s.person_id)

    with api_tx('READ COMMITTED') as tx:
        return tx.execute(Q_GET_PROFILE_INFO, params).fetchone()['j']

def delete_profile_info(req: t.DeleteProfileInfo, s: t.SessionInfo):
    files_params = [
        dict(person_id=s.person_id, position=position)
        for position in req.files or []
    ]

    audio_files_params = [
        dict(person_id=s.person_id, position=-1)
        for position in req.audio_files or []
    ]

    if files_params:
        with api_tx() as tx:
            tx.executemany(Q_DELETE_PROFILE_INFO_PHOTO, files_params)
            tx.execute(Q_UPDATE_VERIFICATION_LEVEL, files_params[0])

    if audio_files_params:
        with api_tx() as tx:
            tx.executemany(Q_DELETE_PROFILE_INFO_AUDIO, audio_files_params)

def _patch_profile_info_about(person_id: int, new_about: str):
    select = """
    SELECT about AS old_about FROM person WHERE id = %(person_id)s
    """

    update = """
    WITH updated_person AS (
        UPDATE person
        SET
            about = %(new_about)s::TEXT,

            last_event_time =
                CASE
                    WHEN %(added_text)s::TEXT IS NULL
                    THEN sign_up_time
                    ELSE now()
                END,

            last_event_name =
                CASE
                    WHEN %(added_text)s::TEXT IS NULL
                    THEN 'joined'::person_event
                    ELSE 'updated-bio'::person_event
                END,

            last_event_data =
                CASE
                    WHEN %(added_text)s::TEXT IS NULL
                    THEN
                        '{}'::JSONB
                    ELSE
                        jsonb_build_object(
                            'added_text', %(added_text)s::TEXT,
                            'body_color', body_color,
                            'background_color', background_color
                        )
                END
        WHERE
            id = %(person_id)s
    ), updated_unmoderated_person AS (
        INSERT INTO
            unmoderated_person (person_id, trait)
        VALUES
            (%(person_id)s, 'about')
        ON CONFLICT DO NOTHING
    )
    SELECT 1
    """

    with api_tx() as tx:
        select_params = dict(
            person_id=person_id,
        )

        tx.execute(select, select_params)

        old_about = tx.fetchone()['old_about']

        update_params = dict(
            person_id=person_id,
            new_about=new_about,
            added_text=diff_addition_with_context(old=old_about, new=new_about),
        )

        tx.execute(update, update_params)

def patch_profile_info(req: t.PatchProfileInfo, s: t.SessionInfo):
    if not s.person_id:
        return 'Not authorized', 400

    [field_name] = req.__pydantic_fields_set__
    field_value = req.dict()[field_name]

    params = dict(
        person_id=s.person_id,
        field_value=field_value,
    )

    q1 = None
    q2 = None

    uuid = None
    base64_file = None
    crop_size = None

    base64_audio_file = None

    if field_name == 'base64_file':
        base64_file = t.Base64File(**field_value)

        crop_size = CropSize(
                top=base64_file.top,
                left=base64_file.left)
        uuid = secrets.token_hex(32)
        blurhash_ = compute_blurhash(base64_file.image, crop_size=crop_size)
        extra_exts = ['gif'] if base64_file.image.format == 'GIF' else []

        params = dict(
            person_id=s.person_id,
            position=base64_file.position,
            uuid=uuid,
            blurhash=blurhash_,
            extra_exts=extra_exts,
            hash=base64_file.md5_hash,
        )

        q1 = """
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
                uuid,
                blurhash,
                extra_exts,
                hash
            ) VALUES (
                %(person_id)s,
                %(position)s,
                %(uuid)s,
                %(blurhash)s,
                %(extra_exts)s,
                %(hash)s
            ) ON CONFLICT (person_id, position) DO UPDATE SET
                uuid = EXCLUDED.uuid,
                blurhash = EXCLUDED.blurhash,
                extra_exts = EXCLUDED.extra_exts,
                hash = EXCLUDED.hash,
                verified = FALSE
        ), updated_person AS (
            UPDATE person
            SET
                last_event_time = now(),
                last_event_name = 'added-photo',
                last_event_data = jsonb_build_object(
                    'added_photo_uuid', %(uuid)s,
                    'added_photo_blurhash', %(blurhash)s,
                    'added_photo_extra_exts', %(extra_exts)s::TEXT[]
                )
            WHERE
                id = %(person_id)s
        )
        SELECT 1
        """

        q2 = Q_UPDATE_VERIFICATION_LEVEL
    elif field_name == 'base64_audio_file':
        base64_audio_file = t.Base64AudioFile(**field_value)

        uuid = secrets.token_hex(32)

        params = dict(
            person_id=s.person_id,
            uuid=uuid,
        )

        q1 = """
        WITH existing_uuid AS (
            SELECT
                uuid
            FROM
                audio
            WHERE
                person_id = %(person_id)s
            AND
                position = -1
        ), undeleted_audio_insertion AS (
            INSERT INTO undeleted_audio (
                uuid
            )
            SELECT
                uuid
            FROM
                existing_uuid
        ), audio_insertion AS (
            INSERT INTO audio (
                person_id,
                position,
                uuid
            ) VALUES (
                %(person_id)s,
                -1,
                %(uuid)s
            ) ON CONFLICT (person_id, position) DO UPDATE SET
                uuid = EXCLUDED.uuid
        ), updated_person AS (
            UPDATE person
            SET
                last_event_time = now(),
                last_event_name = 'added-voice-bio',
                last_event_data = jsonb_build_object(
                    'added_audio_uuid', %(uuid)s
                )
            WHERE
                id = %(person_id)s
        )
        SELECT 1
        """
    elif field_name == 'photo_assignments':
        case_sql = '\n'.join(
            f'WHEN position = {int(k)} THEN {int(v)}'
            for k, v in field_value.items()
        )

        # We set the positions to negative indexes first, to avoid violating
        # uniqueness constraints
        q1 = f"""
        UPDATE
            photo
        SET
            position = - (CASE {case_sql} ELSE position END)
        WHERE
            person_id = %(person_id)s
        """

        q2 = """
        UPDATE
            photo
        SET
            position = ABS(position)
        WHERE
            person_id = %(person_id)s
        """
    elif field_name == 'name':
        q1 = """
        UPDATE person
        SET name = %(field_value)s
        WHERE id = %(person_id)s
        """
    elif field_name == 'about':
        return _patch_profile_info_about(s.person_id, field_value)
    elif field_name == 'gender':
        q1 = """
        UPDATE person
        SET gender_id = gender.id, verified_gender = false
        FROM gender
        WHERE person.id = %(person_id)s
        AND gender.name = %(field_value)s
        AND person.gender_id <> gender.id
        """

        q2 = Q_UPDATE_VERIFICATION_LEVEL
    elif field_name == 'orientation':
        q1 = """
        UPDATE person SET orientation_id = orientation.id
        FROM orientation
        WHERE person.id = %(person_id)s
        AND orientation.name = %(field_value)s
        """
    elif field_name == 'ethnicity':
        q1 = """
        UPDATE person
        SET ethnicity_id = ethnicity.id, verified_ethnicity = false
        FROM ethnicity
        WHERE person.id = %(person_id)s
        AND ethnicity.name = %(field_value)s
        AND person.ethnicity_id <> ethnicity.id
        """

        q2 = Q_UPDATE_VERIFICATION_LEVEL
    elif field_name == 'location':
        q1 = """
        UPDATE person
        SET
            coordinates
                = location.coordinates,
            verification_required
                = location.verification_required OR person.verification_required
        FROM location
        WHERE person.id = %(person_id)s
        AND long_friendly = %(field_value)s
        """
    elif field_name == 'occupation':
        q1 = """
        UPDATE person SET occupation = %(field_value)s
        WHERE person.id = %(person_id)s
        """
    elif field_name == 'education':
        q1 = """
        UPDATE person SET education = %(field_value)s
        WHERE person.id = %(person_id)s
        """
    elif field_name == 'height':
        q1 = """
        UPDATE person SET height_cm = %(field_value)s
        WHERE person.id = %(person_id)s
        """
    elif field_name == 'looking_for':
        q1 = """
        UPDATE person SET looking_for_id = looking_for.id
        FROM looking_for
        WHERE person.id = %(person_id)s
        AND looking_for.name = %(field_value)s
        """
    elif field_name == 'smoking':
        q1 = """
        UPDATE person SET smoking_id = yes_no_optional.id
        FROM yes_no_optional
        WHERE person.id = %(person_id)s
        AND yes_no_optional.name = %(field_value)s
        """
    elif field_name == 'drinking':
        q1 = """
        UPDATE person SET drinking_id = frequency.id
        FROM frequency
        WHERE person.id = %(person_id)s
        AND frequency.name = %(field_value)s
        """
    elif field_name == 'drugs':
        q1 = """
        UPDATE person SET drugs_id = yes_no_optional.id
        FROM yes_no_optional
        WHERE person.id = %(person_id)s
        AND yes_no_optional.name = %(field_value)s
        """
    elif field_name == 'long_distance':
        q1 = """
        UPDATE person SET long_distance_id = yes_no_optional.id
        FROM yes_no_optional
        WHERE person.id = %(person_id)s
        AND yes_no_optional.name = %(field_value)s
        """
    elif field_name == 'relationship_status':
        q1 = """
        UPDATE person SET relationship_status_id = relationship_status.id
        FROM relationship_status
        WHERE person.id = %(person_id)s
        AND relationship_status.name = %(field_value)s
        """
    elif field_name == 'has_kids':
        q1 = """
        UPDATE person SET has_kids_id = yes_no_maybe.id
        FROM yes_no_maybe
        WHERE person.id = %(person_id)s
        AND yes_no_maybe.name = %(field_value)s
        """
    elif field_name == 'wants_kids':
        q1 = """
        UPDATE person SET wants_kids_id = yes_no_maybe.id
        FROM yes_no_maybe
        WHERE person.id = %(person_id)s
        AND yes_no_maybe.name = %(field_value)s
        """
    elif field_name == 'exercise':
        q1 = """
        UPDATE person SET exercise_id = frequency.id
        FROM frequency
        WHERE person.id = %(person_id)s
        AND frequency.name = %(field_value)s
        """
    elif field_name == 'religion':
        q1 = """
        UPDATE person SET religion_id = religion.id
        FROM religion
        WHERE person.id = %(person_id)s
        AND religion.name = %(field_value)s
        """
    elif field_name == 'star_sign':
        q1 = """
        UPDATE person SET star_sign_id = star_sign.id
        FROM star_sign
        WHERE person.id = %(person_id)s
        AND star_sign.name = %(field_value)s
        """
    elif field_name == 'units':
        q1 = """
        UPDATE person SET unit_id = unit.id
        FROM unit
        WHERE person.id = %(person_id)s
        AND unit.name = %(field_value)s
        """
    elif field_name == 'chats':
        q1 = """
        UPDATE person SET chats_notification = immediacy.id
        FROM immediacy
        WHERE person.id = %(person_id)s
        AND immediacy.name = %(field_value)s
        """
    elif field_name == 'intros':
        q1 = """
        UPDATE person SET intros_notification = immediacy.id
        FROM immediacy
        WHERE person.id = %(person_id)s
        AND immediacy.name = %(field_value)s
        """
    elif field_name == 'verification_level':
        q1 = """
        UPDATE person
        SET privacy_verification_level_id = verification_level.id
        FROM verification_level
        WHERE person.id = %(person_id)s AND
        verification_level.name = %(field_value)s
        """
    elif field_name == 'show_my_location':
        q1 = """
        UPDATE person
        SET show_my_location = (
            CASE WHEN %(field_value)s = 'Yes' THEN TRUE ELSE FALSE END)
        WHERE id = %(person_id)s
        """
    elif field_name == 'show_my_age':
        q1 = """
        UPDATE person
        SET show_my_age = (
            CASE WHEN %(field_value)s = 'Yes' THEN TRUE ELSE FALSE END)
        WHERE id = %(person_id)s
        """
    elif field_name == 'hide_me_from_strangers':
        q1 = """
        UPDATE person
        SET hide_me_from_strangers = (
            CASE WHEN %(field_value)s = 'Yes' THEN TRUE ELSE FALSE END)
        WHERE id = %(person_id)s
        """
    elif field_name == 'theme':
        try:
            title_color = field_value['title_color']
            body_color = field_value['body_color']
            background_color = field_value['background_color']

            params.update(
                dict(
                    title_color=title_color,
                    body_color=body_color,
                    background_color=background_color,
                )
            )
        except:
            return f'Invalid colors', 400

        q1 = """
        UPDATE person
        SET
            title_color = %(title_color)s,
            body_color = %(body_color)s,
            background_color = %(background_color)s
        WHERE id = %(person_id)s
        """
    else:
        return f'Unhandled field name {field_name}', 500

    with api_tx() as tx:
        if q1: tx.execute(q1, params)
        if q2: tx.execute(q2, params)

    if uuid and base64_file and crop_size:
        try:
            put_image_in_object_store(uuid, base64_file, crop_size)
        except:
            print(traceback.format_exc())
            return '', 500

    if uuid and base64_audio_file:
        try:
            put_audio_in_object_store(
                uuid=uuid,
                audio_file_bytes=base64_audio_file.transcoded,
            )
        except:
            print(traceback.format_exc())
            return '', 500

def get_search_filters(s: t.SessionInfo):
    return get_search_filters_by_person_id(person_id=s.person_id)

def get_search_filters_by_person_id(person_id: Optional[int]):
    params = dict(person_id=person_id)

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
        elif field_name == 'ethnicity':
            q1 = """
            DELETE FROM search_preference_ethnicity
            WHERE person_id = %(person_id)s"""

            q2 = """
            INSERT INTO search_preference_ethnicity (
                person_id, ethnicity_id
            )
            SELECT %(person_id)s, id
            FROM ethnicity WHERE name = ANY(%(field_value)s)
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

def get_search_clubs(
        s: Optional[t.SessionInfo],
        search_str: str,
        allow_empty: bool = False):

    lower_search_str = search_str.lower().strip()

    if allow_empty and not lower_search_str:
        pass
    elif not re.match(t.CLUB_PATTERN, lower_search_str):
        return []
    elif not len(lower_search_str) <= t.CLUB_MAX_LEN:
        return []

    params = dict(
        person_id=s.person_id if s else None,
        search_string=lower_search_str,
    )

    q = Q_SEARCH_CLUBS if lower_search_str else Q_TOP_CLUBS

    with api_tx('READ COMMITTED') as tx:
        return tx.execute(q, params).fetchall()

def post_join_club(req: t.PostJoinClub, s: t.SessionInfo):
    params = dict(
        person_id=s.person_id,
        club_name=req.name,
    )

    with api_tx() as tx:
        rows = tx.execute(Q_JOIN_CLUB, params).fetchall()

    if rows:
        return f"Joined {req.name}", 200
    else:
        return f"Couldn't join {req.name}", 400

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

def post_verification_selfie(req: t.PostVerificationSelfie, s: t.SessionInfo):
    base64 = req.base64_file.base64
    image = req.base64_file.image
    top = req.base64_file.top
    left = req.base64_file.left
    hash = req.base64_file.md5_hash

    crop_size = CropSize(top=top, left=left)
    photo_uuid = secrets.token_hex(32)

    params_ok = dict(
        person_id=s.person_id,
        photo_uuid=photo_uuid,
        photo_hash=hash,
        expected_previous_status=None,
    )

    params_bad = dict(
        person_id=s.person_id,
        status='failure',
        message=V_REUSED_SELFIE,
        expected_previous_status=None,
    )

    with api_tx() as tx:
        if tx.execute(Q_INSERT_VERIFICATION_PHOTO_HASH, params_ok).fetchall():
            tx.execute(Q_DELETE_VERIFICATION_JOB, params_ok)
            tx.execute(Q_INSERT_VERIFICATION_JOB, params_ok)
        else:
            tx.execute(Q_UPDATE_VERIFICATION_JOB, params_bad)

    try:
        put_image_in_object_store(
            photo_uuid, req.base64_file, crop_size, sizes=[450])
    except Exception as e:
        print('Upload failed with exception:', e)
        return '', 500

def post_verify(s: t.SessionInfo):
    params = dict(
        person_id=s.person_id,
        status='queued',
        message=V_QUEUED,
        expected_previous_status='uploading-photo',
    )

    with api_tx() as tx:
        tx.execute(Q_UPDATE_VERIFICATION_JOB, params)

def get_check_verification(s: t.SessionInfo):
    with api_tx() as tx:
        row = tx.execute(
            Q_CHECK_VERIFICATION,
            dict(person_id=s.person_id)
        ).fetchone()

    if row:
        return row
    return '', 400

def post_dismiss_donation(s: t.SessionInfo):
    with api_tx() as tx:
        tx.execute(Q_DISMISS_DONATION, dict(person_id=s.person_id))

@lru_cache()
def get_stats(ttl_hash=None, club_name: Optional[str] = None):
    if club_name:
        q, params = Q_STATS_BY_CLUB_NAME, dict(club_name=club_name)
    else:
        q, params = Q_STATS, None

    with api_tx('READ COMMITTED') as tx:
        return tx.execute(q, params).fetchone()

@lru_cache()
def get_gender_stats(ttl_hash=None):
    with api_tx('READ COMMITTED') as tx:
        return tx.execute(Q_GENDER_STATS).fetchone()

def get_admin_ban_link(token: str):
    params = dict(token=token)

    err_invalid_token = (
        'Invalid token. User might have already been banned', 401)

    try:
        with api_tx() as tx:
            person_uuid = tx.execute(
                Q_ADMIN_TOKEN_TO_UUID,
                params,
            ).fetchone()['person_uuid']
    except TypeError:
        return err_invalid_token

    try:
        with api_tx('READ COMMITTED') as tx:
            rows = tx.execute(Q_CHECK_ADMIN_BAN_TOKEN, params).fetchall()
    except psycopg.errors.InvalidTextRepresentation:
        return err_invalid_token

    if rows:
        link = f'https://api.duolicious.app/admin/ban/{token}'
        return f'<a href="{link}">Click to confirm. Token: {token}</a>'
    else:
        return err_invalid_token

def get_admin_ban(token: str):
    rows = delete_or_ban_account(s=None, admin_ban_token=token)

    if rows:
        return f'Banned {rows}'
    else:
        return 'Ban failed; User already banned or token invalid', 401

def get_admin_delete_photo_link(token: str):
    params = dict(token=token)

    try:
        with api_tx('READ COMMITTED') as tx:
            tx.execute(Q_CHECK_ADMIN_DELETE_PHOTO_TOKEN, params)
            rows = tx.fetchall()
    except psycopg.errors.InvalidTextRepresentation:
        return 'Invalid token', 401

    if rows:
        link = f'https://api.duolicious.app/admin/delete-photo/{token}'
        return f'<a href="{link}">Click to confirm. Token {token}</a>'
    else:
        return 'Invalid token', 401

def get_admin_delete_photo(token: str):
    params = dict(token=token)

    with api_tx('READ COMMITTED') as tx:
        rows = tx.execute(Q_ADMIN_DELETE_PHOTO, params).fetchall()

        if rows:
            params = dict(person_id=rows[0]['person_id'])
            tx.execute(Q_UPDATE_VERIFICATION_LEVEL, params)

    if rows:
        return f'Deleted photo {rows}'
    else:
        return 'Photo deletion failed', 401

def get_export_data_token(s: t.SessionInfo):
    params = dict(person_id=s.person_id)

    with api_tx() as tx:
        return tx.execute(Q_INSERT_EXPORT_DATA_TOKEN, params).fetchone()

def get_export_data(token: str):
    token_params = dict(token=token)

    # Fetch data from database
    with api_tx('read committed') as tx:
        params = tx.execute(Q_CHECK_EXPORT_DATA_TOKEN, token_params).fetchone()

    if not params:
        return 'Invalid token. Link might have expired.', 401

    with api_tx('read committed') as tx:
        raw_data = tx.execute(Q_EXPORT_API_DATA, params).fetchone()['j']

    person_id = params['person_id']

    inferred_personality_data = get_me(person_id_as_int=person_id)

    search_filters = get_search_filters_by_person_id(person_id=person_id)

    # Redact sensitive fields
    for person in raw_data['person']:
        del person['id_salt']

    # Decode messages
    for row in raw_data['mam_message'] or []:
        row['timestamp'] = datetime.fromtimestamp(
            timestamp=(row['id'] >> 8) / 1_000_000,
            tz=timezone.utc,
        ).isoformat()

        # this is a json string that looks like: \x836804640005786d6c656c6d00000
        message = row['message']

        # Remove the \x prefix
        no_prefix = message[2:]

        # Bytes object
        json_decoded = bytes.fromhex(no_prefix)

        erlang_decoded = erlastic.decode(json_decoded)

        row['message'] = json.dumps(erlang_decoded, cls=BytesEncoder)

    # Return the result
    exported_dict = dict(
        raw_data=raw_data,
        inferred_personality_data=inferred_personality_data,
        search_filters=search_filters,
    )

    exported_string = json.dumps(exported_dict, indent=2)

    exported_bytes = exported_string.encode()

    exported_bytesio = io.BytesIO(exported_bytes)

    return send_file(
        exported_bytesio,
        mimetype='text/json',
        as_attachment=True,
        download_name='export.json',
    )

def post_kofi_donation(req: t.PostKofiData):
    if req.currency.lower() != 'usd':
        return

    params = dict(
        token_hash=sha512(req.verification_token),
        amount=req.amount,
    )

    with api_tx() as tx:
        tx.execute(Q_KOFI_DONATION, params)
