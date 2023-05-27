import hashlib

def sha512(s: str) -> str:
    m = hashlib.sha512()
    m.update(s.encode())  # encode the string into bytes
    return m.hexdigest()
