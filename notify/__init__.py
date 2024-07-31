# TODO: https://github.com/aio-libs/aiocache
# TODO: https://github.com/aio-libs/async-lru

import json
import traceback
import urllib.request
import queue
from dataclasses import dataclass
import time
from typing import List

_notifications = queue.Queue()


@dataclass
class _Notification:
    token: str
    title: str
    body: str


def enqueue_mobile_notification(token: str | None, title: str, body: str):
    if not token:
        return

    notification = _Notification(token=token, title=title, body=body)

    _notifications.put(notification)


def _wait_for_next_batch(
    max_batch_size: int = 100, timeout: float = 1.0) -> List[_Notification]:
    """
    Waits for notifications to be queued and batches them until max_batch_size
    or timeout is reached.

    Args:
        max_batch_size (int): The maximum number of notifications to retrieve.
        timeout (float): The maximum time in seconds to wait for a batch.

    Returns:
        List[_Notification]: A list of notifications.
    """
    batch = []
    start_time = time.time()
    deadline = start_time + timeout

    while len(batch) < max_batch_size:
        remaining = deadline - time.time()
        if remaining <= 0:
            break

        try:
            notification = _notifications.get(timeout=remaining)
            batch.append(notification)
        except queue.Empty:
            break

    return batch


def _send_next_batch():
    batch = _wait_for_next_batch()

    if not batch:
        return

    data = [
        dict(
            to=notification.token,
            title=notification.title,
            body=notification.body,
            sound='default',
            priority='high',
        )
        for notification in batch
    ]

    headers = {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
    }

    req = urllib.request.Request(
        url='https://exp.host/--/api/v2/push/send?useFcmV1=true',
        data=json.dumps(data).encode('utf-8'),
        headers=headers,
        method='POST',
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


def _send_batches_forever():
    while True:
        _send_next_batch()


threading.Thread(target=_send_batches_forever,  daemon=True).start()
