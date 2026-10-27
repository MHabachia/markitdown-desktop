"""Folders and limits of the local API. Other modules read these as `config.NAME` at call time."""

import os

# The desktop shell passes the OS app-data folder; ~/.markitdown-desktop remains the
# fallback for development and the source of a one-time migration.
LEGACY_DATA_DIR = os.path.expanduser("~/.markitdown-desktop")
DATA_DIR = os.environ.get("MARKITDOWN_DATA_DIR") or LEGACY_DATA_DIR
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
EXPORT_DIR = os.path.join(DATA_DIR, "exports")

MAX_RESOLVED_FILES = 5000
UPLOAD_MAX_AGE_SECONDS = 24 * 3600
MAX_UPLOAD_BYTES = 256 * 1024 * 1024
MAX_MARKDOWN_CHARS = 50 * 1024 * 1024
MAX_HISTORY_ENTRIES = 500
MARKDOWN_EXTENSIONS = {".md", ".markdown"}
# Editor exports chosen in a "save as" dialog may also be HTML or plain text.
EXPORT_EXTENSIONS = MARKDOWN_EXTENSIONS | {".html", ".txt"}
