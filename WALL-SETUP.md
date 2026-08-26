> **Address change.** This board first shipped at `/wall/`. That address now
> belongs to the KPI wall — the per-person block tracker the training film
> shows — so the rotating Salesforce board lives at **`/board/`** and the
> production wall at **`/board/production.html`**. Same pages, new door.

# Salesforce Wall Board — setup

Two rotating slide boards for the branch wall, both fed by the same
Salesforce connection and the same Apps Script feed:

| Board | Address | What it shows |
|---|---|---|
| **Branch board** | `/board/` | the whole branch — book, renewals, claims, pipeline |
| **Production wall** | `/board/production.html` | policies **picked up for production** — this week, this month, year to date |
| **Production dashboard** | `/board/dashboard.html` | the interactive view — periods, teams, sortable advisors, held-back deep dive, data health |

**The basis everywhere is the branch report's "Total API": `Total_API__c`
(client portfolio, on the production picked-up date) plus `API_Increase__c`
(policy increases, on the increase picked-up date).** `Increase_API__c` is
the joint-split field and is NOT what the Monday report sums — verified
against the circulated report to the dollar, advisor by advisor. Do not swap
the fields back without re-verifying.

The dashboard is for a desk or a touch screen rather than the rotating wall:
pick a period (this week / last week / month / YTD), click a team card to
filter, click a column to sort, hover the monthly bars for the new-business /
increases split. It also carries the **data health** panel — the standing
list of what staff should fix in Salesforce, with the counts.

## The production wall

Production is two measures merged: `CLIENT_PORTFOLIO__c` on
`Production_Picked_up_Date__c` (new business, `Total_API__c`) **plus**
`Policy_Increases__c` on `Increase_Production_Picked_Up_Date__c`
(increases, `API_Increase__c` — the Total API basis) — each counted on its
own picked-up date. Seven slides:

1. **Week · month · year** — merged API and pickup count for this week
   (vs last week), the running month (vs the same days last year) and
   year to date (vs the same point last year), each card showing its
   new-business / increases split
2. **Held-back API** — apps received this year with no picked-up date:
   submitted business waiting on requirements, banded by how long it has
   waited
3. **Where the held-back money sits** — held-back API by advisor, and the
   biggest single files with days waiting
4. **Week by week** — the last nine weeks, current week in gold
5. **Month by month** — new business with increases stacked on top
6. **Leaderboard** — Total API per advisor year to date
7. **Latest pickups** — the most recent policies picked up this month

### Sound

The **Sound** button in the header turns on narration and music (browsers
require that click before a page may make sound — it cannot start itself):

- The voice is **Andrew** (edge-tts, `-3%` — the house voice), one short
  line per slide, baked into the file as data URIs. The lines carry no
  figures, so they stay true when the live feed changes the numbers.
- The bed is **played, not loaded** — synthesised in Web Audio on the
  branch progression **D – A – Bm – G**, soft pads that duck under the
  voice. Nothing to licence, nothing to loop badly.
- Regenerate the voice with `edge-tts` per the house notes in CLAUDE.md if
  a line changes; each MP3 is base64-folded into `VOICE_LINES` in
  `board/production.html`.

**Pause** freezes the rotation (so a slide can be talked over in a huddle);
space does the same, ←/→ still step.

### The weekly report

`wbSendProductionReport()` in `WallBoard.gs` emails the wall's numbers —
production incl. increases, plus the held-back picture by advisor — to
`MANAGER_EMAIL` (Script Properties, comma-separate several; falls back to
the script owner). Send it every Monday: **Triggers → Add Trigger →
`wbSendProductionReport` → time-driven → week timer → Monday 8–9am.**
Or run it by hand from the editor whenever it's needed.

Advisor names are branch staff and belong on a production wall. Client
fields are never queried for this board, so no client data can reach it.

## The branch board

Seven slides at `/board/`, fourteen seconds each:

