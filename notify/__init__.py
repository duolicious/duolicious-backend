from dataclasses import dataclass
from typing import List
import json
import queue
import threading
import time
import traceback
import urllib.request

# Global variable for flush_interval
_flush_interval_lock = threading.Lock()
_flush_interval_value = 0.0

# Global variable for flush_interval
_do_retry_lock = threading.Lock()
_do_retry_value = False

_notifications = queue.Queue()

@dataclass
class _Notification:
    token: str
    title: str
    body: str

def set_flush_interval(value: float):
    """Sets the global flush_interval value in a thread-safe manner."""
    global _flush_interval_value
    with _flush_interval_lock:
        _flush_interval_value = value

def _get_flush_interval() -> float:
    """Gets the global flush_interval value in a thread-safe manner."""
    with _flush_interval_lock:
        return _flush_interval_value

def set_do_retry(value: bool):
    """Sets the global do_retry value in a thread-safe manner."""
    global _do_retry_value
    with _do_retry_lock:
        _do_retry_value = value

def _get_do_retry() -> bool:
    """Gets the global do_retry value in a thread-safe manner."""
    with _do_retry_lock:
        return _do_retry_value

def enqueue_mobile_notification(token: str | None, title: str, body: str):
    if not token:
        return

    notification = _Notification(token=token, title=title, body=body)
    _notifications.put(notification)

def _wait_for_next_batch(min_batch_size: int = 1, max_batch_size: int = 100) -> List[_Notification]:
    """
    Waits for notifications to be queued and batches them until max_batch_size
    or flush_interval is reached. Will wait indefinitely if min_batch_size isn't
    reached.

    Args:
        max_batch_size (int): The maximum number of notifications to retrieve.

    Returns:
        List[_Notification]: A list of notifications.
    """
    batch = []
    deadline = time.time() + _get_flush_interval()

    while len(batch) < max_batch_size:
        remaining = deadline - time.time()
        if remaining <= 0 and len(batch) >= min_batch_size:
            break

        timeout = remaining if remaining >= 0 else None

        try:
            notification = _notifications.get(timeout=timeout)
        except queue.Empty:
            continue

        batch.append(notification)

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
        'Accept-encoding': 'gzip, deflate',
        'Content-type': 'application/json',
    }

    req = urllib.request.Request(
        url='https://exp.host/--/api/v2/push/send?useFcmV1=true',
        data=json.dumps(data).encode('utf-8'),
        headers=headers,
        method='POST',
    )

    try:
        with urllib.request.urlopen(req) as response:
            response_data = response.read().decode('utf-8')

        parsed_data = json.loads(response_data)

        data_list = parsed_data["data"]

        for data in data_list:
            assert data["status"] == "ok"
    except Exception:
        print(traceback.format_exc())

        if _get_do_retry():
            for notification in batch:
                _notifications.put(notification)

            print('Re-added failed notifications to the queue')

def _send_batches_forever():
    while True:
        _send_next_batch()

threading.Thread(target=_send_batches_forever, daemon=True).start()
