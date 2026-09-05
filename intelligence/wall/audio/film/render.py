#!/usr/bin/env python3
"""Render the launch film's narration, and print the durations the film needs.

WHY NO CHANGING NUMBERS ARE SPOKEN
The screen carries the arithmetic; the voice carries the meaning. Every figure
on these walls moves on the next rebuild and the audio does not, so a spoken
count would be confidently wrong within a day, over a screen showing the right
one. The only numbers below are the band definitions (45, 60, 90) and the
statutory twenty business days — none of which move.
"""
import asyncio, os, ssl, subprocess, sys
import edge_tts, edge_tts.communicate as C

VOICE, RATE = "en-US-AndrewMultilingualNeural", "-3%"
CA = "/root/.ccr/ca-bundle.crt"
if os.path.exists(CA):
    C._SSL_CTX = ssl.create_default_context(cafile=CA)

LINES = [
    # the Friday problem
    "Every Friday, somebody in this branch built the same reports by hand.",
    "Premium dues. Contracts. Licences.",
    "By Monday morning they were already out of date.",
    "Next week, that stops.",
    "We are launching the Branch Intelligence Wall.",
    # premium dues
    "It begins where the money does. Premiums that stopped coming in.",
    "Forty five days. Past the grace period. Early enough that a phone call still works.",
    "At sixty, we write again, and the letter remembers what they told us the first time.",
    "At ninety, we stop asking them to rate us, and start offering ways to keep the cover.",
    # contracts
    "Then the contracts we are holding.",
    "Some are still in our cabinet, and no agent has collected them. That one is ours.",
    "Some an agent collected, and the client has still not signed for.",
    "Every one of them carries a name, and a number of days.",
    "The Act gives the company twenty business days to issue a policy.",
    "After that, the Act is silent. So the clock is ours. We set it, and we show it.",
    # licensing
    "And the licences. Life and general. Every renewal month on one screen.",
    "A licence that lapses is business nobody can write.",
    # close
    "Click any bar, and the whole wall holds to it.",
    "This is not a Friday report any more. It is live, and it does not wait.",
]

async def main():
    proxy = os.environ.get("HTTPS_PROXY")
    for i, text in enumerate(LINES, 1):
        out = "line%02d.mp3" % i
        await edge_tts.Communicate(text, VOICE, rate=RATE, proxy=proxy).save(out)
        print("  %-12s %s" % (out, text))
    print("\nDurations:")
    total = 0.0
    for i in range(1, len(LINES) + 1):
        f = "line%02d.mp3" % i
        d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                            "-of", "default=noprint_wrappers=1:nokey=1", f],
                           capture_output=True, text=True).stdout.strip()
        try: total += float(d)
        except ValueError: d = "?"
        print("  %-12s %s" % (f, d))
    print("\n  spoken total %.2fs" % total)

asyncio.run(main())
