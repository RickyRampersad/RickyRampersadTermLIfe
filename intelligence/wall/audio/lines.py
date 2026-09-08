"""What the wall says — every screen's narration, in one place.

The voice is the branch's: en-US-AndrewNeural at -12%, the same read as the
films (see CLAUDE.md, "The voice"). NOT the Multilingual variant — it detects
language from the text and read a phrase in another one on the first cut.

WHY NO NUMBERS ARE SPOKEN. Every figure on these screens changes on the next
nightly rebuild and the audio does not. A voice that said "forty one policies"
would be confidently wrong within a day, over a screen showing the right
figure. So the screen carries the arithmetic and the voice carries the
meaning, and nothing below stops being true when the data moves.

Short declarative sentences. State the fact and trust it. If a line needs to
breathe more, split it in two rather than reaching for a comma."""

VOICE = 'en-US-AndrewNeural'
RATE = '-12%'

# Keyed by page: audio/narration/<key>/lineNN.mp3 folds into ../<key>.html.
WALLS = {
    'index': [                                   # The 45-Day Line
        "This is the forty five day line.",
        "Past the grace period. Still early enough that a phone call works.",
        "The number on the left is today's.",
        "Most of them were on a standing instruction that failed.",
        "A bank order. A salary deduction. Something that should have collected itself.",
        "That is a bank to ring. Not a client who refused.",
        "And most have been in force for years, not months.",
        "These are not bad sales. They are long standing clients who stopped.",
        "The gold bar is a whole billing cohort crossing on one day.",
        "Work it before it lands.",
    ],
    'possession': [                              # Whose Hands Is It In
        "This is whose hands it is in.",
        "A contract comes from head office to our cabinet. Then to the agent. Then to the client, who signs for it.",
        "The big number is the ones with an agent, still unsigned.",
        "The days count from the moment it left our cabinet.",
        "Past ninety days is not a delay. It is a policy the client has never held.",
        "Below that, the ones still in the cabinet. Nobody has collected them. That part is ours.",
        "Two halves of one job, measured separately. So the delay has a name.",
    ],
    'delivery': [                                # Contract Delivery
        "This is contract delivery.",
        "Every contract head office has dispatched to us, and how long it has sat here.",
        "The number on the left is the ones in the cabinet now.",
        "Beside it, how many are past our own standard. Not head office's. Ours.",
        "By unit, whose clients are waiting, and the oldest in each.",
        "By plan, what kind of contract is sitting here.",
        "A contract in a cabinet is a client who has paid and holds nothing.",
        "Deliver it. That is the whole instruction.",
    ],
    'licence': [                                 # Licensing Year
        "This is the licensing year.",
        "Every licence the branch holds, by the month it renews.",
        "Life and general are two licences, on two anniversaries. An agent can be current on one and lapsed on the other.",
        "The number on the left renews this month. Beside it, the next forty five days.",
        "A first renewal is a form nobody has filled in before. Those are the ones to walk through.",
        "The Act is plain. Nobody sells while they are not registered.",
        "A date on this wall that goes by is business the branch cannot lawfully write.",
        "Start the month before. Not the week of.",
    ],
    'book': [                                    # Birthdays Today
        "These are today's birthdays.",
        "The email has already gone. First thing this morning, in your name.",
        "It has gone every year for years. What it has never done is ask a question.",
        "The bands are where each client is in life. And what that stage is usually short of.",
        "A birthday is the one day a client expects to hear from you. Use it to ask.",
        "The gold marks a gap in cover. That is the conversation the call is for.",
        "Below, the month so far. And what came back.",
        "No names on this wall. You have them in your portal. Call.",
    ],
}


def mp3_seconds(path):
    """Duration by counting MPEG frames — no ffprobe, no dependency.

    The bed under the narration is told how long to last so it lands on its
    home chord instead of being cut off, and it can only know that if these
    durations travel with the audio."""
    d = path.read_bytes(); i = 0; n = len(d); t = 0.0
    BR = {1: [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0],
          0: [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0]}
    SR = {3: [44100,48000,32000], 2: [22050,24000,16000], 0: [11025,12000,8000]}
    if d[:3] == b'ID3':
        i = 10 + ((d[6]&0x7f)<<21 | (d[7]&0x7f)<<14 | (d[8]&0x7f)<<7 | (d[9]&0x7f))
    while i + 4 <= n:
        if d[i] != 0xFF or (d[i+1] & 0xE0) != 0xE0: i += 1; continue
        ver = (d[i+1]>>3)&3; layer = (d[i+1]>>1)&3
        if layer != 1: i += 1; continue                       # Layer III only
        bi = (d[i+2]>>4)&0xF; si = (d[i+2]>>2)&3; pad = (d[i+2]>>1)&1
        if bi in (0,15) or si == 3: i += 1; continue
        mpeg1 = ver == 3
        br = BR[1 if mpeg1 else 0][bi]*1000; sr = SR.get(ver, SR[2])[si]
        if not br or not sr: i += 1; continue
        spf = 1152 if mpeg1 else 576
        flen = int(spf/8*br/sr) + pad
        if flen <= 0: i += 1; continue
        t += spf/sr; i += flen
    return round(t, 2)
