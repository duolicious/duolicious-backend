from database.asyncdatabase import api_tx, chat_tx
from dataclasses import dataclass
from service.cron.emailnotifications.sql import *
from service.cron.emailnotifications.template import emailtemplate
from service.cron.util import join_lists_of_dicts, print_stacktrace, MAX_RANDOM_START_DELAY
from smtp import aws_smtp
import asyncio
import os
import random

EMAIL_POLL_SECONDS = int(os.environ.get(
    'DUO_CRON_EMAIL_POLL_SECONDS',
    str(10), # 10 seconds
))

print('Hello from cron module: emailnotifications')

@dataclass
class PersonNotification:
    person_id: int
    username: str
    last_intro_notification_seconds: int
    last_chat_notification_seconds: int
    last_intro_seconds: int
    last_chat_seconds: int
    has_intro: bool
    has_chat: bool
    name: str
    email: str
    chats_drift_seconds: int
    intros_drift_seconds: int

def do_send(row: PersonNotification):
    email = row.email
    has_intro = row.has_intro
    has_chat = row.has_chat
    intros_drift_seconds = row.intros_drift_seconds
    chats_drift_seconds = row.chats_drift_seconds
    last_intro_notification_seconds = row.last_intro_notification_seconds
    last_chat_notification_seconds = row.last_chat_notification_seconds
    last_intro_seconds = row.last_intro_seconds
    last_chat_seconds = row.last_chat_seconds

    is_intro_sendable = (
        has_intro and
        intros_drift_seconds >= 0 and
        last_intro_notification_seconds + intros_drift_seconds < last_intro_seconds
    )

    is_chat_sendable = (
        has_chat and
        chats_drift_seconds >= 0 and
        last_chat_notification_seconds + chats_drift_seconds < last_chat_seconds
    )

    is_example = email.lower().endswith('@example.com')

    return (is_intro_sendable or is_chat_sendable) and not is_example

def send_notification(row: PersonNotification):
    send_args = dict(
        to=row.email,
        subject="You have a new message 😍",
        body=emailtemplate(
            email=row.email,
            has_intro=row.has_intro,
            has_chat=row.has_chat,
        )
    )

    aws_smtp.send(**send_args)

async def update_last_notification_time(row: PersonNotification):
    params = dict(username=row.username)

    async with chat_tx() as tx:
        if row.has_intro:
            await tx.execute(Q_UPDATE_LAST_INTRO_NOTIFICATION_TIME, params)
        if row.has_chat:
            await tx.execute(Q_UPDATE_LAST_CHAT_NOTIFICATION_TIME, params)

async def maybe_send_notification(row: PersonNotification):
    if not do_send(row):
        return
    print('SENDING:', str(row))

    send_notification(row)
    await update_last_notification_time(row)

async def send_notifications_once():
    async with chat_tx() as tx:
        cur_unread_inbox = await tx.execute(Q_UNREAD_INBOX)
        rows_unread_inbox = await cur_unread_inbox.fetchall()

    async with api_tx() as tx:
        cur_notification_settings = await tx.execute(
            Q_NOTIFICATION_SETTINGS,
            params=dict(ids=[r['person_id'] for r in rows_unread_inbox])
        )
        rows_notification_settings = await cur_notification_settings.fetchall()

    joined = join_lists_of_dicts(
        rows_unread_inbox,
        rows_notification_settings,
        'person_id',
    )
    person_notifications = [PersonNotification(**j) for j in joined]

    for row in person_notifications:
        await maybe_send_notification(row)

async def send_notifications_forever():
    await asyncio.sleep(random.randint(0, MAX_RANDOM_START_DELAY))
    while True:
        await print_stacktrace(send_notifications_once)
        await asyncio.sleep(EMAIL_POLL_SECONDS)
