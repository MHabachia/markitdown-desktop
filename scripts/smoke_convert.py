#!/usr/bin/env python3
"""
Smoke test for a running backend (used by the build workflow on the packaged backend):
converts a text file and a picture of text, so a missing module or model in the bundle
is noticed before the installer is built.

    python3 scripts/smoke_convert.py 18765
"""
import json
import os
import sys
import tempfile
import urllib.request

from PIL import Image, ImageDraw, ImageFont

WORDS = "Hallo Welt 2027"


def convert(port: str, path: str) -> dict:
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}/api/convert",
        data=json.dumps({"source_path": path, "save": False}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.load(response)


def main() -> int:
    port = sys.argv[1]
    with tempfile.TemporaryDirectory() as folder:
        text_file = os.path.join(folder, "notiz.txt")
        with open(text_file, "w", encoding="utf-8") as f:
            f.write("Ein kurzer Text\n")
        image = Image.new("RGB", (700, 160), "white")
        ImageDraw.Draw(image).text((30, 40), WORDS, fill="black", font=ImageFont.load_default(size=64))
        image_file = os.path.join(folder, "bild.png")
        image.save(image_file)

        failed = False
        for path, expected in ((text_file, "kurzer Text"), (image_file, "Welt")):
            result = convert(port, path)
            ok = result.get("success") and expected in result.get("markdown", "")
            print(f"{'OK  ' if ok else 'FAIL'} {os.path.basename(path)}: {result.get('error') or repr(result.get('markdown', '')[:60])}")
            failed = failed or not ok
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
