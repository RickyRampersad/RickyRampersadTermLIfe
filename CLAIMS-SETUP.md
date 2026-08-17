# Claims TT — Setup Guide

The custom claims intake for **claimstt.com**, replacing the Jotform hand-off.

A client picks their claim type, answers only the questions that apply to it,
photographs their documents with their phone, and submits. What comes out the
other end:

- a **claim reference** they can quote and track,
- a **Google Drive folder** per claim holding every document,
- a **row on the Claims tab** of a private Google Sheet,
- a rendered **claim form PDF** filed with the documents and attached to the
  desk email,
- an email to the **claims desk for that line of business**, CC'd to **sales
  support** and to you,
- a **thank-you and acknowledgement** to the client listing what arrived and
  what is still outstanding,
- **passwordless sign-in**: clients see all their claims and upload
  outstanding documents directly; staff get a full dashboard at
  `/claims/staff.html`,
- **automatic follow-up** that chases the client for missing documents and
  nudges the desk on stalled claims, and stops the moment the claim closes.

Everything runs on free tiers: Netlify (hosting) + Google Apps Script
(storage, email, PDF). No servers, no monthly cost.

---

## ⚠️ Read this first — how this site is actually published

**The live site is GitHub Pages, serving this public repository's root.**
(`server: GitHub.com` on rickyrampersadbranch.com — verified.) That has two
consequences that shape everything below:

1. **Anything committed here is public twice over** — once on the website and
   once through GitHub itself (`raw.githubusercontent.com`). There is no
   server-side blocking on GitHub Pages: `netlify.toml` does nothing unless
   hosting moves to Netlify. The only protection is never committing client
   data, which is why `data/*.csv` is now gitignored.

2. **Git history is public too.** The client data files that used to live in
   `data/` were removed from the current tree, but the commits that carried
   them (`b3b8771`, `8f51b58`) remain reachable — a raw URL at those commit
   ids still serves the files today. Removing them for real means a history
   rewrite (`git filter-repo` + force push, then a GitHub support request to
   drop cached views), **or** making the repository private — which is
   instant, but GitHub Pages on a free personal plan requires a public repo,
   so the site would go down until hosting moves (Netlify imports private
   repos free, and this repo already carries a working `netlify.toml`).
   One of the two should happen; which one is your call.

3. **Rotate the staff key.** `apps-script/Code.gs` is served on the public
   site and previously contained the live `STAFF_KEY` for the renewals staff
   dashboard. Treat that key as burned: open the Apps Script copy of Code.gs
   and set a fresh long private value. The repo copy now holds a placeholder.

Nothing under `data/` is ever read by the website at runtime — the claims
lookup goes to Apps Script, which reads the private spreadsheet.

---

## Part 1 — Publish the site (nothing to do)

The claims site is `claims/index.html`, a static page. GitHub Pages already
serves this repository, so the moment this lands on `main` it is live at:

```
https://rickyrampersadbranch.com/claims/
```

Deep links pre-select the claim type — this is what to put in an SMS to a
client who has just called about an accident:

| Link | Opens |
| --- | --- |
| `/claims/?type=motor` | motor claim |
| `/claims/?type=motor&sub=theft` | motor, vehicle stolen |
| `/claims/?type=health` | health claim |
| `/claims/#track` | claim tracking |

(The prettier `/claim/motor` short links in `netlify.toml` only work if
hosting moves to Netlify — GitHub Pages cannot do redirects.)

### Pointing claimstt.com at it

`claimstt.com` is currently a GoDaddy placeholder. Two options:

- **Stay on GitHub Pages:** GoDaddy DNS → CNAME `claimstt.com` (and `www`) to
  `rickyrampersad.github.io`. But note a GitHub Pages site takes **one**
  custom domain, and this one already uses rickyrampersadbranch.com — so
  claimstt.com would redirect there rather than stand alone.
- **Move hosting to Netlify** (free, imports this repo directly): both
  domains can then point at the same site, the `netlify.toml` short links
  and `/data/*` blocking come alive, and the repo could go private without
  taking the site down. This is the better end state.

Until then everything works at `rickyrampersadbranch.com/claims/`.

---

## Part 2 — The Apps Script backend (10 minutes)

