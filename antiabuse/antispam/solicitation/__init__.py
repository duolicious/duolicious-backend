from antiabuse.normalize import normalize_string
import re

_strings = [
    'cashapp',
    'paypal',
    'telegram',
    'venmo',
    'zangi',
]

_solicitation_pattern = '|'.join(f'(\\b{re.escape(s)}\\b)' for s in _strings)


_solicitation_matcher = re.compile(_solicitation_pattern, re.IGNORECASE)


def has_solicitation(s: str) -> bool:
    normalized_input = normalize_string(s)

    return bool(_solicitation_matcher.search(normalized_input))
