from dataclasses import dataclass
from typing import Tuple
import hashlib

BASE62_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

DEFAULT_SALT_EXPONENT = 10 ** 9

@dataclass
class Unsalted:
    unsalted: int
    salt: int

def sha512(s: str) -> str:
    m = hashlib.sha512()
    m.update(s.encode())  # encode the string into bytes
    return m.hexdigest()

def md5(s: str) -> str:
    m = hashlib.md5()
    m.update(s.encode())
    return m.hexdigest()

def base62_encode(num):
    if num == 0:
        return BASE62_ALPHABET[0]
    arr = []
    base = len(BASE62_ALPHABET)
    while num:
        num, rem = divmod(num, base)
        arr.append(BASE62_ALPHABET[rem])
    arr.reverse()
    return ''.join(arr)

def base62_decode(encoded_str):
    base = len(BASE62_ALPHABET)
    strlen = len(encoded_str)
    num = 0

    idx = 0
    for char in encoded_str:
        power = strlen - (idx + 1)
        num += BASE62_ALPHABET.index(char) * (base ** power)
        idx += 1

    return num

def salt(n: int, s: int, exponent=DEFAULT_SALT_EXPONENT) -> str:
    """n is the number to be salted and s is the salt"""
    return base62_encode(n * exponent + s % exponent)

def unsalt(s: str, exponent=DEFAULT_SALT_EXPONENT) -> Unsalted:
    """s is the string to be unsalted"""
    unsalted_, salt_ = divmod(base62_decode(s), exponent)
    return Unsalted(unsalted=unsalted_, salt=salt_)
