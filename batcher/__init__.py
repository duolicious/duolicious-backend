from dataclasses import dataclass
from typing import Awaitable, Callable, Generic, TypeVar
import queue
import threading
import time
import traceback
import inspect
import asyncio

T = TypeVar('T')

event_loop = asyncio.get_event_loop()

@dataclass
class BatchItem(Generic[T]):
    item: T
    callback: Callable[[], None] | Callable[[], Awaitable[None]] | None = None

class Batcher(Generic[T]):
    def __init__(
        self,
        process_fn: Callable[[list[T]], None],
        flush_interval: float,
        min_batch_size: int = 1,
        max_batch_size: int = 100,
        retry: bool = False
    ):
        self._queue: queue.Queue[BatchItem[T]] = queue.Queue()
        self._process_fn = process_fn
        self._flush_interval = flush_interval
        self._min_batch_size = min_batch_size
        self._max_batch_size = max_batch_size
        self._retry = retry
        self._flush_interval_lock = threading.Lock()
        self._stop_event = threading.Event()

    def enqueue(
        self,
        item: T,
        callback: Callable[[], None] | Callable[[], Awaitable[None]] | None = None
    ):
        self._queue.put(BatchItem(item, callback))

    def _get_flush_interval(self) -> float:
        with self._flush_interval_lock:
            return self._flush_interval

    def set_flush_interval(self, flush_interval: float):
        with self._flush_interval_lock:
            self._flush_interval = flush_interval

    def _wait_for_next_batch(self) -> list[BatchItem[T]] | None:
        batch: list[BatchItem[T]] = []
        deadline = time.time() + self._get_flush_interval()

        while len(batch) < self._max_batch_size:
            remaining = deadline - time.time()
            if remaining <= 0 and len(batch) >= self._min_batch_size:
                break

            timeout = remaining if remaining >= 0 else None

            try:
                batch_item = self._queue.get(timeout=timeout)
            except queue.Empty:
                continue

            batch.append(batch_item)

        return batch or None

    def _process_batch(self, batch: list[BatchItem[T]]):
        try:
            items = [bi.item for bi in batch]
            self._process_fn(items)
            for bi in batch:
                if not bi.callback:
                    pass
                elif inspect.iscoroutinefunction(bi.callback):
                    future = asyncio.run_coroutine_threadsafe(
                        coro=bi.callback(),
                        loop=event_loop,
                    )

                    future.add_done_callback(
                        lambda fut:
                            print(fut.exception())
                            if fut.exception()
                            else None
                    )
                else:
                    bi.callback()
        except Exception:
            print(traceback.format_exc())
            if self._retry:
                for bi in batch:
                    self._queue.put(bi)

    def _process_batches_forever(self):
        while not self._stop_event.is_set():
            batch = self._wait_for_next_batch()
            if batch is not None:
                self._process_batch(batch)

    def start(self):
        threading.Thread(target=self._process_batches_forever, daemon=True).start()

    def stop(self):
        self._stop_event.set()
