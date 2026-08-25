#!/usr/bin/env bash
# The wall speaks. Andrew, -3%, the house voice.
#
# The wall's numbers change every ninety seconds, and a static page has no
# text-to-speech engine worth listening to — the device voice is the robotic
# one Ricky rejected. So Andrew is recorded as a BANK and spliced at playback:
# sentence fragments plus every number from zero to one hundred. The player
# chains the buffers back to back, which lets Andrew read live branch figures
# out loud without a server.
#
#   ./build-wall-voice.sh        writes c_*.mp3 here
#   ./embed-wall-voice.py        folds them into wall.html as data URIs
#
# Silence is trimmed off both ends of every clip so the splices land tight —
# the player adds its own small gap between words.
set -euo pipefail
cd "$(dirname "$0")"

VOICE="en-US-AndrewMultilingualNeural"
RATE="-3%"
FF=/usr/bin/ffmpeg
TRIM="silenceremove=start_periods=1:start_silence=0:start_threshold=-46dB,areverse,silenceremove=start_periods=1:start_silence=0:start_threshold=-46dB,areverse"

rm -f c_*.mp3
mk () {                                   # mk <key> <text>
  local key="$1" text="$2" raw="/tmp/qpv_$$.mp3"
  edge-tts --voice "$VOICE" --rate="$RATE" --text "$text" --write-media "$raw" 2>/dev/null
  "$FF" -y -loglevel error -i "$raw" -af "$TRIM" -codec:a libmp3lame -b:a 48k -ar 24000 -ac 1 "c_${key}.mp3"
  rm -f "$raw"
  printf '  %-14s %s\n' "$key" "$text"
}

echo "── numbers ──"
# A trailing comma gives a continuing contour, so a number spliced into the
# middle of a sentence does not land like a full stop.
for n in $(seq 0 100); do mk "n$n" "$n,"; done
for d in $(seq 0 9);   do mk "p$d" "point $d,"; done
# past a hundred: "h" carries a remainder, "hf" is a round hundred
for h in $(seq 1 9); do mk "h$h"  "$((h * 100)) and,"; done
for h in $(seq 1 9); do mk "hf$h" "$((h * 100)),"; done
mk over     "over,"
mk thousand "thousand,"

echo "── grades ──"
mk gAp "an A plus."
mk gA  "an A."
mk gB  "a B."
mk gC  "a C."
mk gD  "a D."
mk gNA "not yet scored."

echo "── fragments ──"
mk f_rightnow      "Right now,"
mk f_areopen       "requests are open."
mk f_arelate       "are past their deadline. Every one of them is being chased automatically."
mk f_nonelate      "Nothing is past its deadline. The board is clean."
mk f_promise       "We are keeping our promise"
mk f_pctoftime     "percent of the time."
mk f_target90      "The target is ninety."

mk f_camein30      "requests came in over the last thirty days."
mk f_cameintoday   "of them came in today."
mk f_steady        "This is the shape of the demand on this branch."

mk f_openwork      "Open work."
mk f_areoverdue    "are overdue, and"
mk f_remindersout  "automatic reminders have already gone out on them."

mk f_fastestdept   "The fastest department is answering"
mk f_pctontime     "percent on time."
mk f_slowestat     "The slowest is at"
mk f_bothnamed     "Both are named on the screen."

mk f_leadagent     "Our leading agent has"
mk f_resolvedat    "requests resolved, at"
mk f_nameonscreen  "Their name is on the screen."

mk f_mostasked     "The request we get most came up"
mk f_times         "times."

mk f_clientsrate   "Clients rate us"
mk f_outoffivefrom "out of five, from"
mk f_ratings       "ratings."
mk f_lowratings    "of those were three stars or below. Each one is a call worth making."
mk f_nolow         "Not one of them was below three stars."

mk f_against       "Against the promises we make, this branch is scoring"
mk f_ontimeis      "On time,"
mk f_vstarget      "percent against a target of ninety."

mk f_intoday       "requests came in today, and"
mk f_wereresolved  "were resolved."
mk f_thisweek      "this week."
mk f_thismonth     "and this month."

# the autopilot, explained rather than just counted
mk f_autolead      "Here is what the system did without being asked."
mk f_remindersent  "reminders were sent to departments, and not one person had to write them."
mk f_thatstime     "That is roughly"
mk f_hoursback     "hours of chasing handed back to the branch."
mk f_solvedalone   "of the requests we closed needed no human chasing at all."
mk f_neededhands   "needed someone to step in."
mk f_thatsthepoint "That gap is the whole point of Query Pal."
mk f_sysshare      "percent of everything that moved a case was done by the system."

mk f_staffhead     "People and the system, side by side."
mk f_deskhead        "Who is carrying the work."
mk f_deskscarry      "desks are sharing the branch's cases between them."
mk f_busiestopen     "are still open on the busiest desk."
mk f_systemclosedfor "percent of what those desks closed, the system had already finished for them."
mk f_selfclosed      "cases were closed by the person handling them, without waiting to be chased."
mk f_recognise       "That is worth recognising."
mk f_busiestdesk   "The busiest desk is named on the screen, carrying"
mk f_casesword     "cases."
mk f_avgclose      "On average a request takes"
mk f_daysclose     "days to close."

mk open            "Query Pal. Live from the Ricky Rampersad Branch. Log it once, and forget it. The system does the rest."

echo
echo "$(ls c_*.mp3 | wc -l) clips  ·  $(du -sh . | cut -f1) on disk"
