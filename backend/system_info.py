"""
System diagnostics and format support detector for MarkItDown.
Analyzes the Python environment, MarkItDown version, installed converter dependencies,
and reports capability status for each document format.
"""

import sys
import importlib
import platform
import os
from typing import Dict, Any, List

# Import names for packages whose module name differs from the distribution name.
_MODULE_NAMES = {
    "pdfminer.six": "pdfminer",
    "python-pptx": "pptx",
    "python-docx": "docx",
    "beautifulsoup4": "bs4",
    "Pillow": "PIL",
}


def get_installed_version(package_name: str) -> str:
    """Version from package metadata; falls back to the module's __version__ (frozen builds)."""
    try:
        from importlib.metadata import version
        return version(package_name)
    except Exception:
        pass
    try:
        module = importlib.import_module(_MODULE_NAMES.get(package_name, package_name.replace("-", "_")))
        found = getattr(module, "__version__", None)
        if found:
            return str(found)
        return "Enthalten"
    except Exception:
        return "Nicht installiert"

def check_module_available(module_name: str) -> bool:
    try:
        importlib.import_module(module_name)
        return True
    except ImportError:
        return False
    except Exception:
        return False

def get_format_capabilities() -> List[Dict[str, Any]]:
    """
    Returns list of all formats supported by MarkItDown and their current readiness status.
    """
    pdf_ready = check_module_available("pdfminer")
    docx_ready = check_module_available("mammoth") or check_module_available("docx")
    pptx_ready = check_module_available("pptx")
    xlsx_ready = check_module_available("openpyxl") or check_module_available("pandas")
    html_ready = check_module_available("bs4")
    image_ready = check_module_available("PIL")

    return [
        {
            "id": "pdf",
            "name": "Portable Document Format",
            "extensions": [".pdf"],
            "status": "ready" if pdf_ready else "needs_dependency",
            "dependency": "pdfminer.six",
            "description": "Extrahiert Fließtext, Tabellen und Struktur aus PDF-Dokumenten.",
            "category": "Dokumente"
        },
        {
            "id": "docx",
            "name": "Microsoft Word",
            "extensions": [".docx"],
            "status": "ready" if docx_ready else "needs_dependency",
            "dependency": "mammoth",
            "description": "Konvertiert Word-Absätze, Überschriften, Listen und Tabellen.",
            "category": "Office"
        },
        {
            "id": "pptx",
            "name": "Microsoft PowerPoint",
            "extensions": [".pptx"],
            "status": "ready" if pptx_ready else "needs_dependency",
            "dependency": "python-pptx",
            "description": "Wandelt Folieninhalte, Titel und Notizen in Folienblöcke um.",
            "category": "Office"
        },
        {
            "id": "xlsx",
            "name": "Microsoft Excel",
            "extensions": [".xlsx", ".xls"],
            "status": "ready" if xlsx_ready else "needs_dependency",
            "dependency": "openpyxl / pandas",
            "description": "Generiert saubere Markdown-Tabellen aus Tabellenblättern.",
            "category": "Office"
        },
        {
            "id": "html",
            "name": "HTML & Webseiten",
            "extensions": [".html", ".htm", ".xhtml"],
            "status": "ready" if html_ready else "needs_dependency",
            "dependency": "beautifulsoup4 / markdownify",
            "description": "Konvertiert semantisches HTML inklusive Überschriften, Links und Tabellen.",
            "category": "Web"
        },
        {
            "id": "csv",
            "name": "CSV & TSV Daten",
            "extensions": [".csv", ".tsv"],
            "status": "ready",
            "dependency": "Integriert (Standardbibliothek)",
            "description": "Wandelt tabellarische Rohdaten direkt in formatierte Markdown-Tabellen um.",
            "category": "Daten"
        },
        {
            "id": "json",
            "name": "JSON & XML",
            "extensions": [".json", ".xml"],
            "status": "ready",
            "dependency": "Integriert (Standardbibliothek)",
            "description": "Konvertiert strukturierte Daten in formatierte Code-/Textblöcke.",
            "category": "Daten"
        },
        {
            "id": "text",
            "name": "Reiner Text & Quellcode",
            "extensions": [".txt", ".log", ".rtf", ".yaml", ".yml"],
            "status": "ready",
            "dependency": "Integriert",
            "description": "Verarbeitet reinen Text und Logdateien unter Beibehaltung der Zeilenumbrüche.",
            "category": "Text"
        },
        {
            "id": "ipynb",
            "name": "Jupyter Notebooks",
            "extensions": [".ipynb"],
            "status": "ready",
            "dependency": "Integriert",
            "description": "Extrahiert Code- und Markdown-Zellen aus Jupyter Notebooks.",
            "category": "Code"
        },
        {
            "id": "image",
            "name": "Bilder (Metadaten)",
            "extensions": [".jpg", ".jpeg", ".png", ".webp"],
            "status": "ready" if image_ready else "needs_dependency",
            "dependency": "Pillow",
            "description": "Liest Metadaten wie EXIF-Angaben aus Bildern aus.",
            "category": "Medien"
        },
        {
            "id": "zip",
            "name": "ZIP Archive",
            "extensions": [".zip"],
            "status": "ready",
            "dependency": "Integriert",
            "description": "Extrahiert enthaltene Dokumente und fügt die Inhalte zusammen.",
            "category": "Archive"
        }
    ]

def get_system_diagnostics() -> Dict[str, Any]:
    """
    Returns full system diagnostics including python versions, markitdown status,
    and capability summary.
    """
    markitdown_version = get_installed_version("markitdown")
    is_markitdown_available = markitdown_version != "Nicht installiert"

    capabilities = get_format_capabilities()
    ready_count = sum(1 for c in capabilities if c["status"] == "ready")
    total_count = len(capabilities)

    # All supported extensions for file filters
    all_extensions = []
    for cap in capabilities:
        all_extensions.extend(cap["extensions"])

    return {
        "status": "ready" if is_markitdown_available else "error",
        "engine": "Microsoft MarkItDown",
        "markitdown_version": markitdown_version,
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "python_path": sys.executable,
        "platform": f"macOS {platform.mac_ver()[0]} ({platform.machine()})" if platform.system() == "Darwin" else f"{platform.system()} {platform.release()} ({platform.machine()})",
        "is_local_only": True,
        "capabilities": capabilities,
        "supported_extensions": sorted(list(set(all_extensions))),
        "ready_formats_count": ready_count,
        "total_formats_count": total_count,
        "packages": {
            "markitdown": markitdown_version,
            "fastapi": get_installed_version("fastapi"),
            "uvicorn": get_installed_version("uvicorn"),
            "pdfminer.six": get_installed_version("pdfminer.six"),
            "mammoth": get_installed_version("mammoth"),
            "python-pptx": get_installed_version("python-pptx"),
            "openpyxl": get_installed_version("openpyxl"),
            "pandas": get_installed_version("pandas"),
            "beautifulsoup4": get_installed_version("beautifulsoup4"),
            "Pillow": get_installed_version("Pillow"),
        }
    }
