# Insurance Renewal Portal — Setup Guide

A complete renewal system for your motor & home book:

- **Client portal** (`/renewal/` on your Netlify site) — each client opens a personal
  link, sees their own policies, learns about their cover and the **average clause**
  (with a live calculator), sees current campaigns, and sends renewal instructions
  in two minutes.
- **Manual send from the sheet (default mode)** — a **"📋 Renewals" menu** inside the
  Google Sheet. Highlight any client row(s) → *Send renewal email* → done. Works even
  when the renewal date has already passed (the email wording adapts for overdue
  renewals). There's also a one-click *"Send to everyone due in the next 14 days"*.
- **Response handling** — submissions are logged to a `Responses` tab, the client gets
  an instant acknowledgment, and **renewal instructions email Guardian** (CC you).
- **Optional automation (OFF by default)** — when you're ready, one menu click turns
  on automatic 14-day reminders with a 7-day follow-up; another click turns it off.

Everything runs on free tiers: Netlify (hosting) + Google Apps Script (emails/API).
No servers, no monthly cost.

---

## Part 1 — Publish the site on Netlify (5 minutes)

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import an
   existing project** → pick GitHub → choose this repository.
2. Leave build settings empty (it's a static site) and deploy.
3. Note your site URL, e.g. `https://rickyrampersad-renewals.netlify.app`.
   (You can rename it under **Site settings → Change site name**.)

Your portal is now live at `https://YOUR-SITE.netlify.app/renewal/` (in preview mode
with sample data until Part 2 is done).

## Part 2 — Install the automation in your Google Sheet (10 minutes)

1. Open the **Motor Renewal Book — Schedule** spreadsheet.
2. **Extensions → Apps Script**, delete any placeholder code, and paste the full
   contents of [`apps-script/Code.gs`](apps-script/Code.gs).
3. At the top of the script, edit `CONFIG`:
   - `PORTAL_BASE` → `https://YOUR-SITE.netlify.app/r/` (your real Netlify name)
   - `GUARDIAN_RENEWALS_EMAIL` is already set to
     `GuardianGeneralRenewals@myguardiangroup.com` — every instruction email goes
     there with you CC'd.
   - Check `AGENT_EMAIL` / `AGENT_PHONE` are correct.
4. Click **Run → setup** once. Approve the permissions when Google asks
   (it needs to read the sheet and send email as you).
   This creates the `Responses` tab, fills the `Token` + `Portal Link` columns,
   and adds the **📋 Renewals menu** to the sheet (reopen the sheet to see it).
   No automatic emails are scheduled — you're in manual mode.
5. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click Deploy and copy the URL ending in `/exec`.

## Part 3 — Connect the portal to the sheet (1 minute)

1. Open [`renewal/index.html`](renewal/index.html) and find `CONFIG` near the bottom.
2. Paste the `/exec` URL into `API_URL`:
   ```js
   API_URL: "https://script.google.com/macros/s/XXXXXXXX/exec",
   ```
3. Commit/push (or edit directly on GitHub) — Netlify redeploys automatically.

**Test it:** take any value from the `Token` column of the sheet and open
`https://YOUR-SITE.netlify.app/r/THAT-TOKEN` — you should see that client's real
policies. Then submit the form and confirm the emails arrive. You can also run
`testReminderEmail` in Apps Script to preview the reminder design in your own inbox.

---

## How the flow works day-to-day (manual mode)

```
You highlight a row ──► 📋 Renewals → "Send renewal email — selected row(s)"
        │                (a confirmation shows exactly who gets emailed;
        │                 overdue clients get "let's renew right away" wording)
        │
        ├── client clicks ──► portal shows their policies, cover explainers,
        │                     average-clause calculator, campaigns
        │
        └── client submits ──► • logged in "Responses" tab
                               • Renewal Status updated on the sheet
                               • instant acknowledgment email to the client
                               • RENEWAL INSTRUCTIONS email to Guardian (CC you)
```

The 📋 Renewals menu also has:
- **Send to everyone due in the next 14 days** — one-click batch for clients with an
  email and no Renewal Status yet (with a confirmation before anything sends)
- **Refresh days left & portal links** — updates the sheet, sends nothing
- **Preview the email** — sends a sample to your own inbox
- **Turn automatic reminders ON / OFF** — flip to full automation whenever you're
  ready; flip back any time

`Renewal Status` shows exactly where each client is (`Invitation sent manually…`,
`Responded… — Renew as-is`, etc.), and rows without an email address are always
skipped with a warning — those clients you call as usual.

## Managing campaigns

Campaign cards (and the opt-in checkboxes on the form) live in `CONFIG.CAMPAIGNS`
inside `renewal/index.html`. Add/remove entries — each has an emoji icon, a title,
and a short pitch. Client interest arrives in the Responses tab and in every
instruction email.

## Property (home & commercial) renewals

Property lives in the **same schedule tab** as motor — a client with motor and home
gets **one link showing both** (tokens are shared per client account name).

1. Open [`data/property-schedule.csv`](data/property-schedule.csv) — 44 property
   risks exported from Salesforce, with the same columns as your schedule (plus
   `Risk Location` and `SF Last Renewal` at the end for reference).
2. In the sheet: **File → Import → Upload → Append to current sheet** (with the
   schedule tab open), or copy-paste the rows below your motor rows.
3. Run **📋 Renewals → Refresh days left & portal links** — property rows get
   tokens automatically, matching existing motor tokens where the client account
   name is identical.

⚠️ Renewal dates that had already passed were **rolled forward one year** (the
original Salesforce date is in the `SF Last Renewal` column) — please sanity-check
them, and note most property rows have no email yet (16 of 44 were matched from
your motor book).

## Corporate fleet portal (RPM, NU-IRON, …)

Corporate clients with multiple vehicles sign in at
`https://YOUR-SITE.netlify.app/renewal/corporate.html` with their **company access
code** — the same token as their schedule rows. They see every vehicle (reg, make,
model, status, premium), renewal history by cycle, upcoming renewals, balances,
a print/PDF button, and a fleet instruction form that flows to Guardian like
everything else.

1. In the Google Sheet, create a tab named exactly **`Fleet`**.
2. Import [`data/fleet-register.csv`](data/fleet-register.csv) into it
   (File → Import → Upload → Insert new sheet, then rename to `Fleet`) — 400 rows
   covering RPM Technical Services, RPM Express Couriers and NU-IRON, including
   multi-year history from Salesforce.
3. Paste the Apps Script `/exec` URL into `renewal/corporate.html`'s `CONFIG.API_URL`
   (same URL as `index.html`).
4. Their access codes are in the schedule's Token column — e.g. give RPM and
   NU-IRON their codes by email or phone.

Keeping it current: when the fleet changes, just edit the `Fleet` tab — add a row
per vehicle per renewal cycle. The portal groups history by renewal date
automatically.

## Adding new clients / policies

Just add a row to the sheet as you do now. The next daily run (or running
`fillTokensAndLinks` manually) assigns a token and portal link automatically —
same client account name = same link across all their policies.

## Still to plug in

- [x] **Guardian renewals email address** — set to `GuardianGeneralRenewals@myguardiangroup.com`
- [ ] **Your Netlify site name** → `PORTAL_BASE` in `Code.gs`
- [ ] **Apps Script `/exec` URL** → `API_URL` in `renewal/index.html`
- [ ] Optional: motor policy wording PDFs (upload them and we'll link them from the
      "Know Your Cover" section so clients can read their actual policy)
- [ ] Optional: exact campaign details/terms to replace the starter campaigns
