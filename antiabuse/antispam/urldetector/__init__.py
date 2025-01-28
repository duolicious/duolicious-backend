from antiabuse.normalize import normalize_string
from antiabuse.antispam.urldetector.tld import tlds
import re
import unicodedata

DOT_VARIATIONS_GROUP = (
    r'\s*\b(?:dot|d0t|\.|;|:|,)\b\s*|'
    r'\s*\[(?:dot|d0t|\.|;|:|,)\]\s*|'
    r'\s*\{(?:dot|d0t|\.|;|:|,)\}\s*|'
    r'\s*\((?:dot|d0t|\.|;|:|,)\)\s*|'
    r'\s*(?:\.|;|:|,)\s*'
)

EXTRANEOUS_SPACES = re.compile(r'\s+')

# A set of TLDs we consider "common" and always safe to unify
COMMON_TLDS = {'com', 'net', 'org', 'gg', 'co', 'io'}

# These domains are typically used to help users describe who they are
SAFE_DOMAINS = {
    'backloggd.com',
    'facebook.com',
    'fandom.com',
    'funnyjunk.com',
    'imdb.com',
    'imgur.com',
    'last.fm',
    'letterboxd.com',
    'rateyourmusic.com',
    'reddit.com',
    'spotify.com',
    'stats.fm',
    'steamcommunity.com',
    'substack.com',
    'tenor.com',
    'twitter.com',
    'vocaroo.com',
    'x.com',
    'youtu.be',
    'youtube.com',
}

# These domains are typically used for self-promotion
UNSAFE_DOMAINS = {
    'bandcamp.com',
    'discord.com',
    'discordapp.com',
    'instagram.com',
    'onlyfans.com',
    'paypal.com',
    'paypal.me',
    'throne.com',
    'twitch.tv',
}

TLD_GROUP = '|'.join(map(re.escape, tlds))

URL_GROUP = (
    r"""((?:https?://|www\.)?)"""            # optional scheme or www.
    r"""([a-zA-Z0-9\-]+)"""                  # domain name
    rf"""({DOT_VARIATIONS_GROUP})"""         # mandatory dot
    rf"""({TLD_GROUP})(?=$|\s|[/:])"""       # known TLD
    r"""(?:\:[0-9]+)?"""                     # optional port
    r"""(?:/[^\s]*)?"""                      # optional path
)

URL_PATTERN = re.compile(URL_GROUP, re.IGNORECASE)

def has_url(text: str):
    normalized_text = normalize_string(text)

    matches = URL_PATTERN.findall(normalized_text)

    for scheme, domain, dot, tld in matches:
        normalized_domain = f'{domain.lower()}.{tld.lower()}'

        if normalized_domain in SAFE_DOMAINS:
            return False
        if normalized_domain in UNSAFE_DOMAINS:
            return True
        if tld.lower() in COMMON_TLDS:
            return True
        if scheme:
            return True
        if not re.compile('\s+').search(dot):
            return True

    return False
