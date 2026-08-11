# The producer board

One advisor per line, the whole funnel across it:

```
Advisor │ Fact finds │ Need found │ Recommended │ Sold │ Apps │ API
```

Two of them: this week, and month to date. Both rank on **API closed**, not on
fact finds — volume is the input, API is the outcome, and a board that ranks
the input rewards the wrong thing.

## Why the funnel matters more than any single column

Read left to right and each advisor's story is on one line. An advisor
uncovering TT$6.1M of need and closing TT$149k of API is converting. One
uncovering TT$2.4M and closing nothing is not short of activity — they are
losing it somewhere between the need and the close, and the row shows exactly
where.

That gap is invisible on a production report, which only ever shows the last
column.

## API

Annual Premium Income. A premium is meaningless until you know how often it is
paid — TT$500 monthly and TT$500 annually are the same figure and twelve times
the business.

| Mode | multiplier |
|---|---|
| Monthly | 12 |
| Quarterly | 4 |
| Semi-Annual | 2 |
| Annual | 1 |

**Recommended API and closed API are deliberately different numbers.** The
producer board uses closed — counted only from lines the client marked as
taking. Reporting recommended as production would flatter the branch by
precisely whatever it failed to close, and that is the figure that gets quoted
upward and then fails to reconcile.

## The assumption, stated rather than buried

Premium mode only began being captured today, so every case written before it
has none. Those annualise as monthly, which is how premiums are quoted here,
and the count of assumed lines prints beside the API total.

It stops being an assumption as advisors fill the field in. Until then the
board says so on its face — a board that presents an assumption as a fact is a
board that gets caught once and then never trusted again.

## Sold vs recommended

`Sold` is the sum assured on lines the client accepted; `Recommended` is what
the advisor proposed. Both are shown because the difference is the coaching
conversation — an advisor recommending TT$4.2M and closing TT$2.85M is doing
something different from one recommending TT$1.5M and closing TT$610k, even
though both "converted about two thirds".

## Days worked

Every fact find carries the date it was completed, so the board can show the
one thing a total never shows: **whether the week was worked evenly or rescued
on Friday.**

Two calendars, both built from the same dates:

- **The week strip** — seven tiles, Sunday first, each with that day's fact
  finds and the API taken on them. Today is ringed, days still to come are
  dimmed, weekends are marked so a Saturday that produced reads as the effort
  it was.
- **The month grid** — a full calendar for the month, each day tinted by how
  many fact finds landed on it. Quiet days are gaps, not missing squares.

Both are pre-seeded with every day in the period before anything is counted.
A day with no activity has to render as an empty square — if quiet days simply
vanished, a week with two days worked and a week with five would look
identical, which is the exact comparison the calendar exists to make.

Beside each: **days worked of days elapsed**. Not days in the month — days
that have actually happened. Comparing four days worked against a 31-day month
on the 11th is a scoreboard nobody can win, and one nobody reads twice.