Claims runs in **its own Google Sheet and its own Apps Script project** — an
Apps Script project may only have one `doGet` and one `doPost`, and `Code.gs`
(renewals) and `Market.gs` (trading league) already use theirs.

1. Create a new Google Sheet named **Claims TT**.
2. **Extensions → Apps Script**, delete the placeholder, paste all of
   [`apps-script/Claims.gs`](apps-script/Claims.gs).
3. Edit the `CLAIMS` config at the top:
   - `DESK` — the claims address for each line of business. **Check these
     before going live**; the health, life and pension addresses are best
     guesses and the motor/property one is the general claims desk.
   - `MAIL_CC` — already set to you, sales support and the branch inbox.
   - `SITE_KEY` — change it, and change it to match in `claims/index.html`.
4. **Run → setupClaims**, and approve the permissions (Sheets, Drive, Gmail).
   This creates the tabs, the Drive folder, and installs the daily follow-up.
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy, and copy the URL ending in `/exec`.

## Part 3 — Connect the site (1 minute)

Open [`claims/index.html`](claims/index.html), find `CONFIG` near the bottom of
the file, and set both values:

```js
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/XXXXXXXX/exec",
  SITE_KEY: "claims-tt-2026-rrb",   // must equal CLAIMS.SITE_KEY in Claims.gs
  ...
```

Commit and push — Netlify redeploys automatically. The orange "Preview mode"
banner disappears once `API_URL` is set; that is how you know it is live.

**Test it safely:** in the sheet, **Claims TT menu → 🧪 Turn test mode ON**
— every email (desk, client, chase, sign-in codes) is then rerouted to your
own inbox with a `[TEST]` banner naming the real recipients, so nothing can
reach a client or Guardian while you experiment. File a claim against
yourself with a photo attached: you should get the acknowledgement with the
PDF and the desk email with the Drive folder link, both marked `[TEST]`.
Turn test mode OFF from the same menu when you go live.

---

## Part 4 — Switch on policy prefill

This is the part that removes most of the pain. A claimant types their number
plate; the vehicle, chassis number, engine number, policy number, cover type
and their own contact details fill themselves in.

### Build the register

The Salesforce export is **not kept in this repository** (client data, public
repo). Put your local copy at `data/risk-details.csv` — the path is
gitignored — then:

```bash
python3 data/build-vehicle-register.py
```

It writes `data/vehicle-register.csv` (also gitignored — import it, then
delete it). Output from the August 2026 export:

```
495 risk rows  ->  429 distinct vehicles
quarantined: 24 rows whose registration is not a registration

  Policy #      87%     Chassis #   64%
  Make          80%     Engine #    60%
  Model         84%     Email       33%
  Year          95%     Mobile      37%

  full prefill (make + model + chassis)   58%
  usable prefill (make + model)           78%
  639 lookup keys (plate + policy number)
```

Risk Details holds one row per vehicle *per policy year*, each carrying a
different fragment of the truth. The script merges them, which is what lifts
chassis coverage — a number recorded once in 2019 and never again comes back
into the current record. It also folds `PDJ-3899` and `PDJ 3899` into one
vehicle, which is where 66 of the duplicate records went.

### Import it

In the **Claims TT** sheet, open the `Vehicle Register` tab, then
**File → Import → Upload → `data/vehicle-register.csv` → Replace current sheet**.
Prefill is live immediately; no redeploy needed.

Re-run the script and re-import whenever you refresh the Salesforce export.

### How the privacy split works

A number plate is public — anyone can read one off a bumper. So the lookup is
deliberately two-stage:

1. **`findPolicy`** returns only what is visible from the pavement anyway:
   *"2025 Toyota RAV 4 — Private Comprehensive. Is that your vehicle?"*
   No name, no email, no phone, no policy number.
2. **`verifyPolicy`** asks for the last four digits of the mobile on file, or
   the policy number. Only a correct answer returns the record.

Five wrong answers on the same plate inside fifteen minutes and it stops
responding.

Without that split, typing a stranger's plate would return their name, home
email and phone number. Note that only **37% of vehicles have a mobile on
file** and **87% have a policy number** — so most clients verify with their
policy number. Every client can skip the lookup entirely and type their
details in; prefill is a convenience, never a gate.

