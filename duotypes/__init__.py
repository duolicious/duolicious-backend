from typing import Any, DefaultDict, Dict, List, Optional
from pydantic import (
    BaseModel,
    EmailStr,
    Extra,
    RootModel,
    conint,
    conlist,
    constr,
    field_validator,
    model_validator,
)
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from PIL import Image
from pillow_heif import register_heif_opener
import constants
import io
import base64
from duoaudio import transcode_and_trim_audio_from_base64
import traceback
import antiabuse.antirude.displayname
import antiabuse.antirude.education
import antiabuse.antirude.occupation
import antiabuse.antirude.profile
import antiabuse.bannedphoto
from antiabuse.antispam.urldetector import has_url
from antiabuse.antispam.phonenumberdetector import detect_phone_numbers
from antiabuse.antispam.solicitation import has_solicitation
from util import human_readable_size_metric
from duohash import md5

register_heif_opener()

CLUB_PATTERN = r"""^[a-zA-Z0-9/#'"_-]+( [a-zA-Z0-9/#'"_-]+)*$"""
CLUB_MAX_LEN = 42

HEX_COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"

MIN_NAME_LEN = 1
MAX_NAME_LEN = 64

MIN_ABOUT_LEN = 0
MAX_ABOUT_LEN = 10000

MAX_IMAGE_DIM = 5000
MIN_IMAGE_DIM = 50

MAX_GIF_DIM = 800
MIN_GIF_DIM = 10

MIN_PHOTO_POSITION = 1
MAX_PHOTO_POSITION = 7


def validate_gif_dimensions(larger_dim: int, smaller_dim: int):
    if larger_dim > MAX_GIF_DIM:
        raise ValueError(
                f'Image must be less than '
                f'{MAX_GIF_DIM}x{MAX_GIF_DIM} '
                'pixels')

    if smaller_dim < MIN_GIF_DIM:
        raise ValueError(
                f'Image must be greater than '
                f'{MIN_GIF_DIM}x{MIN_GIF_DIM} '
                'pixels')


def validate_image_dimensions(larger_dim: int, smaller_dim: int):
    if larger_dim > MAX_IMAGE_DIM:
        raise ValueError(
                f'Image must be less than '
                f'{MAX_IMAGE_DIM}x{MAX_IMAGE_DIM} '
                'pixels')

    if smaller_dim < MIN_IMAGE_DIM:
        raise ValueError(
                f'Image must be greater than '
                f'{MIN_IMAGE_DIM}x{MIN_IMAGE_DIM} '
                'pixels')


class ClubItem(BaseModel):
    name: str
    count_members: int
    search_preference: Optional[bool]


class Base64AudioFile(BaseModel):
    base64: str
    transcoded: bytes
    bytes: bytes

    @model_validator(mode='before')
    def convert_base64(cls, values):
        # Avoid performing transcoding a second time
        if 'base64' in values and 'bytes' in values and 'transcoded' in values:
            return values

        response = transcode_and_trim_audio_from_base64(values['base64'])

        if isinstance(response, ValueError):
            raise response

        decoded_bytes, transcoded = response

        values['bytes'] = decoded_bytes
        values['transcoded'] = transcoded

        return values

    class Config:
        arbitrary_types_allowed = True

# Even though this class has a very generic name, it's used exclusively for
# uploading photos
class Base64File(BaseModel):
    position: conint(ge=MIN_PHOTO_POSITION, le=MAX_PHOTO_POSITION)
    base64: str
    bytes: bytes
    image: Image.Image
    top: int
    left: int
    md5_hash: str

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

        if len(decoded_bytes) > constants.MAX_IMAGE_BYTES:
            raise ValueError(
                f'File must be smaller than '
                f'{human_readable_size_metric(constants.MAX_IMAGE_BYTES)}')

        try:
            image = Image.open(io.BytesIO(decoded_bytes))
        except:
            raise ValueError(f'Base64 string is valid but is not an image')

        try:
            image.load()
        except:
            raise ValueError(f'Image invalid')

        md5_hash = md5(base64_value)
        if antiabuse.bannedphoto.is_banned_photo(md5_hash):
            raise ValueError("That pic breaks the rules 🙈")

        width, height = image.size

        larger_dim = max(width, height)
        smaller_dim = min(width, height)

        if image.format == 'GIF':
            validate_gif_dimensions(larger_dim, smaller_dim)
        else:
            validate_image_dimensions(larger_dim, smaller_dim)

        values['image'] = image
        values['bytes'] = decoded_bytes
        values['md5_hash'] = md5_hash

        return values

    class Config:
        arbitrary_types_allowed = True


