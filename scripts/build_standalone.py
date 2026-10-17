#!/usr/bin/env python3
"""
MarkItDown Desktop - Standalone Backend Sidecar Builder
Compiles backend/api.py into a single, self-contained executable using PyInstaller.
Places the onedir bundle into src-tauri/binaries/backend-service/ (shipped as a Tauri resource) for zero-Python distribution.
"""

import os
import sys
import shutil
import platform
import subprocess
import pathlib

ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
BACKEND_ENTRY = ROOT_DIR / "backend" / "api.py"
BINARIES_DIR = ROOT_DIR / "src-tauri" / "binaries"

def get_target_triple() -> str:
    system = platform.system().lower()
    machine = platform.machine().lower()

    if system == "darwin":
        if machine in ("arm64", "aarch64"):
            return "aarch64-apple-darwin"
        return "x86_64-apple-darwin"
    elif system == "windows":
        return "x86_64-pc-windows-msvc"
    return f"{machine}-{system}"

METADATA_PACKAGES = [
    "markitdown", "fastapi", "uvicorn", "pdfminer.six", "mammoth", "python-pptx",
    "openpyxl", "pandas", "beautifulsoup4", "Pillow",
]


def metadata_args() -> list:
    """--copy-metadata for the packages shown in the diagnostics (frozen apps lack dist-info otherwise)."""
    from importlib.metadata import PackageNotFoundError, version
    args = []
    for name in METADATA_PACKAGES:
        try:
            version(name)
            args += ["--copy-metadata", name]
        except PackageNotFoundError:
            pass
    return args


def main():
    print("=" * 60)
    print("MarkItDown Desktop: Standalone Sidecar Packaging")
    print("=" * 60)

    # 1. Verify Entry File
    if not BACKEND_ENTRY.exists():
        print(f"[Error] Backend entry file not found: {BACKEND_ENTRY}")
        sys.exit(1)

    # 2. Check PyInstaller
    pyinstaller_bin = shutil.which("pyinstaller")
    if not pyinstaller_bin:
        venv_pyinstaller = ROOT_DIR / ".venv" / "bin" / "pyinstaller"
        if venv_pyinstaller.exists():
            pyinstaller_bin = str(venv_pyinstaller)
        else:
            print("[Info] PyInstaller not detected. Installing in current environment...")
            subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], check=True)
            pyinstaller_bin = shutil.which("pyinstaller") or str(venv_pyinstaller)

    print(f"[OK] Using PyInstaller: {pyinstaller_bin}")

    # 3. Target Configuration
    triple = get_target_triple()
    ext = ".exe" if platform.system() == "Windows" else ""
    os.makedirs(BINARIES_DIR, exist_ok=True)

    build_dir = ROOT_DIR / "build" / "pyinstaller_temp"
    dist_dir = ROOT_DIR / "dist" / "sidecar"
    os.makedirs(build_dir, exist_ok=True)
    os.makedirs(dist_dir, exist_ok=True)

    cmd = [
        pyinstaller_bin,
        "--name", "backend-service",
        "--onedir",
        "--clean",
        "--noconfirm",
        "--workpath", str(build_dir),
        "--distpath", str(dist_dir),
        "--paths", str(ROOT_DIR),
        "--collect-submodules", "backend",
        "--hidden-import", "uvicorn",
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols",
        "--hidden-import", "uvicorn.protocols.http",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.lifespan",
        "--hidden-import", "uvicorn.lifespan.on",
        "--hidden-import", "fastapi",
        "--hidden-import", "starlette",
        "--hidden-import", "pydantic",
        "--hidden-import", "markitdown",
        "--hidden-import", "mammoth",
        "--hidden-import", "pptx",
        "--hidden-import", "openpyxl",
        "--hidden-import", "pdfplumber",
        "--hidden-import", "pdfminer",
        "--hidden-import", "PIL",
        "--collect-all", "markitdown",
        # example documents for "Mit Beispielen ausprobieren"
        "--add-data", f"{ROOT_DIR / 'backend' / 'sample_files'}{os.pathsep}backend/sample_files",
        *metadata_args(),
        "--collect-all", "magika",
        str(BACKEND_ENTRY)
    ]

    print(f"\n[Compiling] Building standalone binary for {triple}...")
    subprocess.run(cmd, check=True)

    raw_output = dist_dir / "backend-service"
    target_dest = BINARIES_DIR / "backend-service"
    exe_name = f"backend-service{ext}"

    if (raw_output / exe_name).exists():
        # onedir bundle: no unpacking at startup (onefile took ~20 s per launch).
        if target_dest.exists():
            shutil.rmtree(target_dest)
        shutil.copytree(raw_output, target_dest, symlinks=True)
        if platform.system() != "Windows":
            os.chmod(target_dest / exe_name, 0o755)

        size_mb = round(sum(f.stat().st_size for f in target_dest.rglob("*") if f.is_file()) / (1024 * 1024), 1)
        print(f"\n[Success] Standalone backend created: {target_dest} ({size_mb} MB unpacked)")
    else:
        print("[Error] PyInstaller output was not found.")
        sys.exit(1)

if __name__ == "__main__":
    main()
