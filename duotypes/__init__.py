from typing import Any, DefaultDict, Dict, List, Optional
from pydantic import (
    BaseModel,
    EmailStr,
    conint,
    conlist,
    constr,
    field_validator,
    model_validator,
)
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from PIL import Image
import constants
import io
import base64

CLUB_PATTERN = r"""^[a-zA-Z0-9/#'"_-]+( [a-zA-Z0-9/#'"_-]+)*$"""
CLUB_MAX_LEN = 42

def normalize_email(email: str):
    name, domain = email.lower().split('@')

    if domain not in ["gmail.com", "googlemail.com", "example.com"]:
        return email

    name, *_ = name.replace('.', '').split('+', 1)

    return f"{name}@gmail.com"

class Base64File(BaseModel):
    position: conint(ge=1, le=7)
    base64: str
    image: Image.Image
    top: int
    left: int

    @model_validator(mode='before')
    def convert_base64(cls, values):
        try:
            base64_value = values['base64'].split(',')[-1]
        except:
            raise ValueError('Field base64 must be a valid base64 string')

        try:
            decoded_bytes = base64.b64decode(base64_value)
        except base64.binascii.Error as e:
            raise ValueError(f'Field base64 must be a valid base64 string')

        if len(decoded_bytes) > constants.MAX_IMAGE_SIZE:
            raise ValueError(
                'Decoded file exceeds {constants.MAX_IMAGE_SIZE} bytes')

        try:
            image = Image.open(io.BytesIO(decoded_bytes))
        except:
            raise ValueError(f'Base64 string is valid but is not an image')

        width, height = image.size

        larger_dim = max(width, height)
        smaller_dim = min(width, height)

        if larger_dim > constants.MAX_IMAGE_DIM:
            raise ValueError(
                    f'image is greater than '
                    f'{constants.MAX_IMAGE_DIM}x{constants.MAX_IMAGE_DIM} '
                    'pixels')

        if smaller_dim < constants.MIN_IMAGE_DIM:
            raise ValueError(
                    f'image is less than '
                    f'{constants.MIN_IMAGE_DIM}x{constants.MIN_IMAGE_DIM} '
                    'pixels')

        try:
            image.load()
        except:
            raise ValueError(f'Image is not valid')

        values['image'] = image

        return values

    class Config:
        arbitrary_types_allowed = True


class SessionInfo(BaseModel):
    email: str
    session_token_hash: str
    person_id: Optional[int]
    person_uuid: Optional[str]
    onboarded: bool
    signed_in: bool

    @model_validator(mode='before')
    def set_onboarded(cls, values):
        values['onboarded'] = values.get('person_id') is not None
        return values

class PostAnswer(BaseModel):
    question_id: int
    answer: Optional[bool]
    public: bool

class DeleteAnswer(BaseModel):
    question_id: int

class PostRequestOtp(BaseModel):
    email: EmailStr

    @field_validator('email', mode='before')
    def validate_email(cls, value):
        return EmailStr._validate(value.lower().strip())


class PostCheckOtp(BaseModel):
    otp: constr(pattern=r'^\d{6}$')

class PatchOnboardeeInfo(BaseModel):
    name: Optional[constr(min_length=1, max_length=64, strip_whitespace=True)] = None
    date_of_birth: Optional[str] = None
    location: Optional[constr(min_length=1)] = None
    gender: Optional[constr(min_length=1)] = None
    other_peoples_genders: Optional[conlist(constr(min_length=1), min_length=1)] = None
    base64_file: Optional[Base64File] = None
    about: Optional[constr(min_length=0, max_length=10000)] = None

    @field_validator('date_of_birth')
    def age_must_be_18_or_up(cls, date_of_birth):
        if date_of_birth is None:
            return date_of_birth
        date_of_birth_date = datetime.strptime(date_of_birth, '%Y-%m-%d').date()
        today = date.today()
        age = relativedelta(today, date_of_birth_date).years
        if age < 18:
            raise ValueError(f'Age must be 18 or up.')
        return date_of_birth

    @field_validator('about', mode='before')
    def strip_about(cls, about):
        return about if about is None else about.strip()

    @model_validator(mode='after')
    def check_exactly_one(self):
        if len(self.__pydantic_fields_set__) != 1:
            raise ValueError('Exactly one value must be set')

        [field_name] = self.__pydantic_fields_set__
        field_value = getattr(self, field_name)

        if field_value is None:
            raise ValueError(f'Field {field_name} must not be None')

        return self

    class Config:
        arbitrary_types_allowed = True

