#!/usr/bin/env bash
#
# Build the contracting app as a STANDALONE Netlify site.
#
#   ./build-contracting.sh
#
# This is the whole app on its own — its own Netlify site, its own domain,
# nothing to do with rickyrampersadbranch.com. The pages move up to the root,
# so the wizard is at "/" instead of "/contracting/", and the few links back
# to the branch site are cut.
#
# Output:
#   dist-contracting/    the folder to publish
#   contracting-app.zip  drag this into Netlify
#
# (build.sh is the other one: the whole branch site, contracting included.)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$ROOT/contracting"
DIST="$ROOT/dist-contracting"
ZIP="$ROOT/contracting-app.zip"

echo "→ Cleaning"
rm -rf "$DIST"
rm -f "$ZIP"
mkdir -p "$DIST"

# contracting/ is already a complete site — its own 404, netlify.toml,
# _redirects, _headers and robots.txt live alongside the pages, so a
# git-connected deploy needs nothing but "base directory: contracting".
# This build is the drag-and-drop route to the same site.
echo "→ Copying the app to the site root"
cp -R "$SRC"/. "$DIST"/

find "$DIST" \( -name '.DS_Store' -o -name '*~' -o -name '.*.swp' \) -delete

echo "→ Checking the site is self-contained"
for required in index.html admin.html status.html 404.html \
                netlify.toml _redirects _headers robots.txt; do
  [ -f "$DIST/$required" ] || { echo "   missing: $required" >&2; exit 1; }
done
if grep -rl 'href="\.\./' "$DIST" --include='*.html' >/dev/null 2>&1; then
  echo "   a page still links above the site root:" >&2
  grep -rn 'href="\.\./' "$DIST" --include='*.html' >&2
  exit 1
fi

if command -v zip >/dev/null 2>&1; then
  echo "→ Zipping"
  ( cd "$DIST" && zip -qr "$ZIP" . )
fi

echo
echo "Standalone contracting app:"
find "$DIST" -type f | sed "s|$DIST|  .|" | sort
echo
echo "dist-contracting/ is $(du -sh "$DIST" | cut -f1)$( [ -f "$ZIP" ] && echo " · $(basename "$ZIP") is $(du -h "$ZIP" | cut -f1)" )"
echo
echo "Wizard at /   ·   Tracker at /track   ·   Dashboard at /admin"
echo "Drag dist-contracting/ — or $(basename "$ZIP") — onto https://app.netlify.com/drop"
