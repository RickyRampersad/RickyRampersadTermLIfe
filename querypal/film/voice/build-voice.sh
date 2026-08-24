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

say 1 "Every day, someone asks us for something."
say 2 "A statement. A claim. A change of address. Small things. Never small to the person asking."
say 3 "For years, those requests lived in email."
say 4 "And email forgets."
say 5 "Any update. The honest answer, too often, was: let me check."
say 6 "We got tired of saying let me check."
say 7 "So the branch built Query Pal."
say 8 "One link. Every request logged the moment it is made. It already knows the department. It already knows the day the answer is due."
say 9 "From that moment it is a promise with a date on it."
say 10 "If the department goes quiet, we do not. A reminder. Then a firmer one, on the same thread. Then the branch manager, personally."
say 11 "And when a department is waiting on us, the system chases us too."
say 12 "The client is never left guessing. They are told where things stand, and told again if anything pauses."
say 13 "When it is done, we ask them how we did."
say 14 "Then we put the answer on a screen in the branch, where anyone can see it."
say 15 "Eighty four percent resolved on time. Rated four and a half out of five. Nothing hidden."
say 16 "This is how we work."
say 17 "Not because a system is impressive. Because a promise should be kept."
say 18 "Query Pal. From the Rampersad Branch."

echo
echo "Durations:"
for f in line*.mp3; do
  printf '  %-12s %6.2fs\n' "$f" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"
done
