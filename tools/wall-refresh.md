# Refreshing the wall board from Salesforce

`board/index.html` renders from one object, `WALL_DATA`. There are two ways it
gets its numbers, and the branch should end up on the second.

| | How current | Needs |
|---|---|---|
| **Snapshot** (today) | as of the last refresh | nothing — the numbers sit in the file |
| **Live feed** | refetches every 15 min | `WallBoard.gs` deployed, `WALL_DATA_URL` set |

The snapshot is the fallback either way: if the feed is unreachable the board
keeps drawing the committed numbers rather than going blank on the wall. So the
snapshot has to stay current even after the feed is live.

## The rule that matters

**Every figure in one refresh comes from one pass.** Mixing a fresh count with a
stale one is what produced the 132-against-144 error. If a query fails, the
refresh is abandoned — a half-updated `WALL_DATA` is worse than an old one,
because the totals stop agreeing and nobody can tell which half is wrong.

`tools/board-check.js` asserts the totals agree. Run it before committing.

## The queries

Exactly the ones in `wbBuild_()` in `apps-script/WallBoard.gs`, so the snapshot
and the live feed can never disagree about what a number means. Note that
**Salesforce allows field aliases only in aggregate queries** — `SELECT
Policy__c p` fails the whole call with MALFORMED_QUERY. Four queries here were
written that way and returned nothing.

```sql
-- monthly (drives ytd.risks and ytd.premium; sum the months, never re-query)
SELECT CALENDAR_MONTH(CreatedDate) m, COUNT(Id) n, SUM(Billing_Premiums__c) prem
FROM Risk_Details__c WHERE CreatedDate = THIS_YEAR
GROUP BY CALENDAR_MONTH(CreatedDate) ORDER BY CALENDAR_MONTH(CreatedDate)

-- last year to the SAME DAY, not the same month — this is a like-for-like
SELECT COUNT(Id) n, SUM(Billing_Premiums__c) prem FROM Risk_Details__c
WHERE CreatedDate >= <lastYear>-01-01T00:00:00Z AND CreatedDate <= <lastYear>-<today>T23:59:59Z

SELECT COUNT(Id) n FROM Risk_Details__c
WHERE Next_Renewal_Date__c >= TODAY AND Next_Renewal_Date__c <= NEXT_N_DAYS:30

SELECT Claim_Type__c t, COUNT(Id) n, AVG(Days_Pending__c) d FROM Claims_Revised__c
WHERE Claim_Status__c = 'Opened' GROUP BY Claim_Type__c ORDER BY COUNT(Id) DESC

SELECT COUNT(Id) n FROM Claims_Revised__c WHERE Claim_Status__c = 'Closed' AND CreatedDate = THIS_YEAR
SELECT COUNT(Id) n, SUM(Amount) amt FROM Opportunity WHERE IsClosed = false
SELECT COUNT(Id) n FROM Opportunity WHERE IsWon = true AND CloseDate = LAST_N_MONTHS:12

SELECT Risk_Classification__c k, COUNT(Id) n FROM Risk_Details__c
WHERE CreatedDate = THIS_YEAR GROUP BY Risk_Classification__c

SELECT Carrier__c k, COUNT(Id) n FROM Risk_Details__c
WHERE CreatedDate = LAST_N_MONTHS:12 GROUP BY Carrier__c ORDER BY COUNT(Id) DESC

-- no aliases below this line
SELECT Vehicle_Make__c, Policy__c, Next_Renewal_Date__c, Billing_Premiums__c
FROM Risk_Details__c
WHERE Next_Renewal_Date__c >= TODAY AND Next_Renewal_Date__c <= NEXT_N_DAYS:45
ORDER BY Next_Renewal_Date__c LIMIT 12

SELECT Claim_Reference__c, Claim_Type__c, Days_Pending__c FROM Claims_Revised__c
WHERE Claim_Status__c = 'Opened' ORDER BY Days_Pending__c DESC NULLS LAST LIMIT 6

SELECT Name, StageName, Amount FROM Opportunity WHERE IsClosed = false
ORDER BY Amount DESC NULLS LAST LIMIT 7
```

`legacy` covers 2011–2017 and cannot change. Leave it alone.

## What must never reach the committed snapshot

`board/index.html` is in a public repository and the board itself is served
from a public URL. The live feed masks client identity in `WallBoard.gs`
(`wbMask_`, `wbOppLabel_`, `wbClaimRef_`); **the committed snapshot must be
masked the same way**, so the wall looks identical whether the feed is up or
down.

- **Renewals** — the risk type (`wbRiskLabel_` off the policy prefix: FHO
  homeowner, FAR all risk, FCP/FSP commercial property, CPL liability, AP
  motor) and the vehicle make. Never a name, never a policy number.
- **Claims** — `wbClaimRef_`: last four of the file number only. The reference
  carries the insured's initials, and the wall faces the room.
- **Opportunities** — the class of business only. `OPP Life - <name>` is
  committed as `Life`.
- Premiums and counts are fine. They are the point.

## After editing

```bash
python3 -m http.server 8891 &
node tools/board-check.js        # totals agree, no renewal already past
node tools/board-fit.js          # every slide clears the footer at 720p and 1080p
```

## Turning the real feed on

The snapshot goes stale the moment it is written; the feed does not. To switch:

1. Deploy `apps-script/WallBoard.gs` — Deploy → New deployment → Web app,
   *Execute as Me*, *Who has access: Anyone*.
2. Paste the `/exec` URL into `WALL_DATA_URL` at the top of `board/index.html`.
3. The Salesforce credentials go in Script Properties (`SF_KEY`, `SF_SECRET`,
   `SF_USER`, `SF_PASS`) — never in the file, which is public.

The board then refetches every 15 minutes and falls back to whatever snapshot
was last committed.