### The quarantine list

The script also writes `data/vehicle-register-quarantine.csv` (locally, not
committed): 24 rows whose "Vehicle Reg" field does not hold a registration —
chassis numbers, a make, placeholders like `TBA`. Those clients cannot be
found by plate until the Salesforce records are corrected. The file lists
each one with the client name and policy number so they can be fixed at
source.

---

## What the client sees

```
1. Type        motor / health / property / life / pension
                 ↓ then the sub-type, which decides the whole checklist
2. Details     only the questions that apply — with the policy lookup on top
3. Documents   a checklist per sub-type, drag-drop or phone camera,
                 photos compressed in the browser before upload,
                 "I don't have this yet" on anything they cannot produce
4. About you   contact details and (optionally) settlement bank details
5. Review      everything laid out as an assessor reads it, plus three
                 declarations that must be ticked
                 ↓
   Reference   CLM-2608-4821, printable, trackable
```

Two details worth knowing:

**Deferring a document is a first-class action.** Waiting until you have every
paper is the single biggest cause of a slow claim, so the form actively invites
filing without the police report and records what is outstanding.

**Photos are compressed in the browser** — longest edge 1800px, JPEG q0.75 —
before they leave the phone. A claim with ten 6MB photos becomes a few hundred
KB, which is the difference between an upload that works on mobile data and one
that times out. Files upload in 1.5MB chunks and are reassembled server-side,
and one bad file never sinks the whole claim.

**If the backend is unreachable**, the page opens a pre-addressed email
containing the entire claim and a list of the documents to attach. Nothing is
ever lost to a dropped connection.

---

## Logins — how sign-in works with no passwords

Nobody in this system has a password. Signing in means: give us your email
(clients may also use their mobile number), we email a **6-digit code**, you
type it back. Codes last 10 minutes, allow 5 attempts, and at most 3 are sent
per hour per person — so there is nothing to forget, reset, phish, or leak.

**Clients** sign in on the claims page under *Your claims*. They see every
claim they have (matched by the email or mobile on their claims), its status
on a progress line, what is still outstanding — and an **Upload now** button
beside each outstanding document that puts the file straight into the claim's
Drive folder, marks it received, and logs it. When the last outstanding
document arrives, a claim waiting on documents moves itself back to *Under
review*. Sessions last 30 days on that device. Clients with no email on file
can't receive codes — for them the **quick check** (reference + last 4 mobile
digits) still works, so nobody is locked out.

**Staff** sign in at `/claims/staff.html` — but only emails listed on the
**`Staff` tab** of the Claims TT sheet (`Email, Name, Role, Active`) with
`Active=Y` ever receive a code. `setupClaims` seeds you as `Admin`; add each
team member as a row. Removing someone = set Active to `N` (their next
sign-in fails; their current session dies within 12 hours). The dashboard
gives them the pipeline (counts by status), search, and per-claim: full
detail, the documents with Drive links, editing what's outstanding, a
one-click chase email, status changes (optionally emailing the client),
assignment, and internal notes the client never sees. **Every staff action is
written to the Claim Log with the staff member's name** — that's the
accountability trail.

**You** are simply staff with the `Admin` role — and you keep the Google
Sheet itself as the master console for anything the dashboard doesn't cover.

Uploads are locked accordingly: during filing the browser holds a one-time
upload key, and after filing only a signed-in owner of the claim, or staff,
can add files. A guessed claim reference alone can do nothing.

## Day-to-day: the Claims TT menu

| Menu item | What it does |
| --- | --- |
| Set up / repair everything | Rebuilds tabs, folder and triggers. Safe to re-run. |
| Open the claims Drive folder | Where every document lives |
| Email the client their new status | Change `Status` on the row, then run this |
| Chase outstanding documents now | Manual chase for the selected row(s) |
| Run the follow-up sweep now (test) | Runs the daily automation immediately |
| Clean up abandoned uploads | Sweeps parts from uploads that were interrupted |

### The tabs

**`Claims`** — one row per claim. `Status` is a dropdown; changing it is what
drives everything else. `Missing Documents` is what the automation chases.

**`Claim Files`** — one row per uploaded document, with its Drive link.

