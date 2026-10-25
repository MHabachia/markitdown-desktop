#!/usr/bin/env bash
# Uploads one platform's installer (plus update bundle and signature) to the draft release
# of RELEASE_TAG (e.g. v1.1.0). The .sig files are temporary: the publish job copies them
# into latest.json and removes them before the release goes public.
#
#   scripts/publish_release.sh <platform> <file>...
#
# <platform> is macos-aarch64 or windows-x86_64. Files are renamed to
#   MarkItDown-Desktop_<version>_<platform>.<ext>
# so every asset name says which platform it belongs to. Older assets of the same platform are replaced; other
# platforms' assets are left alone. Needs GH_TOKEN, RELEASE_TAG and TARGET_SHA (the built commit).
set -euo pipefail

platform="$1"
shift
case "$platform" in
  macos-aarch64 | windows-x86_64) ;;
  *) echo "Unknown platform: $platform" >&2; exit 2 ;;
esac

tag="${RELEASE_TAG:?RELEASE_TAG is not set}"
version="${tag#v}"
pkg_version=$(node -p "require('./package.json').version")
[ "$version" = "$pkg_version" ] || { echo "Tag $tag does not match package.json version $pkg_version" >&2; exit 1; }

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
for file in "$@"; do
  base=$(basename "$file")
  case "$base" in
    *.app.tar.gz.sig) ext="app.tar.gz.sig" ;;
    *.app.tar.gz) ext="app.tar.gz" ;;
    *-setup.exe.sig) ext="setup.exe.sig" ;;
    *-setup.exe) ext="setup.exe" ;;
    *.dmg) ext="dmg" ;;
    *) echo "Skipping unexpected file $base"; continue ;;
  esac
  cp "$file" "$stage/MarkItDown-Desktop_${version}_${platform}.${ext}"
done
ls -l "$stage"
[ -n "$(ls -A "$stage")" ] || { echo "Nothing to publish for $platform" >&2; exit 1; }

# Parallel platform jobs may race to create the draft; tolerate that.
# The draft is pinned to this commit; the tag itself is created when the draft is published.
notes=$(mktemp)
awk -v v="## $version" '$0 == v {found=1; next} /^## / && found {exit} found' CHANGELOG.md > "$notes"
[ -s "$notes" ] || echo "MarkItDown Desktop $tag" > "$notes"
gh release view "$tag" > /dev/null 2>&1 \
  || gh release create "$tag" --draft --target "${TARGET_SHA:-$GITHUB_SHA}" --title "MarkItDown Desktop $tag" --notes-file "$notes" \
  || gh release view "$tag" > /dev/null

for name in $(gh release view "$tag" --json assets --jq '.assets[].name'); do
  if [[ "$name" == *"_${platform}."* ]] && [ ! -f "$stage/$name" ]; then
    echo "Removing outdated asset $name"
    gh release delete-asset "$tag" "$name" --yes
  fi
done

gh release upload "$tag" "$stage"/* --clobber
echo "Uploaded $platform assets to $tag"
