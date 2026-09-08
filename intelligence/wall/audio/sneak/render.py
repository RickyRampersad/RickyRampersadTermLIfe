#!/usr/bin/env python3
"""Narration for the sneak peek — the short one that announces Monday.

SAME VOICE AS THE EXPLAINER, one notch quicker. Andrew at -8% against the
explainer's -12%: a trailer is allowed to move, but the -3% this used to run at
was rushing, and the multilingual variant it used to use would occasionally read
a phrase in another language. Neither of those is energy. The energy comes from
how SHORT the lines are and how fast the cuts land.
"""
import asyncio, os, ssl
import edge_tts, edge_tts.communicate as C

VOICE, RATE = "en-US-AndrewNeural", "-8%"
CA = "/root/.ccr/ca-bundle.crt"
if os.path.exists(CA):
    C._SSL_CTX = ssl.create_default_context(cafile=CA)

LINES = [
    "Monday.",
    "The Branch Intelligence Wall goes live.",
    "You have seen what the fact find wall did for production.",
    "This is the other half of the business.",
    "Premium dues. Forty five days. Sixty. Ninety.",
    "Every contract sitting in our cabinet.",
    "Every contract an agent has not delivered.",
    "Every licence. Life and general. Month by month.",
    "Every client whose birthday it is. This morning. In your name.",
    "It names the agent.",
    "It names the unit, and it names the manager.",
    "Nobody on this wall is only being watched.",
    "Twenty four hours a day, on the branch floor.",
    "Monday.",
]

async def main():
    proxy = os.environ.get("HTTPS_PROXY")
    for i, text in enumerate(LINES, 1):
        out = "line%02d.mp3" % i
        await edge_tts.Communicate(text, VOICE, rate=RATE, proxy=proxy).save(out)
        print("  %-12s %s" % (out, text))

asyncio.run(main())
