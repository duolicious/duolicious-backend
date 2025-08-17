from antiabuse.antispam.urldetector import has_url, UrlType
from service.chat.message import (
    Message,
    ChatMessage,
)


def is_spam(text: str):
    result = has_url(text, include_safe=True, do_normalize=False)

    if result == [(UrlType.VERY_SAFE, text)]:
        return False
    else:
        return has_url(text)


def is_spam_message(message: Message):
    if isinstance(message, ChatMessage):
        return is_spam(message.body)
    else:
        return False
