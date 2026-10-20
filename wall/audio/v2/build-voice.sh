#!/usr/bin/env bash
# Andrew's lines for Wall Intelligence (20 October 2026), one file per scene, into this folder.
# Run on your own computer (it needs edge-tts: pip install edge-tts), then commit the eleven .mp3 files.
# The wall plays these on any screen; until they are here, Microsoft Edge's own Andrew voice reads the live lines.
# House rule: en-US-AndrewNeural, never the Multilingual voice; -12% for a walkthrough.
set -euo pipefail
cd "$(dirname "$0")"
V=en-US-AndrewNeural; R=-12%
say() { edge-tts --voice "$V" --rate="$R" --text "$2" --write-media "$1.mp3"; echo "  $1.mp3"; }
say n0 "This is Ricky Rampersad Branch, live. Here is how the day is going, for staff, agents and managers."
say n1 "Staff. Who is in, who is out today, and who is covering, so no client waits."
say n2 "Hour by hour: what is being actioned at the branch, and when."
say n3 "Where the work went: high-payoff first, new business, orphan adoption and retention."
say n4 "The team game: everybody in, nobody ranked. Each person against their own usual week."
say n10 "How we served: every task closed for an agent or a client, rated by the people we serve."
say n5 "Agents: the day in the field, and the fact finds that turn into cover."
say n6 "From a fact find to a family covered: the month, and the year's goal against the time gone."
say n7 "Managers: leading the branch, the unit in the field, and every desk covered."
say n9 "The Branch Manager's day: everything done from his desk since five, as it happens."
say n8 "And that is what is happening now, live, across the branch."
echo "Done. Commit the eleven wall/audio/v2/*.mp3 files and the wall uses them."
