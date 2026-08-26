#!/usr/bin/env python3
"""The wall's voice, third build: WHOLE SENTENCES, no mid-sentence splices.

Numbers recorded on their own ("28,") carry list intonation — the pitch of a
word depends on the sentence around it, so a spliced number always lands
robotic no matter how the seams are faded. The Multilingual voices expose no
word timings to cut numbers out of real sentences, so the fix is brute force:
every sentence is recorded complete, once per value it can carry, and playback
only ever joins full sentences at full stops — where a human voice resets
pitch anyway.

Counts stay exact while they are small; larger figures move to buckets and the
sentence says "about". The screen carries the exact number either way.

Writes c_*.mp3 plus manifest.json (key -> spoken text). embed-wall-voice.py
folds both into wall.html, so the on-screen subtitle is always the same words
Andrew says.
"""
import asyncio, json, pathlib, subprocess, sys
import edge_tts

HERE = pathlib.Path(__file__).parent
VOICE = "en-US-AndrewMultilingualNeural"
RATE = "-3%"
FF = "/usr/bin/ffmpeg"
TRIM = ("silenceremove=start_periods=1:start_silence=0:start_threshold=-46dB,"
        "areverse,silenceremove=start_periods=1:start_silence=0:start_threshold=-46dB,areverse")

M = {}  # key -> text

def add(key, text): M[key] = text

# ── the branch roster, first names only ──
NAMES = ("Ricky Aidan Alyssa Akaash Anthony Chris Crystal Daniel Darryl Dhalina "
         "Diane Faizal Fawwaz Felicia Ganesh Gary Jesus Jonathan Janice Jamil "
         "John Joy Kamla Kerwyn Malcolm Meera Naila Narissa Neil Premchand "
         "Randolph Roberta Stephanie Tricia Varun Aleema Javid Sasha Azariah "
         "Elizabeth Ricardo").split()

def counts(*ranges):
    out = []
    for a, b, step in ranges: out += list(range(a, b + 1, step))
    return sorted(set(out))

OPENS   = counts((0, 40, 1), (45, 100, 5))
LATES   = counts((1, 25, 1), (30, 60, 5))
PCT5    = counts((0, 100, 5))
MONTHS  = counts((0, 30, 1), (35, 100, 5))
SMALL   = counts((0, 15, 1))
CHASES  = counts((0, 30, 1), (35, 100, 5), (110, 200, 10), (220, 400, 20))
HOURS   = counts((1, 24, 1))
DAYS    = counts((1, 20, 1))
DESKN   = counts((1, 12, 1))
TWENTY  = counts((0, 20, 1))

# ── board 0 · the pulse ──
for n in OPENS:
    add(f"open_{n}", f"Right now, {n} request{'s are' if n != 1 else ' is'} open.")
add("late_0", "Nothing is past its deadline. The board is clean.")
for n in LATES:
    add(f"late_{n}", f"{n} of them {'are' if n != 1 else 'is'} past their deadline. "
                     "Every one of them is being chased automatically.")
for p in PCT5:
    if p < 90:
        add(f"promise_{p}", f"We are keeping our promise about {p} percent of the time. "
                            f"That is {90 - p} points short of the ninety we promise.")
    elif p == 90:
        add("promise_90", "We are keeping our promise ninety percent of the time — right on target.")
    else:
        add(f"promise_{p}", f"We are keeping our promise about {p} percent of the time. "
                            f"That is {p - 90} points clear of the ninety we promise.")

# ── board 1 · demand ──
for n in MONTHS:
    add(f"month_{n}", f"{n} request{'s' if n != 1 else ''} came in over the last thirty days.")
add("today_0", "None of them arrived today.")
for n in SMALL[1:]:
    add(f"today_{n}", f"{n} of them arrived today.")
add("trend_up", "Demand is up on the week before.")
add("trend_down", "Demand is down on the week before.")
add("trend_flat", "Demand is holding steady.")

# ── board 2 · open work ──
for p in counts((10, 100, 10)):
    add(f"lateshare_{p}", f"That is about {p} percent of the open work already late.")

# ── board 3 · departments ──
for p in PCT5:
    add(f"fastdept_{p}", f"The fastest department is answering about {p} percent of its requests on time.")
    add(f"slowdept_{p}", f"The slowest is at about {p} percent. Both are named on the screen.")

# ── boards 4 and 11 · people, first names only ──
for nm in NAMES:
    add(f"lead_{nm.lower()}", f"{nm} leads the branch.")
    add(f"desk_{nm.lower()}", f"{nm} is carrying the most.")
    add(f"closer_{nm.lower()}", f"{nm} leads on that.")
for p in PCT5:
    add(f"agentpct_{p}", f"They are resolving about {p} percent of their requests on time.")
    add(f"branchpct_{p}", f"The branch as a whole is at about {p} percent.")

