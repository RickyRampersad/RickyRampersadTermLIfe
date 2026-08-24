#!/usr/bin/env bash
# Regenerate the Query Pal story film's narration.
#
#   ./build-voice.sh
#
# Needs edge-tts (pip install edge-tts). Free, no account, no licence.
# Output is 24 kHz mono MP3 — speech over a music bed, not a master.
#
# Delivery comes from the voice and the rate, not punctuation tricks: Andrew at
# -3% reads slightly under natural pace, lets a full stop land, and does not
# smile. Short sentences do the rest. A line that needs to breathe more gets
# split into two sentences rather than reaching for commas.
#
# After regenerating, run ./embed-audio.py to fold the files back into
# story-film.html, which carries them inline so the film stays one file.
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

say 1 "Every day, a client asks us for something."
say 2 "A statement. A claim. A change of address."
say 3 "And then the hard part. Where does it actually go?"
say 4 "Sixteen departments. Sixty kinds of request. Send it to the wrong inbox, and it sits there for a week."
say 5 "So you email it. And then you wait."
say 6 "No reply. So you chase it yourself. Again. And again."
say 7 "And nobody knows where anything stands. Not the agent. Not the client."
say 8 "Query Pal ends that."
say 9 "One link. The client picks what they need, in plain language."
say 10 "Query Pal already knows the department. It already knows the deadline."
say 11 "One tap, and it is gone. To the right place. Branded, logged, and timed."
say 12 "And if it goes quiet, Query Pal chases. Not you."
say 13 "Day one. Day three. Then the branch manager, personally."
say 14 "Agents sign in and see their whole book."
say 15 "Every case. Every deadline. Every chase the system sent on their behalf."
say 16 "Clients sign in too."
say 17 "They see their own cases, live, with a progress bar that actually moves."
say 18 "No more asking for an update. They can simply look."
say 19 "And the whole branch, on one wall."
say 20 "Eighty four percent on time. Rated four and a half out of five. Nothing hidden."
say 21 "This is Query Pal."
say 22 "Log it once. And let it keep your promise."

echo
echo "Durations:"
for f in line*.mp3; do
  printf '  %-12s %6.2fs\n' "$f" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"
done
