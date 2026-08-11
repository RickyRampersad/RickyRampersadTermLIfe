# The agency wallboard

A screen on the branch wall, always on, redrawing itself. Two panels rotating
every 30 seconds: the agents, then the branch.

## The constraint that shaped it

That screen is read by clients in the waiting area, visitors, and anyone
walking past. So the feed is built so it **cannot** return client data — not
"does not", cannot.

`RRBranchWall.gs` declares `WALL_FIELDS`, and only those columns are resolved
out of the sheet. A client name, ID number, date of birth, income, medical note
or contact detail is never read from the row in the first place, so no bug in
the aggregation can leak one. Adding a field means editing that list, which is
the point — the list is the control, not a promise.

`rrbWallCheck()` proves it from the console: it renders the real payload and
greps it for eleven client field names, reporting PASS or naming what it found.

This matters more now than it would have last week. The session-token work
closed the endpoints that were handing out client data to anyone with the URL.
Putting that same data on a wall would have undone all of it, and under the
Data Protection Act a screen in a public area is a worse problem than an open
endpoint nobody found.

## Poll rate

The screen asks every 45 seconds; the server caches for 45 seconds. Roughly
800 calls across a working day.

Polling every 5 seconds — the instinct for "real time" — would be 17,000 calls
a day, which would exhaust the daily script runtime by mid-morning and leave a
dead screen on the wall. For a branch this is real-time anyway: fact finds land
every few hours, not every few seconds.

## What is on it

**Panel 1 — the agents.** Submitted today, submitted this week against last
week, premium recommended week to date, and the leaderboard with the leader in
gold. A "just in" strip flashes when a fact find lands within the last 30
minutes.

**Panel 2 — the branch.** Awaiting review, age of the oldest and who holds it,
count past the three-day standard, the queue broken down by manager with an
age pill, and flags outstanding — replacements, over-committed premium,
awaiting medical evidence. When nothing is flagged it says so.

Worth knowing: panel 2 puts each manager's backlog on a wall the whole branch
can see. That is a deliberate choice and it does apply pressure, but managers
should hear it from you before they read it off a screen.

## Failure behaviour

A wall that goes blank on one failed request is worse than a wall a minute
behind, so a failed poll keeps the last good picture up and the status dot
turns amber, then red. Verified: with the feed aborted, the week figure still
reads 23 rather than blanking.

The page reloads itself at 4am to shed any drift from running for weeks.

## Setup

1. Run `rrbWallSetup()` once. It logs the feed URL and a key.
2. Paste the key into `wall.html` as `WALL_KEY`, and set `ENDPOINT` to the
   `/exec` URL.
3. Put `wall.html` on Netlify with the other two files.
4. Open it on the TV — Fire Stick, Chromecast, or any old laptop in kiosk mode
   (`chrome --kiosk <url>`).

`rrbWallRotateKey()` issues a new key if the old one ever leaks. It exposes no
client data either way, which is why the key can live in a file on a TV at all.

## Not done

The leaderboard counts fact finds, not sales. An agent submitting many thin
fact finds outranks one writing fewer good ones. Once there is enough history,
ranking on recommended premium — or showing both — would reward the right
behaviour. At current volumes either ranking is 2-5 cases per agent, which is
not enough to be a verdict about anybody.
