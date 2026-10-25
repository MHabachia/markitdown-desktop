#!/usr/bin/env python3
"""Writes THIRD_PARTY_NOTICES.md: every library that ends up in the installers, with its
license and the full license texts (identical texts are listed once).

Sources:
  - Python: the pins in requirements.txt, read from the active environment
    (install the lock first; colorama and tzdata are only needed on Windows, so
    `pip install --no-deps colorama tzdata` into the venv on macOS/Linux).
  - JavaScript: production dependencies from package-lock.json, read from node_modules.
  - Rust: `cargo metadata` for the macOS and Windows targets, normal dependencies only.

Run from the repository root:  .venv/bin/python scripts/generate_notices.py
"""
import importlib.metadata as md
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "THIRD_PARTY_NOTICES.md"
LICENSE_FILE = re.compile(r"^(licen[cs]e|copying|unlicense|notice)([-_.].*)?$", re.IGNORECASE)
RUST_TARGETS = ["aarch64-apple-darwin", "x86_64-pc-windows-msvc"]

# Packages that ship no license file. The texts were copied from the upstream repositories
# into scripts/notice_fallbacks/ (file name = package name; the prefixes share one file).
FALLBACK_DIR = Path(__file__).resolve().parent / "notice_fallbacks"
FALLBACK_PREFIXES = {"objc2": "objc2", "block2": "objc2", "dispatch2": "objc2", "webview2-com": "webview2-com"}

HEADER = """\
# Hinweise zu Software von Dritten

MarkItDown Desktop selbst steht unter der MIT-Lizenz (siehe `LICENSE`). Die App enthält
und benutzt Bibliotheken von Dritten, die unter ihren eigenen Lizenzen stehen. Diese Datei
nennt sie und gibt die Lizenztexte wieder. Sie wird mit `scripts/generate_notices.py`
erzeugt und liegt auch in der installierten App.

## Bibliotheken mit GPL/LGPL (macOS-Version)

Die Texterkennung (RapidOCR) braucht OpenCV. Das Python-Paket `opencv-python-headless`
bringt fertig kompilierte Bibliotheken mit, darunter FFmpeg (LGPL-2.1 oder neuer) sowie
auf macOS unter anderem `libx264` und `libx265` (GPL-2.0 oder neuer) und `libtesseract`
(Apache-2.0). MarkItDown Desktop benutzt davon nur das Laden und Verkleinern von Bildern,
keine Video- oder Audio-Funktionen. Die Dateien liegen unverändert im Programmordner
der App (im Ordner `_internal`); wer sie austauschen möchte, kann das tun.

Den Quelltext dieser Bibliotheken gibt es hier:

- OpenCV-Paket (Build-Skripte und Verweise auf die Quellen): https://github.com/opencv/opencv-python, Version 5.0.0.93
- FFmpeg: https://ffmpeg.org/download.html
- x264: https://code.videolan.org/videolan/x264
- x265: https://bitbucket.org/multicoreware/x265_git

Der Quelltext von MarkItDown Desktop liegt unter https://github.com/MHabachia/markitdown-desktop.
Wer eine der genannten Bibliotheken in genau der ausgelieferten Fassung braucht, kann
dort ein Issue öffnen.

## Weitere Bestandteile

- **Python** (PSF-2.0): Die App bringt einen eigenen Python-Interpreter mit. Lizenz: https://docs.python.org/3/license.html
- **PyInstaller** (GPL-2.0-or-later mit Ausnahme für gebündelte Programme): erzeugt das Backend-Paket. Die Ausnahme erlaubt es, Programme beliebiger Lizenz damit auszuliefern. https://github.com/pyinstaller/pyinstaller/blob/develop/COPYING.txt
- **PP-OCR-Modelle** (Apache-2.0): Die Modelle für die Texterkennung stammen vom PaddleOCR-Projekt und liegen im Paket `rapidocr`.
- **Tauri** und die Rust-Bibliotheken: siehe unten.
"""


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace").strip()


def license_files(directory: Path):
    if not directory.is_dir():
        return []
    return sorted(p for p in directory.iterdir() if p.is_file() and LICENSE_FILE.match(p.name))


def fallback_text(name: str):
    stem = name.lower()
    for prefix, target in FALLBACK_PREFIXES.items():
        if stem == prefix or stem.startswith(prefix + "-"):
            stem = target
            break
    path = FALLBACK_DIR / f"{stem}.txt"
    return [read_text(path)] if path.is_file() else []


