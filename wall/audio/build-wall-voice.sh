#!/usr/bin/env bash
# The wall's own narration — one line per slide, in deck order.
#
#   ./build-wall-voice.sh
#
# Andrew at -3%, the same voice as the films, so the branch sounds like one
# organisation wherever you hear it.
#
# Two rules.
#
#   1. These lines never speak a number. The figures on the wall change every
#      day and the audio does not, so the voice says what a slide is FOR and
#      lets the screen carry what it says. A wall that reads yesterday's total
#      out loud is worse than a silent one.
#
#   2. sN.mp3 is slide N of the deck in wall/index.html — speak() resolves the
#      file straight from the slide index. Insert a slide and every file after
#      it moves. The order below is the order in render(); keep them together
#      or the wall narrates the wrong card, which is worse than silence.
set -euo pipefail
cd "$(dirname "$0")"
export SSL_CERT_FILE=/root/.ccr/ca-bundle.crt

VOICE="en-US-AndrewMultilingualNeural"
RATE="-3%"

say () {
  printf '  %-4s %s…\n' "$1" "${2:0:58}"
  edge-tts --voice "$VOICE" --rate="$RATE" --text "$2" --write-media "$1.mp3"
}

say s1  "The day, block by block. A dot lights when a block is submitted, and turns red when its time has passed with nothing in."
say s2  "Who owes a block right now, and how long until the three o'clock checkpoint goes to the Branch Manager."
say s3  "How the day is being written. A block is written when it says how many, or which one. A box filled in is not a day recorded."
say s4  "What each person worked on today, set against what is still open in exactly that task type. The day and the book, side by side."
say s5  "What was worked today, and whether anybody wrote down what they did. A task can be moved in two seconds. Change the status, push the date into next week, and it counts as work. The line that matters is the one underneath: how many carried a note saying what actually happened."
say s6  "The overdue book, by who owns it — and what each pile is actually made of. A total on its own tells nobody what to do on Monday morning."
say s7  "The same book cut the other way. By owner you see who to talk to. By task type you see what the branch is behind on, and whether anybody worked it today."
say s8  "Who the branch is actually waiting on, by name. Waiting on someone else is a status, not an answer. A name and a number is something you can chase."
say s9  "The open book, and how much of it is late. A big book is not a bad book. What matters is the share of it that is past its date."
say s10 "How the day is chased. Six things happen on their own — the midday nudge goes only to you, never to the branch."

echo "Done — 10 lines, matching the 10 slides in render()."
