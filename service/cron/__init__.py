# TODO: Don't literally send notifications immediately. Wait a few minutes, even if the person hasn't been online for a while
from service.cron.sql import *
from service.cron.emailtemplate import emailtemplate
import asyncio
import os
import psycopg

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

def join_lists_of_dicts(list1, list2, join_key):
    lookup1 = {item[join_key]: item for item in list1}
    lookup2 = {item[join_key]: item for item in list2}

    all_keys = set(lookup1.keys()) | set(lookup2.keys())

    return [
        lookup1[k] | lookup2[k]
        for k in all_keys
        if k in lookup1 and k in lookup2
    ]

def do_send(row):
    email = row["email"]
    has_intros = row["intros"]
    has_chats = row["chats"]
    intros_drift_seconds = row["intros_drift_seconds"]
    chats_drift_seconds = row["chats_drift_seconds"]
    last_notification_seconds = row["last_notification_seconds"]
    now_seconds = row["now_seconds"]

    is_intro_sendable = (
        has_intros and
        intros_drift_seconds >= 0 and
        last_notification_seconds + intros_drift_seconds < now_seconds)

    is_chat_sendable = (
        has_chats and
        chats_drift_seconds >= 0 and
        last_notification_seconds + chats_drift_seconds < now_seconds)

    is_example = email.lower().endswith('@example.com')

    return (is_intro_sendable or is_chat_sendable) and not is_example

async def maybe_send_notification(chat_conn, row):
    print(row, flush=True) # TODO

    if not do_send(row):
        return

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
       "to": [ { "email": email } ],
       "subject": "You Have a New Message!",
       "htmlContent": emailtemplate(
           has_intro=row['intros'],
           chats=row['chats'],
       )
    }

    urllib_req = urllib.request.Request(
        EMAIL_URL,
        headers=headers,
        data=json.dumps(data).encode('utf-8')
    )

    # Send notification
    try:
        print(data, flush=True) # TODO
        # TODO
        # with urllib.request.urlopen(urllib_req) as f:
        #     pass
    except: # YOLO
        pass

    # Update last notification time
    params = dict(
        username=row['username'],
        seconds=row['now_seconds'],
    )
    await chat_conn.execute(Q_UPDATE_LAST_NOTIFICATION_TIME)
    await chat_conn.commit()


async def send_notifications_once():
    api_conn  = await psycopg.AsyncConnection.connect(
        _api_conninfo,
        row_factory=psycopg.rows.dict_row
    )

    chat_conn = await psycopg.AsyncConnection.connect(
        _chat_conninfo,
        row_factory=psycopg.rows.dict_row
    )

    cur_unread_inbox = await chat_conn.execute(
        Q_UNREAD_INBOX,
    )
    rows_unread_inbox = await cur_unread_inbox.fetchall()
    print(rows_unread_inbox, flush=True) # TODO

    cur_notification_settings = await api_conn.execute(
        Q_NOTIFICATION_SETTINGS,
        params=dict(ids=[r['person_id'] for r in rows_unread_inbox])
    )
    rows_notification_settings = await cur_notification_settings.fetchall()

    # Example of a joined row:
    #     {
    #         'person_id': 2,
    #         'last_message_seconds': 1693636581,
    #         'intros': True,
    #         'chats': False,
    #         'now_seconds': 1693636586,
    #         'name': 'user2',
    #         'email': 'user2@example.com',
    #         'chats_drift_seconds': 0,
    #         'intros_drift_seconds': 86400
    #     }
    joined = join_lists_of_dicts(
        rows_unread_inbox,
        rows_notification_settings,
        'person_id',
    )

    for row in joined:
        await maybe_send_notification(chat_conn, row)

    await api_conn.close()
    await chat_conn.close()

async def send_notifications_forever():
    while True:
        await send_notifications_once()
        await asyncio.sleep(1)

async def main():
    await asyncio.gather(
        # TODO: Add photo deletion task
        send_notifications_forever(),
    )

if __name__ == '__main__':
    asyncio.run(main())
