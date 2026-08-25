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
RATE="-8%"

say () {  # say <index> <text>
  local n="$1"; shift
  printf '  line%02d  %s\n' "$n" "$1"
  edge-tts --voice "$VOICE" --rate="$RATE" --text "$1" --write-media "$(printf 'line%02d.mp3' "$n")"
}

echo "Narration — $VOICE at $RATE"

say 1 "Every branch runs on email."
say 2 "And email is where a request goes to die."
say 3 "A client asks for something simple. A statement. A claim."
say 4 "And the agent has to guess."
say 5 "Which of sixteen departments does this one go to?"
say 6 "Guess wrong. And it sits in the wrong inbox for a week."
say 7 "So they chase it. By hand. Again. And again."
say 8 "Staff cannot see it. The client cannot see it. Nobody can."
say 9 "On a McKinsey project, Ricky Rampersad saw a different way."
say 10 "A process you cannot see. Is a process you cannot fix."
say 11 "So he built Query Pal. Here. At Branch twenty six thousand."
say 12 "One aim. End the emails."
say 13 "Log it once. And forget it. The system does the rest."
say 14 "The client types what they need. In plain language."
say 15 "No department to know. No address to find."
say 16 "Query Pal already knows where it goes. And the day it is due."
say 17 "One tap. Gone. To the right place."
say 18 "If the department goes quiet, the reminders write themselves."
say 19 "Day one. Day three. Firm. Polite. On the very same thread."
say 20 "The branch manager is the last resort."
say 21 "And the whole point is that it almost never gets there."
say 22 "An agent opens their phone. And sees their entire book."
say 23 "A client opens theirs. And watches the progress move."
say 24 "No more asking for an update. They can simply look."
say 25 "Agent. Staff. Client. One system. Everybody can see."
say 26 "Eighty four percent on time. Rated four and a half. Nothing hidden."
say 27 "This is Query Pal. A Ricky Rampersad Branch initiative."
say 28 "Log it once. Forget it. We will keep the promise."

echo
echo "Durations:"
for f in line*.mp3; do
  printf '  %-12s %6.2fs\n' "$f" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"
done
