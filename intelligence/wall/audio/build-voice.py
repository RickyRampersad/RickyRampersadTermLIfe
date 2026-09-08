#!/usr/bin/env python3
"""Render the wall's narration — every screen, or one.

    ./build-voice.py            # all five
    ./build-voice.py licence    # one

Reads lines.py, writes narration/<wall>/lineNN.mp3 with edge-tts (free, no
account, no licence), then prints each line's measured length. Run
./embed-audio.py afterwards to fold the audio into the pages.

Renders from inside a Claude sandbox as of 8 September 2026 — the plain
edge-tts CLI reaches the speech endpoint through the agent proxy. If it ever
stops, see the note at the foot of this file."""
import pathlib, subprocess, sys
from lines import WALLS, VOICE, RATE, mp3_seconds

here = pathlib.Path(__file__).parent
want = sys.argv[1:] or list(WALLS)
bad = [w for w in want if w not in WALLS]
if bad:
    sys.exit('No such wall: ' + ', '.join(bad) + '. One of: ' + ', '.join(WALLS))
if 'Multilingual' in VOICE:
    sys.exit('lines.py names the Multilingual voice. It reads phrases in other languages; use en-US-AndrewNeural.')

print('Narration — %s at %s' % (VOICE, RATE))
for wall in want:
    out = here / 'narration' / wall
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob('line*.mp3'):
        old.unlink()
    total = 0.0
    print('\n%s.html' % wall)
    for i, text in enumerate(WALLS[wall], 1):
        if any(ch.isdigit() for ch in text):
            sys.exit('A digit in a spoken line — spell it out, or better, do not say it: ' + text)
        f = out / ('line%02d.mp3' % i)
        subprocess.run(['edge-tts', '--voice', VOICE, '--rate=' + RATE, '--text', text,
                        '--write-media', str(f)], check=True)
        secs = mp3_seconds(f)
        total += secs
        print('  line%02d  %5.2fs  %s' % (i, secs, text))
    print('  %d lines, %.1fs of voice' % (len(WALLS[wall]), total))

print('\nNow run ./embed-audio.py to fold them into the pages.')

# ── IF THE RENDER FAILS BEHIND A PROXY ────────────────────────────────────
# edge_tts pins its own SSL context at import and never consults
# SSL_CERT_FILE, so a proxy CA appended to certifi does nothing. Replace the
# context and pass the proxy:
#
#     import ssl, os, asyncio, edge_tts, edge_tts.communicate as C
#     C._SSL_CTX = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
#     asyncio.run(edge_tts.Communicate(text, VOICE, rate=RATE,
#                 proxy=os.environ.get("HTTPS_PROXY")).save(out))
