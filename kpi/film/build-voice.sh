#!/usr/bin/env bash
# Narration for the KPI tracker training film.
#
#   ./build-voice.sh
#
# Same voice as the launch film — Andrew at -3%, which reads slightly under
# natural pace and lets a full stop land. The argument is carried by short
# sentences, not by punctuation tricks. If a line needs to breathe, split it.
#
# Two rules for this script:
#
#   1. It is written against the two job documents. The six responsibilities
#      are the blocks and the performance expectations are the standard —
#      quoted from the documents the team already has, not invented here.
#
#   2. Every figure spoken is either read from the branch's own Salesforce org,
#      or is clearly framed as a demonstration. The week's numbers in lines 20
#      and 21 come from a worked example, and the narration says so. A training
#      film must not hand people a number about themselves that is not true.
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

say 1 "Every Sales Support Assistant at this branch has a job document. Six responsibilities. And a set of standards you are measured against."

say 2 "Look at the six. New applications. Pending, lapse and follow-ups. Document management. Reporting. Administrative support. And whatever else the day asks of you."

say 3 "Now look at your day. Four blocks. Those same responsibilities, in the order your day actually runs. This is not extra work. It is your job document, written down as you do it."

say 4 "Open the app and your day is already there. Your hours. Your lunch. Your four blocks, and what each one is for. The schedule lives here now, not in an email you have to go and find."

say 5 "Open a block and the KPI is already chosen. You are confirming it, not starting from a blank page."

say 6 "And these are not our words for the work. They are the ten task types Salesforce already tags every task with. Pendings. Renewals. Servicing. Claims. Scripts. The same words, in both places, at last."

say 7 "Three lines. What you actioned. What you genuinely resolved. And what is still open and still yours."

say 8 "If you are waiting on somebody, name them, and say when you last chased. A rolled due date is not an actioned task."

say 9 "Now the part you used to type. Closed today. Open. Overdue. Sixty days and older. Three numbers, entered from memory at the end of a long day."

say 10 "Salesforce knows all four, for you, exactly, right now. So the app asks it. There is nothing to type, and nothing to remember."

say 11 "It also shows what a number on its own cannot. These are your overdue tasks with no reason recorded against them."

say 12 "That distinction matters more than the count. An overdue task with a reason is work in progress. An overdue task without one is a task nobody has looked at."

say 13 "Across this branch, five overdue tasks in every hundred carry a reason. The field has been there all along."

say 14 "So write it here. What it is waiting on, and who owns the next step. Press save, and it is on the task in Salesforce. You do not leave your day to do it."

say 15 "Billing gets one more step, because billing is the easiest work to send twice."

say 16 "Before you send, the block shows what is already open against those accounts. One company here is carrying four open billing tasks at once. Three life renewals and a health billing. Each one was sent. None was checked back."

say 17 "That is not four jobs. That is one job nobody closed, four times over. Check the last one landed, then send."

say 18 "Then submit the block. Not at four o'clock from memory. At the end of the block, while you still remember the detail. Being first is better than being perfect."

say 19 "The moment you submit, your own words come back to you by email. That is your copy. Post it to the branch group. Nobody retypes anything."

say 20 "At three, the branch report goes to the Branch Manager. Who has logged. Who has not. And every blocker raised, with an hour left to do something about it."

say 21 "Your name is on that list either way. The only question is whether it shows your work."

say 22 "On Friday, the week. And this is where it stops being admin."

say 23 "Here is a week reported properly. Not a target, and not last week. Just the shape of it. Every report in. Tasks closed nearly doubled. Overdue down by half. Nothing older than sixty days."

say 24 "Nobody argued anybody into that. The blocks were reported as they were worked, so the branch could see what was really happening while there was still time to act on it."

say 25 "And the two boxes people skip. Value added. Ideas. Read your job document again. Continuous improvement. Demonstrate by making recommendations. Curiosity. Be proactive in sharing views."

say 26 "Those boxes are not decoration. They are performance expectations. This is where you get the credit for them."

say 27 "Every entry builds your record. Closed against overdue. Days logged. Value added. Training you delivered. When your appraisal comes, this is the evidence. In your own words, with the dates attached."

say 28 "Your standards are already written. Head Office within two days. The relevant party within one. One hundred percent accuracy."

say 29 "Report each block as you finish it. And the record shows you met them."

echo
echo "Durations:"
for f in line*.mp3; do
  d=$({ ffmpeg -hide_banner -i "$f" 2>&1 || true; } | sed -n 's/.*Duration: \([0-9:.]*\).*/\1/p')
  printf '  %-12s %s\n' "$f" "$d"
done
