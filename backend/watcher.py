"""
Folder Watcher Service for MarkItDown Desktop
Monitors an inbox directory in a background daemon thread and automatically
converts newly dropped documents to Markdown into a specified output directory.
"""

import os
import time
import pathlib
import threading
from typing import Dict, Any, Optional, Set, Callable, Tuple

# Fallback when no supported_fn is given (tests); the app passes the engine's list.
DEFAULT_EXTENSIONS = {
    ".pdf", ".docx", ".pptx", ".xlsx", ".html", ".htm",
    ".csv", ".json", ".xml", ".txt", ".ipynb", ".png", ".jpg", ".jpeg"
}


class FolderWatcher:
    def __init__(
        self,
        convert_fn: Callable[[str, Optional[str]], Dict[str, Any]],
        supported_fn: Optional[Callable[[], Set[str]]] = None,
    ):
        self.convert_fn = convert_fn
        self.supported_fn = supported_fn
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self.inbox_dir: Optional[str] = None
        self.output_dir: Optional[str] = None
        self.is_running: bool = False
        self.processed_count: int = 0
        # path -> (size, mtime) of the version already handled. A file that failed is not
        # retried until it changes (e.g. the copy finishes or the user replaces it).
        self.processed_files: Dict[str, Tuple[int, float]] = {}
        self.last_error: Optional[str] = None
        self.last_event_time: Optional[float] = None

    def start(self, inbox_dir: str, output_dir: Optional[str] = None) -> Dict[str, Any]:
        if self.is_running:
            return {"success": True, "message": "Watcher läuft bereits", "inbox": self.inbox_dir}

        inbox_p = pathlib.Path(inbox_dir).expanduser()
        if not inbox_p.exists():
            try:
                os.makedirs(inbox_p, exist_ok=True)
            except Exception as e:
                raise ValueError(f"Inbox-Verzeichnis konnte nicht erstellt werden: {e}") from e

        if output_dir:
            output_dir = str(pathlib.Path(output_dir).expanduser())
            out_p = pathlib.Path(output_dir)
            if not out_p.exists():
                os.makedirs(out_p, exist_ok=True)

        self.inbox_dir = str(inbox_p.resolve())
        self.output_dir = str(pathlib.Path(output_dir).resolve()) if output_dir else None
        # A fresh event per run: a loop that is still busy converting after stop() must not be
        # revived by a later start() and end up running next to the new one.
        self._stop_event = threading.Event()
        self.is_running = True
        self.processed_files = {}
        self.last_error = None

        # Seed already existing files so we don't re-convert old files on start
        try:
            for entry in inbox_p.iterdir():
                if entry.is_file() and not entry.name.startswith("."):
                    self.processed_files[str(entry.resolve())] = self._signature(entry)
        except Exception:
            pass

        self._thread = threading.Thread(
            target=self._watch_loop, args=(self._stop_event,), name="folder-watcher", daemon=True
        )
        self._thread.start()

        return {
            "success": True,
            "is_running": True,
            "inbox": self.inbox_dir,
            "output": self.output_dir
        }

    def stop(self) -> Dict[str, Any]:
        if not self.is_running:
            return {"success": True, "is_running": False}

        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        self.is_running = False
        return {
            "success": True,
            "is_running": False,
            "processed_count": self.processed_count
        }

    def get_status(self) -> Dict[str, Any]:
        return {
            "is_running": self.is_running,
            "inbox": self.inbox_dir,
            "output": self.output_dir,
            "processed_count": self.processed_count,
            "last_error": self.last_error,
            "last_event_time": self.last_event_time
        }

    @staticmethod
    def _signature(entry: pathlib.Path) -> Tuple[int, float]:
        stat = entry.stat()
        return stat.st_size, stat.st_mtime

    def _watch_loop(self, stop_event: threading.Event):
        supported_exts = self.supported_fn() if self.supported_fn else DEFAULT_EXTENSIONS

        while not stop_event.is_set():
            try:
                if not self.inbox_dir or not os.path.exists(self.inbox_dir):
                    time.sleep(1.0)
                    continue

                inbox_p = pathlib.Path(self.inbox_dir)
                for entry in inbox_p.iterdir():
                    if stop_event.is_set():
                        break

                    if not entry.is_file() or entry.name.startswith("."):
                        continue

                    file_path = str(entry.resolve())
                    ext = entry.suffix.lower()

                    # Avoid converting output markdown files inside inbox
                    if ext in (".md", ".tmp_md"):
                        continue

                    if ext not in supported_exts:
                        continue

                    try:
                        initial = self._signature(entry)
                        if self.processed_files.get(file_path) == initial:
                            continue
                        # Wait briefly to ensure file finished writing
                        time.sleep(0.3)
                        if self._signature(entry) != initial:
                            continue  # still copying
                    except Exception:
                        continue

                    # Remember the version first: a failing file must not be retried every second.
                    self.processed_files[file_path] = initial
                    try:
                        res = self.convert_fn(file_path, self.output_dir)
                        if res.get("success"):
                            self.processed_count += 1
                            self.last_event_time = time.time()
                        else:
                            self.last_error = f"{entry.name}: {res.get('error') or 'Umwandlung fehlgeschlagen'}"
                    except Exception as conv_err:
                        self.last_error = f"{entry.name}: {conv_err}"

            except Exception as loop_err:
                self.last_error = str(loop_err)

            time.sleep(1.0)
