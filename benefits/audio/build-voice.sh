#!/usr/bin/env bash
# Regenerate the launch film's narration.
#
#   ./build-voice.sh
#
# Needs edge-tts (pip install edge-tts). Free, no account, no licence.
# Output is 24 kHz mono MP3, which is plenty — it is speech over a music bed,
# not a master.
#
# The delivery is set by the voice and the rate, not by punctuation tricks:
# Andrew at -3% reads slightly under natural pace, lets a full stop land, and
# does not smile. Short sentences do the rest of the work. If a line needs to
# breathe more, split it into two sentences rather than reaching for commas.
#
# After regenerating, run  ./embed-audio.py  to fold the files back into
# launch-eb.html, which carries them inline so the film is still one file.
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

say 1 "Employee benefits. Quoted. Enrolled. Billed. And checked."

say 2 "Every month, a company gets two documents. One for life. One for health. Different systems, different formats. Nobody reads three hundred lines by eye. So nobody checks."

say 3 "We start earlier than that. What the company actually needs. How much cover. Read from their real census, not an average."

say 4 "Then there is the work that never stops. People join. People leave. And every change has thirty-one days to reach the insurer."

say 5 "So every month, we read both documents and compare them. A hundred and forty-nine matched. Three spelled differently in the two systems. Two with no life cover at all. And eight hundred and forty-five dollars in premium, paid on someone who had already left."

say 6 "On the wall in the branch, the whole book. Live."

say 7 "Employee benefits. Built at the branch. Running now."

echo
echo "Durations:"
for f in line*.mp3; do
  printf '  %-12s %6.2fs\n' "$f" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"
done
