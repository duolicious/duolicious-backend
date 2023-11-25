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

CLUB_PATTERN = r"""^[a-zA-Z0-9/#'"]+( [a-zA-Z0-9/#'"]+)*$"""

def file_names(files):
    if files is None:
        return files

    for k in files.keys():
        if len(files.getlist(k)) > 2:
            raise ValueError('Files must have distinct names')

    filename_to_bytes: Dict[str, io.BytesIO] = {
        k: io.BytesIO(files[k].read()) for k in files
    }

    for k, v in filename_to_bytes.items():
        if v.getbuffer().nbytes > constants.MAX_IMAGE_SIZE:
            raise ValueError(
                f'{k} exceeds {constants.MAX_IMAGE_SIZE} bytes')

    try:
        filename_to_image: Dict[str, Image.Image] = {
            k: Image.open(v) for k, v in filename_to_bytes.items()
        }
    except:
        raise ValueError(f'{k} is not a valid image')

    for k, v in filename_to_image.items():
        width, height = v.size

        larger_dim = max(width, height)
        smaller_dim = min(width, height)

        if larger_dim > constants.MAX_IMAGE_DIM:
            raise ValueError(
                    f'{k} is greater than '
                    f'{constants.MAX_IMAGE_DIM}x{constants.MAX_IMAGE_DIM} '
                    'pixels')

        if smaller_dim < constants.MIN_IMAGE_DIM:
            raise ValueError(
                    f'{k} is less than '
                    f'{constants.MIN_IMAGE_DIM}x{constants.MIN_IMAGE_DIM} '
                    'pixels')

    for v in filename_to_image.values():
        try:
            v.load()
        except:
            raise ValueError(f'{k} is not a valid image')

    order_to_image: Dict[int, Image.Image] = {
        int(k[0]): v for k, v in filename_to_image.items()
    }

    return order_to_image


class SessionInfo(BaseModel):
    email: str
    session_token_hash: str
    person_id: Optional[int]
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
    files: Optional[Dict[conint(ge=1, le=7), Image.Image]] = None
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

    @field_validator('files', mode='before')
    def file_names(cls, files):
        return file_names(files)

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
    files: Optional[Dict[conint(ge=1, le=7), Image.Image]] = None
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

    @field_validator('files', mode='before')
    def file_names(cls, files):
        return file_names(files)

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

    people_messaged: Optional[str] = None
    people_hidden: Optional[str] = None
    people_blocked: Optional[str] = None

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
    person_ids: List[int]

class PostJoinClub(BaseModel):
    name: constr(pattern=CLUB_PATTERN)

class PostLeaveClub(BaseModel):
    name: constr(pattern=CLUB_PATTERN)
