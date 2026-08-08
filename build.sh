#!/usr/bin/env bash
#
# Assemble the site into dist/ and zip it for a drag-and-drop Netlify deploy.
#
#   ./build.sh
#
# NOT required to deploy. A git-connected Netlify deploy publishes the
# repository root directly and runs no build at all — see netlify.toml. This
# script is only for the manual route: it copies out the pages a visitor
# needs and leaves behind the source that is tracked in git but must never be
# served — the Apps Script backends, the setup docs, the DNS record backup,
# the fleet register.
#
# Output:
#   dist/            the folder to publish
#   contracting.zip  drag this into Netlify
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$ROOT/dist"

# Holds the whole site, not only the contracting pages — a Netlify drop
# replaces everything at the domain, so the bundle has to carry everything.
ZIP="$ROOT/contracting.zip"

echo "→ Cleaning dist/ and any earlier bundle"
rm -rf "$DIST"
rm -f "$ZIP" "$ROOT"/rickyrampersadbranch-*.zip
mkdir -p "$DIST"

echo "→ Copying pages"
cp "$ROOT/index.html"  "$DIST/"
cp "$ROOT/agent.html"  "$DIST/"
cp "$ROOT/staff.html"  "$DIST/"
cp "$ROOT/404.html"    "$DIST/"
cp -R "$ROOT/renewal"  "$DIST/"

echo "→ Copying deploy config"
cp "$ROOT/netlify.toml" "$DIST/"
cp "$ROOT/CNAME"        "$DIST/"

# netlify.toml covers redirects and headers for git-connected deploys.
# _redirects and _headers say the same thing in the form a drag-and-drop
# deploy is guaranteed to honour, so both routes behave identically.
echo "→ Writing _redirects and _headers"
cat > "$DIST/_redirects" <<'REDIRECTS'
# Short personal links — these are what the Google Sheets email out.
/r/*         /renewal/?t=:splat        302
/renew       /renewal/                 302
/c/*         /contracting/?t=:splat    302
/contract    /contracting/             302
REDIRECTS

cat > "$DIST/_headers" <<'HEADERS'
/renewal/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer

# Applicants type ID, tax and bank details in here.
/contracting/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Robots-Tag: noindex, nofollow

/agent.html
  X-Robots-Tag: noindex, nofollow

/staff.html
  X-Robots-Tag: noindex, nofollow
HEADERS

echo "→ Writing robots.txt"
cat > "$DIST/robots.txt" <<'ROBOTS'
User-agent: *
Disallow: /contracting/
Disallow: /agent.html
Disallow: /staff.html
ROBOTS

# A stray .DS_Store or editor backup would be published as-is.
find "$DIST" \( -name '.DS_Store' -o -name '*~' -o -name '.*.swp' \) -delete

# Only for the drag-and-drop route. A git-connected build publishes dist/
# directly, so a missing zip binary must not fail the deploy.
if command -v zip >/dev/null 2>&1; then
  echo "→ Zipping"
  ( cd "$DIST" && zip -qr "$ZIP" . )
else
  echo "→ Skipping zip (zip not installed) — dist/ is still ready to publish"
fi

echo
echo "Deployable files:"
find "$DIST" -type f | sed "s|$DIST|  .|" | sort
echo
echo "dist/ is $(du -sh "$DIST" | cut -f1)$( [ -f "$ZIP" ] && echo " · $(basename "$ZIP") is $(du -h "$ZIP" | cut -f1)" )"
echo
echo "Deliberately NOT published: apps-script/ (backend source), *.md"
echo "(setup docs and the DNS record backup), data/ (fleet register),"
echo "contracting/ (its own site — build it with ./build-contracting.sh)."
echo
echo "Drag dist/ — or $(basename "$ZIP") — onto https://app.netlify.com/drop"
