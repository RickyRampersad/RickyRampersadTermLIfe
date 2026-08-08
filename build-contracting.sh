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

echo "→ Copying the app to the site root"
cp -R "$SRC"/. "$DIST"/
cp "$ROOT/404.html" "$DIST/"

# The app normally sits under /contracting/ on the branch site, where the
# logo points one level up to the homepage. Standing on its own there is no
# level up, so those links become the app's own front page.
echo "→ Cutting the links back to the branch site"
for file in "$DIST"/index.html "$DIST"/admin.html "$DIST"/status.html; do
  [ -f "$file" ] || continue
  sed -i 's|href="\.\./index\.html"|href="/"|g' "$file"
done
sed -i 's|← Back to the main site|← Back to the application|' "$DIST/admin.html"

echo "→ Writing deploy config"
cat > "$DIST/netlify.toml" <<'TOML'
# Standalone contracting app. No build step — plain HTML, CSS and JS with
# pdf-lib vendored, published exactly as it sits.
[build]
  publish = "."

# Short links. /c/<token> is what the invitation emails send an applicant;
# /track/<code> is what the confirmation email sends them afterwards.
[[redirects]]
  from = "/c/*"
  to = "/?t=:splat"
  status = 302

[[redirects]]
  from = "/track/*"
  to = "/status.html?c=:splat"
  status = 302

[[redirects]]
  from = "/track"
  to = "/status.html"
  status = 302

[[redirects]]
  from = "/admin"
  to = "/admin.html"
  status = 302

# Applicants type ID, tax and bank details in here.
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "no-referrer"
    X-Robots-Tag = "noindex, nofollow"
TOML

# A drag-and-drop deploy is only guaranteed to honour these plain files, so
# they say the same thing as netlify.toml above.
cat > "$DIST/_redirects" <<'REDIRECTS'
/c/*        /?t=:splat              302
/track/*    /status.html?c=:splat   302
/track      /status.html            302
/admin      /admin.html             302
REDIRECTS

cat > "$DIST/_headers" <<'HEADERS'
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Robots-Tag: noindex, nofollow
HEADERS

# The whole app is private — invited applicants only.
cat > "$DIST/robots.txt" <<'ROBOTS'
User-agent: *
Disallow: /
ROBOTS

find "$DIST" \( -name '.DS_Store' -o -name '*~' -o -name '.*.swp' \) -delete

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
