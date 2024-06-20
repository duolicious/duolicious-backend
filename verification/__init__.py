from openai import AsyncOpenAI
from openai.types.chat import ChatCompletion
from dataclasses import dataclass
from typing import Literal
import json
import os
import base64
import urllib.request
import traceback
from pathlib import Path

VERIFICATION_IMAGE_BASE_URL = os.getenv('DUO_VERIFICATION_IMAGE_BASE_URL')
VERIFICATION_MOCK_RESPONSE_FILE = os.getenv('DUO_VERIFICATION_MOCK_RESPONSE_FILE')

_mock_response_file = (
     Path(__file__).parent.parent / VERIFICATION_MOCK_RESPONSE_FILE
     if VERIFICATION_MOCK_RESPONSE_FILE else None)

def get_system_content(
    num_claimed_uuids: int,
    claimed_age: int,
    claimed_gender: str,
    claimed_ethnicity: str | None
) -> str:
    english_ethnicity_lines = (
        [
            f"* Image #1 contains a person whose primary or only ethnicity is: {claimed_ethnicity}. "
            "(Users can choose from the options: Black/African Descent, East Asian, Hispanic/Latino, Middle Eastern, Native American, Pacific Islander, South Asian, Southeast Asian, White/Caucasian, and Other.)"
        ]
        if claimed_ethnicity
        else [])

    json_ethnicity_lines = (
        ['  image_1_has_claimed_ethnicity: number']
        if claimed_ethnicity
        else [])

    english_image_lines = [
        f'* Image #1 contains a person who is in Image #{i + 2}.'
        for i in range(num_claimed_uuids)
    ]

    json_image_lines = [
        f'  image_1_has_person_from_image_{i + 2}: number'
        for i in range(num_claimed_uuids)
    ]

    content = '\n'.join([
        'You have been given one or more image(s) by a user attempting to '
        'verify their identity on a social media website. The user claims to '
        'be in Image #1. To verify that claim, you must verify these ones:',
        '',
        '* Image #1 was not edited.',
        '* Image #1 is a photograph.',
        '* Image #1 contains at least one person.',
        '* Image #1 contains exactly one person.',
        '* Image #1 was photographed at about a 45 degree angle to the side of the person\'s face (i.e. a three-quarter profile).',
        f'* Image #1 contains a person whose gender is: {claimed_gender}. (Users can choose from the options: Man, Woman, Agender, Intersex, Non-binary, Transgender, Trans woman, Trans man, and Other.)',
        f'* Image #1 contains a person whose age is: {claimed_age}.',
        f'* Image #1 contains a person whose age is 18 or older.',
        *english_ethnicity_lines,
        '* Image #1 contains a person who is smiling.',
        '* Image #1 contains a person who is touching their eyebrow.',
        '* Image #1 contains a person who is pointing their thumb downward.',
        *english_image_lines,
        '',
        'Provide a JSON object in the following format which assigns a probability from 0.0 to 1.0 to each claim above:',
        '',
        '```',
        '{',
        '  image_1_was_not_edited: number',
        '  image_1_is_photograph: number',
        '  image_1_has_at_least_one_person: number',
        '  image_1_has_exactly_one_person: number',
        '  image_1_has_45_degree_angle: number',
        '  image_1_has_claimed_gender: number',
        '  image_1_has_claimed_age: number',
        '  image_1_has_claimed_minimum_age: number',
        *json_ethnicity_lines,
        '  image_1_has_smiling_person: number',
        '  image_1_has_eyebrow_touch: number',
        '  image_1_has_downward_thumb: number',
        *json_image_lines,
        '}',
        '```',
    ])

    return content

def get_user_content(
    proof_uuid: str,
    claimed_uuids: list[str],
) -> list[str]:
    def go():
        for i, uuid in enumerate([proof_uuid] + claimed_uuids):
            yield {
              "type": "text",
              "text": f"Image #{i + 1}:",
            }
            yield {
                "type": "image_url",
                "image_url": {
                    "url": get_image_url(uuid),
                    "detail": "low"
                }
            }

    return list(go())

@dataclass
class Success:
    verified_uuids: list[str]

    is_verified_age: bool
    is_verified_gender: bool
    is_verified_ethnicity: bool

    raw_json: str

@dataclass
class Failure:
    reason: str
    raw_json: str

@dataclass
class VerificationResult:
    success: Success | None
    failure: Failure | None

def failure(
    reason: str,
    raw_json: str,
) -> VerificationResult:
    return VerificationResult(
        success=None,
        failure=Failure(
            reason=reason,
            raw_json=raw_json,
        ),
    )

def success(
    verified_uuids: list[str],
    is_verified_age: bool,
    is_verified_gender: bool,
    is_verified_ethnicity: bool,
    raw_json: str,
) -> VerificationResult:
    return VerificationResult(
        success=Success(
            verified_uuids=verified_uuids,
            is_verified_age=is_verified_age,
            is_verified_gender=is_verified_gender,
            is_verified_ethnicity=is_verified_ethnicity,
            raw_json=raw_json,
        ),
        failure=None,
    )

