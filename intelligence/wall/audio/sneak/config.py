"""The 40-second sneak peek: Monday, and what lands on the wall.

The energy is in the numbers below, not in a different voice. GAP is 0.36
against the explainer's 0.55 — the lines land almost on top of each other, and
thirteen of them go past in the time the explainer takes to say five.
"""
OUT      = 'sneak.html'
LEAD     = 0.80
GAP      = 0.55     # was 0.36. A trailer can be quick; it cannot be rushed,
                    # and 0.36 was rushed — the note back said so.
CHORD    = 8.70     # same chord length as every other branch film
NCHORDS  = 6        # was 5. The fifth wall's line did not fit 43.5s; six
                    # chords is 52.2s and it still lands home on D.

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

SCENE_LINES = [
    ('s1', [1]),      ('s2', [2]),       ('s3', [3, 4]),   ('s4', [5]),
    ('s5', [6]),      ('s6', [7]),       ('s7', [8]),      ('s8', [9]),
    ('s9', [10, 11]), ('s10', [12]),     ('s11', [13]),    ('s12', [14]),
]

SHOT_FILES = {'w45': 'f2-w45.png', 'poss': 'f2-poss.png',
              'dlv': 'f2-dlv.png', 'lic': 'f2-lic.png', 'filt': 'f2-possfilt.png',
              'book': 'f2-book.png'}
MARK = 'mark.png'
