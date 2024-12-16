from service.chat.spam.urldetector import contains_url
from service.chat.spam.gibberishdetector import contains_gibberish


def is_spam(text: str):
    return contains_url(text) or contains_gibberish(text)
