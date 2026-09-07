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
NCHORDS  = 33       # was 23. The fifth wall added eight lines and the read
                    # now ends at 275s, so the bed is four turns of the phrase
                    # (287.1s) and a final D — more chords, never a longer one.
                    # The close card gets the last twelve seconds to ring out.
SHOT_MAX = 2600     # zoom scenes magnify, so the stills are stored bigger

LINES = [
    # the problem
    "Every Friday, somebody in this branch built the same three reports by hand.",
    "Premium dues. Contracts. Licences.",
    "By Monday morning, they were already out of date.",
    # the announcement
    "That stops now.",
    "This is the Branch Intelligence Wall.",
    "Five screens. Live on the branch floor, twenty four hours a day.",
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
    # wall five — birthdays today. NO CHANGING NUMBERS: not the count of emails,
    # not the count of years, not a dollar figure. Every one of those moves on
    # the next rebuild and the audio does not. The one figure spoken is the
    # statutory penalty, which is the Act's and does not move.
    "The fifth wall is birthdays. Whose birthday it is, today.",
    "Every morning, for years, this branch has emailed every client whose birthday it is. In your name. Nobody had to be reminded, and nobody had to write it.",
    "What the email has never done is ask a question. That part is yours.",
    "Look closer. Everyone with a birthday today, in the band their age puts them in. What that band is short of. And the conversation it is owed.",
    "Every agent with a client on this list is named on it. Find yourself, from across the room.",
    "Look closer. This panel is growth on the plans the branch already holds. And the age of a plan does not decide the size of the increase. Every client is worth the same call.",
    "The Act is sharp here. No sales representative shall cause a policyholder to replace a policy without first discussing the disadvantages of giving up the old one. The penalty is one million, five hundred thousand dollars. And two years.",
    "And no client is on this wall. No name. No policy number. No date of birth. You already have your own clients, in your portal.",
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
    # wall five — birthdays: whole, the hero, the bands, the roll, the growth
    # panel, the Act, and the promise about clients
    ('s20', [30, 31]),    ('s21', [32]),       ('s22', [33]),  ('s23', [34]),
    ('s24', [35]),        ('s25', [36]),       ('s26', [37]),
    # the close
    ('s27', [38, 39]),    ('s28', [40]),       ('s29', [41]),
]

SHOT_FILES = {'w45': 'f2-w45.png', 'w60': 'f2-w60.png', 'poss': 'f2-poss.png',
              'dlv': 'f2-dlv.png', 'lic':  'f2-lic.png',
              'filt': 'f2-possfilt.png', 'book': 'f2-book.png'}
MARK = 'mark.png'
