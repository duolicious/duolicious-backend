from confusable_homoglyphs import confusables
import re
import unicodedata

# Used to convert slang in an input string to a more standard form so that it's
# easier to detect coarse language later on
_normalization_map = {
    "a[s5$]{2}": "ass",
    "b": "be",
    "btch": "bitch",
    "c+u+m+": "cum",
    "c+v+m+": "cum",
    "c0ck": "cock",
    "c0cksucker": "cocksucker",
    "cok": "cock",
    "cvmming": "cumming",
    "cvms": "cums",
    "cvmshot": "cumshot",
    "ejakulate": "ejaculate",
    "fck": "fuck",
    "fcked": "fucked",
    "fcking": "fucking",
    "fk": "fuck",
    "fked": "fucked",
    "fking": "fucking",
    "fuckin": "fucking",
    "fuk": "fuck",
    "fuked": "fucked",
    "fuking": "fucking",
    "fvck": "fuck",
    "fvcked": "fucked",
    "fvcking": "fucking",
    "l0li": "loli",
    "ngger": "nigger",
    "nggr": "nigger",
    "p0rn": "porn",
    "p[e3]d[o0]": "pedo",
    "pissin": "pissing",
    "r": "are",
    "sxy": "sexy",
    "u": "you",
    "ur": "your",
    "urself": "yourself",
    "wh0re": "whore",
    "wh0res": "whores",
}


_split_pattern = re.compile(r'[^\S\n\r]+')


# Characters which were repeated more than once
_repeated_characters_pattern = re.compile(r'(.)\1+', re.IGNORECASE)


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


def normalize_string(s: str):
    # Normalize the string to NFD (Normalization Form Decomposition) and Filter
    # out combining diacritical marks (e.g., accents)
    normalized_input = unicodedata.normalize('NFD', s)
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

    # Replace slang
    normalized_input = _normalize_spelling(normalized_input)

    return normalized_input
