import os
import psycopg
from database import transaction, fetchall_sets
from typing import DefaultDict, Optional, Iterable, Tuple
import service.question as question
import duotypes as t
import urllib.request
import json
import secrets
from duohash import sha512
from PIL import Image
import io
import boto3
from concurrent.futures import ThreadPoolExecutor, as_completed

ENV = os.environ['DUO_ENV']

EMAIL_KEY = os.environ['DUO_EMAIL_KEY']
EMAIL_URL = os.environ['DUO_EMAIL_URL']

R2_ACCT_ID = os.environ['DUO_R2_ACCT_ID']
R2_ACCESS_KEY_ID = os.environ['DUO_R2_ACCESS_KEY_ID']
R2_ACCESS_KEY_SECRET = os.environ['DUO_R2_ACCESS_KEY_SECRET']
R2_BUCKET_NAME = os.environ['DUO_R2_BUCKET_NAME']

Q_DELETE_ANSWER = """
DELETE FROM answer
WHERE person_id = %(person_id)s
AND question_id = %(question_id)s
"""

Q_SET_ANSWER = """
INSERT INTO answer (
    person_id,
    question_id,
    answer,
    public_
) VALUES (
    %(person_id)s,
    %(question_id)s,
    %(answer)s,
    %(public)s
) ON CONFLICT (person_id, question_id) DO UPDATE SET
    answer  = EXCLUDED.answer,
    public_ = EXCLUDED.public_
"""

Q_SET_PERSON_TRAIT_STATISTIC = """
WITH
existing_answer AS (
    SELECT
        person_id,
        question_id,
        answer
    FROM answer
    WHERE person_id = %(person_id)s
    AND question_id = %(question_id)s
),
score AS (
    SELECT
        person_id,
        trait_id,
        CASE
        WHEN existing_answer.answer = TRUE
            THEN presence_given_yes
            ELSE presence_given_no
        END AS presence_score,
        CASE
        WHEN existing_answer.answer = TRUE
            THEN absence_given_yes
            ELSE absence_given_no
        END AS absence_score
    FROM question_trait_pair
    JOIN existing_answer
    ON existing_answer.question_id = question_trait_pair.question_id
),
score_delta_magnitude AS (
    SELECT
        person_id,
        trait_id,
        presence_score - LEAST(presence_score, absence_score) AS presence_delta_magnitude,
        absence_score  - LEAST(presence_score, absence_score) AS absence_delta_magnitude
    FROM score
),
score_delta AS (
    SELECT
        person_id,
        trait_id,
        %(weight)s * presence_delta_magnitude AS presence_delta,
        %(weight)s * absence_delta_magnitude  AS absence_delta
    FROM score_delta_magnitude
),
new_scores AS (
    SELECT
        sd.person_id,
        sd.trait_id,
        COALESCE(pts.presence_score, 0) + sd.presence_delta,
        COALESCE(pts.absence_score, 0)  + sd.absence_delta
    FROM score_delta sd
    LEFT JOIN person_trait_statistic pts
    ON
        sd.person_id = pts.person_id AND
        sd.trait_id  = pts.trait_id
)
INSERT INTO person_trait_statistic (
    person_id,
    trait_id,
    presence_score,
    absence_score
)
SELECT * FROM new_scores
ON CONFLICT (person_id, trait_id) DO UPDATE SET
    presence_score = EXCLUDED.presence_score,
    absence_score  = EXCLUDED.absence_score
"""

Q_SELECT_PERSONALITY = """
WITH
coalesced AS (
    SELECT
        trait,
        COALESCE(presence_score, 0) AS presence_score,
        COALESCE(absence_score, 0) AS absence_score
    FROM trait
    LEFT JOIN person_trait_statistic
    ON trait.id = person_trait_statistic.trait_id
    WHERE person_id = %(person_id)s
)
SELECT
    trait,
    CASE
    WHEN presence_score + absence_score < 1000
        THEN NULL
        ELSE round(100 * presence_score / (presence_score + absence_score))::int
    END AS percentage
FROM coalesced
"""

Q_INSERT_DUO_SESSION = """
INSERT INTO duo_session (
    session_token_hash,
    person_id,
    email,
    otp
) VALUES (
    %(session_token_hash)s,
    (SELECT id FROM person WHERE email = %(email)s),
    %(email)s,
    %(otp)s
)
"""

Q_UPDATE_OTP = """
UPDATE duo_session
SET
    otp = %(otp)s,
    otp_expiry = NOW() + INTERVAL '1 minute'
WHERE session_token_hash = %(session_token_hash)s
"""

Q_MAYBE_DELETE_ONBOARDEE = """
WITH
valid_session AS (
    UPDATE duo_session
    SET signed_in = TRUE
    WHERE
        session_token_hash = %(session_token_hash)s AND
        otp = %(otp)s AND
        otp_expiry > NOW()
    RETURNING email
)
DELETE FROM onboardee
WHERE email IN (SELECT email FROM valid_session)
RETURNING email
"""

