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

say 1 "Every branch runs on email. And email is where a request goes to die."
say 2 "A client asks for something simple. A statement. A claim."
say 3 "And the agent has to guess. Which of sixteen departments does this one go to?"
say 4 "Guess wrong, and it sits in the wrong inbox for a week."
say 5 "So they chase it. By hand. Again, and again."
say 6 "Staff cannot see it. The client cannot see it. Nobody can."
say 7 "Ricky Rampersad took what he learned at McKinsey. A process you cannot see is a process you cannot fix."
say 8 "And built Query Pal. Here. At Branch twenty six thousand."
say 9 "One aim. End the emails."
say 10 "Log it once. And forget it. The system does the rest."
say 11 "The client types what they need, in plain language."
say 12 "No department to know. No address to find. No forms to hunt for."
say 13 "Query Pal already knows where it goes, and the day it is due."
say 14 "One tap. Gone. Branded, logged, and timed."
say 15 "If the department goes quiet, the reminders write themselves."
say 16 "Day one. Day three. Firm, polite, on the very same thread."
say 17 "The branch manager is the last resort. And the whole point is that it almost never gets there."
say 18 "An agent opens their phone and sees their entire book."
say 19 "A client opens theirs, and watches the progress move."
say 20 "No more, any update. No more chasing. No more guessing."
say 21 "Agent. Staff. Client. One system. Everybody can see."
say 22 "Eighty four percent on time. Rated four and a half. Nothing hidden."
say 23 "This is Query Pal. A Ricky Rampersad Branch initiative."
say 24 "Log it once. Forget it. We will keep the promise."

echo
echo "Durations:"
for f in line*.mp3; do
  printf '  %-12s %6.2fs\n' "$f" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"
done