def process_response(
    response: str | None,
    claimed_uuids: list[int],
) -> VerificationResult:
    response_str = str(response)

    try:
        json_obj = json.loads(response)

        image_1_was_not_edited          = json_obj['image_1_was_not_edited']
        image_1_is_photograph           = json_obj['image_1_is_photograph']
        image_1_has_at_least_one_person = json_obj['image_1_has_at_least_one_person']
        image_1_has_exactly_one_person  = json_obj['image_1_has_exactly_one_person']
        image_1_has_45_degree_angle     = json_obj['image_1_has_45_degree_angle']
        image_1_has_claimed_gender      = json_obj['image_1_has_claimed_gender']
        image_1_has_claimed_age         = json_obj['image_1_has_claimed_age']
        image_1_has_claimed_minimum_age = json_obj['image_1_has_claimed_minimum_age']
        image_1_has_claimed_ethnicity   = json_obj.get('image_1_has_claimed_ethnicity')
        image_1_has_smiling_person      = json_obj['image_1_has_smiling_person']
        image_1_has_eyebrow_touch       = json_obj['image_1_has_eyebrow_touch']
        image_1_has_downward_thumb      = json_obj['image_1_has_downward_thumb']
        image_1_has_person_from_image_2 = json_obj.get('image_1_has_person_from_image_2')
        image_1_has_person_from_image_3 = json_obj.get('image_1_has_person_from_image_3')
        image_1_has_person_from_image_4 = json_obj.get('image_1_has_person_from_image_4')
        image_1_has_person_from_image_5 = json_obj.get('image_1_has_person_from_image_5')
        image_1_has_person_from_image_6 = json_obj.get('image_1_has_person_from_image_6')
        image_1_has_person_from_image_7 = json_obj.get('image_1_has_person_from_image_7')
        image_1_has_person_from_image_8 = json_obj.get('image_1_has_person_from_image_8')

        image_1_was_not_edited          = float(image_1_was_not_edited)
        image_1_is_photograph           = float(image_1_is_photograph)
        image_1_has_at_least_one_person = float(image_1_has_at_least_one_person)
        image_1_has_exactly_one_person  = float(image_1_has_exactly_one_person)
        image_1_has_45_degree_angle     = float(image_1_has_45_degree_angle)
        image_1_has_claimed_gender      = float(image_1_has_claimed_gender)
        image_1_has_claimed_age         = float(image_1_has_claimed_age)
        image_1_has_claimed_minimum_age = float(image_1_has_claimed_minimum_age)
        image_1_has_claimed_ethnicity   = float(image_1_has_claimed_ethnicity) if image_1_has_claimed_ethnicity is not None else None
        image_1_has_smiling_person      = float(image_1_has_smiling_person)
        image_1_has_eyebrow_touch       = float(image_1_has_eyebrow_touch)
        image_1_has_downward_thumb      = float(image_1_has_downward_thumb)
        image_1_has_person_from_image_2 = float(image_1_has_person_from_image_2) if image_1_has_person_from_image_2 is not None else None
        image_1_has_person_from_image_3 = float(image_1_has_person_from_image_3) if image_1_has_person_from_image_3 is not None else None
        image_1_has_person_from_image_4 = float(image_1_has_person_from_image_4) if image_1_has_person_from_image_4 is not None else None
        image_1_has_person_from_image_5 = float(image_1_has_person_from_image_5) if image_1_has_person_from_image_5 is not None else None
        image_1_has_person_from_image_6 = float(image_1_has_person_from_image_6) if image_1_has_person_from_image_6 is not None else None
        image_1_has_person_from_image_7 = float(image_1_has_person_from_image_7) if image_1_has_person_from_image_7 is not None else None
        image_1_has_person_from_image_8 = float(image_1_has_person_from_image_8) if image_1_has_person_from_image_8 is not None else None
    except:
        print(traceback.format_exc())
        print('JSON was:', response_str)
        return failure("Something went wrong.", response_str)

    general_truthiness_threshold = 0.7

    # These settings are tuned to gpt-4-turbo. gpt-4o worked better with higher
    # numbers.
    edit_truthiness_threshold = 0.9
    gender_truthiness_threshold = 0.7
    age_truthiness_threshold = 0.5
    minimum_age_truthiness_threshold = 0.8
    ethnicity_truthiness_threshold = 0.4
    photo_truthiness_threshold = 0.9

    if image_1_is_photograph < general_truthiness_threshold:
        return failure("Our AI thinks your image isn’t a real photo.", response_str)

    if image_1_was_not_edited < edit_truthiness_threshold:
        return failure("Our AI thinks your image might have been edited.", response_str)

    if image_1_has_at_least_one_person < general_truthiness_threshold:
        return failure("Our AI thinks your photo doesn’t have a person in it.", response_str)

    if image_1_has_exactly_one_person < general_truthiness_threshold:
        return failure("Our AI thinks there’s more than one person in your photo.", response_str)

    if image_1_has_45_degree_angle < general_truthiness_threshold:
        return failure("Our AI thinks the shot wasn’t taken at the correct angle. The photo needs to be at about a 45 degree angle to the side of your face.", response_str)

    if image_1_has_claimed_gender < gender_truthiness_threshold:
        return failure("Our AI couldn’t verify your gender.", response_str)

    if (
            image_1_has_claimed_ethnicity is not None and
            image_1_has_claimed_ethnicity < ethnicity_truthiness_threshold):
        return failure("Our AI couldn’t verify your ethnicity.", response_str)

    if image_1_has_claimed_age < age_truthiness_threshold:
        return failure("Our AI couldn’t verify your age.", response_str)

    if image_1_has_claimed_minimum_age < minimum_age_truthiness_threshold:
        return failure("Our AI couldn’t verify your age.", response_str)

    if image_1_has_smiling_person < general_truthiness_threshold:
        return failure("Our AI thinks you’re not smiling.", response_str)

    if image_1_has_eyebrow_touch < general_truthiness_threshold:
        return failure("Our AI thinks you’re not touching your eyebrow.", response_str)

    if image_1_has_downward_thumb < general_truthiness_threshold:
        return failure("Our AI thinks you’re not giving the thumbs down.", response_str)

    is_uuid_verified_seq = [
        (image_1_has_person_from_image_2 or 0.0) >= photo_truthiness_threshold,
        (image_1_has_person_from_image_3 or 0.0) >= photo_truthiness_threshold,
        (image_1_has_person_from_image_4 or 0.0) >= photo_truthiness_threshold,
        (image_1_has_person_from_image_5 or 0.0) >= photo_truthiness_threshold,
        (image_1_has_person_from_image_6 or 0.0) >= photo_truthiness_threshold,
        (image_1_has_person_from_image_7 or 0.0) >= photo_truthiness_threshold,
        (image_1_has_person_from_image_8 or 0.0) >= photo_truthiness_threshold,
    ]
    verified_uuids = [
        uuid
        for uuid, is_uuid_verified in zip(claimed_uuids, is_uuid_verified_seq)
        if is_uuid_verified]

    return success(
        verified_uuids=verified_uuids,
        is_verified_age=True,
        is_verified_gender=True,
        is_verified_ethnicity=image_1_has_claimed_ethnicity is not None,
        raw_json=response_str,
    )

