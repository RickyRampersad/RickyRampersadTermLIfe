# Query Pal — querymypolicy.com

The branch's client service-request system. An agent or a client logs a
request once; it routes itself to the right department, chases when the
department goes quiet, keeps the client told, and asks them to rate us when
it closes. `/wall` is the board the office TV runs.

**These files are the source of truth, and they are not on the default
branch.** A checkout of `main` carries no `querypal/` at all, so it looks as
though the site has no source. It has — on this branch. Check here before
concluding otherwise, and commit a change before deploying it. On 9 October
2026 these files matched the live site byte for byte.

## Hosting — a third chain, separate from the other two

| Source | Host | Serves |
|---|---|---|
| `querypal/` (this folder) | **Netlify**, project `querymypolicies` | querymypolicy.com |

It is **drag-and-drop**, not linked to this repository, so a push publishes
nothing. To deploy: drag the **whole folder** onto Netlify → Deploys. A
drag-and-drop deploy replaces every file, so it must be the whole folder every
time — dropping one file deletes the rest of the site.

## The backend is not in any repository

A container-bound Google Apps Script (`Code.gs`, plus `QueryPalPatch.gs` here),
reached at the `/exec` URL hard-coded in `index.html` and `wall.html`. It
writes to the **Queries** tab of the branch's Google Sheet. **Never replace
`Code.gs` wholesale** — it is the branch's own and carries the agent roster,
the routing and the autopilot; `QueryPalPatch.gs` is additive and
`PATCH-INSTRUCTIONS.md` lists the few edits to `Code.gs` itself. Redeploy with
Deploy → Manage deployments → pencil → **New version**; *New deployment*
issues a fresh URL and every page has to be re-wired.

`…/exec?action=health` reports the sheets, the sign-in list, the routing
table, whether the autopilot trigger is installed, the email quota left today,
and whether Gmail threading is authorised.

## What bites

**A slow Apps Script is not a broken one.** Reading the whole log can run past
a minute on a busy sheet. Both the sign-in and the dashboard used to give up
after ten and fifteen seconds and then show a card telling the branch to
install `QueryPal_Backend_v6.gs` — a file that has never existed in this
project. A morning was lost to that advice before anyone doubted the message.
Both now wait properly, retry once, and say something true;
`tests/dashboard.browser.test.mjs` fails if a timeout is shortened again.

**The wall is 13 MB because Andrew is inside it.** The spoken briefings are
738 complete sentences, recorded on Andrew and embedded as data URIs, because
the wall plays in an iframe and a linked MP3 is silent there. Numbers spoken
in isolation sound robotic however they are cross-faded — the pitch of a word
depends on the sentence around it — so every sentence is recorded whole, once
per value it can carry, and playback only ever joins sentences at full stops.
`film/wall-voice/build-sentences.py` regenerates them;
`film/wall-voice/embed-wall-voice.py` folds them back in with their text, so
the subtitle can never drift from what is said.

**A credential in the page is a published credential.** The branch master
codes used to sit in plain text in `index.html`, as an offline sign-in bypass
so a slow Apps Script could never lock the branch out, and in `404.html`, a
stale 310 KB copy of the whole app that was still being served. The backend
honoured them fully — `action=myqueries` with that code returned all 99 cases,
every client name and every request. Anyone who opened View Source on a public
insurance site had the branch's case log. Sign-in is the server's job alone;
the branch now waits for the retry like everybody else.
`tests/secrets.test.mjs` fails if a sign-in literal is ever published again,
and `404.html` is a 404 page now, not a second app.

**The page used to lie when a send failed.** `doPost` writes the row and then
sends the routed email; if that send throws, the whole request answers
`{ok:false}` — and the page read `d.reference` without ever checking `d.ok`,
so it showed the success screen anyway. A client walked away with a reference
for a request no department had received. The site was posted on Facebook on 9
October 2026 with 25 of the day's recipients left, which is how close this
came to happening in public. `tests/send.test.mjs` fails if the `d.ok` check
is removed again.

