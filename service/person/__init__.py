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
        tx.execute(Q_SELECT_ONBOARDEE_PHOTOS_TO_DELETE, params)
        previous_onboardee_photos = tx.fetchall()

    delete_images_from_object_store(
        row['uuid'] for row in previous_onboardee_photos)

    with transaction() as tx:
        tx.execute(Q_MAYBE_DELETE_ONBOARDEE, params)
        tx.execute(Q_MAYBE_SIGN_IN, params)
        row = tx.fetchone()
        if row:
            return dict(onboarded=row['person_id'] is not None)
        else:
            return 'Invalid OTP', 401

def post_sign_out(s: t.SessionInfo):
    params = dict(session_token_hash=s.session_token_hash)

    with transaction('READ COMMITTED') as tx:
        tx.execute(Q_DELETE_DUO_SESSION, params)

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

        # Delete existing onboardee photos in the given position, if any exist
        with transaction() as tx:
            tx.executemany(Q_SELECT_ONBOARDEE_PHOTO, params, returning=True)
            previous_onboardee_photos = fetchall_sets(tx)

        delete_images_from_object_store(
            row['uuid'] for row in previous_onboardee_photos)

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

    # We do this in two steps to ensure there's never any photos in object
    # storage which we're not tracking in the DB. However, there might be
    # entries in the DB which aren't in object storage. The front end deals with
    # that.

    with transaction() as tx:
        tx.executemany(Q_SELECT_ONBOARDEE_PHOTO, params, returning=True)
        previous_onboardee_photos = fetchall_sets(tx)

    delete_images_from_object_store(
        row['uuid'] for row in previous_onboardee_photos)

    with transaction() as tx:
        tx.executemany(Q_DELETE_ONBOARDEE_PHOTO, params)

def post_finish_onboarding(s: t.SessionInfo):
    params = dict(email=s.email)

    with transaction() as tx:
        tx.execute(Q_FINISH_ONBOARDING, params)

def get_me(person_id: int):
    params = dict(person_id=person_id)

    with transaction('READ COMMITTED') as tx:
        person = \
            tx.execute(Q_SELECT_ME_1, params).fetchone()
        personality = \
            tx.execute(Q_SELECT_ME_2, params).fetchall()

        try:
            return {
                'name': person['name'],
                'person_id': person['id'],
                'personality': [
                    {
                        'trait_id': trait['trait_id'],
                        'name': trait['name'],
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

    with transaction() as tx:
        row = tx.execute(Q_SELECT_PROSPECT_PROFILE, params).fetchone()
        if row:
            return row
        else:
            return '', 404
    return '', 500
