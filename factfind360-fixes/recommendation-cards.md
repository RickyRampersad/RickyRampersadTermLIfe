# Recommendations — from a sideways grid to cards

Reported from the field with a photo: the need column reading "Income
Replacem", "Retirement / Pens", "inal Expenses / ", and the priority column cut
to "RI" with the numbers running 1, 1, 2, 3, 3, 4.

## What was wrong

The grid is eleven columns wide:

```
Pri │ Need │ Who │ Plan │ Amount │ Gap │ Premium ║ Plan taken │ Amount │ Premium │ Go?
```

Six rows of that is sixty-six inputs laid out horizontally. It cannot fit a
phone, so it scrolls sideways and truncates — and an advisor filling it in on a
client's sofa sees half a word per column.

Priority was a free-text box, which is why a list came back numbered 1, 1, 3,
3. Nothing computed it and nothing checked it.

## What replaced it

A card per recommendation, stacked. Each carries the need, who it is for, the
plan, the sum assured, the premium, and the client's decision as three buttons
— Taking it / Later / Declined. The amount-taken fields stay hidden until the
client actually chose something different, so the common case is one tap
instead of four fields retyped.

Priority is the position of the card. Nobody types it, so it cannot come back
1, 1, 3, 3.

The grid is still there behind "Show the grid" for anyone who prefers it, and
it is still the thing being filled in — the cards write into the same rec and
dec fields, fire the same events, and reach the same `state`. The printed form,
the sheet and every email are untouched. This is a better way to fill in the
existing form, not a replacement for it.

## The bug that made this worth testing rather than eyeballing

`upgradeRecDropdowns()` converts Need and Plan from text inputs into `<select>`
elements after load. Assigning `.value` to a select whose option list does not
contain that value **fails silently** — the value simply stays empty.

So the first build of these cards wrote the amount and the premium (still text
inputs) and quietly dropped the need and the plan. A card would look perfectly
filled in and submit with its two most important fields blank. Nothing would
have thrown; the advisor would have found out from a manager.

Caught by asserting on the underlying grid after driving the cards:

```
rec1Need  = (empty)          <- dropped
rec1Rec   = (empty)          <- dropped
rec1Amt   = 750000           <- fine
rec1Prem  = 412              <- fine
```

`recSet` now appends the option before assigning. And rather than carry its own
hardcoded list, each card reads the options out of the form's own dropdowns —
so the cards and the grid cannot drift apart, and changing the need refreshes
the plan list exactly as the grid does.

After the fix:

```
rec1Pri = 1     rec1Need = Income Replacement (Breadwinner) — Life
rec1Rec = Guardian Term Life 20    rec1Amt = 750000    rec1Prem = 412
rec2Pri = 2     rec2Need = Critical Illness
dec1Plan = Guardian Term Life 20   dec1Amt = 750000    dec1Go = Yes
```

Verified at 414px — a phone — with nothing truncated.
