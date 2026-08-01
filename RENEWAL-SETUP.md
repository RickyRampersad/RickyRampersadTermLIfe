# Insurance Renewal Portal — Setup Guide

A complete renewal system for your motor & home book:

- **Client portal** (`/renewal/` on your Netlify site) — each client opens a personal
  link, sees their own policies, learns about their cover and the **average clause**
  (with a live calculator), sees current campaigns, and sends renewal instructions
  in two minutes.
- **Automation** (Google Apps Script inside your "Motor Renewal Book — Schedule"
  sheet) — emails every client **14 days** before their `Next Due` date (follow-up at
  **7 days** if no reply), records responses in a `Responses` tab, sends the client an
  instant acknowledgment, and emails **renewal instructions to Guardian** (CC you).

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
   - `GUARDIAN_RENEWALS_EMAIL` → the Guardian renewals address **(send it to me and
     I'll wire it in — until it's set, instruction emails go to you only, so nothing
     is ever lost)**
   - Check `AGENT_EMAIL` / `AGENT_PHONE` are correct.
4. Click **Run → setup** once. Approve the permissions when Google asks
   (it needs to read the sheet and send email as you).
   This creates the daily 8 a.m. trigger, the `Responses` tab, and fills the
   `Token` + `Portal Link` columns for every row.
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

## How the flow works day-to-day

```
14 days before Next Due ──► client gets a branded reminder email with their personal link
        │
        ├── client clicks ──► portal shows their policies, cover explainers,
        │                     average-clause calculator, campaigns
        │
        ├── client submits ──► • logged in "Responses" tab
        │                      • Renewal Status updated on the sheet
        │                      • instant acknowledgment email to the client
        │                      • RENEWAL INSTRUCTIONS email to Guardian (CC you)
        │
        └── no response by 7 days before ──► automatic follow-up email
```

The sheet stays the single source of truth: `Days Left` is recalculated daily, and
`Renewal Status` shows exactly where each client is (`Reminder sent…`, `Follow-up…`,
`Responded… — Renew as-is`, etc.). Rows without an email address are skipped —
those clients you call as usual.

## Managing campaigns

Campaign cards (and the opt-in checkboxes on the form) live in `CONFIG.CAMPAIGNS`
inside `renewal/index.html`. Add/remove entries — each has an emoji icon, a title,
and a short pitch. Client interest arrives in the Responses tab and in every
instruction email.

## Adding new clients / policies

Just add a row to the sheet as you do now. The next daily run (or running
`fillTokensAndLinks` manually) assigns a token and portal link automatically —
same client account name = same link across all their policies.

## Still to plug in

- [ ] **Guardian renewals email address** → `GUARDIAN_RENEWALS_EMAIL` in `Code.gs`
- [ ] **Your Netlify site name** → `PORTAL_BASE` in `Code.gs`
- [ ] **Apps Script `/exec` URL** → `API_URL` in `renewal/index.html`
- [ ] Optional: motor policy wording PDFs (upload them and we'll link them from the
      "Know Your Cover" section so clients can read their actual policy)
- [ ] Optional: exact campaign details/terms to replace the starter campaigns
