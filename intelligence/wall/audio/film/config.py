"""The explainer: what each wall is for, what the Act says, and why it matters.

REWRITTEN AFTER THE FIRST SHOWING. The notes back were specific and all of them
were fair: the read was rushed, the four walls flicked past as slides with
nothing explaining the difference between them, the Act was named but never
quoted, and there was no reason given for why any of it matters. So this is
longer, slower, and it stops on each wall — a full view to place it, then a zoom
into the panel being talked about, so somebody standing in front of the real
wall knows what they are looking at.

THE TWO CONTRACT WALLS ARE NOT THE SAME WALL and that was the single most
confusing thing about the first cut. One is a contract still in our cabinet that
no agent has collected — that delay is ours. The other is a contract an agent
collected and the client has still not signed for — that delay is the agent's.
The film now says so in those words, twice, on two separate walls.
"""
OUT      = 'film.html'
LEAD     = 1.20     # silence before the first word
GAP      = 0.85     # was 0.55. The read was rushed; this is most of the fix.
CHORD    = 8.70     # house spec, see CLAUDE.md — do not drift
NCHORDS  = 23       # 23 x 8.7 = 200.1s; the last two are both D, so the
                    # close rings out under the card instead of stopping
SHOT_MAX = 2600     # zoom scenes magnify, so the stills are stored bigger

LINES = [
    # the problem
    "Every Friday, somebody in this branch built the same three reports by hand.",
    "Premium dues. Contracts. Licences.",
    "By Monday morning, they were already out of date.",
    # the announcement
    "That stops now.",
    "This is the Branch Intelligence Wall.",
    "Four screens. Live on the branch floor, twenty four hours a day.",
    # why it matters
    "Start with why this matters.",
    "The Insurance Act binds every registrant to the market conduct standards in Schedule Eleven.",
    "And a registrant is not only the company. The Act names the sales representative as an intermediary. So the standard is yours, personally.",
    # wall one — premium dues
    "The first wall is premium dues. We call it the forty five day line.",
    "A premium that stopped coming in. Forty five days. Sixty. Ninety.",
    "At forty five, the grace period has passed, and a phone call still works.",
    "Look closer. This panel is how long the client has held the policy. A thirty year client is not a forty five day letter.",
    "At sixty, we write again, and the letter remembers what they told us the first time.",
    "The Act gives that client a late payment notice, and twenty business days to use it. After three years of premiums, the value is already theirs.",
    # wall two — whose hands is it in
    "The second wall is the contracts we are holding.",
    "There are two problems here, and they are not the same problem.",
    "A contract still in our cabinet. No agent has collected it. That delay is ours.",
    "A contract an agent collected, and the client has still not signed for it. That delay is the agent's.",
    "Look closer. Every row is a name, and a number of days.",
    # wall three — delivery
    "The third wall is delivery.",
    "The Act gives the company twenty business days to issue the policy.",
    "After it is issued, the Act is silent. So the clock is ours. We set it at ten days, and we show it.",
    # wall four — licences
    "The fourth wall is the licensing year.",
    "Two licences, not one. Life, and general.",
    "Every renewal month, for the year ahead, on one screen.",
    "Look closer. Life on one line. General on the other. Some agents hold both.",
    "The Act is plain. No person shall perform the functions of a sales representative during any period in which he is not registered.",
    "And a licence is not renewed without continuing professional development.",
    # the close
    "Every wall names the agent. It names the unit. And it names the manager.",
    "Nobody on this wall is only being watched.",
    "Click any bar, and the whole wall holds to it.",
    "This is not a Friday report any more. It is live, and it does not wait.",
]

SCENE_LINES = [
    ('s1',  [1, 2, 3]),   ('s2',  [4, 5, 6]),  ('s3',  [7, 8, 9]),
    # wall one — premium dues: whole, then two zooms, then the Act
    ('s4',  [10, 11]),    ('s5',  [12]),       ('s6',  [13]),
    ('s7',  [14]),        ('s8',  [15]),
    # wall two — the contracts we hold: whole, then the two halves apart
    ('s9',  [16, 17]),    ('s10', [18]),       ('s11', [19]),  ('s12', [20]),
    # wall three — delivery: whole, the Act, our own clock
    ('s13', [21]),        ('s14', [22]),       ('s15', [23]),
    # wall four — licences: whole, the months, life against general, the Act
    ('s16', [24, 25]),    ('s17', [26]),       ('s18', [27]),  ('s19', [28, 29]),
    # the close
    ('s20', [30, 31]),    ('s21', [32]),       ('s22', [33]),
]

SHOT_FILES = {'w45': 'f2-w45.png', 'w60': 'f2-w60.png', 'poss': 'f2-poss.png',
              'dlv': 'f2-dlv.png', 'lic':  'f2-lic.png',
              'filt': 'f2-possfilt.png'}
MARK = 'mark.png'
