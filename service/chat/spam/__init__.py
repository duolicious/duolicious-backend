from antispam.urldetector import has_url
from antispam.gibberishdetector import has_gibberish


def is_spam(text: str):
    return has_url(text) or has_gibberish(text)