class PhotoAssignments(RootModel[Dict[
    conint(ge=MIN_PHOTO_POSITION, le=MAX_PHOTO_POSITION),
    conint(ge=MIN_PHOTO_POSITION, le=MAX_PHOTO_POSITION),
]]):
    @field_validator('root')
    def validate(cls, root):
        values = list(root.values())

        if len(values) != len(set(values)):
            raise ValueError('Many photos were assigned to one position')

        for k, v in root.items():
            if k == v:
                raise ValueError("Item can't be assigned to itself")

        if not root:
            raise ValueError('Must have at least one assignment')

        return root

    def dict(self, *args, **kwargs):
        """Override to return the dictionary directly."""
        return super().dict(*args, **kwargs)['__root__']


class Theme(BaseModel):
    title_color: constr(pattern=HEX_COLOR_PATTERN)
    body_color: constr(pattern=HEX_COLOR_PATTERN)
    background_color: constr(pattern=HEX_COLOR_PATTERN)


class SessionInfo(BaseModel):
    email: str
    session_token_hash: str
    person_id: Optional[int]
    person_uuid: Optional[str]
    onboarded: bool
    signed_in: bool
    pending_club_name: Optional[str]

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
    pending_club_name: Optional[
        constr(
            pattern=CLUB_PATTERN,
            min_length=1,
            max_length=CLUB_MAX_LEN)] = None

    @field_validator('email', mode='before')
    def validate_email(cls, value):
        return EmailStr._validate(value.lower().strip())

    @field_validator('pending_club_name', mode='before')
    def validate_pending_club_name(cls, value):
        return value.lower().strip()


class PostCheckOtp(BaseModel):
    otp: constr(pattern=r'^\d{6}$')


class PatchOnboardeeInfo(BaseModel):
    name: Optional[constr(
        min_length=MIN_NAME_LEN,
        max_length=MAX_NAME_LEN,
        strip_whitespace=True)] = None
    date_of_birth: Optional[str] = None
    location: Optional[constr(min_length=1)] = None
    gender: Optional[constr(min_length=1)] = None
    other_peoples_genders: Optional[conlist(constr(min_length=1), min_length=1)] = None
    base64_file: Optional[Base64File] = None

    @field_validator('date_of_birth')
    def age_must_be_18_or_up(cls, date_of_birth):
        if date_of_birth is None:
            return date_of_birth
        date_of_birth_date = datetime.strptime(date_of_birth, '%Y-%m-%d').date()
        today = date.today()
        age = relativedelta(today, date_of_birth_date).years
        if age < 18:
            raise ValueError('Age must be 18 or up')
        return date_of_birth

    @field_validator('name')
    def name_must_not_be_rude(cls, value):
        if value is None:
            return value
        if antiabuse.antirude.displayname.is_rude(value):
            raise ValueError('Too rude')
        return value

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
    files: List[conint(ge=MIN_PHOTO_POSITION, le=MAX_PHOTO_POSITION)]


class DeleteProfileInfo(BaseModel):
    files: Optional[
        conlist(
            conint(
                ge=MIN_PHOTO_POSITION,
                le=MAX_PHOTO_POSITION
            ),
            min_length=1,
            max_length=MAX_PHOTO_POSITION,
        )
    ] = None

    audio_files: Optional[
        conlist(conint(ge=-1, le=-1), min_length=1, max_length=1)] = None


