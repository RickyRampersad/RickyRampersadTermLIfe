"""The 40-second sneak peek: Monday, and what lands on the wall.

The energy is in the numbers below, not in a different voice. GAP is 0.36
against the explainer's 0.55 — the lines land almost on top of each other, and
thirteen of them go past in the time the explainer takes to say five.
"""
OUT      = 'sneak.html'
LEAD     = 0.80
GAP      = 0.36     # tight. This is what makes it read as a trailer.
CHORD    = 8.70     # same chord length as every other branch film
NCHORDS  = 5        # 5 x 8.7 = 43.5s, and five lands home: D F#m Bm G D

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

SCENE_LINES = [
    ('s1', [1]),      ('s2', [2]),       ('s3', [3, 4]),   ('s4', [5]),
    ('s5', [6]),      ('s6', [7]),       ('s7', [8]),      ('s8', [9, 10]),
    ('s9', [11]),     ('s10', [12]),     ('s11', [13]),
]

SHOT_FILES = {'w45': 'f-w45.png', 'poss': 'f-poss.png',
              'dlv': 'f-dlv.png', 'lic': 'f-lic.png', 'filt': 'f-possfilt.png'}
MARK = 'mark.png'
