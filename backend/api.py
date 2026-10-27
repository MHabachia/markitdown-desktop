"""
FastAPI server for MarkItDown Desktop.

Exposes REST endpoints for document conversion, batch queues, file inspection, persistent
history and system diagnostics. This file only assembles the app; the parts live in
security.py (access control), storage.py (history, settings), routes/ (the endpoints),
services.py (engine and watcher) and lifecycle.py (ending with the desktop shell).

Started as a script by the desktop shell, the dev tools and PyInstaller: `python backend/api.py`.
"""

import os
import sys

# Needed when started as a script: make the `backend` package importable from the repository root.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import threading  # noqa: E402

from fastapi import FastAPI  # noqa: E402

from backend import security, storage  # noqa: E402
from backend.lifecycle import exit_with_parent  # noqa: E402
from backend.routes import all_routers  # noqa: E402


def create_app() -> FastAPI:
    storage.init_storage()
    app = FastAPI(title="MarkItDown Desktop API")
    security.install(app)
    for router in all_routers:
        app.include_router(router)
    return app


app = create_app()


if __name__ == "__main__":
    import multiprocessing
    import uvicorn

    # Needed for the frozen app: conversion workers are started as child processes of this exe.
    multiprocessing.freeze_support()

    parent_pid = os.environ.get("MARKITDOWN_PARENT_PID", "")
    if parent_pid.isdigit():
        threading.Thread(target=exit_with_parent, args=(int(parent_pid),), daemon=True).start()

    port = int(os.environ.get("MARKITDOWN_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port, reload=False)
