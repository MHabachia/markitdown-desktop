"""File helpers shared by the engine, the API and the JSON stores."""

import os
import pathlib
import uuid


def write_atomic(path: str, content: str) -> None:
    """Writes via a temporary file in the same folder, so a crash never leaves half a file."""
    target = pathlib.Path(path)
    tmp = target.with_name(f".{target.name}.{uuid.uuid4().hex}.tmp")
    try:
        tmp.write_text(content, encoding="utf-8")
        os.replace(tmp, target)
    finally:
        if tmp.exists():
            tmp.unlink()