class PatchProfileInfo(BaseModel):
    base64_file: Optional[Base64File] = None
    base64_audio_file: Optional[Base64AudioFile] = None
    photo_assignments: Optional[PhotoAssignments] = None
    name: Optional[constr(
        min_length=MIN_NAME_LEN,
        max_length=MAX_NAME_LEN,
        strip_whitespace=True)] = None
    about: Optional[constr(
        min_length=MIN_ABOUT_LEN,
        max_length=MAX_ABOUT_LEN,
        strip_whitespace=True)] = None
    gender: Optional[str] = None
    orientation: Optional[str] = None
    ethnicity: Optional[str] = None
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
    verification_level: Optional[str] = None
    show_my_location: Optional[str] = None
    show_my_age: Optional[str] = None
    hide_me_from_strangers: Optional[str] = None
    theme: Optional[Theme] = None

    @model_validator(mode='after')
    def check_exactly_one(self):
        if len(self.__pydantic_fields_set__) != 1:
            raise ValueError('Exactly one value must be set')

        [field_name] = self.__pydantic_fields_set__
        field_value = getattr(self, field_name)

        if field_value is None:
            raise ValueError(f'Field {field_name} must not be None')

        return self

    @model_validator(mode='before')
    def strip_strs(cls, values):
        for key, val in values.items():
            values[key] = val.strip() if type(val) is str else val

        return values

    @field_validator('name')
    def name_must_not_be_rude(cls, value):
        if value is None:
            return value
        if antiabuse.antirude.displayname.is_rude(value):
            raise ValueError('Too rude')
        return value

    @field_validator('about')
    def about_must_not_be_rude(cls, value):
        if value is None:
            return value
        if antiabuse.antirude.profile.is_rude(value):
            raise ValueError('Too rude')
        return value

    @field_validator('about')
    def about_must_not_have_spam(cls, value):
        if value is None:
            return value
        if \
                has_url(value) or \
                detect_phone_numbers(value) or \
                has_solicitation(value):
            raise ValueError('Spam')
        return value

    @field_validator('occupation')
    def occupation_must_not_be_rude(cls, value):
        if value is None:
            return value
        if antiabuse.antirude.occupation.is_rude(value):
            raise ValueError('Too rude')
        return value

    @field_validator('education')
    def education_must_not_be_rude(cls, value):
        if value is None:
            return value
        if antiabuse.antirude.education.is_rude(value):
            raise ValueError('Too rude')
        return value

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
    ethnicity: Optional[conlist(str, min_length=1)] = None
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
    name: constr(
            pattern=CLUB_PATTERN,
            min_length=1,
            max_length=CLUB_MAX_LEN)

    @model_validator(mode='before')
    def validate_name(cls, values):
        name = values.get('name')

        if name is None:
            return values

        name = ' '.join(name.split())
        if len(name) < 1:
            raise ValueError('Name must be one or more characters long')

        values['name'] = name.lower().strip()

        return values


class PostLeaveClub(BaseModel):
    name: constr(
            pattern=CLUB_PATTERN,
            min_length=1,
            max_length=CLUB_MAX_LEN)


class PostSkip(BaseModel):
    report_reason: Optional[constr(
        min_length=1, max_length=10000, strip_whitespace=True)] = None


class PostVerificationSelfie(BaseModel):
    base64_file: Base64File


class PostKofiData(BaseModel):
    verification_token: str
    amount: int
    currency: str

    class Config:
        extra = Extra.allow


class ValidDatetime(BaseModel):
    datetime: datetime

    @field_validator('datetime', mode='before')
    def _validate_iso8601(cls, v):
        """
        Allow None or anything `datetime.fromisoformat` can parse.
        Accept the common trailing ‘Z’ (UTC) designator as well.
        """
        if isinstance(v, datetime):
            return v
        try:
            return datetime.fromisoformat(v.replace('Z', '+00:00'))
        except ValueError:
            raise ValueError('`datetime` must be an ISO-8601 datetime')
