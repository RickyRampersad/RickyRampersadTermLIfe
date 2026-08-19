# The film's music

The score is a **composition played on real recorded instruments** — not
synthesised. `score.py` writes `score.mid`; FluidSynth plays that MIDI through
FluidR3_GM, a 148 MB library of sampled instruments, so what you hear is a
Rhodes electric piano, an upright bass, a vibraphone, a nylon guitar and a real
drum kit.

Three earlier scores were written by generating waveforms directly in code, and
all three were rejected as cold or frightening. That was the method's fault,
not the composition's: a computed sine tone has no warmth in it to find, and a
*held* one is the sound of suspense — which is why changing the key from minor
to major never helped.

## The brief it was written to

Nice, warm, relaxing, with a beat.

- **88 BPM** — slow enough to be calm, with a backbeat so it still moves.
- **C major**, on major-seventh and ninth voicings. Seventh chords are what
  make harmony sound warm rather than plain.
- Rhodes comping off the beat, upright bass walking underneath, kit kept soft,
  vibraphone answering in the gaps.
- The arrangement thins and thickens with the film's six acts — sparse over the
  title, fullest through the enrolment section, pulled back for the part about
  who can see what.

## Rebuilding it

```
apt-get install -y fluidsynth fluid-soundfont-gm sox
pip install pretty_midi

cd pension/music
python3 score.py                      # -> score.mid
fluidsynth -ni -F raw.wav -r 44100 -g 0.55 -R 1 -C 1 \
    /usr/share/sounds/sf2/FluidR3_GM.sf2 score.mid
sox raw.wav room.wav trim 0 176.6 \
    reverb 32 50 66 100 12 0 \
    equalizer 220 1.2q +1.5 equalizer 3200 1.0q -1.5 equalizer 9000 0.8q +1.0 \
    gain -n -3
ffmpeg -i room.wav -af loudnorm=I=-16:TP=-1.5:LRA=9 -c:a aac -b:a 192k \
    ../assets/film-music.m4a
```

`timing.json` holds the film's act boundaries and the second the maximum
contribution lands on, so the arrangement stays locked to the picture. It is
generated from the film itself — do not hand-edit it.

## Changing the feel

Everything worth touching is at the top of `score.py`:

| Want | Change |
| --- | --- |
| Slower or faster | `BPM` |
| A different colour | the `CHORDS` list — keep the sevenths, they are the warmth |
| More or less of an instrument | the `ARRANGE` table, one row per act, 0 to 1 |
| A different instrument | the `program=` numbers (General MIDI); 4 is Rhodes, 0 grand piano, 11 vibes, 24 nylon guitar, 32 upright bass |

The render is deterministic: the same `score.py` and `timing.json` always give
the same audio, so a change can be heard rather than guessed at.
