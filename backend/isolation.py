"""
Runs conversions in separate worker processes so a stuck or crashing document can be
stopped for real: a thread cannot be killed, a process can.

Workers are started on demand, keep MarkItDown loaded between files and are replaced
when one has to be killed (timeout) or dies. A worker that sits idle for a few minutes is
ended, and one that has converted many files is replaced: the loaded models and long-running
native libraries otherwise hold on to memory after a big batch.
"""

import multiprocessing
import threading
import time
import traceback
from typing import Any, List, Optional, Tuple

# Importing MarkItDown (and its models) takes a moment; this is not counted as conversion time.
WORKER_START_TIMEOUT = 120.0
MAX_WORKERS = 8
IDLE_TIMEOUT = 300.0  # seconds without a job before a worker is ended
MAX_JOBS_PER_WORKER = 50


class ConversionTimeout(Exception):
    pass


class WorkerCrashed(Exception):
    pass


class RemoteError(Exception):
    """The converter raised inside the worker; carries the original message and traceback."""

    def __init__(self, message: str, details: str):
        super().__init__(message)
        self.details = details


def _worker_main(conn) -> None:
    import os

    from markitdown import MarkItDown
    from backend.ocr_service import IMAGE_EXTENSIONS, extract_image_visual_markdown

    md = MarkItDown(enable_plugins=False)
    conn.send(("ready",))
    while True:
        try:
            job = conn.recv()
        except (EOFError, OSError):
            return  # the backend is gone
        if job is None:
            return
        path, keep_data_uris = job
        try:
            result = md.convert(path, keep_data_uris=keep_data_uris)
            # Text recognition runs here too, so the timeout and the kill cover it.
            image_info = None
            if os.path.splitext(path)[1].lower() in IMAGE_EXTENSIONS:
                image_info = extract_image_visual_markdown(path)
            conn.send(("ok", result.text_content or "", getattr(result, "title", None), image_info))
        except BaseException as e:  # a converter may raise anything; the parent decides what to show
            conn.send(("error", str(e) or type(e).__name__, traceback.format_exc()))


class _Worker:
    def __init__(self, target=_worker_main) -> None:
        ctx = multiprocessing.get_context("spawn")
        self.conn, child_conn = ctx.Pipe()
        self.process = ctx.Process(target=target, args=(child_conn,), daemon=True)
        self.process.start()
        child_conn.close()
        self.jobs_done = 0
        self.idle_since = time.monotonic()
        try:
            if not self.conn.poll(WORKER_START_TIMEOUT) or self.conn.recv() != ("ready",):
                raise WorkerCrashed("Der Umwandlungsprozess ist nicht gestartet.")
        except (EOFError, OSError) as e:
            self.kill()
            raise WorkerCrashed("Der Umwandlungsprozess ist beim Start beendet worden.") from e
        except WorkerCrashed:
            self.kill()
            raise

    def kill(self) -> None:
        try:
            self.process.terminate()
            self.process.join(2.0)
            if self.process.is_alive():
                self.process.kill()
                self.process.join(2.0)
        except Exception:
            pass
        try:
            self.conn.close()
        except OSError:
            pass


class ConversionPool:
    def __init__(
        self,
        size: int = MAX_WORKERS,
        worker_target=_worker_main,
        idle_timeout: float = IDLE_TIMEOUT,
        max_jobs: int = MAX_JOBS_PER_WORKER,
    ) -> None:
        self._worker_target = worker_target
        self._slots = threading.Semaphore(size)
        self._idle: List[_Worker] = []
        self._lock = threading.Lock()
        self._idle_timeout = idle_timeout
        self._max_jobs = max_jobs
        self._closed = threading.Event()
        self._reaper: Optional[threading.Thread] = None

    def _take(self) -> _Worker:
        with self._lock:
            while self._idle:
                worker = self._idle.pop()
                if worker.process.is_alive():
                    return worker
                worker.kill()
        return _Worker(self._worker_target)

    def _give_back(self, worker: _Worker) -> None:
        worker.jobs_done += 1
        if worker.jobs_done >= self._max_jobs:
            worker.kill()
            return
        worker.idle_since = time.monotonic()
        with self._lock:
            self._idle.append(worker)
            if self._reaper is None and not self._closed.is_set():
                self._reaper = threading.Thread(target=self._reap_idle, name="worker-reaper", daemon=True)
                self._reaper.start()

    def _reap_idle(self) -> None:
        """Ends workers that have been idle for too long, so their memory is given back."""
        interval = max(0.05, min(30.0, self._idle_timeout / 4))
        while not self._closed.wait(interval):
            cutoff = time.monotonic() - self._idle_timeout
            with self._lock:
                expired = [w for w in self._idle if w.idle_since < cutoff]
                self._idle = [w for w in self._idle if w.idle_since >= cutoff]
            for worker in expired:
                worker.kill()

    def convert(self, path: str, keep_data_uris: bool, timeout: float) -> Tuple[str, Optional[str], Optional[dict]]:
        """Returns (markdown, title, image_info for images or None). Raises ConversionTimeout, WorkerCrashed or RemoteError."""
        with self._slots:
            worker = self._take()
            try:
                worker.conn.send((path, keep_data_uris))
                if not worker.conn.poll(timeout):
                    worker.kill()
                    raise ConversionTimeout()
                message: Tuple[Any, ...] = worker.conn.recv()
            except ConversionTimeout:
                raise
            except (EOFError, OSError) as e:
                worker.kill()
                raise WorkerCrashed(f"Der Umwandlungsprozess wurde unerwartet beendet ({type(e).__name__}).") from e

            if message[0] == "ok":
                self._give_back(worker)
                return message[1], message[2], message[3]
            self._give_back(worker)
            raise RemoteError(message[1], message[2])

    def shutdown(self) -> None:
        self._closed.set()
        with self._lock:
            workers, self._idle = self._idle, []
        for worker in workers:
            worker.kill()
