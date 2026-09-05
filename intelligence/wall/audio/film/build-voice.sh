#!/usr/bin/env bash
# Narration for the Branch Intelligence Wall launch film.
#
#   ./build-voice.sh && ../embed-audio.py ../../film.html film
#
# Same voice and rate as every other film in the branch — Andrew at -3%. A
# branch that sounds like one organisation on four screens is the whole reason
# the voice was fixed once and never re-argued.
#
# ── RENDERING FROM INSIDE A CLAUDE SANDBOX ────────────────────────────────
# edge-tts fails behind the agent proxy with SSLCertVerificationError, which
# reads exactly like the tunnel refusing a WebSocket upgrade. That is the wrong
# diagnosis. edge_tts pins its own SSL context at import —
#
#     edge_tts/communicate.py:  _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
#
# — and never consults SSL_CERT_FILE or REQUESTS_CA_BUNDLE, so appending the
# proxy CA to certifi does nothing. Replace the context and pass the proxy;
# render.py beside this file does exactly that and works in-session.
# ──────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"
exec python3 render.py