**The client path has no sign-in, and that is deliberate** — it is a public
service form. It does mean a stranger can route a request to a real Guardian
department, and that each request spends up to six of the day's hundred
recipients. Two things hold the line: a device that logs six requests in an
hour is asked to call the branch instead, and under quota pressure the backend
sheds the courtesy copies (sales support, branch support, the agent) rather
than lose the department email. `qpUnsentReport()` lists anything that still
never went.

**The email quota is a real ceiling.** A consumer Google account sends about a
hundred recipients a day and the autopilot spends them on chases, surveys and
client updates. When it runs out, follow-ups silently do not go.

**A reference was never a credential, but three endpoints treated it as one.**
`comments`, `casehistory` and `replies` took a reference and checked nothing.
Tested live on 10 October 2026: `action=replies` with no sign-in returned every
open reference waiting on a department, and `action=comments` with one of them
returned nine comments, all `mode:"internal"`. The two chained — the first call
handed out the references the second one needed. `addcomment` had the gap from
the other side: a valid code, but no check that the case belonged to the person
holding it, so any agent could write onto anybody's case and push it to the
client on the trail. Patch section 14 wraps all four with the scope rule
`myQueries_` already used. The page now sends `qpCred()` on every staff read of
a case, and `tests/scope.test.mjs` fails if a new call site forgets.

**Two declarations of `normName_`, and the wrong one wins.** `Code.gs` declares
it at line 1231 keeping spaces, then again in the v8.1 section stripping every
non-letter. The last declaration in a file is the one that runs, so three
comparisons written against a literal *with a space* can never be true — which
is why `roleFromHierarchy_` cannot grant the manager role by name, and why a
manager whose row carries no email gets an empty team and sees only their own
cases, looking exactly like an agent with no error anywhere. Edit 26 renames
the second one. `qpAuditTrailScope()` prints role, cases visible and team-key
count per code, with no client text, so this is visible before anyone notices
it in the app.

**`qpwall.html` is a byte copy of `wall.html`** under the name the branch
manager has in Downloads. Keep them identical.

## Rules that do not bend

- Never send test email to a real department — `TEST_MODE = true` sends to the
  branch manager's own address.
- Internal notes never reach a client view.
- The wall carries aggregates only — no names, references or request text.
- Client scoping is enforced on the server, never in the page.
- A department override may only pick a department on the branch's own list,
  and the server checks that list again.

## Why a chase can miss the department

Worth keeping, because it took reading one reminder email to find three
separate faults.

`sendFollowUp_` replies inside the original Gmail thread when it can find it,
which reaches everyone the request went to. When the search misses it sends a
fresh email, and that fallback addresses Sales Support on a health or claims
case with the agent, manager and branch support on CC — **not the department**.
So the cases chased ten times instead of three are exactly the ones where the
department never hears. Edit 27 puts it on the CC; Sales Support keeps the To
line, because driving health and claims to close is theirs.

The thread search missed for a reason of its own. The client keep-warm block
read its counter from `row[18]` — column 19, Description — and wrote it back
with `getRange(r + 1, 18)`, column 18, **Subject**. Reading one column and
writing the next means the counter never advances, so a progress update goes to
the client on every sweep, each headed "#1", and the subject is overwritten
with the description plus ` | client-updates:1`. Since the chase subject is
built from column 18, every chase carried a different subject from the request
it was chasing. `qpRepairSubjects()` recovers each one from the reference's
fifth segment, cut to 24 characters as the reference itself carries it.

**A detected department reply still needs a person.** Case 081 recorded a reply
on 5 October and sent five more reminders over the top of it, each saying there
was no confirmation on the thread. Nothing is broken there — it is the system
working as built, and it is the next thing worth changing.

**The timeline used to invent dates.** `history_` loops the Follow-ups count and
stamps every chase with the single Last Follow-up date, so five chases spread
over a fortnight all render on one day. Per-chase dates are recorded nowhere, so
`qpFoldChases_` shows one event with the real count instead of five that imply
dates nobody has.
