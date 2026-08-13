# The daily digest

## What was wrong

Two thousand pixels tall, and it answered no question.

The old layout printed the same four-part block — summary line, insurance need,
agent list, product chips — for every unit, in two windows. Eight blocks on a
day when three fact finds happened. Structure was about ninety per cent of the
pixels and the information was the rest.

Specifically:

- **Empty units got a full card to say nothing happened.** Two of the four
  units on a normal day.
- **The agent lists were names beside a column of 1s.** A list pretending to be
  a table: nothing to rank, nothing to compare.
- **Today and month-to-date were the same layout twice**, so comparing them
  meant holding the first in your head while scrolling to the second.
- **Nothing was flagged and nothing was asked.** The one actionable number —
  what is waiting on a manager — appeared as "· 3 pending" inside a unit
  header, three screens down.
- **The subject line led with the branch name and the word "digest"**, which is
  true of every one of these ever sent.

## What it does now

It opens with what needs the reader, because that is the only reason to open it
at five in the afternoon.

1. **What is waiting on a manager** — count, age of the oldest, how many are
   past the 14-day mark, the five that have waited longest by name, and a
   button to the manager drill-down. The block turns from amber to red when
   anything breaches.
2. **Three headline numbers** — today, this week, month to date.
3. **One unit table** — four rows, three windows side by side, need MTD. Units
   with nothing to report are a dash in a row, not a card.
4. **Today, by name** — client, advisor, need, and whether it is approved or
   still with a manager.

The subject line leads with the state, not the label:

```
3 fact finds today · 18 waiting on you (9 over 14 days) — RR Branch 2026-08-13
```

Roughly 950px of content against 2000px, and it reads on a phone without
side-scrolling.

## Two things worth keeping

**The waiting list reads every case, not this month's.** The oldest case
waiting on a manager is 59 days old and falls outside every window the digest
reports on. A backlog that ages out of the report is exactly the backlog that
never gets cleared, so `_digestWaiting_` runs over all submissions while the
counts stay windowed.

**"Nothing is waiting on a manager" is printed, not omitted.** A section that
silently disappears when it is empty makes the reader wonder whether it broke.
An all-clear is worth reading.

## A bug found while building it

The action button was written as `?action=insights` against the web app URL.
There is no such route — the manager drill-down is a page on the site. Every
manager who tapped it would have got a 404. It points at
`RRB_SITE + '/insights.html'` now.
