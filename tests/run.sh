#!/usr/bin/env bash
# Everything that has broken in front of staff, kept broken-proof.
#
#   ./tests/run.sh
#
# No install, no framework — node and the two files under test. The Sheets API
# is a fake that counts round trips, because "faster" should be a number.
set -euo pipefail
cd "$(dirname "$0")/.."
fail=0
for t in tests/test-*.js; do
  echo; echo "──────── $t"
  node "$t" || fail=1
done
echo; echo "──────── round trips per save"
node tests/bench.js || true
exit $fail
