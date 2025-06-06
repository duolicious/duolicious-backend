from confusable_homoglyphs import confusables
import re
import unicodedata
from functools import cache

_char_map = {
    "a": "a@4x*",
    "c": "ck",
    "e": "e3x*",
    "g": "gб",
    "i": "i1l!yx*",
    "l": "l1l!",
    "o": "o0x*",
    "s": "sz5$",
    "t": "tт",
    "u": "uvx*",
    "y": "yi1",
}

_elideable_chars = {
    "a",
    "e",
    "i",
    "o",
    "u",
}

_punctuation = {
    '!',
    ',',
    '.',
    '?',
}

_closed_class_slang_words = {
    "yourself": [
        "urself",
        "your self",
        "ur self",
    ],
    "myself": [
        "my self",
    ],
    "you": [
        "u",
    ],
    "your": [
        "ur",
    ],
    "are": [
        "r",
    ],
    "be": [
        "b",
    ],
    "fuck": [
        "fck",
        "fk",
        "fuc",
        "fuk",
    ],
}

_closed_class_slang_suffixes = {
    "ing": [
        "in",
    ],
    "ed": [
        "d",
    ],
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
    Normalizes an input string by replacing characters that are confusable with
    Latin homoglyphs.
    """
    return ''.join(_get_latin_homoglyph(char) for char in s)


def verb_forms(verb: str) -> list[str]:
    """
    Return a list of common English derivations for *verb*:
        base, -s, -ed/-d, -ing, -able, -er, -ers
    with simple spelling rules:
        • drop final e before -ing/-able/-er/-ers. But also add -eable to
          account for misspellings.
        • add only 'd' to verbs ending in e  (dance → danced)
        • double final consonant (except w/x/y) for CVC verbs
          before vowel-initial suffixes  (stop → stopped/stopping/stoppable)

    NOTE: Ignores irregular spellings (go→went, run→ran, etc.).
    """
    vowels = "aeiou"

    def double_final_consonant(w: str) -> str:
        """CVC doubling heuristic (ignores w/x/y)."""
        if (len(w) >= 3 and
            w[-1] not in vowels + "wxy" and
            w[-2] in vowels and
            w[-3] not in vowels):
            return w + w[-1]
        return w

    def derive(w: str) -> set[str]:
        """Derivations for a single verb form (no 'un-' added here)."""
        forms = {w}

        if w.endswith("e"):
            stem = w[:-1]
            forms.update({
                w + "d",            # danced
                stem + "ing",       # dancing
                stem + "able",      # dancable
                stem + "eable",     # danceable
                stem + "er", stem + "ers"
            })
        else:
            base = double_final_consonant(w)
            forms.update({
                base + "ed",        # stopped
                base + "ing",       # stopping
                base + "able",      # stoppable
                base + "er", base + "ers"
            })

        forms.add(w + "s")           # stops / loves
        return forms

    # 1. normal verb
    derivs = derive(verb)

    # 2. add un- prefixed set if requested and verb itself isn’t already “un…”
    if not verb.startswith("un"):
        derivs |= {"un" + f for f in derivs}

    return sorted(derivs)


def verb_forms_for_each(verb_list: list[str]) -> list[str]:
    return [
        verb_form
        for verb in verb_list
        for verb_form in verb_forms(verb)
    ]


def char_to_regex(c: str, is_initial: bool, is_final: bool):
    is_medial = not is_initial and not is_final

    re_quantifier = rf'*' if is_medial and c in _elideable_chars else '+'

    re_chars = _char_map[c] if c in _char_map else c

    # Don't match punctuation at the end of a word
    if is_final:
        re_chars = ''.join(c for c in re_chars if c not in _punctuation)

    return rf'[{re_chars}]{re_quantifier}'


def suffix_class_instance_to_regex(suffix_class_instance: str) -> str:
    return '(' + ''.join(
        char_to_regex(
            c=c,
            is_initial=i == 0,
            is_final=i == len(suffix_class_instance) - 1,
        )
        for i, c in enumerate(suffix_class_instance)
    ) + ')'


def suffix_class_to_regex(suffix_class: list[str]) -> str:
    return '(' + '|'.join(
        suffix_class_instance_to_regex(suffix_class_instance)
        for suffix_class_instance in suffix_class
    ) + ')'


def word_class_instance_to_regex(word_class_instance: str) -> str:
    for suffix in _closed_class_slang_suffixes:
        if word_class_instance.endswith(suffix):
            without_suffix = word_class_instance[:-len(suffix)]

            with_suffixes = [
                f'{without_suffix}{suffix_class_instance}'
                for suffix_class_instance in _closed_class_slang_suffixes[suffix]
            ]

            return suffix_class_to_regex([word_class_instance] + with_suffixes)

    return suffix_class_to_regex([word_class_instance])



def word_class_to_regex(word_class: list[str]) -> str:
    return '(' + '|'.join(
        word_class_instance_to_regex(word_class_instance)
        for word_class_instance in word_class
    ) + ')'


def word_to_regex(word: str) -> str:
    if word in _closed_class_slang_words:
        return word_class_to_regex([word] + _closed_class_slang_words[word])
    else:
        return word_class_to_regex([word])


def phrase_to_regex(phrase: str) -> str:
    return '(' + '[ -]?'.join(
            word_to_regex(word) for word in phrase.split(' ')
    ) + ')'


@cache
def phrase_to_pattern(phrase: str):
    needle = phrase_to_regex(phrase)

    return re.compile(
            r'((?<=[^a-z0-9])|^)'
            f'{needle}'
            r'((?=[^a-z0-9])|$)',
            re.IGNORECASE)


def _normalize_spelling(haystack: str, normalizeable_phrases: list[str]):
    for phrase in normalizeable_phrases:
        pattern = phrase_to_pattern(phrase)

        haystack = pattern.sub(phrase, haystack)

    return haystack


def _remove_zero_width_characters(s: str):
    return _zero_width_chars.sub('', s)


def normalize_string(s: str, normalizeable_phrases: list[str]):
    normalized_input = unicodedata.normalize('NFKD', s)
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
    normalized_input = _normalize_spelling(normalized_input, normalizeable_phrases)

    return normalized_input
