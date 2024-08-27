from typing import Callable, List, Generic, TypeVar, Optional
import queue
import threading
import time
import traceback

T = TypeVar('T')  # Generic type variable for items

class Batcher(Generic[T]):
    def __init__(
            self,
            process_fn: Callable[List[T], None],
            flush_interval: float,
            min_batch_size: int = 1,
            max_batch_size: int = 100,
            retry: bool = False):
        self._queue: queue.Queue[T] = queue.Queue()
        self._process_fn = process_fn
        self._flush_interval = flush_interval
        self._min_batch_size = min_batch_size
        self._max_batch_size = max_batch_size
        self._retry = retry
        self._flush_interval_lock = threading.Lock()
        self._stop_event = threading.Event()

    def enqueue(self, item: T):
        self._queue.put(item)

    def _get_flush_interval(self) -> float:
        with self._flush_interval_lock:
            return self._flush_interval

    def set_flush_interval(self, flush_interval: float):
        with self._flush_interval_lock:
            self._flush_interval = flush_interval

    def _wait_for_next_batch(self) -> Optional[T]:
        batch: List[T] = []
        deadline = time.time() + self._get_flush_interval()

        while len(batch) < self._max_batch_size:
            remaining = deadline - time.time()
            if remaining <= 0 and len(batch) >= self._min_batch_size:
                break

            timeout = remaining if remaining >= 0 else None

            try:
                item = self._queue.get(timeout=timeout)
            except queue.Empty:
                continue

            batch.append(item)

        if not batch:
            return None

        return batch

    def _process_batch(self, batch: List[T]):
        try:
            self._process_fn(batch)
        except:
            print(traceback.format_exc())
            if self._retry:
                for item in batch:
                    self._queue.put(item)

    def _process_batches_forever(self):
        while not self._stop_event.is_set():
            batch = self._wait_for_next_batch()
            if batch is not None:
                self._process_batch(batch)

    def start(self):
        threading.Thread(target=self._process_batches_forever, daemon=True).start()

    def stop(self):
        self._stop_event.set()