class DeleteOnboardeeInfo(BaseModel):
    files: List[conint(ge=1, le=7)]

class DeleteProfileInfo(BaseModel):
    files: List[conint(ge=1, le=7)]

class PatchProfileInfo(BaseModel):
    base64_file: Optional[Base64File] = None
    about: Optional[constr(min_length=0, max_length=10000)] = None
    gender: Optional[str] = None
    orientation: Optional[str] = None
    location: Optional[str] = None
    occupation: Optional[constr(min_length=1, max_length=64)] = None
    education: Optional[constr(min_length=1, max_length=64)] = None
    height: Optional[int] = None
    looking_for: Optional[str] = None
    smoking: Optional[str] = None
    drinking: Optional[str] = None
    drugs: Optional[str] = None
    long_distance: Optional[str] = None
    relationship_status: Optional[str] = None
    has_kids: Optional[str] = None
    wants_kids: Optional[str] = None
    exercise: Optional[str] = None
    religion: Optional[str] = None
    star_sign: Optional[str] = None
    units: Optional[str] = None
    chats: Optional[str] = None
    intros: Optional[str] = None
    show_my_location: Optional[str] = None
    show_my_age: Optional[str] = None
    hide_me_from_strangers: Optional[str] = None

    @model_validator(mode='after')
    def check_exactly_one(self):
        if len(self.__pydantic_fields_set__) != 1:
            raise ValueError('Exactly one value must be set')

        [field_name] = self.__pydantic_fields_set__
        field_value = getattr(self, field_name)

        if field_value is None:
            raise ValueError(f'Field {field_name} must not be None')

        return self

    @field_validator('about', mode='before')
    def strip_about(cls, about):
        return about if about is None else about.strip()

    class Config:
        arbitrary_types_allowed = True

class PostSearchFilter(BaseModel):
    class Age(BaseModel):
        min_age: Optional[int]
        max_age: Optional[int]

    class Height(BaseModel):
        min_height_cm: Optional[int]
        max_height_cm: Optional[int]

    gender: Optional[conlist(str, min_length=1)] = None
    orientation: Optional[conlist(str, min_length=1)] = None
    age: Optional[Age] = None
    furthest_distance: Optional[int] = None
    height: Optional[Height] = None
    has_a_profile_picture: Optional[conlist(str, min_length=1)] = None
    looking_for: Optional[conlist(str, min_length=1)] = None
    smoking: Optional[conlist(str, min_length=1)] = None
    drinking: Optional[conlist(str, min_length=1)] = None
    drugs: Optional[conlist(str, min_length=1)] = None
    long_distance: Optional[conlist(str, min_length=1)] = None
    relationship_status: Optional[conlist(str, min_length=1)] = None
    has_kids: Optional[conlist(str, min_length=1)] = None
    wants_kids: Optional[conlist(str, min_length=1)] = None
    exercise: Optional[conlist(str, min_length=1)] = None
    religion: Optional[conlist(str, min_length=1)] = None
    star_sign: Optional[conlist(str, min_length=1)] = None

    people_you_messaged: Optional[str] = None
    people_you_skipped: Optional[str] = None

    @model_validator(mode='after')
    def check_exactly_one(self):
        if len(self.__pydantic_fields_set__) != 1:
            raise ValueError('Exactly one value must be set')

        [field_name] = self.__pydantic_fields_set__
        field_value = getattr(self, field_name)

        if field_name == 'furthest_distance':
            pass
        elif field_value is None:
            raise ValueError(f'Field {field_name} must not be None')

        return self

    class Config:
        arbitrary_types_allowed = True

class PostSearchFilterAnswer(BaseModel):
    question_id: int
    answer: Optional[bool]
    accept_unanswered: bool

class PostInboxInfo(BaseModel):
    person_uuids: List[str]

class PostJoinClub(BaseModel):
    name: constr(pattern=CLUB_PATTERN, min_length=1, max_length=CLUB_MAX_LEN)

class PostLeaveClub(BaseModel):
    name: constr(pattern=CLUB_PATTERN, min_length=1, max_length=CLUB_MAX_LEN)

class PostSkip(BaseModel):
    report_reason: Optional[constr(min_length=1, max_length=10000)] = None
