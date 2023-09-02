# TODO: Don't literally send notifications immediately. Wait a few minutes, even if the person hasn't been online for a while
from service.cron.emailnotifications.template import emailtemplate
from service.cron.emailnotifications.sql import *
import asyncio
import os
import psycopg
import urllib.request
import json
from dataclasses import dataclass
from typing import List

DRY_RUN = os.environ.get('DUO_DRY_RUN', '').lower() not in ['false', 'f', '0', 'no']

EMAIL_KEY = os.environ['DUO_EMAIL_KEY']
EMAIL_URL = os.environ['DUO_EMAIL_URL']

DB_HOST      = os.environ['DUO_DB_HOST']
DB_PORT      = os.environ['DUO_DB_PORT']
DB_USER      = os.environ['DUO_DB_USER']
DB_PASS      = os.environ['DUO_DB_PASS']
DB_CHAT_NAME = os.environ['DUO_DB_CHAT_NAME']
DB_API_NAME  = os.environ['DUO_DB_API_NAME']

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

@dataclass
class PersonNotification:
    person_id: int
    username: str
    last_notification_seconds: int
    intros: bool
    chats: bool
    now_seconds: int
    name: str
    email: str
    chats_drift_seconds: int
    intros_drift_seconds: int

def join_lists_of_dicts(list1, list2, join_key):
    lookup1 = {item[join_key]: item for item in list1}
    lookup2 = {item[join_key]: item for item in list2}

    all_keys = set(lookup1.keys()) | set(lookup2.keys())

    return [
        lookup1[k] | lookup2[k]
        for k in all_keys
        if k in lookup1 and k in lookup2
    ]

def do_send(row: PersonNotification):
    email = row.email
    has_intros = row.intros
    has_chats = row.chats
    intros_drift_seconds = row.intros_drift_seconds
    chats_drift_seconds = row.chats_drift_seconds
    last_notification_seconds = row.last_notification_seconds
    now_seconds = row.now_seconds

    is_intro_sendable = (
        has_intros and
        intros_drift_seconds >= 0 and
        last_notification_seconds + intros_drift_seconds < now_seconds
    )

    is_chat_sendable = (
        has_chats and
        chats_drift_seconds >= 0 and
        last_notification_seconds + chats_drift_seconds < now_seconds
    )

    is_example = email.lower().endswith('@example.com')

    return (is_intro_sendable or is_chat_sendable) and not is_example

def new_notification_req(row: PersonNotification):
    headers = {
        'accept': 'application/json',
        'api-key': EMAIL_KEY,
        'content-type': 'application/json'
    }

    data = {
       "sender": {
          "name": "Duolicious",
          "email": "no-reply@duolicious.app"
       },
       "to": [ { "email": row.email } ],
       "subject": "You Have a New Message!",
       "htmlContent": template(
           has_intro=row.intros,
           has_chat=row.chats,
       )
    }

    return urllib.request.Request(
        EMAIL_URL,
        headers=headers,
        data=json.dumps(data).encode('utf-8')
    )

def send_notification(row: PersonNotification):
    req = new_notification_req(row)

    if DRY_RUN:
        email_data = dict(
            full_url=req.full_url,
            headers=req.headers,
            data=req.data,
        )
        email_data_str = json.dumps(email_data) + '\n'

        with open(filename, 'a') as f:
            f.write(email_data_str)
    else:
        try:
            urllib.request.urlopen(req) # TODO: Does this work without the ctx manager?
        except: # YOLO
            pass

async def update_last_notification_time(chat_conn, row: PersonNotification):
    params = dict(
        username=row.username,
        seconds=row.now_seconds,
    )
    await chat_conn.execute(Q_UPDATE_LAST_NOTIFICATION_TIME, params)
    await chat_conn.commit()

async def maybe_send_notification(chat_conn, row: PersonNotification):
    if not do_send(row):
        return

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
        await send_notifications_once()
        await asyncio.sleep(1)
