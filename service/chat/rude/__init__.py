from database.asyncdatabase import api_tx
from service.chat.message import (
    Message,
    ChatMessage,
)
from antiabuse.antirude.chat import is_rude

Q_INSERT_RUDE_MESSAGE = """
INSERT INTO
    rude_message (person_id, message)
VALUES (
    %(person_id)s,
    %(message)s
)
ON CONFLICT DO NOTHING
"""


def is_rude_message(message: Message) -> bool:
    if isinstance(message, ChatMessage):
        return is_rude(message.body)
    else:
        return False


async def store_rude_message(person_id: int, message: Message):
    if not isinstance(message, ChatMessage):
        return

    params = dict(
        person_id=person_id,
        message=message.body,
    )

    async with api_tx('read committed') as tx:
        await tx.execute(Q_INSERT_RUDE_MESSAGE, params)

