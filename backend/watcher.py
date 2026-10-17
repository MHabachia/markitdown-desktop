"""
Folder Watcher Service for MarkItDown Desktop
Monitors an inbox directory in a background daemon thread and automatically
converts newly dropped documents to Markdown into a specified output directory.
"""

import os
import time
import pathlib
import threading
from typing import Dict, Any, Optional, Set, Callable

class FolderWatcher:
    def __init__(self, convert_fn: Callable[[str, Optional[str]], Dict[str, Any]]):
        self.convert_fn = convert_fn
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self.inbox_dir: Optional[str] = None
        self.output_dir: Optional[str] = None
        self.is_running: bool = False
        self.processed_count: int = 0
        self.processed_files: Set[str] = set()
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
                raise ValueError(f"Inbox-Verzeichnis konnte nicht erstellt werden: {e}")

        if output_dir:
            output_dir = str(pathlib.Path(output_dir).expanduser())
            out_p = pathlib.Path(output_dir)
            if not out_p.exists():
                os.makedirs(out_p, exist_ok=True)

        self.inbox_dir = str(inbox_p.resolve())
        self.output_dir = str(pathlib.Path(output_dir).resolve()) if output_dir else None
        self._stop_event.clear()
        self.is_running = True
        self.processed_files = set()

        # Seed already existing files so we don't re-convert old files on start
        try:
            for entry in inbox_p.iterdir():
                if entry.is_file() and not entry.name.startswith("."):
                    self.processed_files.add(str(entry.resolve()))
        except Exception:
            pass

        self._thread = threading.Thread(target=self._watch_loop, daemon=True)
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

    def _watch_loop(self):
        supported_exts = {
            ".pdf", ".docx", ".pptx", ".xlsx", ".html", ".htm",
            ".csv", ".json", ".xml", ".txt", ".ipynb", ".png", ".jpg", ".jpeg"
        }

        while not self._stop_event.is_set():
            try:
                if not self.inbox_dir or not os.path.exists(self.inbox_dir):
                    time.sleep(1.0)
                    continue

                inbox_p = pathlib.Path(self.inbox_dir)
                for entry in inbox_p.iterdir():
                    if self._stop_event.is_set():
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

                    if file_path in self.processed_files:
                        continue

                    # Wait briefly to ensure file finished writing
                    try:
                        initial_size = entry.stat().st_size
                        time.sleep(0.3)
                        if entry.stat().st_size != initial_size:
                            continue  # still copying
                    except Exception:
                        continue

                    # Execute conversion
                    try:
                        res = self.convert_fn(file_path, self.output_dir)
                        if res.get("success"):
                            self.processed_count += 1
                            self.processed_files.add(file_path)
                            self.last_event_time = time.time()
                    except Exception as conv_err:
                        self.last_error = str(conv_err)

            except Exception as loop_err:
                self.last_error = str(loop_err)

            time.sleep(1.0)
