#!/usr/bin/env python3
"""Narration for the sneak peek — the short one that announces Monday.

SAME VOICE, SAME RATE. Andrew at -3%, exactly as the explainer and the other
branch films. The energy of a sneak peek comes from how SHORT the lines are and
how fast the cuts land, not from a different voice or a faster read — a branch
that suddenly sounds like somebody else for one film sounds like two branches.
"""
import asyncio, os, ssl
import edge_tts, edge_tts.communicate as C

VOICE, RATE = "en-US-AndrewMultilingualNeural", "-3%"
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
