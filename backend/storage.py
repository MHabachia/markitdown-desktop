"""History and settings on disk, uploaded copies and file names.

Nothing happens at import time: `init_storage()` prepares the data folder when the app is created.
"""

import json
import os
import re
import shutil
import threading
import time
import uuid
from typing import Any, Dict, List, Optional

from backend import config
from backend.fsutil import write_atomic
from backend.models import SettingsModel

# One lock serialises read-modify-write cycles on history.json / settings.json,
# since parallel API requests and the folder watcher all touch them.
_store_lock = threading.RLock()


def load_json_store(filepath: str, default_val: Any) -> Any:
    """Reads a JSON store. A file that cannot be parsed is moved aside (`.corrupt`) instead of
    being overwritten by the next save, so the user's data is not silently lost."""
    if not os.path.exists(filepath):
        return default_val
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, type(default_val)):
            return data
    except OSError:
        return default_val
    except ValueError:
        pass
    try:
        os.replace(filepath, f"{filepath}.corrupt")
        print(f"[Warning] {filepath} was unreadable and was moved to {filepath}.corrupt")
    except OSError as e:
        print(f"[Warning] Could not move aside {filepath}: {e}")
    return default_val


def save_json_store(filepath: str, data: Any) -> None:
    """Atomically replaces a JSON store. Raises OSError if it cannot be written."""
    write_atomic(filepath, json.dumps(data, indent=2, ensure_ascii=False))


def migrate_legacy_data() -> None:
    """Copies history and settings from the old data folder once, if the new one is empty."""
    if os.path.abspath(config.DATA_DIR) == os.path.abspath(config.LEGACY_DATA_DIR):
        return
    for name in ("history.json", "settings.json"):
        old, new = os.path.join(config.LEGACY_DATA_DIR, name), os.path.join(config.DATA_DIR, name)
        if os.path.isfile(old) and not os.path.exists(new):
            try:
                shutil.copy2(old, new)
            except OSError as e:
                print(f"[Warning] Could not migrate {name}: {e}")


def cleanup_old_uploads(max_age: Optional[float] = None) -> int:
    """Removes uploaded temp files older than max_age seconds. Returns removed count."""
    if max_age is None:
        max_age = config.UPLOAD_MAX_AGE_SECONDS
    removed = 0
    if not os.path.isdir(config.UPLOAD_DIR):
        return removed
    cutoff = time.time() - max_age
    for entry in os.scandir(config.UPLOAD_DIR):
        try:
            if entry.stat().st_mtime < cutoff:
                if entry.is_dir(follow_symlinks=False):
                    shutil.rmtree(entry.path, ignore_errors=True)
                else:
                    os.remove(entry.path)
                removed += 1
        except OSError:
            pass
    return removed


def init_storage() -> None:
    """Creates the data folder, takes over data of an older version and tidies old uploads."""
    os.makedirs(config.DATA_DIR, exist_ok=True)
    migrate_legacy_data()
    cleanup_old_uploads()


def safe_filename(name: Optional[str], default: str = "uploaded_document") -> str:
    """Reduces a client-supplied name to a harmless single path component."""
    base = os.path.basename((name or "").replace("\\", "/"))
    base = re.sub(r'[\x00-\x1f<>:"|?*]', "_", base).strip(" .")
    return base or default


def default_output_dir() -> str:
    downloads = os.path.expanduser("~/Downloads")
    return downloads if os.path.isdir(downloads) else os.path.join(config.DATA_DIR, "output")


# --- history -----------------------------------------------------------------


def get_history() -> List[Dict[str, Any]]:
    with _store_lock:
        return load_json_store(config.HISTORY_FILE, [])


def append_history(entry: Dict[str, Any]) -> None:
    with _store_lock:
        history = load_json_store(config.HISTORY_FILE, [])
        history.insert(0, entry)
        try:
            save_json_store(config.HISTORY_FILE, history[: config.MAX_HISTORY_ENTRIES])
        except OSError as e:
            # The conversion itself succeeded; a missing history line must not turn it into an error.
            print(f"[Error] Failed to save the history: {e}")


def clear_history() -> None:
    """Raises OSError if the history cannot be written."""
    with _store_lock:
        save_json_store(config.HISTORY_FILE, [])


def delete_history_item(item_id: str) -> None:
    """Raises OSError if the history cannot be written."""
    with _store_lock:
        history = load_json_store(config.HISTORY_FILE, [])
        save_json_store(config.HISTORY_FILE, [item for item in history if item.get("id") != item_id])


def make_history_entry(res: Dict[str, Any], source_path: str, source_name: str) -> Dict[str, Any]:
    if source_path and os.path.exists(source_path):
        size = os.path.getsize(source_path)
    else:
        size = res.get("file_size_bytes", 0)
    return {
        "id": f"hist_{uuid.uuid4().hex}",
        "source_name": source_name,
        "source_path": source_path,
        "target_path": res.get("target_path"),
        "status": "success" if res.get("success") else "failed",
        "timestamp": res.get("timestamp") or "",
        "duration_ms": res.get("duration_ms", 0),
        "word_count": res.get("word_count", 0),
        "file_size_bytes": size,
        "error": res.get("error"),
    }


# --- settings ----------------------------------------------------------------


def load_settings() -> Dict[str, Any]:
    settings = SettingsModel().model_dump()
    with _store_lock:
        saved = load_json_store(config.SETTINGS_FILE, {})
    # Ignore keys from older versions that the model no longer knows.
    settings.update({k: v for k, v in saved.items() if k in settings})
    return settings


def save_settings(data: Dict[str, Any]) -> None:
    """Raises OSError if the settings cannot be written."""
    with _store_lock:
        save_json_store(config.SETTINGS_FILE, data)
