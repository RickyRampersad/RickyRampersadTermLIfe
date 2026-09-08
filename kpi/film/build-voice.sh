#!/usr/bin/env bash
# Narration for the KPI tracker training film — the go-live cut.
#
#   ./build-voice.sh
#
# Andrew at -3%, same as every branch film: slightly under natural pace so a
# full stop can land. Short sentences carry the argument, not punctuation.
#
# Two rules, unchanged from the first cut:
#
#   1. The film teaches the flow as it actually ships. Staff land on their own
#      day; only the Branch Manager sees the branch; the wall is signed in once
#      and left alone. If the app changes, this script changes.
#
#   2. No number is spoken about a person that is not true. This cut names no
#      figures at all — the screens carry a worked example and the captions say
#      what the viewer is looking at.
set -euo pipefail
cd "$(dirname "$0")"
export SSL_CERT_FILE=/root/.ccr/ca-bundle.crt

VOICE="en-US-AndrewMultilingualNeural"
RATE="-3%"

say () {
  local n="$1"; shift
  printf '  line%02d  %s…\n' "$n" "${1:0:62}"
  edge-tts --voice "$VOICE" --rate="$RATE" --text "$1" --write-media "$(printf 'line%02d.mp3' "$n")"
}

echo "Narration — $VOICE at $RATE"

say 1 "This is the branch's Daily KPI and Innovation tracker. It is live now, at ricky rampersad branch dot com, slash KPI. Sign in with your agent number and your password."

say 2 "One sign-in, and your record is yours. Nobody else's day is on your screen. Yours is on nobody else's."

say 3 "You land on your own day. Four blocks, from your job document, in the order the day actually runs. The KPI is already chosen from the branch schedule. If the block went somewhere else, change it. The honest entry wins."

say 4 "Open the block as it ends. Three questions. What you actioned. What genuinely resolved. And what you still own."

say 5 "Write it the way you would say it. Numbers where you have them. Names where they matter."

say 6 "Then submit the block. It lands in the branch log, and a copy is emailed straight to you."

say 7 "That receipt reads exactly what you sent. Keep them. At review time, they are your file."

say 8 "Block by block, the day fills. Nobody is reconstructing an afternoon from memory at four o'clock."

say 9 "If nothing is in by noon, the tracker asks. If the day is unfinished at three, it asks again. Not to catch anybody. So the three o'clock report reads what actually happened."

say 10 "Value added is logged every day. Something the branch would not have unless you brought it. And if the honest entry is none today, write none today. That is still an entry."

say 11 "Ideas belong in the day too. A checklist that stops a repeat error. A macro that saves an hour. A process fix. Innovation is part of the job here, not extra to it."

say 12 "The Branch Manager sees the branch. The three o'clock checkpoint and the Friday summary are built from what you submitted. Your words, not a guess."

say 13 "And the Branch Manager logs a day like everyone else. Recruitment. Production. Training. Escalations. The standard applies at the top."

say 14 "At three o'clock the checkpoint goes out. Who is in. Who is missing. What is blocked. While there is still a working hour to do something about it."

say 15 "Friday evening, the weekly summary. Where the week actually went, person by person."

say 16 "Trends hold the longer story. Days logged. Blocks completed. Ideas raised. The quiet work becomes visible."

say 17 "And the wall. On the office screen, live through the day. Each name. Each block as it lands. The ideas the branch raised today. Signed in once in the morning, it looks after itself."

say 18 "Everything lives on the branch site. Slash KPI is the tracker. Slash training is this film. Slash manual is the written guide. And slash wall is the live screen."

say 19 "So: submit each block as it ends. Log the value you added. Raise the idea. That is the whole system."

say 20 "Your record. Your evidence. Your branch. Welcome to the wall."

echo "Done."
