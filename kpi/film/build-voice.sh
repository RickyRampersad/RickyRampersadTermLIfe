#!/usr/bin/env bash
# Narration for the KPI tracker training film.
#
#   ./build-voice.sh
#
# Same voice as the launch film — Andrew at -3%, which reads slightly under
# natural pace and lets a full stop land. The argument is carried by short
# sentences, not by punctuation tricks. If a line needs to breathe, split it.
#
# The script is written against the Sales Support Assistant job document:
# the six responsibilities are the blocks, and the performance expectations
# are the standard. Nothing here is invented — it is quoted from the document
# the team already has.
set -euo pipefail
cd "$(dirname "$0")"
export SSL_CERT_FILE=/root/.ccr/ca-bundle.crt

VOICE="en-US-AndrewMultilingualNeural"
RATE="-3%"

say () {
  local n="$1"; shift
  printf '  line%02d  %s\n' "$n" "${1:0:64}…"
  edge-tts --voice "$VOICE" --rate="$RATE" --text "$1" --write-media "$(printf 'line%02d.mp3' "$n")"
}

echo "Narration — $VOICE at $RATE"

say 1 "Every Sales Support Assistant at this branch has a job document. Six responsibilities. And a set of standards you are measured against."

say 2 "Look at the six. New applications. Pending, lapse and follow-ups. Document management. Reporting. Administrative support. And whatever else the day asks of you."

say 3 "Now look at your day. Four blocks. Those same responsibilities, in the order your day actually runs. This is not extra work. It is your job document, written down as you do it."

say 4 "Open the app and your day is already there. Your hours. Your lunch. Your four blocks, and what each one is for. The schedule lives here now, not in an email you have to go and find."

say 5 "Open a block and the KPI is already chosen. You are confirming it, not starting from a blank page."

say 6 "Three lines. What you actioned. What you genuinely resolved. And what is still open and still yours."

say 7 "If you are waiting on somebody, name them, and say when you last chased. A rolled due date is not an actioned task."

say 8 "Then submit. Not at four o'clock from memory. At the end of the block, while you still remember the detail. Being first is better than being perfect."

say 9 "The moment you submit, your own words come back to you by email. That is your copy. Post it to the branch group. Nobody retypes anything."

say 10 "Four blocks. Four short reports. Under five minutes across a whole day."

say 11 "At three, the branch report goes to the Branch Manager. Who has logged. Who has not. And every blocker raised, with an hour left to do something about it."

say 12 "Your name is on that list either way. The only question is whether it shows your work."

say 13 "On Friday, the week. And this is where it stops being admin."

say 14 "Reports in, twenty five out of twenty five. Tasks closed, two hundred and thirty six, up to four hundred and sixty three. Overdue, one hundred and forty six, down to sixty eight. Sixty days and older, forty four, down to sixteen."

say 15 "Nobody argued anybody into that. The blocks were reported as they were worked, so the branch could see what was really happening while there was still time to act on it."

say 16 "And the two boxes people skip. Value added. Ideas. Read your job document again. Continuous improvement. Demonstrate by making recommendations. Curiosity. Be proactive in sharing views."

say 17 "Those boxes are not decoration. They are performance expectations. This is where you get the credit for them."

say 18 "Every entry builds your record. Closed against overdue. Days logged. Value added. Training you delivered. When your appraisal comes, this is the evidence. In your own words, with the dates attached."

say 19 "Your standards are already written. Head Office within two days. The relevant party within one. One hundred percent accuracy."

say 20 "Report each block as you finish it. And the record shows you met them."

echo
echo "Durations:"
total=0
for f in line*.mp3; do
  d=$({ ffmpeg -hide_banner -i "$f" 2>&1 || true; } | sed -n 's/.*Duration: \([0-9:.]*\).*/\1/p')
  printf '  %-12s %s\n' "$f" "$d"
done
