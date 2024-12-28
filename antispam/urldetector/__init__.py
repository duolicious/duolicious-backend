from antispam.urldetector.tld import tlds
import re
import unicodedata

ZERO_WIDTH_CHARS = re.compile(r'[\u200B\u200C\u200D\uFEFF]')

DOT_VARIATIONS_PATTERN = re.compile(
    r'\b(?:dot|d0t)\b|\[(?:dot|d0t)\]|\{(?:dot|d0t)\}|\((?:dot|d0t)\)',
    re.IGNORECASE
)

PUNCTUATION_TO_DOT = {
    ',': '.',
    ';': '.',
    ':': '.'
}

EXTRANEOUS_SPACES = re.compile(r'\s+')

# A set of TLDs we consider "common" and always safe to unify
COMMON_TLDS = {'com', 'net', 'org', 'gg', 'co', 'io'}

def create_tld_merge_pattern(tld_list):
    # Case-sensitive match to avoid merging sentences like "You"
    tld_group = '|'.join(tld_list)
    return re.compile(rf'([a-zA-Z0-9-]+)\s*\.\s*({tld_group})(?=$|\s|[/:])')

TLD_MERGE_PATTERN = create_tld_merge_pattern(tlds)
COMMON_TLD_MERGE_PATTERN = create_tld_merge_pattern(COMMON_TLDS)

# Words that indicate a likely URL mention
SUSPICIOUS_WORDS = re.compile(r'\b(?:http|https|www|join|visit|discord)\b', re.IGNORECASE)

def normalize_text(text: str):
    # 1. Unicode normalization
    text = unicodedata.normalize('NFKC', text)
    # 2. Remove zero-width characters
    text = ZERO_WIDTH_CHARS.sub('', text)

    # 3. Replace dot/d0t variants with '.'
    original_text = text
    text = DOT_VARIATIONS_PATTERN.sub('.', text)
    replaced_dot_variations = (text != original_text)

    # 4. Replace punctuation-like characters with dots
    for punc, rep in PUNCTUATION_TO_DOT.items():
        text = text.replace(punc, rep)

    # 5. Normalize spaces
    text = EXTRANEOUS_SPACES.sub(' ', text)

    # 6. Merge TLDs based on conditions:
    #    - If we replaced dot variants or found suspicious words, unify all TLDs.
    #    - Otherwise, only unify common TLDs.
    if replaced_dot_variations or SUSPICIOUS_WORDS.search(text):
        text = TLD_MERGE_PATTERN.sub(r'\1.\2', text)
    else:
        # No suspicious words or replaced variants, only unify common TLDs
        text = COMMON_TLD_MERGE_PATTERN.sub(r'\1.\2', text)

    return text

def create_url_pattern(tld_list):
    tld_group = '|'.join(map(re.escape, tld_list))
    pattern = (
        r"""(?:(?:https?://|www\.)?)"""      # optional scheme or www.
        r"""[a-zA-Z0-9\-]+"""                # domain name
        r"""\."""                            # mandatory dot
        rf"""(?:{tld_group})(?=$|\s|[/:])""" # known TLD
        r"""(?:\:[0-9]+)?"""                 # optional port
        r"""(?:/[^\s]*)?"""                  # optional path
    )
    return re.compile(pattern, re.VERBOSE | re.IGNORECASE)

url_pattern = create_url_pattern(tlds)

def contains_url(text: str):
    normalized_text = normalize_text(text)
    return bool(url_pattern.search(normalized_text))
