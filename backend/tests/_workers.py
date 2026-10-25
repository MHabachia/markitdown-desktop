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
