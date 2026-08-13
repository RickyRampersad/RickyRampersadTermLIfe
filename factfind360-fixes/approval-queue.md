# The approval queue

The request, verbatim: *"I would like to be able to approve the ones that are
outstanding with data driven to me."*

So the case comes to the manager, with everything needed to decide, and the
decision happens where the reading happens. Sign in to `insights.html` and the
first full-width card is **Waiting on a decision**: every open case in scope,
oldest first, decided in place.

## What each card carries

The point is that the manager never has to open the app to know what they are
signing. Each card shows:

- **Age**, large, red past the 14-day mark
- Client, advisor, whose unit it is, submitted date, calculated need
- **Every recommendation line** — plan, cover, premium with its mode
  ("/mo assumed" where the advisor never captured one), and a `CLIENT TAKING`
  chip on lines the client accepted
- **The same checks the review email runs** — missing date of birth, premium
  above surplus, replacement flags — computed server-side by `rrbChecks_` and
  attached to the row, so the queue and the email can never disagree about a
  case. "No concerns flagged by the checks" is printed when true, rather than
  showing nothing and leaving the manager to wonder.

## The two actions

**Approve** is two clicks on the same button — it arms to "Confirm approve"
for six seconds. One-click approve on a list of look-alike cards is how the
wrong client gets approved.

**Send back…** opens a note box on the card ("What needs to change before you
can approve it?") and emails the advisor with the note.

Both then run the machinery that already existed: status, attestation,
timestamps, the advisor email, and on approval the client's approval letter
with the service rating. The record is written by the same code path in the
same shape as the email tap-to-approve — the only field that differs is
`mgrSignatureMethod: 'Dashboard'`, so the file always says which door the
decision came through.

## Rules it enforces

- **Session-token auth, server-side scope.** The endpoint re-checks that the
  case is in the caller's unit; a URL cannot reach another manager's case.
- **Agents see the queue but get no buttons** — their card says who decides
  it. Useful transparency, no temptation.
- **One decision per case.** A script lock plus a settled-status check means
  two managers (or one double-click) cannot both write; the second sees
  "Already settled by …" and the page refreshes to the truth.
- **The range selector never hides the queue.** It is built from all rows, not
  the filtered window. A 56-day-old case that vanishes because "This week" is
  selected is how a backlog gets to 56 days.

## The deep dive

**Full review ▾** on any card opens the whole case in place — the same facts
the paper file would hold, so approving here is approving with the file open:

- **The person** — age from DOB, ID, marital, smoker, occupation and employer,
  tenure, dependants counted from spouse, children and other dependants.
  Missing critical fields print as red "missing", not blank.
- **The money** — income, expenses, surplus, the new premium per month
  (client-taking lines, or as-recommended when none taken yet), and premium as
  a percentage of surplus with a bar that turns amber past 50% and red past
  80%.
- **Need vs the answer** — three bars on one scale: need found, cover
  recommended, cover the client is taking, and the need left uncovered. This
  is the suitability question drawn rather than asserted.
- **Existing cover** — the portfolio as recorded, insurer by insurer, with
  "NONE recorded" stated when that is the record. Replacement detection prints
  in red with whether the declaration was confirmed.
- **The client's voice** — whether the client confirmed the record is
  accurate, any change they asked for (quoted, amber, before the approve
  button can matter), and their rating of the advisor.
- **The advisor's record** — this advisor across everything in scope:
  fact finds, approval rate, sent back, picked up, average client rating.
  Context for how much scrutiny this file deserves.
- **Open the full fact find form →** — the actual submitted form, by id.

## The attestation

With the deep dive open, the blanket two-click approve is replaced by four
explicit checkmarks — data, ratios, suitability, compliance — and Approve
refuses until all four are ticked. The ticks are sent to the server and
written to the record as the individual attestations (`mgrVer*`), so the file
shows what was actually attested rather than a blanket true. A quick approve
from the collapsed card keeps the old behaviour, which is the same blanket
attestation the email one-tap has always made.

## Hold

The third decision that managers actually make: *seen it, not signing yet*.
Hold requires a reason, stamps who parked it and when, and resets the reminder
clock so the daily chase does not nag about a case the manager looked at
today. Status stays pending — a held case is still an open case in every count
on every board — but the card turns violet and carries the reason, so the
queue distinguishes "nobody has looked" from "looked, waiting on something
named". Any real decision clears the hold.

## The loop it closes

The daily digest's red block — "18 waiting on you, oldest 59 days" — has a
**Review them now** button that lands here. Digest says what needs you; the
queue is where you clear it; the wallboard shows the branch the result.
