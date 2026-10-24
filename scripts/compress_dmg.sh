#!/usr/bin/env bash
# Repacks a dmg with LZMA (about 20 % smaller than the default zlib; needs macOS 10.15 or newer),
# checks that the result mounts and that the app inside still passes the signature check,
# and only then replaces the original.
#
#   scripts/compress_dmg.sh path/to/App.dmg
set -euo pipefail

SRC="$1"
TMP="$(mktemp -d)"
trap 'hdiutil detach "$TMP/mnt" -quiet 2>/dev/null || true; rm -rf "$TMP"' EXIT

hdiutil convert "$SRC" -format ULMO -o "$TMP/packed.dmg" -quiet
hdiutil verify "$TMP/packed.dmg" -quiet

mkdir "$TMP/mnt"
hdiutil attach "$TMP/packed.dmg" -readonly -nobrowse -noverify -mountpoint "$TMP/mnt" -quiet
APP="$(find "$TMP/mnt" -maxdepth 1 -name '*.app' | head -n 1)"
[ -n "$APP" ] || { echo "No .app inside the repacked dmg" >&2; exit 1; }
codesign --verify --deep --strict "$APP"
hdiutil detach "$TMP/mnt" -quiet

before=$(stat -f %z "$SRC")
mv "$TMP/packed.dmg" "$SRC"
after=$(stat -f %z "$SRC")
echo "dmg repacked: $((before / 1048576)) MB -> $((after / 1048576)) MB"
