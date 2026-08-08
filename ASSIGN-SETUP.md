# "You don't have an active agent" — Reassignment Programme

A complete outreach and reassignment system for clients whose servicing agent
has left the branch.

It answers one question from your live data — **which clients are paying premiums
with nobody looking after them?** — and then runs the whole recovery journey:
a personal letter from you, a client portal, a profiling form, automatic recaps,
an agent appointment with a proper introduction, and chasers that escalate to you
when a promise slips.

Everything runs on free tiers: your existing site + Google Apps Script.
No servers, no monthly cost.

---

## What it found in your portfolio

Run against the full **Export** tab — all 20,348 policy rows:

| | |
| --- | --- |
| Policy rows | **20,348** |
| Distinct clients | **10,926** |
| Active roster (`Users` tab) | **37** |
| Distinct agents named on policies | **92** |
| **Agents no longer active** | **59** |
| **Orphaned clients** | **2,962** |
| Their policies | **4,348** |
| **Premium under inactive agents** | **TT$5,086,116** |
| Clients with an active agent | 7,819 |

The book is concentrated: the ten largest inactive holdings account for roughly
two thirds of the orphaned clients, and the single biggest holds over 360.
Run `listInactiveAgents()` for the names and figures — they are deliberately
kept out of this file, because this repository is public and who left with how
much premium is not something to publish.

### Two things you need to decide

**1. Five of them are agencies, not people.** Five brokerage/agency channels
account for **841 clients between them**. They are almost certainly being
serviced by the broker — just not by one of your agents. They are listed in
`CONFIG.EXCLUDE_AGENTS` and **excluded** from the outreach, which brings the
real target down to:

| | excluding broker channels |
| --- | --- |
| Orphaned clients | **2,143** |
| Their policies | 2,990 |
| Premium | **TT$2,541,691** |

Delete a line from `EXCLUDE_AGENTS` to pull that channel's clients back in.
Run `listInactiveAgents()` to see all 59 before you decide.

**2. Most of them have no email address.** This is the important one:

| Of the 2,143 orphaned clients | |
| --- | --- |
| Reachable by email | **647** (30%) |
| Phone number only | **1,127** (53%) |
| No contact details at all | **369** (17%) |

**The email programme reaches fewer than a third of them.** That is a limit of
the data, not the build — you cannot email 1,127 people whose address you do not
hold.

So there's a second track. `exportCallList()` builds a **`Reassign Call List`**
tab: every orphaned client with a phone but no email, **sorted by premium, highest
first**, with columns for who called and what happened. When staff capture an
email address, they write it into the `Email` column on the `Reassign` tab and
that client joins the normal invitation flow on the next run.

Work the top of that call list first — the premium concentration means a few
hundred calls covers most of the money at risk.

Numbers change as the book changes. `reportInactiveAgents()` re-runs all of this
live and prints the current truth.

### Built for the real size

At 20,000 rows the naive approach dies — Apps Script kills anything over six
minutes. So:

- The portfolio is read **once**, streamed in 2,000-row blocks, and each orphaned
  client's policies are cached onto their own queue row (`Policies JSON`).
  Portal loads, emails and dashboards then read only the small `Reassign` tab —
  none of them ever rescan 20,000 rows.
- The active/inactive decision is memoised per distinct agent name, turning
  ~20,000 × 37 comparisons into a few hundred.
- Invitations are **paced and resumable**: `MAX_INVITES_PER_RUN` (60) per run,
  and the script checks your remaining Gmail quota before sending, keeping 20
  back for alerts. Every run picks up exactly where the last stopped, so you can
  work through thousands of clients a batch at a time without ever double-sending.
- The manager dashboard shows the clients needing a decision first and tells you
  how many are queued behind them, rather than trying to render thousands.

### How "inactive" is decided

An agent counts as **active** when their name matches a person on the `Users`
tab whose `Active` column says `Active`. Every policy whose servicing agent
fails that test belongs to an orphaned client. Names are matched loosely
(`A08413 - Meera Persad Khan` on the roster matches `Meera Persad-Khan` on a
policy), because the two tabs spell people differently.

Clients are grouped so **one person gets one email**, no matter how many
policies they hold. Files marked Death, File Closed, Not Proceeded With,
Declined or Matured are skipped.

---

## The journey a client experiences

