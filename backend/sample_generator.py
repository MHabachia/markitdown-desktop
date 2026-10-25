"""
Example documents for trying the app (and for the tests).

The files ship with the app in backend/sample_files/ and are copied into a writable
folder on request, so the app does not need PDF/Office writer libraries at runtime.
"""

import os
import pathlib
import shutil

SAMPLE_DIR = pathlib.Path(__file__).resolve().parent / "sample_files"


def ensure_samples_dir(target_dir: str) -> str:
    os.makedirs(target_dir, exist_ok=True)
    return target_dir


def generate_sample_files(target_dir: str) -> dict:
    """Copies the example documents into target_dir; returns {extension without dot: path}."""
    ensure_samples_dir(target_dir)
    copied = {}
    for source in sorted(SAMPLE_DIR.iterdir()):
        if source.is_file() and not source.name.startswith("."):
            target = pathlib.Path(target_dir) / source.name
            shutil.copy2(source, target)
            copied[source.suffix.lstrip(".").lower()] = str(target)
    return copied
