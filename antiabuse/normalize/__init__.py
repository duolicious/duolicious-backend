from confusable_homoglyphs import confusables
import re
import unicodedata

# Used to convert slang in an input string to a more standard form so that it's
# easier to detect coarse language later on
_normalization_map = {
    "[a4]+n[a4]+[l1]+": "anal",
    "[a4][s$]*h[o0][l1][e3]": "asshole",
    "a[s5$]{2}": "ass",
    "b[a4]ck ?sh[o0][tт][s$z]": "backshots",
    "b": "be",
    "b[i1y]?tch": "bitch",
    "b[o0][o0]b[i1][e3][s$z]": "boobies",
    "c[a4][s$z]h[a4]pp": "cashapp",
    "c[o0]ck": "cock",
    "c[o0]ck[s$z]": "cocks",
    "c[o0]ck[s$z][uv]ck[e3]r": "cocksucker",
    "cok": "cock",
    "c+[uv]+m+": "cum",
    "c[uv]mm[i1]ng": "cumming",
    "c[uv]m[s$z]h[o0][tт]": "cumshot",
    "c+[uv]+m+s+": "cums",
    "d[i1]ck": "dick",
    "d[iy1]k[e3]": "dyke",
    "dyck": "dick",
    "ejaku[l1]ate": "ejaculate",
    "f[a4]*[gб]+[o0]*[tᴛ][s$z]": "faggots",
    "f[a4]*[gб]+[o0]*[tт]": "faggot",
    "fcked": "fucked",
    "fck": "fuck",
    "fcking": "fucking",
    "fked": "fucked",
    "fk": "fuck",
    "fking": "fucking",
    "f[o0]{2}tj[o0]b": "footjob",
    "f[o0]{2}tj[o0]b[s$z]": "footjobs",
    "f[uv]ck[e3]d": "fucked",
    "f[uv]ck": "fuck",
    "f[uv]ckin": "fucking",
    "f[uv]cking": "fucking",
    "f[uv]ked": "fucked",
    "f[uv]k": "fuck",
    "f[uv]king": "fucking",
    "gr[a4]p[e3]d": "raped",
    "gr[a4]p[i1]ng": "raping",
    "gr[o0][o0]mer": "groomer",
    "gr[o0][o0]m": "groom",
    "h[@a4]rm": "harm",
    "k[iy1][l1]+": "kill",
    "[l1]0[l1]icon": "lolicon",
    "[l1]0[l1]i": "loli",
    "n[i1ye3]gg[l1]et": "niglet",
    "n[i1ye3]*[gб]+(a|uh|e)": "nigga",
    "n[i1ye3]*[gб]+([e3]*r)?": "nigger",
    "n[i1ye3]*[gб]+[e3]*r[s$z]": "niggers",
    "n[i1ye3][gб]+uh*": "nigga",
    "n[ie][gб]{1,2}re{1,2}s+": "negress",
    "p[e3]d[o0]": "pedo",
    "pissin": "pissing",
    "p[iy1][s$][s$]": "piss",
    "p[o0]rn": "porn",
    "pr[o0]n": "porn",
    "r[@a4]p[e3]-?ab[l1]e": "rapeable",
    "r[@a4]p[e3]d": "raped",
    "r[@a4]p[e3]": "rape",
    "r[@a4]p[i1]*ng": "raping",
    "r": "are",
    "raype": "rape",
    "r[e3]t[@a4]rd": "retard",
    "s[e3][l1]f": "self",
    "seg+[zs]+": "sex",
    "sht": "shit",
    "s[uv][i1]c[i1]d[e3]": "suicide",
    "sxy": "sexy",
    "tr[@a4]nnie[s$z]": "trannies",
    "tr[@a4]nny": "tranny",
    "tr[o0]{2}n[s$z]": "troons",
    "tr[o0]{2}n": "troon",
    "un-?r[@a4]p[e3]-?ab[l1]e": "unrapeable",
    "un-?r[@a4]p[e3]": "unrape",
    "urse[l1]f": "yourself",
    "ur": "your",
    "u": "you",
    "wh[o0]r[e3][s$z]": "whores",
    "wh[o0]r[e3]": "whores",
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
    normalized_input = _normalize_spelling(normalized_input)

    return normalized_input
