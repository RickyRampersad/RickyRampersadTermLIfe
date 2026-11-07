/* The advisor, cut on the beat. No voice: the words are on screen and the
   music carries it. `b` is the hit's length in BEATS (0.608s each), so every
   cut lands on one. {word} takes the accent colour.

   THIRTY-ONE BEATS, because the track is 19.35s and 0.289 + 31 x 0.608 is
   19.14. Looping the music to fit a longer film puts a seam in the middle of
   the beat grid, and the cut is the whole point of this version. */
window.BEAT_CFG = {
  key: 'bwagent',
  url: 'rickyrampersadbranch.com<br>/joinourbranch',
  tail: 0.2,
  hits: [
    { b: 2, bg: 'navy',  t: ['MOST PEOPLE START', 'THE SAME WAY'] },
    { b: 2, bg: 'blue',  t: ['A LIST OF FRIENDS', 'AND {GOOD} {LUCK}'], rule: true },
    { b: 2, bg: 'navy',  t: ['NOT HERE.'], mark: true, align: 'mid' },

    { b: 1, bg: 'cyan',  t: ['LEADS'] },
    { b: 2, bg: 'navy',  shot: 'home-ph.jpg', t: ['THAT ASKED', 'TO BE CALLED'] },

    { b: 2, bg: 'navy',  shot: 'mylog-ph.jpg', t: ['CLIENTS', 'MATCHED TO YOU'] },
    { b: 1, bg: 'blue',  t: ['HOUSEHOLD', 'BY HOUSEHOLD'] },
    { b: 2, bg: 'navy',  t: ['THE WHOLE FILE', '{ALREADY} {READ}'] },

    { b: 2, bg: 'navy',  shot: 'production-week.jpg', pos: [-6, -6, 112],
      t: ['YOUR NUMBERS', 'ON THE WALL'] },
    { b: 1, bg: 'cyan',  t: ['EVERY DAY'] },

    { b: 2, bg: 'navy',  t: ['A {COACH}', 'NOT A CLOCK'] },
    { b: 2, bg: 'blue',  t: ['TRAINED BEFORE', 'YOU ARE CONTRACTED'] },

    { b: 2, bg: 'navy',  t: ['CONTRACTED', 'SOMEWHERE TODAY?'] },
    { b: 2, bg: 'cyan',  t: ['NOBODY THERE', 'WILL KNOW'], rule: true },

    { b: 6, bg: 'navy',  t: ['TWO MINUTES'], cap: 112, align: 'mid',
      qr: 'See the whole thing before you apply.' }
  ]
};
