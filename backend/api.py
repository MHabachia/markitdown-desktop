"""
FastAPI Server for MarkItDown Desktop
Exposes REST endpoints for document conversion, batch queues, file inspections,
persistent history, and system diagnostics.

Security model: the server only binds to 127.0.0.1, rejects foreign Host/Origin
headers (CSRF / DNS rebinding) and, when MARKITDOWN_API_TOKEN is set (the Tauri
shell does this), requires that token in the X-API-Token header.
"""

import os
import sys

# Ensure repository root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import datetime
import json
import base64
import binascii
import hmac
import pathlib
import platform
import re
import shutil
import subprocess
import threading
import time
import uuid
import zipfile
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend.system_info import get_system_diagnostics, get_format_capabilities
from backend.engine import ConversionEngine
from backend.sample_generator import generate_sample_files, ensure_samples_dir
from backend.watcher import FolderWatcher
from backend.linter import clean_blank_lines, format_markdown_tables, generate_toc

app = FastAPI(title="MarkItDown Desktop API", version="1.0.0")

# --- Access control -------------------------------------------------------


API_TOKEN = os.environ.get("MARKITDOWN_API_TOKEN", "")

APP_ORIGINS = ["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"]
DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
# The desktop app always passes a token; without one we are in development (browser + Vite),
# which is the only case where the dev server's origin is allowed.
ALLOWED_ORIGINS = APP_ORIGINS if API_TOKEN else APP_ORIGINS + DEV_ORIGINS
ALLOWED_HOSTNAMES = {"127.0.0.1", "localhost", "[::1]"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def guard_requests(request: Request, call_next):
    raw_host = request.headers.get("host") or ""
    if raw_host.startswith("["):
        host = raw_host.split("]")[0] + "]"
    else:
        host = raw_host.split(":")[0]
    if host and host not in ALLOWED_HOSTNAMES:
        return JSONResponse({"detail": "Host nicht erlaubt"}, status_code=403)

    origin = request.headers.get("origin")
    if origin is not None and origin not in ALLOWED_ORIGINS:
        return JSONResponse({"detail": "Origin nicht erlaubt"}, status_code=403)

    # CORS preflights cannot carry custom headers; they are answered by CORSMiddleware.
    if API_TOKEN and request.method != "OPTIONS":
        supplied = request.headers.get("x-api-token", "")
        if not hmac.compare_digest(supplied.encode(), API_TOKEN.encode()):
            return JSONResponse({"detail": "Ungültiges oder fehlendes API-Token"}, status_code=401)

    return await call_next(request)


engine = ConversionEngine()
watcher = FolderWatcher(convert_fn=lambda src, out: engine.convert_file(source_path=src, target_dir=out))

# The desktop shell passes the OS app-data folder; ~/.markitdown-desktop remains the
# fallback for development and the source of a one-time migration.
LEGACY_DATA_DIR = os.path.expanduser("~/.markitdown-desktop")
DATA_DIR = os.environ.get("MARKITDOWN_DATA_DIR") or LEGACY_DATA_DIR
os.makedirs(DATA_DIR, exist_ok=True)
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
EXPORT_DIR = os.path.join(DATA_DIR, "exports")

MAX_RESOLVED_FILES = 5000
UPLOAD_MAX_AGE_SECONDS = 24 * 3600
MAX_UPLOAD_BYTES = 256 * 1024 * 1024
MARKDOWN_EXTENSIONS = {".md", ".markdown"}
# Editor exports chosen in a "save as" dialog may also be HTML or plain text.
EXPORT_EXTENSIONS = MARKDOWN_EXTENSIONS | {".html", ".txt"}

# One lock serialises read-modify-write cycles on history.json / settings.json,
# since parallel API requests and the folder watcher all touch them.
_store_lock = threading.RLock()


def load_json_store(filepath: str, default_val: Any) -> Any:
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return default_val
    return default_val


def save_json_store(filepath: str, data: Any):
    try:
        temp_file = f"{filepath}.{uuid.uuid4().hex}.tmp"
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(temp_file, filepath)
    except Exception as e:
        print(f"[Error] Failed to save {filepath}: {e}")


def migrate_legacy_data() -> None:
    """Copies history and settings from the old data folder once, if the new one is empty."""
    if os.path.abspath(DATA_DIR) == os.path.abspath(LEGACY_DATA_DIR):
        return
    for name in ("history.json", "settings.json"):
        old, new = os.path.join(LEGACY_DATA_DIR, name), os.path.join(DATA_DIR, name)
        if os.path.isfile(old) and not os.path.exists(new):
            try:
                shutil.copy2(old, new)
            except OSError as e:
                print(f"[Warning] Could not migrate {name}: {e}")


migrate_legacy_data()


def cleanup_old_uploads(max_age: float = UPLOAD_MAX_AGE_SECONDS) -> int:
    """Removes uploaded temp files older than max_age seconds. Returns removed count."""
    removed = 0
    if not os.path.isdir(UPLOAD_DIR):
        return removed
    cutoff = time.time() - max_age
    for entry in os.scandir(UPLOAD_DIR):
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


cleanup_old_uploads()


def safe_filename(name: Optional[str], default: str = "uploaded_document") -> str:
    """Reduces a client-supplied name to a harmless single path component."""
    base = os.path.basename((name or "").replace("\\", "/"))
    base = re.sub(r'[\x00-\x1f<>:"|?*]', "_", base).strip(" .")
    return base or default


def append_history(entry: Dict[str, Any]):
    with _store_lock:
        history = load_json_store(HISTORY_FILE, [])
        history.insert(0, entry)
        save_json_store(HISTORY_FILE, history[:500])


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


def load_settings() -> Dict[str, Any]:
    settings = SettingsModel().model_dump()
    with _store_lock:
        saved = load_json_store(SETTINGS_FILE, {})
    # Ignore keys from older versions that the model no longer knows.
    settings.update({k: v for k, v in saved.items() if k in settings})
    return settings


# Models
class ConvertRequest(BaseModel):
    source_path: Optional[str] = None
    file_base64: Optional[str] = None
    file_name: Optional[str] = None
    target_dir: Optional[str] = None
    filename_template: Optional[str] = None
    collision_strategy: str = Field(default="rename", description="rename, overwrite, skip, error")
    keep_data_uris: bool = False
    # False: return the Markdown only; the user previews it and saves explicitly.
    save: bool = True

MAX_MARKDOWN_CHARS = 50 * 1024 * 1024

class SaveMarkdownRequest(BaseModel):
    content: str = Field(max_length=MAX_MARKDOWN_CHARS)
    source_path: Optional[str] = None
    file_name: Optional[str] = None
    target_dir: Optional[str] = None
    # Exact file chosen in a "save as" dialog (the dialog already asked about overwriting).
    target_path: Optional[str] = None
    filename_template: Optional[str] = None
    collision_strategy: str = "rename"
    word_count: Optional[int] = None
    duration_ms: Optional[float] = None

class ZipItem(BaseModel):
    name: str
    content: str = Field(max_length=MAX_MARKDOWN_CHARS)

class ResolvePathsRequest(BaseModel):
    paths: List[str] = Field(default_factory=list, max_length=10000)

class SaveFileRequest(BaseModel):
    file_path: str
    content: str

class OpenPathRequest(BaseModel):
    path: str

class LinterRequest(BaseModel):
    content: str

class WatcherStartRequest(BaseModel):
    inbox_dir: str
    output_dir: Optional[str] = None

class SettingsModel(BaseModel):
    theme: str = "system"  # dark, light, system
    default_output_dir: str = ""
    open_output_after_convert: bool = False
    open_preview_after_convert: bool = True
    collision_strategy: str = "rename"
    filename_template: str = "{name}.md"
    concurrency_limit: int = Field(default=4, ge=1, le=16)
    watcher_inbox_dir: str = ""
    watcher_output_dir: str = ""
    keep_data_uris: bool = False
    # Off: results are previewed first and saved explicitly.
    auto_save_after_convert: bool = False
    # Asks GitHub for a newer release a few seconds after start (no data is sent).
    check_updates: bool = True
    timeout_seconds: int = Field(default=60, ge=1, le=3600)

@app.get("/api/health")
def get_health():
    return get_system_diagnostics()

@app.get("/api/formats")
def get_formats():
    return get_format_capabilities()

@app.post("/api/convert")
def convert_single(req: ConvertRequest):
    source_path = req.source_path
    file_name = req.file_name

    if req.file_base64:
        raw_b64 = req.file_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        if len(raw_b64) * 3 // 4 > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Upload ist zu groß.")
        try:
            payload = base64.b64decode(raw_b64, validate=False)
        except (binascii.Error, ValueError):
            raise HTTPException(status_code=400, detail="file_base64 ist kein gültiges Base64.")

        # Each upload gets its own directory and a sanitised name: no traversal, no clobbering.
        fname = safe_filename(req.file_name)
        upload_dir = os.path.join(UPLOAD_DIR, uuid.uuid4().hex)
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

    if req.target_dir:
        out_dir: Optional[str] = os.path.expanduser(req.target_dir)  # created if missing
    elif req.file_base64:
        # An upload is only a temporary copy, so "next to the original" is impossible.
        out_dir = _default_output_dir()
    else:
        out_dir = None  # next to the source file

    res = engine.convert_file(
        source_path=source_path,
        target_dir=out_dir,
        collision_strategy=req.collision_strategy,
        keep_data_uris=req.keep_data_uris,
        filename_template=req.filename_template,
        save=req.save
    )

    # The history lists files on disk: unsaved results are recorded when they are saved.
    if res.get("saved") or not res.get("success"):
        append_history(make_history_entry(res, source_path, file_name or os.path.basename(source_path)))

    return res


def _default_output_dir() -> str:
    downloads = os.path.expanduser("~/Downloads")
    return downloads if os.path.isdir(downloads) else os.path.join(DATA_DIR, "output")


@app.post("/api/save-markdown")
def save_markdown(req: SaveMarkdownRequest):
    """Saves a previewed (possibly edited) result: next to the source, into the target folder, or to a chosen file."""
    if req.target_path:
        target = pathlib.Path(req.target_path).expanduser()
        if target.suffix.lower() not in {".md", ".markdown"} or not target.parent.is_dir():
            raise HTTPException(status_code=400, detail="Ziel muss eine .md-Datei in einem vorhandenen Ordner sein.")
        engine.write_atomic(str(target), req.content)
        result = {"target_path": str(target), "saved": True, "skipped": False, "file_size_bytes": target.stat().st_size}
    else:
        source = pathlib.Path(req.source_path).expanduser() if req.source_path else None
        if source is not None and source.is_file():
            source_path, target_dir = str(source), req.target_dir
        else:
            # Uploaded copy (browser mode): there is no original folder to save next to.
            target_dir = req.target_dir or _default_output_dir()
            source_path = os.path.join(target_dir, safe_filename(req.file_name, "dokument"))
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
            raise HTTPException(status_code=409, detail=str(e))

    if result.get("saved"):
        name = req.file_name or os.path.basename(req.source_path or result["target_path"])
        append_history(make_history_entry(
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

@app.post("/api/resolve-paths")
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
            if len(files) >= MAX_RESOLVED_FILES:
                return {"files": files, "skipped": skipped, "truncated": True}
    return {"files": files, "skipped": skipped, "truncated": False}

@app.post("/api/save-file")
def save_file(req: SaveFileRequest):
    p = pathlib.Path(req.file_path)
    if p.suffix.lower() not in EXPORT_EXTENSIONS:
        raise HTTPException(status_code=403, detail="Nur Markdown-, HTML- und Textdateien können gespeichert werden.")
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_name(f".{p.name}.{uuid.uuid4().hex}.tmp")
        tmp.write_text(req.content, encoding="utf-8")
        os.replace(tmp, p)
        return {
            "success": True,
            "path": str(p.resolve()),
            "size": p.stat().st_size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Speichern der Datei: {str(e)}")

def _open_with_os(target: str):
    if platform.system() == "Windows":
        os.startfile(target)  # type: ignore[attr-defined]
    else:
        subprocess.run(["open", target], check=True)


@app.post("/api/open-folder")
def open_folder(req: OpenPathRequest):
    path = req.path
    folder = os.path.dirname(path) if os.path.isfile(path) else path

    if not os.path.isdir(folder):
        raise HTTPException(status_code=404, detail="Ordner existiert nicht")

    try:
        _open_with_os(folder)
        return {"success": True, "opened": folder}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ordner konnte nicht geöffnet werden: {str(e)}")

@app.post("/api/open-file")
def open_file(req: OpenPathRequest):
    path = req.path
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Datei existiert nicht")
    # Allow-list, not a block-list: the app only ever opens the Markdown files it wrote.
    if pathlib.Path(path).suffix.lower() not in MARKDOWN_EXTENSIONS:
        raise HTTPException(status_code=403, detail="Es werden nur Markdown-Dateien geöffnet.")
    try:
        _open_with_os(path)
        return {"success": True, "opened": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Datei konnte nicht im Standardprogramm geöffnet werden: {str(e)}")

@app.post("/api/generate-samples")
def create_samples():
    # Generate into the user data folder: the app bundle itself may be read-only.
    samples_dir = ensure_samples_dir(os.path.join(DATA_DIR, "samples"))
    files_dict = generate_sample_files(samples_dir)
    file_items = []
    for key, fpath in files_dict.items():
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

@app.get("/api/history")
def get_history():
    with _store_lock:
        return load_json_store(HISTORY_FILE, [])

@app.delete("/api/history")
def clear_history():
    with _store_lock:
        save_json_store(HISTORY_FILE, [])
    return {"success": True}

@app.delete("/api/history/{item_id}")
def delete_history_item(item_id: str):
    with _store_lock:
        history = load_json_store(HISTORY_FILE, [])
        updated = [item for item in history if item.get("id") != item_id]
        save_json_store(HISTORY_FILE, updated)
    return {"success": True}

@app.get("/api/settings")
def get_settings():
    return load_settings()

@app.post("/api/settings")
def update_settings(settings: SettingsModel):
    data = settings.model_dump()
    with _store_lock:
        save_json_store(SETTINGS_FILE, data)
    return data

class ExportZipRequest(BaseModel):
    # Current (possibly edited, possibly unsaved) results, so the ZIP matches the preview.
    items: List[ZipItem] = Field(max_length=10000)
    zip_name: Optional[str] = "markitdown_export.zip"
    # Full path chosen in a save dialog; must end in .zip and its folder must exist.
    target_path: Optional[str] = None

@app.post("/api/export-zip")
def export_zip(req: ExportZipRequest):
    if not req.items:
        raise HTTPException(status_code=400, detail="Keine Dateien angegeben")

    if req.target_path:
        target = pathlib.Path(req.target_path).expanduser()
        if target.suffix.lower() != ".zip" or not target.parent.is_dir():
            raise HTTPException(status_code=400, detail="Ziel muss eine .zip-Datei in einem vorhandenen Ordner sein.")
        zip_path = str(target)
    else:
        zip_name = safe_filename(req.zip_name, "markitdown_export.zip")
        if not zip_name.lower().endswith(".zip"):
            zip_name += ".zip"
        os.makedirs(EXPORT_DIR, exist_ok=True)
        zip_path = os.path.join(EXPORT_DIR, zip_name)

    used_names = set()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for item in req.items:
            stem = pathlib.Path(safe_filename(item.name, "dokument")).stem
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

@app.post("/api/watcher/start")
def start_watcher(req: WatcherStartRequest):
    try:
        res = watcher.start(inbox_dir=req.inbox_dir, output_dir=req.output_dir)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/watcher/stop")
def stop_watcher():
    return watcher.stop()

@app.get("/api/watcher/status")
def get_watcher_status():
    return watcher.get_status()

@app.post("/api/linter/format-tables")
def api_format_tables(req: LinterRequest):
    return {"formatted": format_markdown_tables(req.content)}

@app.post("/api/linter/clean-whitespace")
def api_clean_whitespace(req: LinterRequest):
    return {"formatted": clean_blank_lines(req.content)}

@app.post("/api/linter/generate-toc")
def api_generate_toc(req: LinterRequest):
    return {"formatted": generate_toc(req.content)}


def _parent_alive(pid: int) -> bool:
    if platform.system() == "Windows":
        import ctypes
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        STILL_ACTIVE = 259
        handle = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if not handle:
            return False
        code = ctypes.c_ulong()
        ok = ctypes.windll.kernel32.GetExitCodeProcess(handle, ctypes.byref(code))
        ctypes.windll.kernel32.CloseHandle(handle)
        return bool(ok) and code.value == STILL_ACTIVE
    return os.getppid() == pid


def _exit_with_parent(pid: int):
    """Terminates this process once the supervising Tauri shell is gone (crash, kill -9)."""
    while True:
        time.sleep(2.0)
        if not _parent_alive(pid):
            os._exit(0)


if __name__ == "__main__":
    import uvicorn

    parent_pid = os.environ.get("MARKITDOWN_PARENT_PID", "")
    if parent_pid.isdigit():
        threading.Thread(target=_exit_with_parent, args=(int(parent_pid),), daemon=True).start()

    port = int(os.environ.get("MARKITDOWN_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port, reload=False)
