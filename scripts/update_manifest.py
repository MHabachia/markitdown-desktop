#!/usr/bin/env python3
"""
Writes latest.json for the Tauri updater from the signed bundles in a release.

    python scripts/update_manifest.py <tag> <dir-with-.sig-files> <output-file>

Only platforms whose signature file is present are listed, so a release without the
Windows build still updates Mac users.
"""
import datetime
import json
import os
import pathlib
import sys

PLATFORMS = {
    # updater target          asset suffix (see scripts/publish_release.sh)
    "darwin-aarch64": "macos-aarch64.app.tar.gz",
    "windows-x86_64": "windows-x86_64.setup.exe",
}


def main() -> int:
    tag, sig_dir, output = sys.argv[1], pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3])
    repo = os.environ["GITHUB_REPOSITORY"]
    version = tag.removeprefix("v")
    platforms = {}
    for target, suffix in PLATFORMS.items():
        asset = f"MarkItDown-Desktop_{version}_{suffix}"
        sig = sig_dir / f"{asset}.sig"
        if sig.is_file():
            platforms[target] = {
                "signature": sig.read_text().strip(),
                "url": f"https://github.com/{repo}/releases/download/{tag}/{asset}",
            }
    if not platforms:
        print("No signed update bundles found; latest.json not written.")
        return 0
    manifest = {
        "version": version,
        "notes": f"MarkItDown Desktop {tag}",
        "pub_date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "platforms": platforms,
    }
    output.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"latest.json written for: {', '.join(platforms)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
