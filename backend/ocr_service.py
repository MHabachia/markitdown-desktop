"""
Text recognition (OCR) for images.

RapidOCR runs on onnxruntime and ships its models inside the package, so it works offline
and needs nothing installed on the computer.
"""

import pathlib
import sys
from typing import Any, Dict, Optional

try:
    from PIL import Image
except ImportError:
    Image = None

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}

_engine = None


def _get_engine():
    """One engine per process; loading the models takes a moment, so it happens on first use."""
    global _engine
    if _engine is None:
        from rapidocr import RapidOCR
        _engine = RapidOCR(params={"Global.log_level": "warning"})
    return _engine


def run_ocr(file_path: str) -> Optional[str]:
    """Recognised text, one line per text line, or None if there is none (or OCR is unavailable)."""
    try:
        result = _get_engine()(file_path)
    except Exception as e:  # a broken image or missing models must not fail the whole conversion
        print(f"[Warning] OCR failed for {file_path}: {e}", file=sys.stderr)
        return None
    lines = [t.strip() for t in (getattr(result, "txts", None) or ()) if t and t.strip()]
    return "\n".join(lines) or None


def extract_image_visual_markdown(image_path: str) -> Dict[str, Any]:
    """
    Text for an image: the recognised text, or one short note if there is none.
    The output goes to AI tools, so it carries no boilerplate and no local file paths.
    """
    p = pathlib.Path(image_path)
    if not p.exists():
        return {"markdown": f"*(Bild {p.name} nicht gefunden)*\n", "has_ocr": False}

    ocr_text = run_ocr(image_path)
    if ocr_text:
        return {"markdown": ocr_text + "\n", "has_ocr": True}

    details = ""
    if Image is not None:
        try:
            with Image.open(image_path) as img:
                details = f" ({img.size[0]}×{img.size[1]} px, {img.format or p.suffix.lstrip('.').upper()})"
        except Exception:
            pass
    return {"markdown": f"*Bild {p.name}{details}: kein Text erkannt.*\n", "has_ocr": False}
