from antispam.urldetector import contains_url
from antispam.gibberishdetector import contains_gibberish


def is_spam(text: str):
    return contains_url(text) or contains_gibberish(text)
