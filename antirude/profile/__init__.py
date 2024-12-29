from antirude.normalize import normalize_string
import re

_strings = [
    "cervix",
    "chink",
    "chinks",
    "coal burner",
    "coal burners",
    "coalburner",
    "coalburners",
    "coon",
    "cunny",
    "cunny",
    "cunny-pilled",
    "cunnypilled",
    "edtwt",
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
    "nigg",
    "nigge",
    "nigger",
    "rape",
    "rapeable",
    "rapebait"
    "raped",
    "rapes",
    "raping",
    "rapist",
    "shit skin",
    "shitskin",
    "shtwt",
    "throat fuck",
    "throat fucking",
    "throat pussy",
    "throatfuck",
    "throatfucking",
    "tnd",
    "troon",
    "troons",
    "you will never be a woman",
    "you'll never be a woman",
    "ywnbaw",
]


_offensive_pattern = '|'.join(f'(\\b{re.escape(s)}\\b)' for s in _strings)


_offensive_matcher = re.compile(_offensive_pattern, re.IGNORECASE)


def is_offensive(s: str) -> bool:
    normalized_input = normalize_string(s)

    return bool(_offensive_matcher.search(normalized_input))
