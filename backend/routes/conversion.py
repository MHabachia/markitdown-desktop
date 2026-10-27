"""Converting, saving and exporting documents."""

import base64
import binascii
import datetime
import os
import pathlib
import shutil
import uuid
import zipfile
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException

from backend import config, storage
from backend.fsutil import write_atomic
from backend.models import (
    ConvertRequest,
    ExportZipRequest,
    ResolvePathsRequest,
    SaveFileRequest,
    SaveMarkdownRequest,
)
from backend.services import engine

router = APIRouter()


@router.post("/api/convert")
def convert_single(req: ConvertRequest):
    source_path = req.source_path
    file_name = req.file_name

    if req.file_base64:
        raw_b64 = req.file_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        if len(raw_b64) * 3 // 4 > config.MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Upload ist zu groß.")
        try:
            payload = base64.b64decode(raw_b64, validate=False)
        except (binascii.Error, ValueError) as e:
            raise HTTPException(status_code=400, detail="file_base64 ist kein gültiges Base64.") from e

        # Each upload gets its own directory and a sanitised name: no traversal, no clobbering.
        fname = storage.safe_filename(req.file_name)
        upload_dir = os.path.join(config.UPLOAD_DIR, uuid.uuid4().hex)
        os.makedirs(upload_dir, exist_ok=True)
        save_path = os.path.join(upload_dir, fname)
        with open(save_path, "wb") as f:
            f.write(payload)
        source_path = save_path
        file_name = fname
    elif source_path:
        file_name = req.file_name or os.path.basename(source_path)

    if not source_path:
        raise HTTPException(status_code=400, detail="Weder source_path noch file_base64 angegeben.")

    upload_dir_to_remove = os.path.dirname(source_path) if req.file_base64 else None
    try:
        return _convert_and_record(req, source_path, file_name)
    finally:
        # An upload is only a temporary copy; it is not needed once the result is in the response.
        if upload_dir_to_remove:
            shutil.rmtree(upload_dir_to_remove, ignore_errors=True)


def _convert_and_record(req: ConvertRequest, source_path: str, file_name: Optional[str]) -> Dict[str, Any]:
    if req.target_dir:
        out_dir: Optional[str] = os.path.expanduser(req.target_dir)  # created if missing
    elif req.file_base64:
        # An upload is only a temporary copy, so "next to the original" is impossible.
        out_dir = storage.default_output_dir()
    else:
        out_dir = None  # next to the source file

    res = engine.convert_file(
        source_path=source_path,
        target_dir=out_dir,
        collision_strategy=req.collision_strategy,
        keep_data_uris=req.keep_data_uris,
        filename_template=req.filename_template,
        save=req.save,
        timeout=storage.load_settings()["timeout_seconds"]
    )

    # The history lists files on disk: unsaved results are recorded when they are saved.
    if res.get("saved") or not res.get("success"):
        storage.append_history(
            storage.make_history_entry(res, source_path, file_name or os.path.basename(source_path))
        )

    return res


