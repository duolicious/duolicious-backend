from typing import Tuple
import hashlib

def sha512(s: str) -> str:
    m = hashlib.sha512()
    m.update(s.encode())  # encode the string into bytes
    return m.hexdigest()

def md5(s: str) -> str:
    m = hashlib.md5()
    m.update(s.encode())
    return m.hexdigest()

def pk(person_id: int | str) -> Tuple[int | None, str | None]:
    try:
        person_id_as_int = int(person_id)
        if person_id_as_int < 5000:
            return person_id_as_int, None
    except:
        pass

    return None, str(person_id)
