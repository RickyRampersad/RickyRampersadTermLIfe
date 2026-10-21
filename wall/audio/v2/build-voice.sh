#!/usr/bin/env bash
# Andrew's lines for Wall Intelligence (20 October 2026), one file per scene, into this folder.
# Made on the GitHub runner (branch tts-run, tts/job.json key "wall"); this script does the same on any computer with edge-tts.
# House rule: en-US-AndrewNeural, never the Multilingual voice, at -4% and in spoken wording: at -12% he sounded robotic
# to Mr Rampersad (17 and 20 October 2026). The wall's captions (each scene's rec line) are these words.
set -euo pipefail
cd "$(dirname "$0")"
V=en-US-AndrewNeural; R=-4%
say() { edge-tts --voice "$V" --rate="$R" --text "$2" --write-media "$1.mp3"; echo "  $1.mp3"; }
say n0 "This is the Ricky Rampersad Branch, live. Here's how the day's going, for staff, agents and managers."
say n1 "First, the staff. Who's in, who's out today, and who's covering, so no client waits."
say n2 "Hour by hour, here's what's being actioned at the branch, and when."
say n3 "Where the work went. High-payoff work comes first: new business, orphan adoption, and retention."
say n4 "The team game. Everybody's in, and nobody's ranked. Each person plays against their own usual week."
say n10 "How we served. Every task closed for an agent or a client gets rated by the people we serve."
say n11 "Shout-outs! Today's wins: par reached, five-star service, levels up, streaks, and every thank-you."
say n5 "Now, the agents. Their day in the field, and the fact finds that turn into cover."
say n6 "From a fact find to a family covered. Here's the month, and the year's goal against the time gone."
say n9 "The Branch Manager's day. Everything done from his desk since five this morning, as it happens."
say n7 "The managers. Leading the branch, Akaash's unit in the field, and every desk covered."
say n8 "And that's what's happening right now, live, across the branch."
echo "Done. Commit the twelve wall/audio/v2/*.mp3 files and the wall uses them."
