"""The conversion engine and the folder watcher, shared by the routes."""

import os
from typing import Any, Dict, Optional

from backend import storage
from backend.engine import ConversionEngine
from backend.watcher import FolderWatcher

engine = ConversionEngine()


def convert_for_watcher(source: str, target_dir: Optional[str]) -> Dict[str, Any]:
    """Folder-watcher conversion: saved right away, with the user's settings, and listed in the history."""
    settings = storage.load_settings()
    res = engine.convert_file(
        source_path=source,
        target_dir=target_dir,
        collision_strategy=settings["collision_strategy"],
        keep_data_uris=settings["keep_data_uris"],
        filename_template=settings["filename_template"],
        timeout=settings["timeout_seconds"],
    )
    storage.append_history(storage.make_history_entry(res, source, os.path.basename(source)))
    return res


watcher = FolderWatcher(convert_fn=convert_for_watcher, supported_fn=engine.supported_extensions)
