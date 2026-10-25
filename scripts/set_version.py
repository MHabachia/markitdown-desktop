#!/usr/bin/env python3
"""
Sets the app version everywhere it is stored.

    python3 scripts/set_version.py 1.1.1      (or: npm run version:set -- 1.1.1)

Updates package.json, package-lock.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml
and the app's entry in src-tauri/Cargo.lock. Afterwards add a "## 1.1.1" section to
CHANGELOG.md and push to main; the release workflow takes it from there.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def set_json_version(path: pathlib.Path, version: str, lock: bool = False) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    data["version"] = version
    if lock and "" in data.get("packages", {}):
        data["packages"][""]["version"] = version
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    if len(sys.argv) != 2 or not re.fullmatch(r"\d+\.\d+\.\d+", sys.argv[1]):
        print("Usage: set_version.py X.Y.Z")
        return 2
    version = sys.argv[1]

    set_json_version(ROOT / "package.json", version)
    set_json_version(ROOT / "package-lock.json", version, lock=True)
    set_json_version(ROOT / "src-tauri" / "tauri.conf.json", version)

    cargo = ROOT / "src-tauri" / "Cargo.toml"
    cargo.write_text(re.sub(r'(?m)^version = "[^"]+"', f'version = "{version}"', cargo.read_text(), count=1))

    lock = ROOT / "src-tauri" / "Cargo.lock"
    lock.write_text(re.sub(
        r'(name = "markitdown-desktop"\nversion = )"[^"]+"', rf'\g<1>"{version}"', lock.read_text()
    ))

    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    print(f"Version set to {version}.")
    if f"## {version}" not in changelog:
        print(f'Next: add a "## {version}" section to CHANGELOG.md.')
    return 0


if __name__ == "__main__":
    sys.exit(main())
