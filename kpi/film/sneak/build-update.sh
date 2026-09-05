#!/usr/bin/env bash
# Assemble the "what changed" film.
#
#   node capture.js && node compose.js   # plates from the real tracker
#   ./build-voice.sh                     # narration
#   ./build-update.sh                    # this
#
# Vertical 1080x1920. It goes out on WhatsApp and is watched on a phone, and
# the subject is a phone app — a landscape frame in a chat window shrinks the
# tracker's own text below the size anyone will read it at.
#
# Each plate is held for exactly as long as its line, with a beat of air after,
# and given a very slow push in. Timings come off the rendered audio, never
# from an estimate.
set -euo pipefail
cd "$(dirname "$0")"

PLATES="${PLATES:-plates}"
MUSIC="${MUSIC:-../../../rr-branch-theme.mp3}"
OUT="${OUT:-sneak-peek.mp4}"
GAP=0.75
FPS=25
CRF="${CRF:-26}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

dur () { { ffmpeg -hide_banner -i "$1" 2>&1 || true; } | sed -n 's/.*Duration: 00:00:\([0-9.]*\).*/\1/p'; }

echo "Building segments"
: > "$WORK/vlist.txt"; : > "$WORK/alist.txt"
total=0
for f in line*.mp3; do
  n="${f#line}"; n="${n%.mp3}"
  plate="$PLATES/$n.png"
  [ -f "$plate" ] || { echo "  missing $plate — skipping"; continue; }
  d=$(dur "$f")
  seg=$(python3 -c "print(round($d + $GAP, 3))")
  frames=$(python3 -c "print(int(round($seg * $FPS)))")
  total=$(python3 -c "print(round($total + $seg, 3))")
  printf '  %s  %6.2fs  %s\n' "$n" "$seg" "$plate"

  ffmpeg -y -v error -loop 1 -i "$plate" \
    -filter_complex "scale=1350:-1,zoompan=z='min(1+0.04*on/$frames,1.04)':d=$frames:\
x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=$FPS,format=yuv420p" \
    -t "$seg" -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p "$WORK/v$n.mp4"
  echo "file '$WORK/v$n.mp4'" >> "$WORK/vlist.txt"

  ffmpeg -y -v error -i "$f" -af "apad=pad_dur=$GAP,aresample=48000" \
    -t "$seg" -c:a pcm_s16le "$WORK/a$n.wav"
  echo "file '$WORK/a$n.wav'" >> "$WORK/alist.txt"
done

echo
echo "Narration: ${total}s total"
ffmpeg -y -v error -f concat -safe 0 -i "$WORK/vlist.txt" -c copy "$WORK/video.mp4"
ffmpeg -y -v error -f concat -safe 0 -i "$WORK/alist.txt" -c copy "$WORK/voice.wav"

echo "Laying the bed"
ffmpeg -y -v error -stream_loop -1 -i "$MUSIC" -i "$WORK/voice.wav" -filter_complex "
  [0:a]atrim=0:$total,volume=-22dB,afade=t=in:st=0:d=2.5,
       afade=t=out:st=$(python3 -c "print(round($total-4,3))"):d=4,aresample=48000[bed];
  [1:a]aformat=channel_layouts=stereo,volume=1.0[voice];
  [bed][voice]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,
   aformat=channel_layouts=stereo[mix]" \
  -map "[mix]" -c:a pcm_s16le "$WORK/mixed.wav"

echo "Encoding $OUT"
ffmpeg -y -v error -i "$WORK/video.mp4" -i "$WORK/mixed.wav" \
  -map 0:v -map 1:a -c:v copy \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,aformat=channel_layouts=stereo" \
  -c:a aac -b:a 128k -ar 48000 -movflags +faststart -shortest "$OUT"

echo "Writing chapters.json"
./chapters.py "$GAP"

echo
{ ffmpeg -hide_banner -i "$OUT" 2>&1 || true; } | grep -E "Duration|Stream"
ls -la "$OUT" | awk '{printf "  %.1f MB\n", $5/1048576}'
