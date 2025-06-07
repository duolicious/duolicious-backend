from antiabuse.normalize import normalize_string
from antiabuse.normalize.normalizationlists import chat
import re


_needle = '(' + '|'.join(f'{re.escape(s)}' for s in chat) + ')'


_rude_pattern = (
    r'((?<=[^a-z0-9])|^)' +
    f'{_needle}' +
    r'((?=[^a-z0-9])|$)')


_rude_matcher = re.compile(_rude_pattern, re.IGNORECASE)


def is_rude(s: str) -> bool:
    normalized_input = normalize_string(s, chat)

    return bool(_rude_matcher.search(normalized_input))
