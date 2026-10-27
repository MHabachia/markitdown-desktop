"""Diagnostics, example files and opening things in the operating system."""

import os
import pathlib
import platform
import subprocess

from fastapi import APIRouter, HTTPException

from backend import config
from backend.models import OpenPathRequest
from backend.sample_generator import ensure_samples_dir, generate_sample_files
from backend.system_info import get_format_capabilities, get_system_diagnostics

router = APIRouter()


@router.get("/api/health")
def get_health():
    return get_system_diagnostics()


@router.get("/api/formats")
def get_formats():
    return get_format_capabilities()


def _open_with_os(target: str):
    if platform.system() == "Windows":
        os.startfile(target)  # type: ignore[attr-defined]
    else:
        subprocess.run(["open", target], check=True)


@router.post("/api/open-folder")
def open_folder(req: OpenPathRequest):
    path = req.path
    folder = os.path.dirname(path) if os.path.isfile(path) else path

    if not os.path.isdir(folder):
        raise HTTPException(status_code=404, detail="Ordner existiert nicht")

    try:
        _open_with_os(folder)
        return {"success": True, "opened": folder}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ordner konnte nicht geöffnet werden: {str(e)}") from e


@router.post("/api/open-file")
def open_file(req: OpenPathRequest):
    path = req.path
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Datei existiert nicht")
    # Allow-list, not a block-list: the app only ever opens the Markdown files it wrote.
    if pathlib.Path(path).suffix.lower() not in config.MARKDOWN_EXTENSIONS:
        raise HTTPException(status_code=403, detail="Es werden nur Markdown-Dateien geöffnet.")
    try:
        _open_with_os(path)
        return {"success": True, "opened": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Datei konnte nicht im Standardprogramm geöffnet werden: {str(e)}") from e


@router.post("/api/generate-samples")
def create_samples():
    # Generate into the user data folder: the app bundle itself may be read-only.
    samples_dir = ensure_samples_dir(os.path.join(config.DATA_DIR, "samples"))
    files_dict = generate_sample_files(samples_dir)
    file_items = []
    for fpath in files_dict.values():
        p = pathlib.Path(fpath)
        if p.exists():
            stat = p.stat()
            file_items.append({
                "name": p.name,
                "path": str(p.resolve()),
                "size": stat.st_size,
                "extension": p.suffix.lower(),
            })
    return {
        "success": True,
        "directory": samples_dir,
        "files": file_items
    }
