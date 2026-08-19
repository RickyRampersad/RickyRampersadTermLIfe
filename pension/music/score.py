"""The score, v5 — played on real instruments.

v2, v3 and v4 were all synthesised: sine waves and filtered noise written
sample by sample. That is why none of them sounded warm. You cannot add warmth
to a sine wave; warmth is what a recorded instrument has and a computed tone
does not.

v5 is a composition played by FluidR3_GM — 148 MB of actual recorded
instruments. A Rhodes electric piano, an upright bass, a vibraphone, a nylon
guitar and a real drum kit, all sampled from the instruments themselves.

Brief: nice, warm, relaxing, with a beat.
  - 88 BPM. Slow enough to be calm, with a backbeat so it still moves.
  - C major, on major-seventh and ninth voicings. Seventh chords are what make
    music sound warm rather than plain — it is the harmony of a hotel lobby at
    six o'clock, not of a corporate slideshow.
  - Rhodes comping off the beat, upright bass walking underneath, brushed kit
    kept soft, vibraphone answering in the gaps.
  - The arrangement thins and thickens with the film's six acts.

Deterministic: same timing.json in, same MIDI out, same audio out.
"""
import json, pretty_midi

T = json.load(open('timing.json'))
TOTAL = T['total'] + 0.6
ACTS = T['acts']

BPM = 88
BEAT = 60.0 / BPM              # 0.6818 s
BAR = BEAT * 4                 # 2.727 s

# ── harmony ────────────────────────────────────────────────────────────────
# Cmaj9 – Fmaj9 – Am7 – G7sus. Sevenths and ninths throughout: this is the
# warm end of the harmonic vocabulary, and nothing in it is left unresolved.
CHORDS = [
    dict(name='Cmaj9',  bass=36, keys=[48, 52, 55, 59, 62], vibes=[72, 76, 79]),
    dict(name='Fmaj9',  bass=41, keys=[53, 57, 60, 64, 67], vibes=[76, 81, 84]),
    dict(name='Am7',    bass=45, keys=[45, 52, 55, 60, 64], vibes=[72, 76, 81]),
    dict(name='G7sus',  bass=43, keys=[43, 53, 57, 62, 65], vibes=[74, 79, 83]),
]

def act_of(t):
    a = 0
    for i, s in enumerate(ACTS):
        if t >= s:
            a = i
    return a

# Which layers play in each act: rhodes, bass, kit, vibes, guitar, shaker
ARRANGE = [
    dict(rhodes=0.70, bass=0.00, kit=0.00, vibes=0.55, guitar=0.00, shaker=0.00),  # title
    dict(rhodes=0.85, bass=0.85, kit=0.62, vibes=0.60, guitar=0.55, shaker=0.45),  # your company
    dict(rhodes=0.90, bass=0.92, kit=0.75, vibes=0.65, guitar=0.65, shaker=0.60),  # the team
    dict(rhodes=0.95, bass=1.00, kit=0.85, vibes=0.70, guitar=0.72, shaker=0.70),  # enrolling
    dict(rhodes=0.78, bass=0.80, kit=0.52, vibes=0.50, guitar=0.40, shaker=0.35),  # the register
    dict(rhodes=0.95, bass=0.95, kit=0.78, vibes=0.85, guitar=0.65, shaker=0.62),  # start one
]

# A fixed velocity wobble — deterministic, so the render is reproducible, but
# enough that no two bars are played identically.
WOBBLE = [0, -4, 2, -2, 5, -6, 1, 3, -3, 4, -1, 6, -5, 0, 2, -4]
def vel(base, i, lvl):
    v = int(round((base + WOBBLE[i % len(WOBBLE)]) * lvl))
    return max(1, min(127, v))

pm = pretty_midi.PrettyMIDI(initial_tempo=BPM)
rhodes = pretty_midi.Instrument(program=4,  name='Rhodes')       # Electric Piano 1
bass   = pretty_midi.Instrument(program=32, name='Upright')      # Acoustic Bass
vibes  = pretty_midi.Instrument(program=11, name='Vibraphone')
guitar = pretty_midi.Instrument(program=24, name='Nylon')        # Acoustic Guitar (nylon)
drums  = pretty_midi.Instrument(program=0,  name='Kit', is_drum=True)

