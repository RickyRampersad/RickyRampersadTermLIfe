#!/usr/bin/env bash
# The wall's spoken board titles — Andrew, -3%, the house voice.
# Dynamic numbers stay on screen as titles; Andrew names each board as it
# rotates in. Regenerate, then ./embed-wall-voice.py folds them into wall.html.
set -euo pipefail
cd "$(dirname "$0")"
VOICE="en-US-AndrewMultilingualNeural"
RATE="-3%"
say () { local n="$1"; shift
  printf '  w%02d  %s\n' "$n" "$1"
  edge-tts --voice "$VOICE" --rate="$RATE" --text "$1" --write-media "$(printf 'w%02d.mp3' "$n")"; }

say 0 "The service pulse. Where the branch stands, right now."
say 1 "Demand. Every request of the last twelve weeks, counted."
say 2 "Open work. What is due, and what is being chased."
say 3 "Department performance, ranked by on-time delivery."
say 4 "The agent leaderboard. Resolved on time, and celebrated."
say 5 "What clients ask for most."
say 6 "How the service feels. Every rating, in the client's own words."
say 7 "How are we doing? Measured against the promises we make."
say 8 "Intake. What came in today, this week, and this month. And what we resolved."
say 9 "The autopilot, working. Reminders sent with nobody chasing, and who is on it."
say 10 "Query Pal, live from the Ricky Rampersad Branch. Log it once, and forget it. The system does the rest."
