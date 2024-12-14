from service.chat.spam.tld import tlds
import re
import unicodedata

ZERO_WIDTH_CHARS = re.compile(r'[\u200B\u200C\u200D\uFEFF]')

# Combined pattern to match "dot", "d0t", and their bracketed forms
DOT_VARIATIONS_PATTERN = re.compile(
    r'\b(?:dot|d0t)\b|\[(?:dot|d0t)\]|\{(?:dot|d0t)\}|\((?:dot|d0t)\)',
    re.IGNORECASE
)

PUNCTUATION_TO_DOT = {
    ',': '.',
    ';': '.',
    ':': '.'
}
SPACES_AROUND_DOT = re.compile(r'\s*\.\s*')
EXTRANEOUS_SPACES = re.compile(r'\s+')

def normalize_text(text: str):
    # 1. Unicode normalization (NFKC) to standardize characters
    text = unicodedata.normalize('NFKC', text)

    # 2. Remove zero-width and invisible characters
    text = ZERO_WIDTH_CHARS.sub('', text)

    # 3. Replace dot/d0t variations (including bracketed forms) with a real dot
    text = DOT_VARIATIONS_PATTERN.sub('.', text)

    # 4. Replace punctuation-like characters with dots
    for punc, rep in PUNCTUATION_TO_DOT.items():
        text = text.replace(punc, rep)

    # 5. Normalize spaces around dots (e.g. "discord . gg" -> "discord.gg")
    text = SPACES_AROUND_DOT.sub('.', text)

    # 6. Reduce multiple spaces to a single space
    text = EXTRANEOUS_SPACES.sub(' ', text)

    return text

def create_url_pattern(tld_list):
    # Join the TLDs into a regex group
    tld_group = '|'.join(map(re.escape, tld_list))

    # Regex pattern to detect URLs with potential obfuscations
    pattern = (
        r"""(?:(?:https?://|www\.)?)"""      # optional scheme or www.
        r"""[a-zA-Z0-9\-]+"""                # domain name
        r"""\s*(?:\[|\(|\{)?(?:\.|dot|d0t)(?:\]|\)|\})?\s*"""  # mandatory dot or variant
        rf"""(?:{tld_group})"""              # known TLD
        r"""(?:\:[0-9]+)?"""                 # optional port
        r"""(?:/[^\s]*)?"""                  # optional path
    )

    return re.compile(pattern, re.VERBOSE | re.IGNORECASE)

url_pattern = create_url_pattern(tlds)

def contains_url(text: str):
    # Normalize the text to handle obfuscations
    normalized_text = normalize_text(text)
    print(normalized_text)  # For debugging purposes

    # Check for a URL match in the normalized text
    return bool(url_pattern.search(normalized_text))


# TODO: Add more heuristics
def is_spam(text: str):
    return contains_url(text)