# ── board 5 · the mix ──
for n in MONTHS:
    add(f"toptype_{n}", f"Our most requested service came up {n} time{'s' if n != 1 else ''}. "
                        "It is named on the screen.")

# ── board 6 · satisfaction ──
for i in range(10, 51):
    c = i / 10
    spoken = f"{int(c)}" if c == int(c) else f"{c}"
    add(f"csat_{i}", f"Clients rate us {spoken} out of five.")
add("csat_below", "That is below the four and a half we aim for.")
add("csat_at", "That is at or above the four and a half we aim for.")
add("low_0", "Not one rating was below three stars.")
for n in SMALL[1:]:
    add(f"low_{n}", f"{n} of those ratings {'were' if n != 1 else 'was'} three stars or below. "
                    "Each one is a call worth making.")

# ── board 7 · the grade ──
for key, word in [("Ap", "an A plus"), ("A", "an A"), ("B", "a B"), ("C", "a C"), ("D", "a D")]:
    add(f"grade_{key}", f"Against the promises we make, this branch is scoring {word}.")
add("grade_NA", "Against the promises we make, this branch is not yet scored.")

# ── board 8 · intake ──
add("intoday_0", "No new requests came in today.")
for n in SMALL[1:]:
    add(f"intoday_{n}", f"{n} request{'s' if n != 1 else ''} came in today.")
add("restoday_0", "None have been resolved yet today.")
for n in SMALL[1:]:
    add(f"restoday_{n}", f"{n} {'were' if n != 1 else 'was'} resolved today.")
add("pace_keep", "We are clearing them as fast as they arrive.")
add("pace_behind", "More came in than went out, so the backlog grew.")

# ── board 9 · the autopilot ──
for n in CHASES:
    add(f"chased_{n}", f"The system has sent {n} reminder{'s' if n != 1 else ''} to departments, "
                       "and not one person had to write them.")
for h in HOURS:
    add(f"hours_{h}", f"That is about {h} hour{'s' if h != 1 else ''} of chasing handed back to the branch.")
for d in DAYS:
    add(f"avgd_{d}", f"On average a request takes about {d} day{'s' if d != 1 else ''} to close.")

# ── board 10 · people and the system ──
for p in PCT5:
    add(f"sysshare_{p}", f"About {p} percent of everything that moved a case was done by the system.")
    add(f"alone_{p}", f"About {p} percent of what we closed needed no human chasing at all.")
add("point", "That gap is the whole point of Query Pal.")

# ── board 11 · the desks ──
for n in DESKN:
    add(f"desks_{n}", f"{n} desk{'s are' if n != 1 else ' is'} sharing the branch's cases.")
add("deskopen_0", "Nothing on their desk is still open.")
for n in TWENTY[1:]:
    add(f"deskopen_{n}", f"{n} of their cases {'are' if n != 1 else 'is'} still open.")
for n in TWENTY[1:]:
    add(f"self_{n}", f"{n} case{'s were' if n != 1 else ' was'} closed by the person handling "
                     "them, without waiting to be chased. That is worth recognising.")

add("welcome", "Query Pal. Live from the Ricky Rampersad Branch. "
               "Log it once, and forget it. The system does the rest.")

# ── generate ──
sem = asyncio.Semaphore(3)

async def synth(key, text):
    out = HERE / f"c_{key}.mp3"
    if out.exists() and out.stat().st_size > 800:
        return True
    raw = HERE / f"raw_{key}.mp3"
    async with sem:
        for attempt in range(3):
            try:
                await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(raw))
                break
            except Exception:
                await asyncio.sleep(2 * (attempt + 1))
        else:
            return False
    r = subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(raw), "-af", TRIM,
                        "-codec:a", "libmp3lame", "-b:a", "32k", "-ar", "24000", "-ac", "1", str(out)])
    raw.unlink(missing_ok=True)
    return r.returncode == 0 and out.stat().st_size > 800

async def main():
    for f in HERE.glob("c_*.mp3"):
        pass  # kept: resume-friendly — existing good clips are skipped
    (HERE / "manifest.json").write_text(json.dumps(M, indent=0, ensure_ascii=False))
    keys = list(M)
    print(f"{len(keys)} sentences to voice")
    done = 0
    failed = []
    for i in range(0, len(keys), 30):
        batch = keys[i:i + 30]
        results = await asyncio.gather(*[synth(k, M[k]) for k in batch])
        done += sum(results)
        failed += [k for k, r in zip(batch, results) if not r]
        print(f"  {done}/{len(keys)}", flush=True)
    if failed:
        print("FAILED:", " ".join(failed))
        sys.exit(1)
    print("all sentences voiced")

asyncio.run(main())
