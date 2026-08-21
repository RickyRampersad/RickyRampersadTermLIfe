# Approving is signing

## What was wrong

Tapping **Approve** — in the dashboard queue or in the review email — wrote a
status and nothing else. No signature was ever collected, so the fact find went
out to the client with the manager's sign-off box **empty** on a case that had,
on paper, been approved.

The record said as much. `mgrSignatureMethod` read `Dashboard` or
`Email one-tap`, and `bmSigUrl` / `dmSigUrl` stayed blank.

## What happens now

Both doors collect a signature before anything is written.

### From the dashboard queue

1. **Approve** opens a signing panel inside the card instead of deciding.
2. Four attestations tick, visibly, one at a time:
   - Client data complete and accurate
   - Premium affordable against the surplus
   - Recommendation suits the need found
   - Replacement, disclosure and compliance in order
3. A pad takes the signature — finger, stylus or mouse. *Use my typed name*
   renders the typed name in a hand for anyone without a touch screen.
4. **Sign & approve** posts the decision.

All four ticks and a mark are required. Neither is optional; the decision does
not leave the page without both.

### From the review email

The **Approve** and **Request changes** buttons now open `action=decide_sign`
rather than recording on the spot. That page shows the figures being signed —
need uncovered, cover recommended, premium, client surplus, anything the checks
flagged — then the same attestations and the same pad.

The token is only *verified* on that page, never spent. Opening the link and
closing it decides nothing, and the link still works.

## Where the signature goes

| Decision | Field | Effect |
|---|---|---|
| Approved, branch manager | `bmSigUrl` (+ `managerSigUrl`) | Renders in the Branch Manager sign-off box on the printed form and the client's copy |
| Approved, unit manager | `dmSigUrl` (+ `managerSigUrl`) | Renders in the Direct Manager sign-off box |
| Sent back | `mgrDecisionSigUrl` | Kept against the decision only |

A send-back is deliberately **not** put in the sign-off box. The form is not
signed off — it is going back to the advisor — and a manager's mark sitting in
the sign-off spot would say the opposite of what happened. The mark is still
filed, because a refusal is a decision and the record should carry a hand
against it.

A **hold** collects no signature. It is not a decision on the case.

## New schema fields

```
mgrSignName          Mgr Signed As
mgrDecisionSigUrl    Mgr Decision Sig URL
```

`mgrSignatureMethod` now reads `Dashboard — Drawn` or `Email — Drawn`.

## Why the decision moved to POST

A signature is a PNG data URL — roughly 10KB. That does not fit in a query
string, so `doPost` now routes:

- a JSON body with `stage: "queue_decide"` → the dashboard queue
- a form post carrying `action=` → the signing page in the email

Both land in the same handlers as the GET path.

## Also fixed here

`rrbEsc_` was defined twice — once in `RRB_Additions.gs` without quote escaping,
once in `RRBranchEmails.gs` with it. Apps Script has one global namespace, so
whichever file parsed last silently won. This is the same class of collision
that once made the client link mint a token for id `undefined`. The weaker copy
is gone, and the surviving one now escapes single quotes too, because the
signing page puts a token straight into an HTML attribute.

## Test

`manager-signature-test.js` drives the queue the way a manager does — open a
card, approve, attest, sign, submit — and asserts that submission is refused
without four ticks, refused without a mark, and that a real PNG leaves the page.
