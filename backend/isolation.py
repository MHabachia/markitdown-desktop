"""
Runs conversions in separate worker processes so a stuck or crashing document can be
stopped for real: a thread cannot be killed, a process can.

Workers are started on demand, keep MarkItDown loaded between files and are replaced
when one has to be killed (timeout) or dies.
"""

import multiprocessing
import threading
import traceback
from typing import Any, List, Optional, Tuple

# Importing MarkItDown (and its models) takes a moment; this is not counted as conversion time.
WORKER_START_TIMEOUT = 120.0
MAX_WORKERS = 8


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
    from markitdown import MarkItDown

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
            conn.send(("ok", result.text_content or "", getattr(result, "title", None)))
        except BaseException as e:  # a converter may raise anything; the parent decides what to show
            conn.send(("error", str(e) or type(e).__name__, traceback.format_exc()))


class _Worker:
    def __init__(self, target=_worker_main) -> None:
        ctx = multiprocessing.get_context("spawn")
        self.conn, child_conn = ctx.Pipe()
        self.process = ctx.Process(target=target, args=(child_conn,), daemon=True)
        self.process.start()
        child_conn.close()
        try:
            if not self.conn.poll(WORKER_START_TIMEOUT) or self.conn.recv() != ("ready",):
                raise WorkerCrashed("Der Umwandlungsprozess ist nicht gestartet.")
        except (EOFError, OSError):
            self.kill()
            raise WorkerCrashed("Der Umwandlungsprozess ist beim Start beendet worden.")
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
    def __init__(self, size: int = MAX_WORKERS, worker_target=_worker_main) -> None:
        self._worker_target = worker_target
        self._slots = threading.Semaphore(size)
        self._idle: List[_Worker] = []
        self._lock = threading.Lock()

    def _take(self) -> _Worker:
        with self._lock:
            while self._idle:
                worker = self._idle.pop()
                if worker.process.is_alive():
                    return worker
                worker.kill()
        return _Worker(self._worker_target)

    def _give_back(self, worker: _Worker) -> None:
        with self._lock:
            self._idle.append(worker)

    def convert(self, path: str, keep_data_uris: bool, timeout: float) -> Tuple[str, Optional[str]]:
        """Returns (markdown, title). Raises ConversionTimeout, WorkerCrashed or RemoteError."""
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
                raise WorkerCrashed(f"Der Umwandlungsprozess wurde unerwartet beendet ({type(e).__name__}).")

            if message[0] == "ok":
                self._give_back(worker)
                return message[1], message[2]
            self._give_back(worker)
            raise RemoteError(message[1], message[2])

    def shutdown(self) -> None:
        with self._lock:
            workers, self._idle = self._idle, []
        for worker in workers:
            worker.kill()
