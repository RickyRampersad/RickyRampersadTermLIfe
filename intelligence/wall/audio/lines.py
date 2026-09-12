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
    'day': [                                     # The Day So Far
        "This is the branch's own day.",
        "Every other screen on this wall is about the client book. This one is about us.",
        "The big number is what the branch has closed today.",
        "Beside each desk, what is still open, what is late, and what has gone quiet.",
        "Quiet means nobody has touched it in a week. A task with a date next month and no movement is not in hand.",
        "The bars on the right are the day's blocks, and whether each has been filed.",
        "No client is named here. Counts only.",
    ],
    'blocks': [                                  # The Day In Blocks
        "This is how the day was spent.",
        "Four blocks, and what each one is for.",
        "The number is how many desks have filed that block.",
        "A block is filed when somebody writes what they actually did in it.",
        "Green means filed. Gold means still owed.",
        "A day with every block filed is a day the branch can account for.",
        "That is the whole ask.",
    ],
    'permanent': [                               # The Permanent Book
        "This is the other half of the branch, and it is the larger half.",
        "Nothing on this screen ends on a date. That is the whole reason it is not on the last one.",
        "Econo Life is whole life. The premium is paid to sixty-five, or to eighty-five, and the cover runs for life.",
        "So there is nothing to convert. It is what a term converts into.",
        "Liberator is the one to watch. Its premium runs to sixty-five, seventy-five, eighty-five or a hundred.",
        "And a Liberator written in two thousand and nine or earlier can simply be extended.",
        "No application. No underwriting. No new policy. That is the gold figure, and it is the call to make.",
        "Rejuvenator is the critical illness cover, and the riders ride whatever they are attached to.",
        "The critical illness rider alone carries more cover than the entire term book.",
        "Every policy here is tested the same way. In force, and paid to date, or it is not on the list.",
        "No client is named here. Cover and counts only.",
    ],
    'conversion': [                              # Conversions This Month
        "Only one kind of policy on this book is allowed to become something else.",
        "Flexi Term, with a C in the code. Nothing else on the branch's book has ever converted.",
        "Convertible means permanent cover with no medical, no questions, and no chance of being declined.",
        "It is worth the most to the client least likely to pass a medical.",
        "But it has to be in force, and it has to be paid up.",
        "A lapsed policy cannot be converted at all. One in arrears cannot be converted until somebody collects.",
        "So the gold column is the call that comes first. Collect, then convert.",
        "Conversion is priced at the age the client has reached.",
        "So the cheapest day to do it is the day before a birthday, and the dearest is the day after.",
        "That is why this list is the month's birthdays, and why the gold figure is the half still to come.",
        "Beside each agent is the age the policy was written at, how long it has been in force, and the year the contract runs out.",
        "The bar under the figure is the runway. How long is left before the cover stops.",
        "Because a conversion has to happen before that date, not after it.",
        "The last panel is term written non-convertible. Nothing to exchange, so it is a fresh application, before the date.",
        "Econo Life and Liberator are not on this screen. Nothing about them ends on a date, and they have a screen of their own.",
        "No client is named here. Cover and counts only.",
    ],
    'pending': [                                 # What Is Pending
        "This is what is submitted and not yet issued.",
        "It is the only screen on this wall that somebody can still change this afternoon.",
        "The bars are how long each case has waited, counted from the day the application came in.",
        "Not from the days column. That one is typed, and it drifts.",
        "Underneath, what is actually holding them, in the underwriter's own words.",
        "A medical. A proof of address. A physician's statement that was ordered and never came back.",
        "Two kinds of money sit here, and they are opposites.",
        "One the client has already paid, and we cannot apply it until the case closes. That is a file to finish.",
        "The other has never been paid at all. That is a call to make.",
        "And the hardest number on the screen is the cases nobody has ever raised a task on.",
        "A case with a closed chase and an open file is worse. It reads as handled.",
        "No client is named here. Counts only.",
    ],
    'ready': [                       # Ready To Settle
        "These are the easiest cases on the wall.",
        "Nothing is outstanding on any of them. Underwriting is finished.",
        "What is missing is the premium. Not one dollar has come in.",
        "A case with no requirement left looks finished on every other screen. That is why these sit.",
        "The bars show how long each has been collectable.",
        "A case that has been ready for three months was ready three months ago.",
        "The names beside them are the people who can collect. None of this needs head office.",
    ],
    'triage': [                      # Whose Move Is It
        "Every pending case sits in exactly one place on this screen.",
        "Two of them are ours to work today.",
        "Ready to settle is money to collect. The agent's move is a document only they can get.",
        "Everything below that is waiting on somebody who is already on it.",
        "A requirement that has been ordered is in motion. Nobody should be rung about it.",
        "That is the whole point of this screen.",
        "Chase everything, and the chase stops meaning anything.",
    ],
    'culprits': [                    # Who Is Holding It Up
        "This is who can move a case today.",
        "The ranking is what is actually theirs. It is not how many cases they hold.",
        "An agent whose cases are all at the lab is not the one to call.",
        "Beside each name is how many of theirs are already in motion. Read the ranking with that in mind.",
        "The last column is the one to watch.",
        "It counts the cases that were chased once, closed, and are still pending.",
        "That is the worst state there is, because it reads as handled.",
    ],
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
