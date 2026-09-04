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

say  1 "Forty one policies crossed the forty five day line today."
say  2 "They carry thirty seven thousand dollars in premium."
say  3 "Thirty four of them were on a standing instruction that failed."
say  4 "That is a bank to ring. Not a client who refused."
say  5 "Thirty one have been in force between two and ten years."
say  6 "These are not bad sales. They are long standing clients who stopped."
say  7 "On Friday the eleventh, three hundred and forty five more cross."
say  8 "One billing cohort. Everything paid to the twenty eighth of July."
say  9 "Eight times a normal day."
say 10 "Work it before Friday."

echo
echo "Durations:"
for f in line*.mp3; do
  printf '  %-12s %s\n' "$f" "$(ffprobe -v error -show_entries format=duration \
    -of default=noprint_wrappers=1:nokey=1 "$f" 2>/dev/null || echo '?')"
done
echo
echo "Now run ./embed-audio.py to fold them into the wall."
