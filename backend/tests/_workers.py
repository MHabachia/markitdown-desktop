"""Stand-in worker processes for the isolation tests (must be importable by the spawned child)."""
import time


def hanging_worker(conn):
    conn.send(("ready",))
    conn.recv()
    time.sleep(600)


def crashing_worker(conn):
    conn.send(("ready",))
    conn.recv()
    import os
    os._exit(3)


def echo_worker(conn):
    """Answers every job with a fixed result, like a converter that always succeeds."""
    conn.send(("ready",))
    while True:
        try:
            job = conn.recv()
        except (EOFError, OSError):
            return
        if job is None:
            return
        conn.send(("ok", "ok", None, None))