Q_MAYBE_SIGN_IN = """
WITH
valid_session AS (
    UPDATE duo_session
    SET signed_in = TRUE
    WHERE
        session_token_hash = %(session_token_hash)s AND
        otp = %(otp)s AND
        otp_expiry > NOW()
    RETURNING person_id, email
),
existing_person AS (
    SELECT person_id
    FROM valid_session
    WHERE person_id IS NOT NULL
),
new_onboardee AS (
    INSERT INTO onboardee (
        email
    )
    SELECT email
    FROM valid_session
    WHERE NOT EXISTS (SELECT 1 FROM existing_person)
)
SELECT * FROM valid_session
"""

Q_SELECT_ONBOARDEE_PHOTO = """
SELECT uuid
FROM onboardee_photo
WHERE
    email = %(email)s AND
    position = %(position)s
"""

Q_DELETE_ONBOARDEE_PHOTO = """
DELETE FROM onboardee_photo
WHERE
    email = %(email)s AND
    position = %(position)s
"""

Q_SELECT_ONBOARDEE_PHOTOS_TO_DELETE = """
WITH
valid_session AS (
    SELECT email
    FROM duo_session
    WHERE
        session_token_hash = %(session_token_hash)s AND
        otp = %(otp)s AND
        otp_expiry > NOW()
)
SELECT uuid
FROM onboardee_photo
WHERE email IN (SELECT email from valid_session)
"""

Q_DELETE_DUO_SESSION = """
DELETE FROM duo_session
WHERE session_token_hash = %(session_token_hash)s
"""

Q_FINISH_ONBOARDING_1 = """
WITH
onboardee_country AS (
    SELECT country
    FROM location
    ORDER BY location.coordinates <-> (
        SELECT coordinates
        FROM onboardee
        WHERE email = %(email)s
    )
    LIMIT 1
),
new_person AS (
    INSERT INTO person (
        email,
        name,
        date_of_birth,
        coordinates,
        gender_id,
        about,

        verified,

        unit_id,

        chats_notification,
        intros_notification,
        visitors_notification
    ) SELECT
        email,
        name,
        date_of_birth,
        coordinates,
        gender_id,
        about,

        (SELECT id FROM yes_no WHERE name = 'No'),

        (
            SELECT id
            FROM unit
            WHERE name IN (
                SELECT
                    CASE
                    WHEN country = 'United States'
                        THEN 'Imperial'
                        ELSE 'Metric'
                    END AS name
                FROM onboardee_country
            )
        ),

        (SELECT id FROM immediacy WHERE name = 'Immediately'),
        (SELECT id FROM immediacy WHERE name = 'Immediately'),
        (SELECT id FROM immediacy WHERE name = 'Daily')
    FROM onboardee
    WHERE email = %(email)s
    RETURNING id, email
),
new_photo AS (
    INSERT INTO photo (
        person_id,
        position,
        uuid
    )
    SELECT
        new_person.id,
        position,
        uuid
    FROM onboardee_photo
    JOIN new_person
    ON onboardee_photo.email = new_person.email
    RETURNING person_id
),
new_search_preference_gender AS (
    INSERT INTO search_preference_gender (
        person_id,
        gender_id
    )
    SELECT
        new_person.id,
        gender_id
    FROM onboardee_search_preference_gender
    JOIN new_person
    ON onboardee_search_preference_gender.email = new_person.email
    RETURNING person_id
),
new_question_order_map AS (
    WITH
    row_to_shuffle AS (
      SELECT id
      FROM question
      WHERE id > 50
      ORDER BY RANDOM()
      LIMIT (SELECT ROUND(0.2 * COUNT(*)) FROM question)
    ),
    shuffled_src_to_dst_position AS (
      SELECT
        a.id AS src_position,
        b.id AS dst_position
      FROM (SELECT *, ROW_NUMBER() OVER(ORDER BY RANDOM()) FROM row_to_shuffle) AS a
      JOIN (SELECT *, ROW_NUMBER() OVER(ORDER BY RANDOM()) FROM row_to_shuffle) AS b
      ON a.row_number = b.row_number
    ),
    identity_src_to_dst_position AS (
      SELECT
        id AS src_position,
        id AS dst_position
      FROM question
      WHERE id NOT IN (SELECT src_position FROM shuffled_src_to_dst_position)
    )
    (SELECT * FROM identity_src_to_dst_position)
    UNION
    (SELECT * FROM shuffled_src_to_dst_position)
),
new_question_order AS (
    INSERT INTO question_order (
        person_id,
        question_id,
        position
    ) SELECT
        new_person.id,
        new_question_order_map.src_position,
        new_question_order_map.dst_position
    FROM new_person
    CROSS JOIN new_question_order_map
    RETURNING person_id
),
updated_session AS (
    UPDATE duo_session
    SET person_id = new_person.id
    FROM new_person
    WHERE duo_session.email = new_person.email
    RETURNING person_id
)
SELECT
    (SELECT COUNT(*) FROM new_person) +
    (SELECT COUNT(*) FROM new_photo) +
    (SELECT COUNT(*) FROM new_search_preference_gender) +
    (SELECT COUNT(*) FROM new_question_order) +
    (SELECT COUNT(*) FROM updated_session)
"""

