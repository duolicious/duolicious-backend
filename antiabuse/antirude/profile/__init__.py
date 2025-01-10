from antiabuse.normalize import normalize_string

import re

_strings = [
    "1488",
    "cervix",
    "chink",
    "chinks",
    "coal burner",
    "coal burners",
    "coalburner",
    "coalburners",
    "coon",
    "cunny",
    "cunny-pilled",
    "cunnypilled",
    "cut myself",
    "cut ourselves",
    "cutmaxxer",
    "dicked",
    "dicking",
    "edtwt",
    "groom me",
    "heil",
    "kike",
    "kill my self",
    "kill myself",
    "kill your self",
    "kill yourself"
    "kill yourself",
    "killed myself",
    "killed yourself",
    "killing myself",
    "killing yourself",
    "kms",
    "kys",
    "loli",
    "lolicon",
    "masturbate",
    "negress",
    "nigga",
    "niggas",
    "nigger",
    "niggerlicious",
    "niggers",
    "rape",
    "rapeable",
    "rapebait"
    "raped",
    "rapes",
    "raping",
    "rapist",
    "self harm",
    "self-harm",
    "selfharm",
    "shit skin",
    "shitskin",
    "shota",
    "shotacon",
    "shtwt",
    "throat fuck",
    "throat fucking",
    "throat pussy",
    "throatfuck",
    "throatfucking",
    "tnd",
    "tranny",
    "troon",
    "troons",
    "unrape",
    "unrapeable",
    "you will never be a woman",
    "you'll never be a woman",
    "ywnbaw",
]


_rude_pattern = '|'.join(f'(\\b{re.escape(s)}\\b)' for s in _strings)


_rude_matcher = re.compile(_rude_pattern, re.IGNORECASE)


def is_rude(s: str) -> bool:
    normalized_input = normalize_string(s)

    return bool(_rude_matcher.search(normalized_input))
