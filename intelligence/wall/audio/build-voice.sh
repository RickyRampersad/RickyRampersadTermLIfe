#!/usr/bin/env bash
# Regenerate the wall's narration — all five screens, or one:
#
#   ./build-voice.sh && ./embed-audio.py
#   ./build-voice.sh licence && ./embed-audio.py licence
#
# The lines, the voice and the rate live in lines.py; this is a thin wrapper
# around build-voice.py so the old command keeps working. Needs edge-tts
# (pip install edge-tts). Free, no account, no licence.
set -euo pipefail
cd "$(dirname "$0")"
exec python3 ./build-voice.py "$@"
