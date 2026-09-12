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
sleep 1.2

for f in "$ROOT"/benefits/test/*.mjs; do
  name=$(basename "$f" .mjs)
  [ -n "$ONLY" ] && [ "$name" != "$ONLY" ] && continue
  echo ""
  echo "──────── $name ────────"
  node "$f" || FAIL=1
done

kill $WEB 2>/dev/null
echo ""
[ $FAIL -eq 0 ] && echo "ALL GREEN" || echo "SOMETHING FAILED"
exit $FAIL
