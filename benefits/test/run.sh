#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# The benefits benches. IN THE REPOSITORY ON PURPOSE.
#
# These lived in a session scratchpad until 12 September 2026, when the
# container was reclaimed and 163 assertions went with it — the engine
# bench, the portal benches, the mock API and every runner. The house
# note already said a scratchpad is deleted when the container is; the
# tests were in one anyway.
#
#   ./benefits/test/run.sh            everything
#   ./benefits/test/run.sh smoke      one bench
# ══════════════════════════════════════════════════════════════════════
set -u
cd "$(dirname "$0")/../.." || exit 1
ROOT=$(pwd)
ONLY="${1:-}"
PORT=8955
FAIL=0

fuser -k $PORT/tcp 2>/dev/null; sleep 0.4
# Served from the repository root, because that is the shape of the
# live site: /benefits/group.html resolving ../logo-mark.png to
# /logo-mark.png. Serving benefits/ as root hides that path.
(cd "$ROOT" && exec python3 -m http.server $PORT) >/dev/null 2>&1 &
WEB=$!

# The pages point at the live Apps Script. Serve a copy under test/live/
# with that URL swapped for the mock, so a bench never touches production.
fuser -k 8940/tcp 8944/tcp 2>/dev/null
node "$ROOT/benefits/test/mockapi.mjs" >/dev/null 2>&1 &
MOCK=$!
LIVE_URL="https://script.google.com/macros/s/AKfycbzxAl-EP_stXYGHZkkxWnei6idJ04bM5ZIUKfGxDTr-cHPH7Tt9trmAYVNPzeq9k4U56w/exec"
rm -rf "$ROOT/benefits/test/live"; mkdir -p "$ROOT/benefits/test/live"
for f in "$ROOT"/benefits/*.html "$ROOT"/benefits/*.css "$ROOT"/benefits/*.js; do
  [ -f "$f" ] || continue
  sed "s|\"$LIVE_URL\"|\"http://localhost:8940\"|" "$f" > "$ROOT/benefits/test/live/$(basename "$f")"
done
sleep 1.2

for f in "$ROOT"/benefits/test/*.mjs; do
  name=$(basename "$f" .mjs)
  # mockapi is the server the benches talk to, not a bench
  [ "$name" = "mockapi" ] && continue
  [ -n "$ONLY" ] && [ "$name" != "$ONLY" ] && continue
  echo ""
  echo "──────── $name ────────"
  node "$f" || FAIL=1
done

kill $WEB $MOCK 2>/dev/null
echo ""
[ $FAIL -eq 0 ] && echo "ALL GREEN" || echo "SOMETHING FAILED"
exit $FAIL