def python_packages():
    names = []
    for line in (ROOT / "requirements.txt").read_text().splitlines():
        m = re.match(r"([A-Za-z0-9_.-]+)==([^\s;]+)", line)
        if m:
            names.append(m.group(1))
    result = []
    for name in sorted(set(names), key=str.lower):
        dist = md.distribution(name)
        meta = dist.metadata
        lic = meta.get("License-Expression") or meta.get("License") or ""
        if not lic or len(lic) > 80 or "\n" in lic:
            classes = [c.split("::")[-1].strip() for c in meta.get_all("Classifier") or [] if c.startswith("License ::")]
            lic = " / ".join(classes) or (lic.splitlines()[0][:80] if lic else "siehe Lizenztext")
        texts = []
        for f in dist.files or []:
            parts = f.parts
            if parts[0].endswith(".dist-info") and (LICENSE_FILE.match(parts[-1]) or "licenses" in parts[1:-1]):
                texts.append(read_text(Path(dist.locate_file(f))))
        texts = texts or fallback_text(meta["Name"])
        result.append((meta["Name"], meta["Version"], lic, texts))
    return result


def js_packages():
    lock = json.loads((ROOT / "package-lock.json").read_text())
    result = []
    for key, info in sorted(lock["packages"].items()):
        if not key.startswith("node_modules/") or info.get("dev"):
            continue
        directory = ROOT / key
        pkg = json.loads((directory / "package.json").read_text())
        lic = pkg.get("license")
        if isinstance(lic, dict):
            lic = lic.get("type")
        texts = [read_text(p) for p in license_files(directory)] or fallback_text(pkg["name"])
        result.append((pkg["name"], pkg["version"], lic or "siehe Lizenztext", texts))
    return result


def rust_packages():
    found = {}
    for target in RUST_TARGETS:
        raw = subprocess.run(
            ["cargo", "metadata", "--format-version", "1", "--filter-platform", target],
            cwd=ROOT / "src-tauri", check=True, capture_output=True, text=True,
        ).stdout
        meta = json.loads(raw)
        packages = {p["id"]: p for p in meta["packages"]}
        nodes = {n["id"]: n for n in meta["resolve"]["nodes"]}
        seen, stack = set(), [meta["resolve"]["root"]]
        while stack:
            current = stack.pop()
            if current in seen:
                continue
            seen.add(current)
            for dep in nodes[current]["deps"]:
                if any(k["kind"] is None for k in dep["dep_kinds"]):
                    stack.append(dep["pkg"])
        for pid in seen:
            pkg = packages[pid]
            if pkg.get("source") is None:
                continue  # the app itself
            texts = [read_text(p) for p in license_files(Path(pkg["manifest_path"]).parent)] or fallback_text(pkg["name"])
            found[(pkg["name"], pkg["version"])] = (pkg.get("license") or "siehe Lizenztext", texts)
    return [(n, v, lic, texts) for (n, v), (lic, texts) in sorted(found.items())]


def python_license_text():
    candidates = list(Path(sys.base_prefix).glob("lib/python3*/LICENSE.txt"))
    return read_text(candidates[0]) if candidates else None


def main() -> int:
    sections = [("Python-Pakete", python_packages()), ("JavaScript-Pakete (Oberfläche)", js_packages()),
                ("Rust-Pakete (Tauri und App-Hülle)", rust_packages())]

    unique = {}  # normalized text -> (text, [package names])
    without_text = []
    for _, packages in sections:
        for name, version, lic, texts in packages:
            if not texts:
                without_text.append(f"{name} {version} ({lic})")
            for text in texts:
                key = re.sub(r"\s+", " ", text)
                unique.setdefault(key, (text, []))[1].append(f"{name} {version}")

    lines = [HEADER]
    for title, packages in sections:
        lines += [f"## {title}", "", "| Paket | Version | Lizenz |", "| --- | --- | --- |"]
        lines += [f"| {n} | {v} | {lic.replace('|', '/')} |" for n, v, lic, _ in packages]
        lines.append("")

    lines += ["## Lizenztexte", "",
              "Gleiche Texte stehen nur einmal da. Darunter steht, für welche Pakete sie gelten.", ""]
    ordered = sorted(unique.values(), key=lambda item: (-len(item[1]), item[1][0].lower()))
    for text, users in ordered:
        users = sorted(set(users), key=str.lower)
        lines += ["---", "", "**Gilt für:** " + ", ".join(users), "", "```text", text.replace("```", "'''"), "```", ""]

    py_text = python_license_text()
    if py_text:
        lines += ["---", "", "**Gilt für:** Python (Interpreter)", "", "```text", py_text, "```", ""]

    gpl = FALLBACK_DIR / "GPL-2.0.txt"
    lines += ["---", "", "**Gilt für:** libx264 und libx265 (im macOS-Paket von OpenCV), PyInstaller", "",
              "```text", read_text(gpl), "```", ""]

    if without_text:
        lines += ["---", "",
                  "Für diese Pakete liegt im Paket selbst keine Lizenzdatei, die Lizenz stammt aus den Metadaten:", ""]
        lines += [f"- {entry}" for entry in sorted(set(without_text), key=str.lower)]
        lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    total = sum(len(p) for _, p in sections)
    print(f"{OUT.name}: {total} Pakete, {len(unique)} verschiedene Lizenztexte, {OUT.stat().st_size // 1024} KB, "
          f"{len(set(without_text))} ohne Lizenzdatei")
    return 0


if __name__ == "__main__":
    sys.exit(main())