```
  You click "Send invitations"
        │
        ├─ 1. A personal letter from you lands in their inbox.
        │     "The agent servicing your policy is no longer active with us."
        │     Their policies are listed. One button.
        │
        ├─ 2. They open their private portal, see their own portfolio,
        │     and answer six short questions (90 seconds).
        │
        ├─ 3a. INSTANT — they get a recap email of everything they said,
        │      plus your 3-day / 1-day promise.
        │  3b. INSTANT — Sales Support gets the full answers, their portfolio,
        │      and a read on the client (churn risk, priority, suggested
        │      speciality) with "appoint someone" as the call to action.
        │
        ├─ 4. You type a name into the "Appointed Agent" column
        │     (or use the dashboard). That single act sends:
        │       • the client → "meet your new agent", with the agent's photo,
        │         speciality and profile. Agent is CC'd.
        │       • the agent → a full brief: what the client said, what the old
        │         agent did, the portfolio, and a 1-working-day deadline.
        │
        ├─ 5. The agent files a first-contact report on the dashboard.
        │     You get emailed the outcome.
        │
        └─ 6. Anything that slips gets chased automatically:
              • responded 3+ days ago, still no agent → you get an OVERDUE list
              • agent appointed but hasn't called → the agent gets a reminder
              • still nothing after 3 days → ESCALATION email to you
```

The client can reopen their link at any time to watch the progress tracker move.

---

## Part 1 — Install the script (10 minutes)

This is a **standalone** script, deliberately *not* attached to the spreadsheet,
so it cannot collide with whatever is already running on Branch Portfolio.

