"""The 95-second explainer: the problem, the announcement, all four walls."""
OUT      = 'film.html'
LEAD     = 1.10     # silence before the first word
GAP      = 0.55     # silence after each line — measured, this film breathes
CHORD    = 8.70     # house spec, see CLAUDE.md — do not drift
NCHORDS  = 11       # 11 x 8.7 = 95.7s, and 11 lands the progression home on D

LINES = [
    "Every Friday, somebody in this branch built the same reports by hand.",
    "Premium dues. Contracts. Licences.",
    "By Monday morning they were already out of date.",
    "Next week, that stops.",
    "We are launching the Branch Intelligence Wall.",
    "It begins where the money does. Premiums that stopped coming in.",
    "Forty five days. Past the grace period. Early enough that a phone call still works.",
    "At sixty, we write again, and the letter remembers what they told us the first time.",
    "At ninety, we stop asking them to rate us, and start offering ways to keep the cover.",
    "Then the contracts we are holding.",
    "Some are still in our cabinet, and no agent has collected them. That one is ours.",
    "Some an agent collected, and the client has still not signed for.",
    "Every one of them carries a name, and a number of days.",
    "The Act gives the company twenty business days to issue a policy.",
    "After that, the Act is silent. So the clock is ours. We set it, and we show it.",
    "And the licences. Life and general. Every renewal month on one screen.",
    "A licence that lapses is business nobody can write.",
    "Click any bar, and the whole wall holds to it.",
    "This is not a Friday report any more. It is live, and it does not wait.",
]

SCENE_LINES = [
    ('s1',  [1, 2, 3]),   ('s2',  [4, 5]),      ('s3',  [6, 7]),
    ('s4',  [8]),         ('s5',  [9]),         ('s6',  [10, 11]),
    ('s7',  [12, 13]),    ('s8',  [14, 15]),    ('s9',  [16, 17]),
    ('s10', [18]),        ('s11', [19]),
]

SHOT_FILES = {'w45': 'f-w45.png', 'w60': 'f-w60.png', 'w90': 'f-w90.png',
              'poss': 'f-poss.png', 'dlv': 'f-dlv.png', 'lic': 'f-lic.png',
              'filt': 'f-possfilt.png'}
MARK = 'mark.png'
