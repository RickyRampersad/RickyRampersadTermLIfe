#!/usr/bin/env bash
# Narration for the prospecting film — how the branch prospects now.
#
#   ./build-voice.sh
#
# Needs edge-tts (pip install edge-tts). Free, no account, no licence.
# Output is 24 kHz mono MP3 — speech over a music bed, not a master.
#
# Same voice and rate as the launch film, because three films that share a
# voice and a key sound like one organisation and three that do not sound
# like three suppliers. Andrew at -3% reads slightly under natural pace, lets
# a full stop land, and does not smile.
#
# Written to be spoken, not read: short declarative sentences, one idea each.
# If a line needs to breathe, it is two sentences, not a comma.
#
# After running this, send the durations it prints. The film is cut to the
# rendered audio — scene boundaries just before each line, a beat of silence
# after it, counters firing on the words that name them. Estimated timings
# are how the last film shipped silent and looked fine.
# ── RENDERING FROM INSIDE A CLAUDE SANDBOX ────────────────────────────────
# edge-tts talks to the speech endpoint over a WebSocket, and behind the agent
# proxy the plain CLI fails with SSLCertVerificationError — "self-signed
# certificate in certificate chain". That is NOT the WebSocket being blocked,
# which is what it looks like and what cost an afternoon. It is edge_tts
# pinning its own SSL context:
#
#     edge_tts/communicate.py:  _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
#
# It never reads SSL_CERT_FILE or REQUESTS_CA_BUNDLE, so appending the proxy CA
# to certifi does nothing. Replace the context and pass the proxy explicitly and
# it goes straight through:
#
#     import ssl, os, asyncio, edge_tts, edge_tts.communicate as C
#     C._SSL_CTX = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
#     proxy = os.environ.get("HTTPS_PROXY")
#     asyncio.run(edge_tts.Communicate(text, VOICE, rate=RATE, proxy=proxy).save(out))
#
# On a normal machine none of that is needed — the plain `edge-tts` calls below
# work as written.
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

say 1 "Prospecting was a phone call and a hope. This is what replaces it."

say 2 "Every advisor has their own link. It carries their code, so whoever sends it is whoever gets credited."

say 3 "Open your board. Type a first name and a number. Tap send. The message writes itself."

say 4 "What they receive is not a brochure. It is how you work. Written while you talk, not from memory after you leave. A reason in writing against every recommendation. A manager checking the file before they ever see it."

say 5 "Then nothing to fill in. They tap what is actually on their mind."

say 6 "Your board fills in by itself. Sent. Opened. Watched. Booked."

say 7 "The one worth ringing is the one who watched it through and stopped. They have told you what worries them and gone no further. That is the shortest distance between a link and an appointment."

say 8 "The wall carries the whole branch. Every link out, where people stop, and what they came looking for."

say 9 "This is the front of the work now. Everything else follows it."

echo
echo "Durations:"
for f in line*.mp3; do
  printf '  %-12s %6.2fs\n' "$f" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"
done
