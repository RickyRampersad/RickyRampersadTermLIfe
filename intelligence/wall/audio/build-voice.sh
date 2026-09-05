#!/usr/bin/env bash
# Regenerate the 45-day wall's narration.
#
#   ./build-voice.sh && ./embed-audio.py
#
# Needs edge-tts (pip install edge-tts). Free, no account, no licence, so
# nothing here needs clearing before it plays on a screen in the branch.
#
# Same voice and rate as the films, because a branch that sounds like one
# organisation on three screens is the whole point of fixing the voice once.
# Andrew at -3% reads slightly under natural pace, lets a full stop land, and
# does not smile. Short declarative sentences do the rest. If a line needs to
# breathe more, split it in two rather than reaching for a comma.
#
# CANNOT BE RUN IN THE CLAUDE SESSION THAT WROTE IT. edge-tts talks to the
# speech endpoint over a WebSocket and the sandbox's proxy does not carry a
# WebSocket upgrade, so the MP3s have to be rendered on a machine with direct
# network. Everything else about the wall works without them; the Narrate
# button simply stays disabled until these files exist and are embedded.
# ── RENDERING FROM INSIDE A CLAUDE SANDBOX ────────────────────────────────
# edge-tts fails behind the agent proxy with SSLCertVerificationError, which
# reads exactly like the tunnel refusing a WebSocket upgrade. That is the wrong
# diagnosis and it cost this file an afternoon of being marked impossible.
# edge_tts pins its own context at import —
#
#     edge_tts/communicate.py:  _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
#
# — and never consults SSL_CERT_FILE or REQUESTS_CA_BUNDLE, so appending the
# proxy CA to certifi does nothing. Replace the context, pass the proxy:
#
#     import ssl, os, asyncio, edge_tts, edge_tts.communicate as C
#     C._SSL_CTX = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
#     asyncio.run(edge_tts.Communicate(text, VOICE, rate=RATE,
#                 proxy=os.environ.get("HTTPS_PROXY")).save(out))
#
# On a normal machine the plain `edge-tts` calls below work as written.
# ──────────────────────────────────────────────────────────────────────────

set -euo pipefail
cd "$(dirname "$0")"

VOICE="en-US-AndrewMultilingualNeural"
RATE="-3%"

say () {  # say <index> <text>
  local n="$1"; shift
  printf '  line%02d  %s\n' "$n" "$1"
  edge-tts --voice "$VOICE" --rate="$RATE" --text "$1" --write-media "$(printf 'line%02d.mp3' "$n")"
}

echo "Narration — $VOICE at $RATE"

# ── WHY NO NUMBERS ARE SPOKEN ─────────────────────────────────────────────
# The first draft of this script said "forty one policies" and "three hundred
# and forty five on Friday the eleventh". Every one of those figures changes on
# the next nightly rebuild, and the audio does not — so within a day the voice
# would have been confidently reading wrong numbers over a screen showing the
# right ones, which is worse than saying nothing.
#
# The screen carries the arithmetic; the voice carries the meaning. That split
# is also just better narration: an eye reads a figure faster than an ear, and
# a voice is the only thing on the wall that can say what the figure MEANS.
# Nothing below stops being true when the data moves.
# ──────────────────────────────────────────────────────────────────────────

say  1 "This is the forty five day line."
say  2 "Past the grace period. Still early enough that a phone call works."
say  3 "The number on the left is today's."
say  4 "Most of them were on a standing instruction that failed."
say  5 "A bank order. A salary deduction. Something that should have collected itself."
say  6 "That is a bank to ring. Not a client who refused."
say  7 "And most have been in force for years, not months."
say  8 "These are not bad sales. They are long standing clients who stopped."
say  9 "The gold bar is a whole billing cohort crossing on one day."
say 10 "Work it before it lands."

echo
echo "Durations:"
for f in line*.mp3; do
  printf '  %-12s %s\n' "$f" "$(ffprobe -v error -show_entries format=duration \
    -of default=noprint_wrappers=1:nokey=1 "$f" 2>/dev/null || echo '?')"
done
echo
echo "Now run ./embed-audio.py to fold them into the wall."
