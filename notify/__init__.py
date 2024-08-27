from dataclasses import dataclass
from typing import Any, List, Optional
import json
import urllib.request
import os
from batcher import Batcher

# This should typically be: https://exp.host/--/api/v2/push/send?useFcmV1=true
NOTIFICATION_API_URL = os.environ.get(
    'DUO_NOTIFICATION_API_URL',
    'http://localhost'
)

@dataclass
class Notification:
    token: str
    title: str
    body: str
    data: Optional[Any]

def process_notification_batch(notifications: List[Notification]):
    data = [
        dict(
            to=notification.token,
            title=notification.title,
            body=notification.body,
            **(dict(data=notification.data) if notification.data else {}),
            sound='default',
            priority='high',
        )
        for notification in notifications
    ]

    headers = {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-type': 'application/json',
    }

    req = urllib.request.Request(
        url=NOTIFICATION_API_URL,
        data=json.dumps(data).encode('utf-8'),
        headers=headers,
        method='POST',
    )

    with urllib.request.urlopen(req) as response:
        response_data = response.read()

    parsed_data = json.loads(response_data.decode('utf-8'))

    for notification, data in zip(notifications, parsed_data["data"]):
        if data["status"] != "ok":
            raise Exception(f"Notification failed: {data}")

_batcher = Batcher[Notification](
    process_fn=process_notification_batch,
    flush_interval=1.0,
    min_batch_size=1,
    max_batch_size=100,
    retry=False,
)

_batcher.start()

def enqueue_mobile_notification(
    token: str | None,
    title: str,
    body: str,
    data = None
):
    if not token:
        return

    notification = Notification(token=token, title=title, body=body, data=data)

    _batcher.enqueue(notification)
