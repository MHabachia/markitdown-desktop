"""
OCR and Visual Document Processing Service
Enhances image and scan conversions with OCR capabilities and visual metadata extraction.
"""

import os
import shutil
import subprocess
import pathlib
from typing import Dict, Any, Optional

try:
    from PIL import Image
except ImportError:
    Image = None

def run_local_ocr_if_available(file_path: str) -> Optional[str]:
    """
    Attempts to run OCR using local system utilities if available (e.g. tesseract).
    """
    tesseract_bin = shutil.which("tesseract")
    if tesseract_bin and os.path.exists(file_path):
        try:
            res = subprocess.run(
                [tesseract_bin, file_path, "stdout", "-l", "deu+eng"],
                capture_output=True,
                text=True,
                timeout=15
            )
            if res.returncode == 0 and res.stdout.strip():
                return res.stdout.strip()
        except Exception:
            pass
    return None

def extract_image_visual_markdown(image_path: str) -> Dict[str, Any]:
    """
    Text for an image: the OCR result if Tesseract is available, otherwise one short note.
    The output goes to AI tools, so it carries no boilerplate and no local file paths.
    """
    p = pathlib.Path(image_path)
    if not p.exists():
        return {"markdown": f"*(Bild {p.name} nicht gefunden)*\n", "has_ocr": False}

    ocr_text = run_local_ocr_if_available(image_path)
    if ocr_text:
        return {"markdown": ocr_text + "\n", "has_ocr": True}

    details = ""
    if Image is not None:
        try:
            with Image.open(image_path) as img:
                details = f" ({img.size[0]}×{img.size[1]} px, {img.format or p.suffix.lstrip('.').upper()})"
        except Exception:
            pass
    return {
        "markdown": f"*Bild {p.name}{details}: kein Text erkannt. Für Texterkennung muss Tesseract installiert sein.*\n",
        "has_ocr": False,
    }
