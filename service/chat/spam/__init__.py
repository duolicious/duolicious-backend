from antiabuse.antispam.urldetector import has_url, UrlType
from service.chat.message import (
    Message,
    ChatMessage,
)


def is_spam(text: str):
    result = has_url(text, include_safe=True, do_normalize=False)

    if any(url_type == UrlType.VERY_SAFE for url_type, _ in result):
        return False
    else:
        return bool(result)


def is_spam_message(message: Message):
    if isinstance(message, ChatMessage):
        return is_spam(message.body)
    else:
        return False