1. **The branch, right now** — risks written and premium billed this year,
   with the same-period-last-year comparison, renewals due and open claims
2. **Production** — premium billed month by month, risk counts underneath
3. **The book** — new business vs renewal, and the carrier mix
4. **Renewals radar** — the next renewals due, with countdown chips
5. **Claims watch** — open claims by type, longest-waiting list
6. **Pipeline** — open opportunities by size and stage
7. **The long view** — the branch's life production record, 2011–2017

Everything on screen comes out of Salesforce: `Risk_Details__c`,
`Claims_Revised__c`, `Opportunity` and `Submission__c`.

## It works the moment it's deployed

`wall/index.html` ships with a **snapshot** of the numbers baked in — queried
straight from Salesforce on the date shown in the board's footer. Put the page
on a screen and it plays; no wiring needed. The header badge reads **Snapshot**
and the footer says when the data was pulled.

The board is one self-contained file, same as the films — the wall plays it in
an iframe, so it must never depend on a sibling file.

## Going live (optional, ~5 minutes)

The board can refresh itself from Salesforce every 15 minutes:

1. Open the renewal sheet's Apps Script project — the one that already holds
   `SalesforceSync.gs`. If the ☁ Salesforce sync works there, the connection
   this feed needs is already stored.
2. Add a file called `WallBoard.gs` and paste in everything from
   `apps-script/WallBoard.gs`. Every function is prefixed `wb`, so nothing
   collides with the sync.
3. Run **`wbTest`** once from the editor and check the log shows sensible
   numbers.
4. **Deploy → New deployment → Web app** · Execute as **Me** · Who has access
   **Anyone**. Copy the `/exec` URL.
5. Paste that URL into `WALL_DATA_URL` at the top of `board/index.html`,
   `board/production.html` **and** `board/dashboard.html` — one feed serves
   all three (the production wall reads the payload's `production` block,
   the dashboard also reads `dashboardAdvisors`) — then commit and push.

The badge flips to **Live** on the first successful fetch. If the feed ever
fails — quota, network, an expired password — the board silently falls back to
the baked-in snapshot and keeps playing. The wall is never blank.

When the Salesforce password (or security token) changes, update `SF_PASS` in
the Apps Script project's Script Properties — the same place the renewal sync
reads it from, so fixing one fixes both.

## What the feed will and won't say

Two different lines, because the two copies of the data live in different
places:

- The **baked-in snapshot** is committed to this repo, and this repo serves
  the public site — so it is **fully anonymous**: risk types, dates and
  amounts only. No client names, no claim references, no policy numbers.
- The **live feed** never touches git, so it may say a little more: clients
  as **first name + last initial** ("Shalima M."), claims as reference
  numbers only. Still no policy numbers, emails or phone numbers — the
  `/exec` URL is fetchable by anyone who has it.

Keep both lines where they are: anything added to `WallBoard.gs` goes onto a
public URL, and anything added to the `WALL_DATA` block goes into a public
repo. When refreshing the snapshot by hand, strip names the same way.

## Driving it on the wall

- **←/→** change slide · **space** pauses · **F** toggles full screen
- Refresh cadence: browser asks the feed every 15 min; the feed caches for
  10 min, so Salesforce sees about six queries an hour.
- To refresh the **snapshot** instead (no live feed), re-run the queries and
  update the `WALL_DATA` block in `board/index.html` — every number in it is
  plain JSON with the query it came from documented in `apps-script/WallBoard.gs`.

## Things that have bitten elsewhere — and apply here

- The life "long view" slide reads `Submission__c` **API totals**, which are
  life sums. Do not add `Risk_Details__c` premiums, health schedules or annuity
  targets into any figure labelled life cover (see CLAUDE.md — this exact
  mistake once produced a TT$121m branch figure).
- `netlify.toml` in this repo protects nothing — GitHub Pages ignores it. The
  wall page carries `noindex` and masks names instead of relying on headers.