Q_FINISH_ONBOARDING_2 = """
DELETE FROM onboardee
WHERE email = %(email)s
"""

Q_SEARCH_LOCATIONS = """
SELECT friendly
FROM location
WHERE friendly ILIKE %(first_character)s || '%%'
ORDER BY friendly <-> %(search_string)s
LIMIT 10
"""

s3 = boto3.resource('s3',
  endpoint_url = f'https://{R2_ACCT_ID}.r2.cloudflarestorage.com',
  aws_access_key_id = R2_ACCESS_KEY_ID,
  aws_secret_access_key = R2_ACCESS_KEY_SECRET,
)

bucket = s3.Bucket(R2_BUCKET_NAME)

def init_db():
    with transaction() as tx:
        tx.execute("SELECT COUNT(*) FROM person")
        if tx.fetchone()['count'] != 0:
            return

        tx.execute(
            """
            INSERT INTO person (
                email,
                name,
                date_of_birth,
                coordinates,
                gender_id,
                about,

                verified,

                unit_id,

                chats_notification,
                intros_notification,
                visitors_notification
            )
            VALUES (
                %(email)s,
                %(name)s,
                %(date_of_birth)s,
                (SELECT coordinates FROM location LIMIT 1),
                (SELECT id FROM gender LIMIT 1),
                %(about)s,

                (SELECT id FROM yes_no LIMIT 1),

                (SELECT id FROM unit LIMIT 1),

                (SELECT id FROM immediacy LIMIT 1),
                (SELECT id FROM immediacy LIMIT 1),
                (SELECT id FROM immediacy LIMIT 1)
            )
            """,
            dict(
                email='ch.na.ha+testingasdf@gmail.com',
                name='Rahim',
                date_of_birth='1999-05-30',
                about="I'm a reasonable person copypasta",
            )
        )

def process_image(
        image: Image.Image,
        output_size: Optional[int] = None
) -> io.BytesIO:
    output_bytes = io.BytesIO()

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

        if output_size != min_dim:
            # Scale the image to the desired size
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
            (f'450-{uuid}.jpg', process_image(img, output_size=450)),
            (f'900-{uuid}.jpg', process_image(img, output_size=900))]
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
            f'450-{uuid}.jpg',
            f'900-{uuid}.jpg']
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


def put_answer(req: t.PutAnswer):
    params = req.dict()

    with transaction() as tx:
        tx.execute(Q_SET_PERSON_TRAIT_STATISTIC, params | {'weight': -1})
        tx.execute(Q_SET_ANSWER, params)
        tx.execute(Q_SET_PERSON_TRAIT_STATISTIC, params | {'weight': +1})


def delete_answer(req: t.DeleteAnswer):
    params = req.dict()

    with transaction() as tx:
        tx.execute(Q_SET_PERSON_TRAIT_STATISTIC, params | {'weight': -1})
        tx.execute(Q_DELETE_ANSWER, params)

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

    _send_otp(email, otp)

    with transaction() as tx:
        tx.execute(Q_INSERT_DUO_SESSION, params)

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

    with transaction() as tx:
        tx.execute(Q_DELETE_DUO_SESSION, params)

def get_search_locations(q: Optional[str]):
    if q is None:
        return []

    normalized_whitespace = ' '.join(q.split())

    if len(normalized_whitespace) < 1:
        return []

    params = dict(
        first_character=normalized_whitespace[0],
        search_string=normalized_whitespace,
    )

    with transaction() as tx:
        tx.execute(Q_SEARCH_LOCATIONS, params)
        return [row['friendly'] for row in tx.fetchall()]

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
            friendly=field_value
        )

        q_set_onboardee_field = """
            INSERT INTO onboardee (
                email,
                coordinates
            ) SELECT
                %(email)s,
                coordinates
            FROM location
            WHERE friendly = %(friendly)s
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

        # Delete existing onboardee photos, if any exist
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
        tx.execute(Q_FINISH_ONBOARDING_1, params)
        tx.execute(Q_FINISH_ONBOARDING_2, params)

def get_personality(person_id: int):
    params = dict(
        person_id=person_id,
    )

    with transaction('READ COMMITTED') as tx:
        return {
            row['trait']: row['percentage']
            for row in tx.execute(Q_SELECT_PERSONALITY, params).fetchall()
        }


# TODO
# with transaction() as tx:
#     tx.execute(
#         """
#         select
#             person_id,
#             question_id,
#             question,
#             answer
#         from answer
#         join question
#         on question_id = question.id
#         """,
#     )
# 
#     import json
#     j_str = json.dumps(tx.fetchall(), indent=2)
#     with open(
#             '/home/christian/duolicious-backend/answers.json',
#             'w',
#             encoding="utf-8"
#     ) as f:
#         f.write(j_str)