def get_image_url(uuid: str) -> str:
    if not VERIFICATION_IMAGE_BASE_URL:
        return f"https://user-images.duolicious.app/450-{uuid}.jpg"

    # Everything after this point is only intended for use in development.
    # This shouldn't be used in production.
    intermediate_image_url = f"{VERIFICATION_IMAGE_BASE_URL}/450-{uuid}.jpg"
    print(f'Fetching for verification: {intermediate_image_url}')

    with urllib.request.urlopen(intermediate_image_url) as response:
        data = response.read()

    base64_encoded_str = base64.b64encode(data).decode('utf-8')

    return f"data:image/jpeg;base64,{base64_encoded_str}"

def get_messages(
    proof_uuid: str,
    claimed_uuids: list[str],
    claimed_age: int,
    claimed_gender: str,
    claimed_ethnicity: str | None,
):
    return [
        {
            "role": "system",
            "content": get_system_content(
                num_claimed_uuids=len(claimed_uuids),
                claimed_age=claimed_age,
                claimed_gender=claimed_gender,
                claimed_ethnicity=claimed_ethnicity,
            )
        },
        {
            "role": "user",
            "content": get_user_content(
                proof_uuid,
                claimed_uuids,
            )
        },
    ]

async def verify(
    proof_uuid: str,
    claimed_uuids: list[str],
    claimed_age: int,
    claimed_gender: str,
    claimed_ethnicity: str | None,
) -> VerificationResult:
    if _mock_response_file:
        with _mock_response_file.open('r') as f:
            response = f.read()
    else:
        try:
            response = (await AsyncOpenAI().chat.completions.create(
                model="gpt-4-turbo",
                response_format={"type": "json_object"},
                temperature=0.0,
                frequency_penalty=0.0,
                presence_penalty=0.0,
                messages=get_messages(
                    proof_uuid=proof_uuid,
                    claimed_uuids=claimed_uuids,
                    claimed_age=claimed_age,
                    claimed_gender=claimed_gender,
                    claimed_ethnicity=claimed_ethnicity,
                ),
                max_tokens=500,
                timeout=45,
            )).choices[0].message.content
        except:
            print(traceback.format_exc())
            response = None

    return process_response(response, claimed_uuids)
