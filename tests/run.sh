#!/usr/bin/env bash
# Everything that has broken in front of staff, kept broken-proof.
#
#   ./tests/run.sh
#
# The unit tests need nothing but node — the Sheets API is a fake that counts
# round trips, because "faster" should be a number rather than a claim.
#
# The two e2e tests drive a real browser through the afternoons that went
# wrong on 2 September. They need playwright and a chromium on disk, and are
# skipped when there isn't one.
set -euo pipefail
cd "$(dirname "$0")/.."
fail=0

for t in tests/test-*.js; do
  echo; echo "──────── $t"
  node "$t" || fail=1
done

echo; echo "──────── round trips per save"
node tests/bench.js || fail=1

if node -e "require('playwright')" 2>/dev/null; then
  for t in tests/e2e-*.js; do
    echo; echo "──────── $t"
    node "$t" || fail=1
  done
else
  echo; echo "──────── e2e skipped (no playwright — npm i playwright to run them)"
fi

echo
[ $fail -eq 0 ] && echo "ALL GREEN" || echo "SOMETHING FAILED"
exit $fail
