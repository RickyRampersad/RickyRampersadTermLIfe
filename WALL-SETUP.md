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
| **Renewals wall** | `/renewals/` | **this month's motor & property renewals** — due, renewed, premiums, tasks, next month |
| **Renewals dashboard** | `/renewals/dashboard.html` | the interactive desk view — line/status filters, sortable register, values, trend, people |

**The basis everywhere is the branch report's "Total API": `Total_API__c`
(client portfolio, on the production picked-up date) plus `API_Increase__c`
(policy increases, on the increase picked-up date).** `Increase_API__c` is
the joint-split field and is NOT what the Monday report sums — verified
against the circulated report to the dollar, advisor by advisor. Do not swap
the fields back without re-verifying.

The dashboard is for a desk or a touch screen rather than the rotating wall:
pick a period (this week / last week / month / YTD), click a team card to
filter, click a column to sort, hover the monthly bars for the new-business /
increases split. It also carries:

- **▶ Run** — cycles section to section every 12 seconds like a wall; any
  click, scroll or key hands control back to whoever is at the screen.
- **⬇ Head-office weekly** — downloads the Monday hierarchy sheet as Excel
  (Apps/API for last week, the month and YTD, advisor rows grouped under
  each unit, unit subtotals, grand total), rebuilt from whatever the
  dashboard is showing. On the snapshot the advisors are initials; wire the
  live feed and the export carries full names — ready to send to head
  office. Apps columns count policy records; if head office counts apps
  differently (joint cases once), adjust before sending.
- **Settled vs pending** — `Date_Settled__c` against the picked-up book,
  month by month with settle-through rates, settle-speed bands and the
  pending chase list by advisor. `Policy_Status_Description_R__c` is blank
  on 700 of 706 picked-up records, so the settle date is currently the only
  reliable signal — the data-health panel exists to change that.
- The **data health** panel — the standing list of what staff should fix in
  Salesforce, with the counts.

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

## The renewals wall

Twelve slides at `/renewals/`, fourteen seconds each — the month's renewal book
as a working wall:

1. **The month, right now** — due / renewed / still open / overdue, with the
   day-of-month progress bar
2. **The month on one line** — every renewal on a date rail, dot size =
   premium, blue = motor, gold = property, a green ring = already re-written
   in Salesforce, dashed line = today
3. **Motor** — every vehicle due, cover type, status chip, premium
4. **Property** — every property risk due, private/commercial, premium
5. **Values · motor comprehensive** — last year's insured value against this
   year's, whether the renewal took the prepared step-down, and the benefits
   on each policy (windscreen cover, Waiver of Excess)
6. **Values · property** — each sum insured, how many years it has sat
   unchanged, what it is worth today at +5%/yr rebuilding drift, and the
   riders on file
7. **The year so far · motor** — Jan→now stacked by month: renewed, still
   open, lost, sold, with the retention percentage under each month and the
   gained-vs-lost picture beside it
8. **Whom we are losing** — how concentrated the losses are, and the recent
   walked renewals (weeks old, still recoverable), biggest first
9. **Who is managing the renewals** — renewals processed per person (from
   `CreatedBy` on each new cycle), open renewal tasks per owner, and how
   much of the written premium has a payment recorded against it
10. **The money** — motor vs property split, the biggest renewals, and
    re-written vs collected (reads `Payments_Made__c` on the new cycle —
    blank until payments are posted, and the wall says so)
11. **The work behind it** — open Tasks by owner and status, plus the renewal
    chase ladder (payment follow-ups, waiting renewals), genericised
12. **Already knocking** — next month's count and premium, by line

The registers also tie each renewal to its workload and money: a **Tasks**
column counts open Salesforce Tasks on the risk record or the client's
account (counts only — task subjects carry client names and never ship), and
a **Paid** column reads `Payments_Made__c` on the renewed cycle ("not
recorded" until a receipt is posted). "Lost" in the trend means the renewal
date passed with no next-cycle row and the vehicle not marked Sold; the
distinct-vehicle count is shown beside the row count because the register
carries some vehicles twice.

**The values conversation, in fields:** comprehensive motor values step DOWN —
`Cover1__c` against the prior cycle, with the register's own prepared options
`Depreciation_10_Option_1__c` / `Depreciation_15_Option_2__c` as the guide
(never `Depreciation__c`, which is the parts clause — see RENEWAL-SETUP).
A value equal to last year's is flagged: premium is being paid on money a
claim would not pay out. Property sums insured only go stale —
`Total_Property_Cover__c` compared across the account's history; unchanged
4+ years is flagged with the +5%/yr suggested figure (the RenewalLines
drift), because average cuts every claim on an underinsured risk. Riders
(burglary, stock, contents, liability, pool, electronics, WC) are read off
the current row and shown as chips; blank riders show "confirm at renewal".

**How "renewed" is decided:** a renewal counts as renewed when its next-cycle
`Risk_Details__c` row exists — a record with the same vehicle registration
(motor) or policy number (property) whose `From__c` is on/after the due date.
Rows are matched one-to-one, so three risks on one policy need three new rows.
`Vehicle_Status__c` other than Current (e.g. Sold) shows as leaving the book.

Same rules as everything else here: the baked snapshot is **fully anonymous**
(risk types, dates, amounts — no names, policy numbers, registrations or
addresses); the live feed adds first name + last initial only. Task subjects
are **never** shipped raw — staff write client names and policy numbers into
them — the feed reduces them to a kind and a date. Staff names on the task
slide are branch staff and belong on a wall.

**The dashboard** (`/renewals/dashboard.html`) is the same data as a desk
view instead of a rotation: line and status filter chips that recompute the
KPI row, a merged motor+property register sortable by due date or premium,
the values panels, the year trend, the losing and people panels, and next
month. **▶ Run** cycles section to section every 12 seconds like a wall;
any scroll, click or key hands control back. The wall and the dashboard
carry the same baked snapshot — refresh both files together.

The live feed is the same `/exec` as the other boards — `wbBuild_()` now
carries a `renewalsWall` block (`wbRenewalsWall_()` in
`apps-script/WallBoard.gs`). Paste the URL into `WALL_DATA_URL` at the top of
`renewals/index.html` **and** `renewals/dashboard.html` and the badge flips
to **Live**; if the deployed script predates the block, both just stay on
their snapshot. Refresh the snapshot by re-running the queries documented in
`wbRenewalsWall_()` and updating the `WALL_DATA` block — and keep it
anonymous when you do.

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