@router.post("/api/save-markdown")
def save_markdown(req: SaveMarkdownRequest):
    """Saves a previewed (possibly edited) result: next to the source, into the target folder, or to a chosen file."""
    if req.target_path:
        target = pathlib.Path(req.target_path).expanduser()
        if target.suffix.lower() not in {".md", ".markdown"} or not target.parent.is_dir():
            raise HTTPException(status_code=400, detail="Ziel muss eine .md-Datei in einem vorhandenen Ordner sein.")
        write_atomic(str(target), req.content)
        result = {"target_path": str(target), "saved": True, "skipped": False, "file_size_bytes": target.stat().st_size}
    else:
        source = pathlib.Path(req.source_path).expanduser() if req.source_path else None
        if source is not None and source.is_file():
            source_path, target_dir = str(source), req.target_dir
        else:
            # Uploaded copy (browser mode): there is no original folder to save next to.
            target_dir = req.target_dir or storage.default_output_dir()
            source_path = os.path.join(target_dir, storage.safe_filename(req.file_name, "dokument"))
        if target_dir:
            target_dir = os.path.expanduser(target_dir)
        try:
            result = engine.save_markdown(
                source_path=source_path,
                content=req.content,
                target_dir=target_dir,
                collision_strategy=req.collision_strategy,
                filename_template=req.filename_template
            )
        except FileExistsError as e:
            raise HTTPException(status_code=409, detail=str(e)) from e

    if result.get("saved"):
        name = req.file_name or os.path.basename(req.source_path or result["target_path"])
        storage.append_history(storage.make_history_entry(
            {
                "success": True,
                "target_path": result["target_path"],
                "word_count": req.word_count if req.word_count is not None else len(req.content.split()),
                "duration_ms": req.duration_ms or 0,
                "timestamp": datetime.datetime.now().isoformat(),
                "file_size_bytes": result.get("file_size_bytes", 0),
            },
            req.source_path or "",
            name,
        ))
    return {"success": True, **result}


@router.post("/api/resolve-paths")
def resolve_paths(req: ResolvePathsRequest):
    """Expands chosen or dropped paths (files and folders) into supported files with metadata."""
    files: List[Dict[str, Any]] = []
    seen = set()
    skipped = 0
    for raw in req.paths:
        p = pathlib.Path(raw).expanduser()
        if p.is_dir():
            candidates = engine.scan_directory(str(p), recursive=True)
        elif p.is_file():
            info = engine.describe_file(p)
            candidates = [info] if info else []
            skipped += 0 if info else 1
        else:
            skipped += 1
            continue
        for info in candidates:
            if info["path"] in seen:
                continue
            seen.add(info["path"])
            files.append(info)
            if len(files) >= config.MAX_RESOLVED_FILES:
                return {"files": files, "skipped": skipped, "truncated": True}
    return {"files": files, "skipped": skipped, "truncated": False}


@router.post("/api/save-file")
def save_file(req: SaveFileRequest):
    p = pathlib.Path(req.file_path)
    if p.suffix.lower() not in config.EXPORT_EXTENSIONS:
        raise HTTPException(status_code=403, detail="Nur Markdown-, HTML- und Textdateien können gespeichert werden.")
    if not p.parent.is_dir():
        raise HTTPException(status_code=400, detail="Der Zielordner existiert nicht.")
    try:
        write_atomic(str(p), req.content)
        return {
            "success": True,
            "path": str(p.resolve()),
            "size": p.stat().st_size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Speichern der Datei: {str(e)}") from e


@router.post("/api/export-zip")
def export_zip(req: ExportZipRequest):
    if not req.items:
        raise HTTPException(status_code=400, detail="Keine Dateien angegeben")

    if req.target_path:
        target = pathlib.Path(req.target_path).expanduser()
        if target.suffix.lower() != ".zip" or not target.parent.is_dir():
            raise HTTPException(status_code=400, detail="Ziel muss eine .zip-Datei in einem vorhandenen Ordner sein.")
        zip_path = str(target)
    else:
        zip_name = storage.safe_filename(req.zip_name, "markitdown_export.zip")
        if not zip_name.lower().endswith(".zip"):
            zip_name += ".zip"
        os.makedirs(config.EXPORT_DIR, exist_ok=True)
        zip_path = os.path.join(config.EXPORT_DIR, zip_name)

    used_names = set()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for item in req.items:
            stem = pathlib.Path(storage.safe_filename(item.name, "dokument")).stem
            arcname, counter = f"{stem}.md", 1
            while arcname in used_names:
                arcname = f"{stem} ({counter}).md"
                counter += 1
            used_names.add(arcname)
            zf.writestr(arcname, item.content)

    return {
        "success": True,
        "zip_path": zip_path,
        "size_bytes": os.path.getsize(zip_path),
        "file_count": len(used_names)
    }
