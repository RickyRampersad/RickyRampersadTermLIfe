# Specific Need Only, and the manager's sign-off

Two problems, reported together after a live case: a Specific Need Only fact
find for a client who declined full disclosure reached the manager looking
like a failed full fact find, and managers had been saying for a while that
approving anything took too long.

## Specific Need Only was honoured by the form and nowhere else

Selecting it already worked on the form: sections 2–9 hide, their validation is
waived, and the client is captured in section 1 instead.

The server knew nothing about it. `appType` appeared **zero** times across the
email and dashboard code. So the manager's review email ran the full
needs-analysis engine over a client who had disclosed nothing, and produced:

- "No sums assured have been entered against the recommended plans"
- "Occupation: not recorded", income $0, assessed shortfall $0
- a dependants block reading "Marital status not recorded"

Every one of those reads as a failing by the advisor. Every one of them is
actually the client exercising a right under the Insurance Act 2018,
Schedule 11. Worse, RAI raised a red finding against each, and a manager must
type a written basis of 8+ characters for every red finding before signing —
so the client's choice not to disclose became several paragraphs of homework
for the manager.

The scope now overrides everything downstream, the way it already overrode the
form:

| | Before | After |
|---|---|---|
| Subject | `[DRAFT] Fact find for review — <client>` | `[DRAFT] Specific Need Only — approval required — <client>` |
| Body | full needs analysis, rendered as zeroes | need, product, sum, premium, reason |
| Non-disclosure findings | red, each needing a written basis | not raised |
| Length | ~7 blocks | 3 |

The email states plainly that the blank sections are the client's decision and
not the advisor's omission, and asks the manager the only three questions that
can actually be answered on a limited-scope file: does the product suit the
need described, was the client told a policy bought without a full fact find
may not suit their wider needs, and would the reason on file survive
inspection.

If no recommendation is recorded at all, that *is* flagged — on a Specific
Need Only case the need, the product and the reason are the entire file, so
their absence is the one thing worth sending back.

## The manager's sign-off: nine actions to four

To approve one case a manager completed: their name, guidance to the agent, a
tickbox confirming they gave that guidance, a response to every RAI finding,
agree/disagree, feedback, four verification tickboxes, a signature, and a date.

Several of those asked for the same thing twice.

| Was | Now |
|---|---|
| Your name | auto, from the signed review link |
| Guidance to the Agent | **kept** — and it now prints as Manager's Comments |
| Tickbox: "I confirm I provided guidance" | gone — writing the guidance is the confirmation |
| Respond to **every** RAI finding | red findings only |
| Agree / Do not agree | **kept** |
| Feedback (required) | gone — mirrored from the guidance box |
| Four verification tickboxes | one attestation line naming all four |
| Signature | **kept** |
| Sign date | auto, the day they sign |

Nothing that evidences supervision was removed. The file still carries the
manager's written reasoning, their attestation and their signature, so a case
pulled for inspection still shows what the manager checked and why they agreed.
What went was duplication.

`rrbMgrSync_()` still writes `dmResponded`, `mgrComments` and all four
`mgrVer*` fields, so the printed form and the `ffRevised` sheet are unchanged.
Downstream reporting does not need to know this happened.

### Why amber findings stopped blocking

The submit button was disabled until *every* finding was answered — amber and
green included. Only red findings carry a written-basis duty, so only red ones
block now. Amber and green remain on screen to be read.

## Verified

In a real browser, on the actual file:

```
BEFORE — blocking:                      AFTER the four:
  • Your guidance to the agent            nothing blocking — can sign
  • Your recommendation (Agree / Do not agree)
  • Tick the verification line
  • Your signature

still written to the record:
  dmResponded true · mgrComments mirrored · 4 ver fields all true · sigDate set
```

Scope handling, with three red findings unanswered:

```
Full disclosure      -> 3 flagged (red) RAI finding(s) — blocked
Specific Need Only   -> nothing blocking — manager can sign
sections 2-9         -> display:none in advice mode
```

Subject lines:

```
advice -> [DRAFT] Specific Need Only — approval required — <client> (<advisor>)
full   -> [DRAFT] Fact find for review — <client> (<advisor>)
```

No page JS errors on load.

## Not done

The dashboard still does not distinguish a Specific Need Only case in its lists
or counts, so branch-level metrics — recommend-ratio in particular — mix
limited-scope cases in with full ones and understate the ratio. Those cases
have no assessed shortfall to divide by. Worth excluding them from that metric
rather than letting it drift.

---

# The email became the review

The review used to be: read a notification, open a link, load a long form,
clear every finding, fill nine fields, sign, submit. On a phone, between
appointments, that does not happen — so cases sat in `pending_review` and the
median climbed.

The email now carries the decision. **Approve** and **Request changes** are two
taps at the top of the message, above the reasoning rather than below it. The
full application is still one link away for a case that deserves the long look.

## What is in the message now

| Block | Shown when | Why |
|---|---|---|
| Approve / Request changes | always | the decision, before the reading |
| Check this is right | always, both scopes | bio data is verifiable even when the finances are not |
| Concerns | only when there are any | silence when a case is clean is the point |
| The recommendation | always | need, product, sum, premium, reason |

On a clean case the concerns block says so in one green line. Managers stop
reading a page that cries wolf, and a branch where every case shows six amber
findings has effectively no flags at all.

### Concerns are computed, not listed

| Concern | Severity | Scope |
|---|---|---|
| No recommendation recorded | red | both |
| Recommendation with no reason given | red | both |
| Existing cover being replaced | red | both |
| Premium over 80% of monthly surplus | red | full only |
| Premium 50–80% of surplus | amber | full only |
| Recommendation under 80% / over 125% of assessed need | amber | full only |
| Medical evidence likely required | amber | both |
| Missing DOB, ID, occupation or income | red | full only |

The scope split matters. On a Specific Need Only case there is no disclosed
income to divide a premium into, so those tests do not run — and a blank field
is reported as "not disclosed" rather than "not recorded", because one is the
client's decision and the other is an omission.

## What a tap records

Verdict, the reviewer named in the token, the timestamp, and the token's own
id — written to `mgrSignatureMethod` and `mgrSignatureRef`, two new schema
columns. Both were needed: `ffWriteRow_` iterates the schema and silently drops
any key without a column, so without adding them the attestation trail would
have looked fine in code and written nothing.

**This replaces the drawn signature on the email path only.** Opening the form
and signing still works and still records a drawn signature. The record says
which method was used rather than leaving a blank that reads like a missing
signature.

The link is a single-use HMAC token bound to that submission and that reviewer,
expiring, revocable, and marked spent the moment it is used. The verdict rides
in the URL rather than the signature because anyone able to alter it could
simply have used the link instead.

After the decision is saved, the confirmation page offers an optional comment
box backed by a fresh single-use token. The decision lands whether or not the
comment is ever typed.

## Verified

Concerns computed against three shaped cases:

```
advice        — 5 bio facts, 0 concerns
full (bad)    — 7 bio facts, 3 concerns
                  RED    Existing cover is being replaced
                  amber  Recommendation covers 50% of the assessed need
                  RED    Premium is 87% of the client's monthly surplus
full (clean)  — 7 bio facts, 0 concerns
```

One token minted per email — not one per button.

## Not done

The dashboard still does not show how a case was signed off, so a manager
looking at the branch view cannot tell a one-tap approval from a fully signed
form. The data is now there to show it.
