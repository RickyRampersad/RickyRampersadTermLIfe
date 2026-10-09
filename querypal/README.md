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

**The email quota is a real ceiling.** A consumer Google account sends about a
hundred recipients a day and the autopilot spends them on chases, surveys and
client updates. When it runs out, follow-ups silently do not go.

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