1. Go to [script.google.com](https://script.google.com) → **New project**.
2. Name it `Agent Reassignment`.
3. Delete the placeholder code and paste all of
   [`apps-script/AgentAssign.gs`](apps-script/AgentAssign.gs).
4. Edit `CONFIG` at the top:
   - `SPREADSHEET_ID` — already set to your Branch Portfolio sheet. Only change
     it if you move to a different workbook.
   - **`SALES_SUPPORT_EMAIL`** — ⚠️ currently empty. Until you set it, every
     client submission goes to you instead of the support team.
   - Check `MANAGER_YEARS: 35` reads the way you want it to in the letter.
   - Leave `TEST_MODE: true` for now.
5. **Run → `setup`**, and approve the permissions Google asks for (it needs to
   read the sheet and send email as you).
   This creates the `Reassign`, `Reassign Responses`, `Agent Profiles` and
   `Reassign Log` tabs, builds the queue, and installs the triggers.
6. Check the execution log. It will tell you how many orphaned clients it found,
   and warn you about anything still unset.

### Then look at what it found

These four change nothing and send nothing — run them and read the log:

- **`listTabs`** — confirms the script is pointed at the right tab.
  `CONFIG.PORTFOLIO_SHEET` is set to `Export`; this proves it found ~20,000 rows
  there and not a smaller working copy that shares the same headers.
- **`reportInactiveAgents`** — the full-book analysis: every inactive agent,
  orphaned client count, email vs phone-only split, and premium at risk.
- **`listInactiveAgents`** — all 59 inactive agents with their holdings, so you
  can decide which are genuinely departed and which are broker channels to add
  to `CONFIG.EXCLUDE_AGENTS`.
- **`exportCallList`** — builds the phone-only call list. **This is where most
  of your orphaned clients are**, so don't skip it.

---

## Part 2 — 🔒 Fix the access codes (do this before anyone signs in)

The `Users` tab currently uses **sequential numbers as passwords** — `1`, `2`,
`3`, and so on. Yours is `1`.

The dashboard shows client names, phone numbers, email addresses and premiums.
A code of `1` is not a password; anyone who finds the page is one keystroke from
the whole branch pipeline.

The script refuses any code shorter than 8 characters, so **nobody can sign in
until this is done**. Fix it in one step:

> **Run → `rotateAccessCodes`**

It replaces every weak password with a strong random code (no look-alike
characters), writes it back to the `Users` tab, and emails each person their own
new code. Codes that are already strong are left alone.

---

## Part 3 — Publish the pages (5 minutes)

1. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy, and copy the URL ending in `/exec`.
2. Paste that URL into `CONFIG.API_URL` in **both**:
   - [`assign/index.html`](assign/index.html) — the client portal
   - [`assign/agent.html`](assign/agent.html) — the staff dashboard
3. Commit and push. Netlify redeploys automatically.

Your pages are then live at:

| Page | Who it's for |
| --- | --- |
| `rickyrampersadbranch.com/assign/` | clients (access-code sign-in) |
| `rickyrampersadbranch.com/a/<token>` | a client's personal link |
| `rickyrampersadbranch.com/assign/agent.html` | agents and you |

> **A dedicated domain.** You mentioned something like `donthaveanagent.com`.
> The registrar lookup was rate-limited when this was built, so nothing has been
> reserved. When you pick one, point it at the same Netlify site and change the
> two `PORTAL_BASE` / `AGENT_PORTAL` lines in `CONFIG` — nothing else moves.

---

## Part 4 — Rehearse it, then go live

**Rehearse (nothing reaches a client):**

- Run **`previewAllEmails`** — sends you all five emails in the journey, each
  with a yellow TEST MODE banner showing who it *would* have gone to.
- Sign in to the dashboard with your new access code and click through both tabs.
- Open any `Portal Link` from the `Reassign` tab and submit the form as if you
  were the client. Watch the recap and the support brief arrive.

**Go live** when you're happy:

1. Set `TEST_MODE: false` in the script and save.
2. Fill in `SALES_SUPPORT_EMAIL`.
3. Edit the `Agent Profiles` tab — speciality, a two-line profile, a photo URL
   and a direct line for each agent. **This is what the client sees when they
   are introduced to their new agent**, so it's worth twenty minutes.
4. Run **`sendInvitations(3)`** — three real clients, nothing more. Watch what
   comes back before you open the tap.

### Then work through the book in batches

With a book this size you are not going to email everyone at once, and you
shouldn't want to — every reply needs an agent appointed within three days, and
that promise is only worth making if you can keep it.

Plain `sendInvitations()` sends at most `MAX_INVITES_PER_RUN` (60), stops if your
Gmail quota is running low, and resumes exactly where it left off next time.
Send a batch, appoint the agents for whoever replies, then send the next batch.
Raise or lower the 60 in `CONFIG` to match what the branch can actually service.

If you want it to tick over on its own, set `AUTO_INVITE: true` and the daily
8am job will release a batch each morning. Leave it off until you've watched a
few batches land.

---

## Running it day to day

Everything is on the dashboard — you don't have to touch the sheet.

**As Branch Manager** (`Whole branch` tab): the pipeline funnel, every orphaned
client, and an *Appoint agent* dropdown against each one. Choosing a name sends
both emails immediately. There's also a **Re-scan portfolio** button for when
someone new leaves.

**As an agent** (`My clients` tab): only their own appointed clients — with the
client's answers, the read on them, their portfolio, and the first-contact
report form.

If you prefer the sheet, typing a name into the **Appointed Agent** column on
the `Reassign` tab does exactly the same thing.

### The tabs it creates

| Tab | What's in it |
| --- | --- |
| `Reassign` | one row per orphaned client — the spine of the whole programme |
| `Reassign Responses` | every form submission, raw |
| `Agent Profiles` | speciality / bio / photo per agent — **edit this** |
| `Reassign Log` | every email and action, timestamped |

---

## The questions, and why each one is there

| # | Question | What it tells you |
| --- | --- | --- |
| 1 | Who should handle your policy from here? | The decision itself — in-house, a personal agent, or your recommendation |
| 2 | What did your previous agent actually *do* for you? | The service standard they're used to. "Never heard from them again" and "not sure who my agent was" are churn flags |
| 3 | What matters most over the next 12 months? | Drives which agent's speciality to match them with |
| 4 | How confident do you feel about your cover? (1–5) | The emotional read. 1–2 means call them first |
| 5 | How and when should we reach you? | The agent works around them, not the reverse |
| 6 | Anything your new agent should know? | Free text — usually the most useful box on the page |

Answers 2, 3 and 4 are combined into a **read on the client** — churn risk,
priority, and a suggested speciality — which appears in the Sales Support email,
the agent's brief, and on the dashboard. That is the difference between a form
and actual intelligence.

---

## Safety notes

- **`TEST_MODE: true` is the default.** Every email is redirected to you with a
  banner naming the real recipient. Nothing reaches a client until you change it.
- **No client data is in this repository.** Names, addresses, phone numbers and
  premiums stay in the Google Sheet and are only ever served to a client holding
  their own token. Please keep it that way — a previous commit had to remove a
  client schedule from the public repo.
- **Tokens are 16-character random strings**, one per client, and the portal
  pages are `noindex` with `Referrer-Policy: no-referrer` so a token can't leak
  through a link.
- **Automatic invitations are OFF** (`AUTO_INVITE: false`). Invitations only go
  out when you ask for them. The daily job still runs the chasers and
  escalations.

## Still to plug in

- [ ] `SALES_SUPPORT_EMAIL` in `AgentAssign.gs`
- [ ] The `/exec` URL into `CONFIG.API_URL` in both HTML pages
- [ ] Run `rotateAccessCodes` before anyone signs in
- [ ] Fill in the `Agent Profiles` tab (speciality, bio, photo)
- [ ] Decide on the dedicated domain, if you want one
- [ ] Set `TEST_MODE: false` when you're ready to go live
