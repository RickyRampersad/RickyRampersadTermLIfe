#!/usr/bin/env python3
"""Narration for the explainer.

TWO CHANGES AFTER THE FIRST SHOWING, both from what was actually heard.

NOT THE MULTILINGUAL VOICE. `en-US-AndrewMultilingualNeural` detects language
from the text and will read a phrase in another one — which is what "I am
hearing a different language" was. `en-US-AndrewNeural` is the same warm,
confident read with no language detection in it at all, so English text comes
back as English every time.

AND SLOWER. -12% against the -3% the first cut used. The note back was that he
is rushing, and he was: thirty three lines at -3% with a half second between
them is a briefing, not a walkthrough. The pauses come from GAP in config.py —
0.85s after every line — rather than from punctuation tricks in the text.
"""
import asyncio, importlib.util, os, pathlib, ssl
import edge_tts, edge_tts.communicate as C

VOICE, RATE = "en-US-AndrewNeural", "-12%"
CA = "/root/.ccr/ca-bundle.crt"
if os.path.exists(CA):
    C._SSL_CTX = ssl.create_default_context(cafile=CA)

here = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location('cfg', here / 'config.py')
cfg = importlib.util.module_from_spec(spec); spec.loader.exec_module(cfg)

async def main():
    proxy = os.environ.get("HTTPS_PROXY")
    for i, text in enumerate(cfg.LINES, 1):
        out = here / ("line%02d.mp3" % i)
        for attempt in range(4):
            try:
                await edge_tts.Communicate(text, VOICE, rate=RATE, proxy=proxy).save(str(out))
                break
            except Exception as e:
                if attempt == 3: raise
                await asyncio.sleep(2 * 2 ** attempt)
        print("  %-12s %s" % (out.name, text[:64]))

asyncio.run(main())