KICK, RIM, HAT, OPENHAT, SHAKER = 36, 37, 42, 46, 70

def note(inst, pitch, start, dur, velocity):
    if start >= TOTAL or velocity <= 0:
        return
    inst.notes.append(pretty_midi.Note(
        velocity=velocity, pitch=pitch, start=start, end=min(start + dur, TOTAL)))

bar = 0
while bar * BAR < TOTAL:
    t0 = bar * BAR
    ch = CHORDS[bar % len(CHORDS)]
    A = ARRANGE[act_of(t0)]

    # ── Rhodes: comping off the beat, which is what keeps it relaxed rather
    #    than square. Held long enough to bloom, never long enough to drone.
    if A['rhodes'] > 0.02:
        for off, dur, base in ((0.0, BEAT * 1.6, 62), (1.5 * BEAT, BEAT * 1.1, 52),
                               (2.5 * BEAT, BEAT * 1.4, 57), (3.5 * BEAT, BEAT * 0.8, 46)):
            for k, p in enumerate(ch['keys']):
                note(rhodes, p, t0 + off + k * 0.012, dur, vel(base, bar + k, A['rhodes']))

    # ── Upright bass: root, fifth, and a passing note into the next chord
    if A['bass'] > 0.02:
        nxt = CHORDS[(bar + 1) % len(CHORDS)]['bass']
        approach = nxt - 1 if nxt > ch['bass'] else nxt + 1
        for off, p, base, dur in ((0.0, ch['bass'], 78, BEAT * 1.3),
                                  (1.5 * BEAT, ch['bass'] + 7, 62, BEAT * 0.8),
                                  (2.5 * BEAT, ch['bass'], 68, BEAT * 0.9),
                                  (3.5 * BEAT, approach, 58, BEAT * 0.6)):
            note(bass, p, t0 + off, dur, vel(base, bar, A['bass']))

    # ── Kit: soft kick, rim on the backbeat, eighth-note hats
    if A['kit'] > 0.02:
        note(drums, KICK, t0, 0.2, vel(76, bar, A['kit']))
        note(drums, KICK, t0 + 2.5 * BEAT, 0.2, vel(64, bar + 1, A['kit']))
        for b in (1, 3):
            note(drums, RIM, t0 + b * BEAT, 0.12, vel(66, bar + b, A['kit']))
        for e in range(8):
            t = t0 + e * BEAT / 2
            open_hat = (e == 7 and bar % 4 == 3)
            note(drums, OPENHAT if open_hat else HAT, t, 0.1,
                 vel(52 if e % 2 else 60, bar + e, A['kit']))

    # ── Shaker: sixteenths, right down at the back
    if A['shaker'] > 0.02:
        for s in range(16):
            note(drums, SHAKER, t0 + s * BEAT / 4, 0.06,
                 vel(38 if s % 2 else 44, bar + s, A['shaker']))

    # ── Nylon guitar: a gentle arpeggio, one note per beat
    if A['guitar'] > 0.02:
        shape = [0, 2, 4, 3]
        for b in range(4):
            p = ch['keys'][shape[b] % len(ch['keys'])] + 12
            note(guitar, p, t0 + b * BEAT + 0.25 * BEAT, BEAT * 0.9,
                 vel(50, bar + b, A['guitar']))

    # ── Vibraphone: answers every other bar, in the space
    if A['vibes'] > 0.02 and bar % 2 == 1:
        for i, p in enumerate(ch['vibes']):
            note(vibes, p, t0 + (1.0 + i * 0.5) * BEAT, BEAT * 1.6,
                 vel(54 - i * 4, bar + i, A['vibes']))

    bar += 1

# ── the moment the maximum lands: a warm vibraphone rise, not a bell ───────
for i, p in enumerate([72, 76, 79, 84]):
    note(vibes, p, T['chime'] + i * 0.13, 2.2, 70 - i * 6)

for inst in (rhodes, bass, vibes, guitar, drums):
    pm.instruments.append(inst)
pm.write('score.mid')

counts = {i.name: len(i.notes) for i in pm.instruments}
print('score.mid written —', sum(counts.values()), 'notes')
for k, v in counts.items():
    print(f'   {k:<12} {v}')
print(f'   length {TOTAL:.1f}s at {BPM} BPM, {bar} bars')
