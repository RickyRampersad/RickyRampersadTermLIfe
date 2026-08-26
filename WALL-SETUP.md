# Salesforce Wall Board — setup

A rotating slide board for the branch wall at **`/wall/`** —
rickyrampersadbranch.com/wall/. Seven slides, fourteen seconds each:

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
5. Paste that URL into `WALL_DATA_URL` at the top of `wall/index.html`, commit,
   push.

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
  update the `WALL_DATA` block in `wall/index.html` — every number in it is
  plain JSON with the query it came from documented in `apps-script/WallBoard.gs`.

## Things that have bitten elsewhere — and apply here

- The life "long view" slide reads `Submission__c` **API totals**, which are
  life sums. Do not add `Risk_Details__c` premiums, health schedules or annuity
  targets into any figure labelled life cover (see CLAUDE.md — this exact
  mistake once produced a TT$121m branch figure).
- `netlify.toml` in this repo protects nothing — GitHub Pages ignores it. The
  wall page carries `noindex` and masks names instead of relying on headers.
