from database.asyncdatabase import api_tx, chat_tx
from dataclasses import dataclass
from service.cron.notifications.sql import (
    Q_NOTIFICATION_SETTINGS,
    Q_UNREAD_INBOX,
    Q_UPDATE_LAST_CHAT_NOTIFICATION_TIME,
    Q_UPDATE_LAST_INTRO_NOTIFICATION_TIME,
    Q_DELETE_MOBILE_TOKEN,
)
from service.cron.notifications.template import (
    big_part,
    emailtemplate,
)
from service.cron.util import (
    MAX_RANDOM_START_DELAY,
    join_lists_of_dicts,
    print_stacktrace,
)
from smtp import aws_smtp
import asyncio
import os
import random
import urllib.request
import json
import traceback

EMAIL_POLL_SECONDS = int(os.environ.get(
    'DUO_CRON_EMAIL_POLL_SECONDS',
    str(10), # 10 seconds
))

print('Hello from cron module: notifications')

@dataclass
class PersonNotification:
    person_uuid: int
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
    token: str | None

def do_send_notification(row: PersonNotification):
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

    return (is_intro_sendable or is_chat_sendable)

def do_send_email_notification(row: PersonNotification):
    is_example = row.email.lower().endswith('@example.com')

    return do_send_notification(row) and not is_example

async def delete_mobile_token(row: PersonNotification):
    params = dict(username=row.person_uuid)

    async with chat_tx() as tx:
        await tx.execute(Q_DELETE_MOBILE_TOKEN, params)

def send_email_notification(row: PersonNotification):
    if not do_send_email_notification(row):
        print('Email notification failed because it ends with @example.com')
        return

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

def send_mobile_notification(row: PersonNotification):
    if not row.token:
        raise ValueError('Token not present')

    message = dict(
        to=row.token,
        sound='default',
        title='You have a new message 😍',
        body=big_part(row.has_intro, row.has_chat),
        priority='high',
    )

    headers = {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
    }

    req = urllib.request.Request(
        url='https://exp.host/--/api/v2/push/send?useFcmV1=true',
        data=json.dumps(message).encode('utf-8'),
        headers=headers,
        method='POST'
    )

    with urllib.request.urlopen(req) as response:
        response_data = response.read().decode('utf-8')

    try:
        parsed_data = json.loads(response_data)
        assert parsed_data["data"]["status"] == "ok"
        return True
    except:
        print(traceback.format_exc())

    return False

async def send_notification(row: PersonNotification):
    if not row.token:
        print('Sending email notification:', str(row))
        return send_email_notification(row)

    print('Sending mobile notification:', str(row))
    if not send_mobile_notification(row):
        print('Mobile notification failed; sending email')
        await delete_mobile_token(row)
        return send_email_notification(row)

async def update_last_notification_time(row: PersonNotification):
    params = dict(username=row.person_uuid)

    async with chat_tx() as tx:
        if row.has_intro:
            await tx.execute(Q_UPDATE_LAST_INTRO_NOTIFICATION_TIME, params)
        if row.has_chat:
            await tx.execute(Q_UPDATE_LAST_CHAT_NOTIFICATION_TIME, params)

async def maybe_send_notification(row: PersonNotification):
    if not do_send_notification(row):
        return

    await send_notification(row)
    await update_last_notification_time(row)

async def send_notifications_once():
    async with chat_tx() as tx:
        cur_unread_inbox = await tx.execute(Q_UNREAD_INBOX)
        rows_unread_inbox = await cur_unread_inbox.fetchall()

    async with api_tx() as tx:
        cur_notification_settings = await tx.execute(
            Q_NOTIFICATION_SETTINGS,
            params=dict(ids=[r['person_uuid'] for r in rows_unread_inbox])
        )
        rows_notification_settings = await cur_notification_settings.fetchall()

    joined = join_lists_of_dicts(
        rows_unread_inbox,
        rows_notification_settings,
        'person_uuid',
    )
    person_notifications = [PersonNotification(**j) for j in joined]

    for row in person_notifications:
        await maybe_send_notification(row)

async def send_notifications_forever():
    await asyncio.sleep(random.randint(0, MAX_RANDOM_START_DELAY))
    while True:
        await print_stacktrace(send_notifications_once)
        await asyncio.sleep(EMAIL_POLL_SECONDS)
