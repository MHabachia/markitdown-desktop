"""
MarkItDown Conversion Engine Wrapper
Provides robust, thread-safe document conversion using Microsoft's official MarkItDown library.
Handles filename formatting, collision prevention, detailed timing, error diagnostics,
and batch queue execution.
"""

import os
import sys

# Ensure repository root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import re
import uuid
import time
import threading
import datetime
import pathlib
import traceback
from typing import Dict, Any, Optional, List

try:
    from markitdown import MarkItDown
except ImportError:
    MarkItDown = None

from backend.isolation import ConversionPool, ConversionTimeout, RemoteError
from backend.ocr_service import extract_image_visual_markdown

_UNSAFE_NAME_CHARS = re.compile(r'[\x00-\x1f<>:"/\\|?*]')


def _safe_markdown_name(name: str, fallback: str) -> str:
    """Strips path separators and reserved characters from a generated file name."""
    cleaned = _UNSAFE_NAME_CHARS.sub("_", name).strip(" .")
    if not cleaned or cleaned in {".md", "_.md"} or set(cleaned) <= {".", "_"}:
        cleaned = fallback
    if not cleaned.lower().endswith(".md"):
        cleaned += ".md"
    return cleaned


class ConversionEngine:
    def __init__(self):
        self._path_lock = threading.Lock()
        # MarkItDown does not document thread safety, and conversions run in parallel
        # request threads: every thread gets its own instance.
        self._local = threading.local()
        self._pool = ConversionPool()

    @property
    def md(self):
        if MarkItDown is None:
            return None
        if not hasattr(self._local, "md"):
            self._local.md = MarkItDown(enable_plugins=False)
        return self._local.md

    def compute_target_path(
        self,
        source_path: str,
        target_dir: Optional[str] = None,
        collision_strategy: str = "rename",
        filename_template: Optional[str] = None
    ) -> str:
        """
        Safe destination path from the target folder (default: next to the source) and the
        naming template ({name}, {date}, {time}, {ext}).
        """
        source_p = pathlib.Path(source_path)
        base_name = source_p.stem
        raw_ext = source_p.suffix.lstrip(".").lower()

        if not target_dir:
            out_dir = source_p.parent
        else:
            out_dir = pathlib.Path(target_dir).expanduser()

        os.makedirs(out_dir, exist_ok=True)

        now = datetime.datetime.now()
        now_str = now.strftime("%Y%m%d_%H%M%S")
        date_str = now.strftime("%Y-%m-%d")

        # Apply template if supplied
        if filename_template and filename_template.strip():
            tpl = filename_template.strip()
            candidate_name = (
                tpl.replace("{name}", base_name)
                   .replace("{date}", date_str)
                   .replace("{time}", now_str)
                   .replace("{ext}", raw_ext)
            )
            if not candidate_name.endswith(".md"):
                candidate_name += ".md"
        else:
            candidate_name = f"{base_name}.md"

        # The template is user input: keep the result a single file name
        # so it can never point outside the target directory.
        candidate_name = _safe_markdown_name(candidate_name, fallback=f"{base_name}.md")
        target_file = out_dir / candidate_name

        # Collision Handling
        if collision_strategy == "overwrite":
            return str(target_file)
        elif collision_strategy == "skip":
            return str(target_file)
        elif collision_strategy == "rename":
            if not target_file.exists():
                return str(target_file)
            counter = 1
            stem = target_file.stem
            while True:
                numbered_file = out_dir / f"{stem} ({counter}).md"
                if not numbered_file.exists():
                    return str(numbered_file)
                counter += 1
        elif collision_strategy == "error":
            if target_file.exists():
                raise FileExistsError(f"Zieldatei existiert bereits: {target_file}")
            return str(target_file)

        return str(target_file)

    def convert_file(
        self,
        source_path: str,
        target_dir: Optional[str] = None,
        collision_strategy: str = "rename",
        keep_data_uris: bool = False,
        filename_template: Optional[str] = None,
        save: bool = True,
        timeout: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Converts a single document to Markdown using Microsoft MarkItDown.
        With a timeout (seconds) the conversion runs in a worker process that is killed when
        the time is up; without one it runs in this process.
        With save=False nothing is written: the app shows the result first and the user
        saves it explicitly (see save_markdown). The folder watcher keeps save=True.
        Returns complete execution status, content, timing and error diagnostics.
        """
        start_time = time.perf_counter()
        source_p = pathlib.Path(source_path)

        if not source_p.exists():
            return {
                "success": False,
                "source_path": source_path,
                "error": "Quelldatei wurde nicht gefunden.",
                "error_details": f"Pfad existiert nicht: {source_path}",
                "solution_hint": "Überprüfe, ob die Datei verschoben oder gelöscht wurde.",
                "duration_ms": 0.0
            }

        if not os.access(source_path, os.R_OK):
            return {
                "success": False,
                "source_path": source_path,
                "error": "Keine Leserechte für Quelldatei.",
                "error_details": f"Permission denied: {source_path}",
                "solution_hint": "Prüfe die Dateiberechtigungen im Betriebssystem.",
                "duration_ms": 0.0
            }

        if timeout is None and self.md is None:
            return {
                "success": False,
                "source_path": source_path,
                "error": "MarkItDown Engine ist nicht geladen.",
                "error_details": "Das Modul 'markitdown' konnte in der aktuellen Python-Umgebung nicht importiert werden.",
                "solution_hint": "Führe 'pip install markitdown[all]' aus und starte die Engine neu.",
                "duration_ms": 0.0
            }

        try:
            if timeout is None:
                result = self.md.convert(str(source_p), keep_data_uris=keep_data_uris)
                markdown_content = result.text_content or ""
                doc_title = getattr(result, "title", None)
            else:
                markdown_content, doc_title = self._pool.convert(str(source_p), keep_data_uris, timeout)

            # OCR / Visual Fallback for image formats or empty documents
            ext = source_p.suffix.lower()
            if (not markdown_content.strip()) or (ext in (".png", ".jpg", ".jpeg", ".webp", ".bmp")):
                image_info = extract_image_visual_markdown(str(source_p))
                if not markdown_content.strip():
                    markdown_content = image_info.get("markdown", "")
                elif image_info.get("has_ocr"):
                    markdown_content = markdown_content + "\n\n" + image_info.get("markdown", "")

            out: Dict[str, Any] = {
                "success": True,
                "source_path": source_path,
                "target_path": None,
                "saved": False,
                "skipped": False,
                "title": doc_title,
                "markdown": markdown_content,
                "char_count": len(markdown_content),
                "word_count": len(markdown_content.split()),
                "line_count": len(markdown_content.splitlines()),
                "duration_ms": round((time.perf_counter() - start_time) * 1000, 2),
                "timestamp": datetime.datetime.now().isoformat()
            }
            if save:
                out.update(self.save_markdown(
                    source_path=source_path,
                    content=markdown_content,
                    target_dir=target_dir,
                    collision_strategy=collision_strategy,
                    filename_template=filename_template
                ))
            return out

        except ConversionTimeout:
            return {
                "success": False,
                "source_path": source_path,
                "target_path": None,
                "error": f"Zeitüberschreitung nach {round(timeout or 0)} s",
                "error_details": "Die Umwandlung wurde abgebrochen, weil das Zeitlimit erreicht war.",
                "solution_hint": "Erhöhe das Zeitlimit in den Einstellungen oder wandle die Datei einzeln um.",
                "duration_ms": round((time.perf_counter() - start_time) * 1000, 2),
                "timestamp": datetime.datetime.now().isoformat()
            }
        except Exception as e:
            end_time = time.perf_counter()
            duration_ms = round((end_time - start_time) * 1000, 2)
            tb = e.details if isinstance(e, RemoteError) else traceback.format_exc()
            err_msg = str(e)

            hint = "Überprüfe das Dateiformat und stelle sicher, dass die Datei nicht beschädigt ist."
            if "password" in err_msg.lower() or "encrypted" in err_msg.lower():
                hint = "Die Datei ist möglicherweise kennwortgeschützt oder verschlüsselt."
            elif "zip" in err_msg.lower() or "badzipfile" in err_msg.lower():
                hint = "Das Office-Dokument oder Archiv ist unvollständig oder korrupt."
            elif "codec" in err_msg.lower() or "decode" in err_msg.lower():
                hint = "Die Datei enthält ungültige Zeichenkodierungen (z.B. kein valides UTF-8/Latin-1)."

            return {
                "success": False,
                "source_path": source_path,
                "target_path": None,
                "error": err_msg or type(e).__name__,
                "error_details": tb,
                "solution_hint": hint,
                "duration_ms": duration_ms,
                "timestamp": datetime.datetime.now().isoformat()
            }

    @staticmethod
    def write_atomic(path: str, content: str) -> None:
        """Writes via a temporary file in the same folder so a crash never leaves half a file."""
        target = pathlib.Path(path)
        tmp = target.with_name(f".{target.name}.{uuid.uuid4().hex}.tmp")
        try:
            tmp.write_text(content, encoding="utf-8")
            os.replace(tmp, target)
        finally:
            if tmp.exists():
                tmp.unlink()

    def save_markdown(
        self,
        source_path: str,
        content: str,
        target_dir: Optional[str] = None,
        collision_strategy: str = "rename",
        filename_template: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Saves Markdown for source_path using the naming template and collision rule.
        Raises FileExistsError for collision_strategy="error".
        """
        # Choosing the name and writing happen under one lock, so parallel saves never
        # pick the same "name (1).md".
        with self._path_lock:
            target_path = self.compute_target_path(
                source_path=source_path,
                target_dir=target_dir,
                collision_strategy=collision_strategy,
                filename_template=filename_template
            )
            if collision_strategy == "skip" and os.path.exists(target_path):
                return {"target_path": target_path, "saved": False, "skipped": True}
            self.write_atomic(target_path, content)
        return {
            "target_path": target_path,
            "saved": True,
            "skipped": False,
            "file_size_bytes": os.path.getsize(target_path)
        }

    @staticmethod
    def supported_extensions() -> set:
        from backend.system_info import get_format_capabilities
        return {ext.lower() for cap in get_format_capabilities() if cap["status"] == "ready" for ext in cap["extensions"]}

    def describe_file(self, path: pathlib.Path, supported: Optional[set] = None) -> Optional[Dict[str, Any]]:
        """Metadata for a supported file, or None if the type is not supported or unreadable."""
        ext = path.suffix.lower()
        if ext not in (supported if supported is not None else self.supported_extensions()):
            return None
        try:
            stat = path.stat()
        except OSError:
            return None
        return {
            "name": path.name,
            "path": str(path.resolve()),
            "size": stat.st_size,
            "extension": ext,
            "modified": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat()
        }

    def scan_directory(self, dir_path: str, recursive: bool = True, limit: int = 5000) -> List[Dict[str, Any]]:
        """Supported files in a directory; hidden files and folders (e.g. .git) are skipped."""
        root = pathlib.Path(dir_path)
        if not root.is_dir():
            return []
        supported = self.supported_extensions()
        found: List[Dict[str, Any]] = []
        for current, dirs, files in os.walk(root):
            dirs[:] = sorted(d for d in dirs if not d.startswith(".")) if recursive else []
            for name in sorted(files):
                if name.startswith("."):
                    continue
                info = self.describe_file(pathlib.Path(current) / name, supported)
                if info:
                    found.append(info)
                    if len(found) >= limit:
                        return found
        return found