**`Claim Log`** — the audit trail. Every submission, every automatic email,
every failure.

**`Vehicle Register`** — the prefill source. Nothing writes to it but you.

### The automatic follow-up

Runs daily at ~9am.

- **Chasing the client** at 3, 7, 14, 21 and 30 days while anything is
  outstanding. One email per claim per day, never a burst. The last one says
  it is the last and hands over to a phone call.
- **Nudging the desk** at 10, 25 and 45 days without movement on an open claim,
  with the folder link and whether the hold-up is the client or us.
- **It stops** the moment `Status` becomes `Settled`, `Declined` or `Closed`.

Cadences are `CHASE_DAYS` and `DESK_NUDGE_DAYS` in the config.

---

## The claim form PDF

Every claim renders one: the answers laid out as a form on branded paper, saved
into the claim's Drive folder and attached to both the desk email and the
client's acknowledgement. It carries the declaration the client accepted
online, so nothing needs printing or signing.

### Filling Guardian's own AcroForm instead

`Claim Form Motor.pdf` is a real fillable AcroForm with 154 named fields
(`INSUREDNAME`, `ACCIDENTDATE`, `TPDREGNOINSUR1`, …). Pushing values into
those named fields — rather than rendering our own layout — is the better
long-run answer for the motor desk, and it has already been proven to work.

Apps Script cannot manipulate AcroForms natively, so that step needs one small
service alongside this one (a Netlify or Cloud Function running `pdf-lib` or
`pypdf`, called from `saveClaimForm_` with the claim JSON, returning the filled
PDF). The renderer in `Claims.gs` is what runs today and is what keeps the desk
working from day one.

Two defects in that template need fixing once, whichever route is taken:

- the page `/Annots` arrays were stripped, so an ordinary PDF reader shows a
  blank form even though the fields are present;
- six third-party fields are anchored to page one instead of page two, which
  collides text at *Registration No.* and *Sum Insured*.

The other three forms (Living Benefit, Newlife Living Benefits, and the
Guardian General property peril form) have **no form fields at all** — two are
pure scans with no text layer. Each needs its field boxes mapped by hand once,
roughly half a day per form.

---

## Adding a claim type

Everything the site asks is data, in `claims/index.html`:

```js
TYPES.pension = {
  label: "Pension / Annuity", icon: "📈",
  blurb: "...",
  subtypes: [{ id: "maturity", label: "Plan reaching maturity" }, ...],
  fields:   [{ id: "planNumber", label: "Plan number", type: "text", half: true }, ...],
  docs:     [{ id: "birthcert", label: "Birth certificate", req: ["maturity"] }, ...],
};
```

- `req` and `show` take `true`, `false`, or a **list of sub-type ids** — that
  is how the same type asks for a police report on a theft but not on a
  windscreen chip.
- Any field with no dedicated column on the sheet is folded neatly into the
  description, so the backend schema never has to change.

Add the matching entry to `CLAIM_TYPES` and `DESK` in `Claims.gs` and it is
done.

---

## Still to plug in

- [ ] **Apps Script `/exec` URL** → `CONFIG.API_URL` in `claims/index.html`
- [ ] **`SITE_KEY`** changed from the default, in both files
- [ ] **Claims desk addresses** confirmed for health, life and pension
- [ ] **Staff emails** added to the `Staff` tab (Active=Y) so the team can
      sign in at `/claims/staff.html`
- [ ] **Vehicle register** imported into the `Vehicle Register` tab (the CSV
      was delivered privately in the Claude session; or rebuild it locally)
- [ ] **Rotate `STAFF_KEY`** in the Apps Script copy of `Code.gs` — the old
      value was published on the public site
- [ ] **Git history**: purge the client-data commits, or make the repo
      private and move hosting to Netlify — see *Read this first*
- [ ] **claimstt.com DNS** repointed from the GoDaddy placeholder
- [ ] **Guardian compliance sign-off** before the site takes live client data

That last one is not a formality. The system holds names, addresses, policy
numbers, medical detail, bank particulars and ID documents — that carries real
obligations under Trinidad & Tobago's Data Protection Act, and the answers to
"where is it stored, who can see it, how long is it kept" should be Guardian's,
not ours. Worth starting that conversation now rather than after launch.
