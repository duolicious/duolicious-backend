from service.chat.messagestorage.inbox import (
        INBOX_CONTENT_ENCODING,
        UpsertConversationJob,
        process_upsert_conversation_batch,
)
from service.chat.messagestorage.mam import (
        process_store_mam_message_batch,
        StoreMamMessageJob)
from service.chat.messagestorage.setmessaged import (
        process_set_messaged_batch,
        SetMessagedJob)
from batcher import Batcher
from database import api_tx
from service.chat.message import AudioMessage, ChatMessage
from typing import Awaitable, Callable
from lxml import etree
from dataclasses import dataclass
import datetime
from service.chat.chatutil import (
    message_string_to_etree,
)


@dataclass(frozen=True)
class StoreMessageJob:
    store_mam_message_job: StoreMamMessageJob
    upsert_conversation_job: UpsertConversationJob
    messaged_job: SetMessagedJob


def store_message(
    from_username: str,
    to_username: str,
    from_id: int,
    to_id: int,
    msg_id: str,
    message: ChatMessage | AudioMessage,
    callback: Callable[[], None] | Callable[[], Awaitable[None]] | None = None
):
    timestamp = datetime.datetime.now().timestamp()

    content = etree.tostring(
        message_string_to_etree(
            message_body=message.body,
            to_username=to_username,
            from_username=from_username,
            id=msg_id,
        ),
        encoding='unicode',
        pretty_print=False,
    ).encode(INBOX_CONTENT_ENCODING)

    job = StoreMessageJob(
        store_mam_message_job=StoreMamMessageJob(
            timestamp_microseconds=int(timestamp * 1_000_000),
            from_username=from_username,
            to_username=to_username,
            id=msg_id,
            message_body=message.body,
            audio_uuid=(
                message.audio_uuid
                if isinstance(message, AudioMessage)
                else None
            ),
        ),
        upsert_conversation_job=UpsertConversationJob(
            from_username=from_username,
            to_username=to_username,
            msg_id=msg_id,
            content=content,
        ),
        messaged_job=SetMessagedJob(
            from_id=from_id,
            to_id=to_id,
        ),
    )

    _store_message_batcher.enqueue(job, callback)


def _process_store_message_batch(batch: list[StoreMessageJob]):
    store_mam_message_jobs = [
            job.store_mam_message_job
            for job in batch]

    upsert_conversation_jobs = [
            job.upsert_conversation_job
            for job in batch]

    messaged_jobs = [
            job.messaged_job
            for job in batch]

    with api_tx('read committed') as tx:
        process_store_mam_message_batch(tx, store_mam_message_jobs)
        process_upsert_conversation_batch(tx, upsert_conversation_jobs)
        process_set_messaged_batch(tx, messaged_jobs)


_store_message_batcher = Batcher[StoreMessageJob](
    process_fn=_process_store_message_batch,
    flush_interval=0.5,
    min_batch_size=1,
    max_batch_size=1000,
    retry=False,
)


_store_message_batcher.start()
