from service.chat.message import (
    Message,
    ChatMessage,
)
from antiabuse.antirude.chat import is_rude


def is_rude_message(message: Message) -> bool:
    if isinstance(message, ChatMessage):
        return is_rude(message.body)
    else:
        return False
