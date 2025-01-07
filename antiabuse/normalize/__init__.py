from confusable_homoglyphs import confusables
import re
import unicodedata

# Used to convert slang in an input string to a more standard form so that it's
# easier to detect coarse language later on
_normalization_map = {
    "a[s5$]{2}": "ass",
    "b": "be",
    "btch": "bitch",
    "c0ck": "cock",
    "c0cksucker": "cocksucker",
    "cok": "cock",
    "c+[uv]+m+": "cum",
    "c+[uv]+m+s+": "cums",
    "cvmming": "cumming",
    "cvmshot": "cumshot",
    "ejakulate": "ejaculate",
    "fcked": "fucked",
    "fck": "fuck",
    "fcking": "fucking",
    "fked": "fucked",
    "fk": "fuck",
    "fking": "fucking",
    "fuckin": "fucking",
    "fuked": "fucked",
    "fuk": "fuck",
    "fuking": "fucking",
    "fvcked": "fucked",
    "fvck": "fuck",
    "fvcking": "fucking",
    "h[@a4]rm": "harm",
    "l0licon": "lolicon",
    "l0li": "loli",
    "ngger": "nigger",
    "nggr": "nigger",
    "nigge": "nigger",
    "nigg": "nigger",
    "p0rn": "porn",
    "p[e3]d[o0]": "pedo",
    "pissin": "pissing",
    "r[@a4]p[e3]-?able": "rapeable",
    "r[@a4]p[e3]": "rape",
    "r": "are",
    "raype": "rape",
    "s[e3]lf": "self",
    "sxy": "sexy",
    "tr[@a4]nnies": "trannies",
    "tr[@a4]nny": "tranny",
    "un-?r[@a4]p[e3]-?able": "unrapeable",
    "un-?r[@a4]p[e3]": "unrape",
    "urself": "yourself",
    "ur": "your",
    "u": "you",
    "wh0res": "whores",
    "wh0re": "whore",
}


_split_pattern = re.compile(r'[^\S\n\r]+')


# Characters which were repeated more than once
_repeated_characters_pattern = re.compile(r'(.)\1+', re.IGNORECASE)

_zero_width_chars = re.compile(r'[\u200B\u200C\u200D\uFEFF]')


def _get_latin_homoglyph(char: str) -> str:
    """
    Returns a Latin homoglyph for the given character if available.
    If no Latin homoglyph is found, returns the original character.
    """
    # confusables.is_confusable returns a list of dictionaries, one per confusable character
    # Each dictionary can contain a 'homoglyphs' key, which is a list of homoglyph entries.
    info_seq = confusables.is_confusable(char, preferred_aliases=['latin']) or []

    for info in info_seq:
        # Extract the first Latin homoglyph character if one exists
        latin_homoglyphs = (
                h['c']
                for h in info.get('homoglyphs', [])
                if info.get('alias') not in ['LATIN', 'COMMON']
        )
        latin_homoglyph = next(latin_homoglyphs, None)
        if latin_homoglyph:
            return latin_homoglyph

    return char


def _normalize_homoglyphs(s: str) -> str:
    """
    Normalizes an input string by replacing characters that are confusable with Latin homoglyphs.
    """
    return ''.join(_get_latin_homoglyph(char) for char in s)


def _normalize_spelling(haystack: str):
    for needle, replacement in _normalization_map.items():
        # Apparently compiled regexes are cached between invocations of
        # re.compile.
        pattern = re.compile(f"(?:(?<=^)|(?<=\s)){needle}(?=\s|$)", re.IGNORECASE)

        haystack = pattern.sub(replacement, haystack)

    return haystack


def _remove_zero_width_characters(s: str):
    return _zero_width_chars.sub('', s)


def normalize_string(s: str):
    # Normalize the string to NFD (Normalization Form Decomposition) and Filter
    # out combining diacritical marks (e.g., accents)
    normalized_input = unicodedata.normalize('NFKC', s)
    normalized_input = ''.join(
        char for char in normalized_input if not unicodedata.combining(char)
    )

    # Mitigate homoglyph attacks
    normalized_input = _normalize_homoglyphs(normalized_input)

    # Normalize whitespace
    normalized_input = ' '.join(_split_pattern.split(normalized_input))

    # Remove repeated characters
    normalized_input = _repeated_characters_pattern.sub(
        r'\1\1', normalized_input)

    # Remove zero width characters
    normalized_input = _remove_zero_width_characters(normalized_input)

    # Replace slang
    normalized_input = _normalize_spelling(normalized_input)

    return normalized_input
