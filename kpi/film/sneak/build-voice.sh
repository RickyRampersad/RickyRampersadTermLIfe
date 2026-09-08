#!/usr/bin/env bash
# Narration for the "what changed" film.
#
#   ./build-voice.sh
#
# Same voice as every other branch film — Andrew at -3%, per the house notes.
# The lines live in lines.json beside the plate they belong to, so the film and
# the words cannot drift apart.
#
# Short declarative sentences. State the fact and trust it. This one is telling
# nine people that something they were blamed for was not their fault, and then
# asking them for something. Neither part is helped by selling.
set -euo pipefail
cd "$(dirname "$0")"

VOICE="en-US-AndrewMultilingualNeural"
RATE="-3%"

# ffprobe is not always on the box; ffmpeg reports the same duration.
dur () { { ffmpeg -hide_banner -i "$1" 2>&1 || true; } | sed -n 's/.*Duration: 00:00:\([0-9.]*\).*/\1/p'; }

echo "Narration — $VOICE at $RATE"
python3 -c "
import json
for L in json.load(open('lines.json')):
    print('%d\t%s' % (L['n'], L['say']))
" | while IFS=$'\t' read -r n say; do
  f=$(printf 'line%02d.mp3' "$n")
  printf '  %s  %s\n' "$f" "$say"
  edge-tts --voice "$VOICE" --rate="$RATE" --text "$say" --write-media "$f"
done

echo
echo "Durations:"
total=0
for f in line*.mp3; do
  d=$(dur "$f"); total=$(python3 -c "print(round($total + $d, 2))")
  printf '  %-12s %6.2fs\n' "$f" "$d"
done
echo "  ----------------------"
printf '  %-12s %6.2fs of speech\n' "total" "$total"
