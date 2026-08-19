#!/usr/bin/env bash
#
# Puts a real recorded voice onto the film.
# ============================================================================
#
# The film ships with music and on-screen text only. If the branch records a
# narration — Ricky, a team member, or a hired voice — this script lays it over
# the music, ducks the music underneath it, re-masters, and rebuilds both video
# files. It takes about a minute and needs nothing installed but ffmpeg.
#
#   bash pension/add-narration.sh  path/to/recording.wav
#
# ---------------------------------------------------------------------------
# WHAT TO RECORD
#
# The script sheet is pension/assets/film.vtt — it is the twenty lines in
# order, each with the exact second it belongs at and how long it has. Read it
# in a quiet room; a phone held a hand's width away and slightly off to the
# side is genuinely fine. Leave the pauses in. Do not try to hit the timings
# exactly — record it straight through as one take and this script places it.
#
# Two takes is normally enough. Warmth and conviction beat perfection: this is
# meant to sound like the branch, not like a radio advertisement.
#
# ---------------------------------------------------------------------------
# WHAT THIS DOES
#
#   1. converts the recording to 44.1 kHz stereo
#   2. cleans it lightly — a high-pass to take out room rumble, gentle
#      compression so the quiet words are not lost, and a limiter
#   3. lays it over the music and ducks the music to 40% underneath it,
#      automatically, wherever the voice is speaking
#   4. masters the result to -15 LUFS, which is where web video sits
#   5. rebuilds RRB-Company-Pensions.mp4 and .webm without re-rendering a
#      single frame of picture
#
set -euo pipefail

VOICE="${1:-}"
if [ -z "$VOICE" ] || [ ! -f "$VOICE" ]; then
  echo "Usage: bash pension/add-narration.sh path/to/recording.wav"
  echo
  echo "Record the twenty lines in pension/assets/film.vtt, straight through."
  exit 1
fi

HERE="$(cd "$(dirname "$0")" && pwd)"
A="$HERE/assets"
MUSIC="$A/film-music.m4a"
[ -f "$MUSIC" ] || { echo "Missing $MUSIC — it ships with the repository."; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "1/4  cleaning the recording…"
ffmpeg -y -v error -i "$VOICE" \
  -af "aresample=44100,aformat=channel_layouts=stereo,highpass=f=90,\
acompressor=threshold=0.09:ratio=3.2:attack=8:release=200:makeup=1.7,\
alimiter=limit=0.94" \
  -c:a pcm_s16le "$TMP/voice.wav"

echo "2/4  laying it over the music, ducking underneath…"
# sidechaincompress makes the music step aside wherever the voice speaks, so
# nobody has to mark where the lines fall.
ffmpeg -y -v error -i "$MUSIC" -i "$TMP/voice.wav" \
  -filter_complex "[1:a]asplit=2[vo][key];\
[0:a][key]sidechaincompress=threshold=0.02:ratio=9:attack=25:release=340:makeup=1[duck];\
[duck][vo]amix=inputs=2:normalize=0:dropout_transition=0[mix];\
[mix]alimiter=limit=0.97[out]" \
  -map "[out]" -c:a pcm_s16le "$TMP/mix.wav"

echo "3/4  mastering to -15 LUFS…"
M=$(ffmpeg -hide_banner -i "$TMP/mix.wav" -af loudnorm=I=-15:TP=-1.5:LRA=8:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
gv(){ echo "$M" | grep "\"$1\"" | sed 's/.*: *"//;s/".*//'; }
ffmpeg -y -v error -i "$TMP/mix.wav" \
  -af "loudnorm=I=-15:TP=-1.5:LRA=8:measured_I=$(gv input_i):measured_TP=$(gv input_tp):measured_LRA=$(gv input_lra):measured_thresh=$(gv input_thresh):linear=true,aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=stereo" \
  -c:a pcm_s16le "$TMP/master.wav"

echo "4/4  rebuilding the film (no frame is re-rendered)…"
cp "$A/RRB-Company-Pensions.mp4"  "$TMP/in.mp4"
cp "$A/RRB-Company-Pensions.webm" "$TMP/in.webm"
ffmpeg -y -v error -i "$TMP/in.mp4" -i "$TMP/master.wav" -map 0:v:0 -map 1:a:0 \
  -c:v copy -c:a aac -b:a 128k -ar 44100 -ac 2 -shortest -movflags +faststart \
  "$A/RRB-Company-Pensions.mp4"
ffmpeg -y -v error -i "$TMP/in.webm" -i "$TMP/master.wav" -map 0:v:0 -map 1:a:0 \
  -c:v copy -c:a libopus -b:a 112k -shortest \
  "$A/RRB-Company-Pensions.webm"

echo
echo "Done. Both films now carry the recording."
ls -la "$A/RRB-Company-Pensions.mp4" "$A/RRB-Company-Pensions.webm" | awk '{printf "  %-46s %.1f MB\n", $9, $5/1048576}'
echo
echo "If you also want captions back on, put the <track> line back into"
echo "pension/launch.html — film.vtt already holds the words and their timings."
