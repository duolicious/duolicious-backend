from typing import Any, DefaultDict, Dict, List, Optional
from pydantic import BaseModel, EmailStr, constr, conlist, validator, root_validator, conint
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from PIL import Image
import constants
import io

class NormalizedEmailStr(EmailStr):
    @classmethod
    def validate(cls, value: EmailStr) -> EmailStr:
        return EmailStr.validate(value).lower().strip()

class SessionInfo(BaseModel):
    email: str
    session_token_hash: str
    person_id: Optional[int]
    onboarded: bool
    signed_in: bool

    @root_validator(pre=True)
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
    email: NormalizedEmailStr

class PostCheckOtp(BaseModel):
    otp: constr(regex=r'^\d{6}$')

class PatchOnboardeeInfo(BaseModel):
    name: Optional[constr(min_length=1, max_length=64, strip_whitespace=True)]
    date_of_birth: Optional[str]
    location: Optional[constr(min_length=1)]
    gender: Optional[constr(min_length=1)]
    other_peoples_genders: Optional[conlist(constr(min_length=1), min_items=1)]
    files: Optional[Dict[conint(ge=1, le=7), Image.Image]]
    about: Optional[constr(min_length=1, max_length=10000)]

    @validator('date_of_birth')
    def age_must_be_18_or_up(cls, date_of_birth):
        if date_of_birth is None:
            return date_of_birth
        date_of_birth_date = datetime.strptime(date_of_birth, '%Y-%m-%d').date()
        today = date.today()
        age = relativedelta(today, date_of_birth_date).years
        if age < 18:
            raise ValueError(f'Age must be 18 or up.')
        return date_of_birth_date

    @validator('files', pre=True)
    def file_names(cls, files):
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

    @root_validator
    def check_at_least_one(cls, values):
        if len(values) == 0:
            raise ValueError('At least one value must be set')
        return values

    class Config:
        arbitrary_types_allowed = True

class DeleteOnboardeeInfo(BaseModel):
    files: List[conint(ge=1, le=7)]

class PostViewQuestion(BaseModel):
    question_id: int
