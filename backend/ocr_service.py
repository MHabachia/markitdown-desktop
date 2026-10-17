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
    Extracts image properties and OCR text if possible.
    """
    p = pathlib.Path(image_path)
    if not p.exists() or Image is None:
        return {"markdown": f"![{p.name}]({image_path})\n", "has_ocr": False}

    ocr_text = run_local_ocr_if_available(image_path)
    
    try:
        with Image.open(image_path) as img:
            width, height = img.size
            img_format = img.format or p.suffix.upper().replace(".", "")
            img_mode = img.mode
            
            md_lines = [
                f"# Bild-Analyse: {p.name}\n",
                f"![{p.name}]({image_path})\n",
                "### Eigenschaften",
                f"| Eigenschaft | Wert |",
                f"|:---|:---|",
                f"| **Dateiname** | `{p.name}` |",
                f"| **Format** | {img_format} |",
                f"| **Auflösung** | {width} x {height} Pixel |",
                f"| **Farbraum** | {img_mode} |",
                f"| **Dateigröße** | {round(p.stat().st_size / 1024, 1)} KB |\n"
            ]
            
            if ocr_text:
                md_lines.extend([
                    "### Erkannter Text (Lokales OCR)",
                    "> ℹ️ *Text wurde über die lokale OCR-Engine extrahiert:*\n",
                    ocr_text,
                    "\n"
                ])
                return {"markdown": "\n".join(md_lines), "has_ocr": True}
            else:
                md_lines.extend([
                    "> 💡 *Tipp: Für optische Texterkennung aus gescannten Dokumenten kann Tesseract auf dem System installiert werden (`brew install tesseract-lang`).*",
                    "\n"
                ])
                return {"markdown": "\n".join(md_lines), "has_ocr": False}
    except Exception as e:
        return {
            "markdown": f"![{p.name}]({image_path})\n\n*(Bildanalyse fehlgeschlagen: {e})*",
            "has_ocr": False
        }
