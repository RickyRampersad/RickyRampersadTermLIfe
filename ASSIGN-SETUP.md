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

Running the detection against the **Branch Portfolio** sheet as it stands today:

| | |
| --- | --- |
| People on the active roster (`Users` tab) | **37** |
| Distinct servicing agents named on policies | **32** |
| **Agents no longer active** | **10** |
| **Orphaned clients** (their agent is gone) | **17** |
| Policies attached to them | **28** |

The departed/unrecognised agents, biggest first: Agentsatlange Trinidad,
Carlton Aloy Wong, Kevin Ragoo, Christalene Beharry, Alm Insurance Services
Limited, Lulliana Ragunan, Ignatius And Company Limited, Sherwin Mohammed,
Angela Joseph, Robin Baljohn.

⚠️ **That count is from a partial export.** Google's reader capped the download at
about 100 policy rows, so treat those numbers as a working sample, not the full
book. The script re-runs the same analysis **live against every row in the sheet**
— run `reportInactiveAgents()` (below) to see the real totals.

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

Run **`reportInactiveAgents`** and open the log. This changes nothing and sends
nothing — it just prints the real, full-book analysis: every inactive agent,
how many policies each is holding, and the total orphaned client count.

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
4. Run `sendInvitations` — or better, run `sendInvitations(3)` first and send to
   just three people before opening the tap.

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
