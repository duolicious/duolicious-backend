from dataclasses import dataclass
from service.cron.emailnotifications.sql import *
from service.cron.emailnotifications.template import emailtemplate
from service.cron.util import join_lists_of_dicts, print_stacktrace
import asyncio
import json
import os
import psycopg
from smtp import aws_smtp
import random

DRY_RUN = os.environ.get(
    'DUO_CRON_EMAIL_DRY_RUN',
    'true',
).lower() not in ['false', 'f', '0', 'no']

EMAIL_POLL_SECONDS = int(os.environ.get(
    'DUO_CRON_EMAIL_POLL_SECONDS',
    '10',
))

DB_HOST      = os.environ['DUO_DB_HOST']
DB_PORT      = os.environ['DUO_DB_PORT']
DB_USER      = os.environ['DUO_DB_USER']
DB_PASS      = os.environ['DUO_DB_PASS']
DB_CHAT_NAME = os.environ['DUO_DB_CHAT_NAME']
DB_API_NAME  = os.environ['DUO_DB_API_NAME']

_emails_file = os.path.join(
        os.path.dirname(__file__), '..', '..', '..',
        'test/output/cron-emails')

_api_conninfo = psycopg.conninfo.make_conninfo(
    host=DB_HOST,
    port=DB_PORT,
    dbname=DB_API_NAME,
    user=DB_USER,
    password=DB_PASS,
)

_chat_conninfo = psycopg.conninfo.make_conninfo(
    host=DB_HOST,
    port=DB_PORT,
    dbname=DB_CHAT_NAME,
    user=DB_USER,
    password=DB_PASS,
)

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

    if DRY_RUN:
        print('DUO_CRON_EMAIL_DRY_RUN env var prevented email from being sent')

        email_data_str = json.dumps(send_args, indent=4) + '\n'

        with open(_emails_file, 'a') as f:
            f.write(email_data_str)
    else:
        aws_smtp.send(**send_args)

async def update_last_notification_time(chat_conn, row: PersonNotification):
    params = dict(username=row.username)

    if row.has_intro:
        await chat_conn.execute(Q_UPDATE_LAST_INTRO_NOTIFICATION_TIME, params)
    if row.has_chat:
        await chat_conn.execute(Q_UPDATE_LAST_CHAT_NOTIFICATION_TIME, params)
    await chat_conn.commit()

async def maybe_send_notification(chat_conn, row: PersonNotification):
    if not do_send(row):
        return
    print('SENDING:', str(row))

    send_notification(row)
    await update_last_notification_time(chat_conn, row)

async def send_notifications_once():
    api_conn  = await psycopg.AsyncConnection.connect(
        _api_conninfo,
        row_factory=psycopg.rows.dict_row
    )

    chat_conn = await psycopg.AsyncConnection.connect(
        _chat_conninfo,
        row_factory=psycopg.rows.dict_row
    )

    cur_unread_inbox = await chat_conn.execute(Q_UNREAD_INBOX)
    rows_unread_inbox = await cur_unread_inbox.fetchall()

    cur_notification_settings = await api_conn.execute(
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
        await maybe_send_notification(chat_conn, row)

    await api_conn.close()
    await chat_conn.close()

async def send_notifications_forever():
    while True:
        await print_stacktrace(send_notifications_once)
        await asyncio.sleep(EMAIL_POLL_SECONDS)
