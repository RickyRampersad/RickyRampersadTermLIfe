# Rampersad Private — Contracts

*Every contract, seen through.*

The contracting desk for **Ricky Rampersad Private** — the private practice,
separate from Guardian. Somebody answers each question once and the app
writes the answers into the partner's own PDFs — the real AcroForm fields,
not a look-alike — then sends the packet on, chases both sides until it is
done, and lets the applicant follow their own progress with a code.

**Nothing here is Guardian business.** The international carriers, the
property work and the financing all run through this desk on their own.
Everything an applicant or a partner sees carries the private brand and the
private email address (`CONFIG.RECRUITER_EMAIL`); the only Guardian address
anywhere is Kamla's, in `COPY_TO`, which is internal and never shown to
anyone outside. If you would rather it were not there at all, replace it with
a private address for her.

VUMI® is the line that has forms behind it today. The picker is grouped by
line of business so real estate and premium financing already have their
place; adding one means dropping in its PDFs, mapping the fields in
`packet.js`, and flipping `available` in the `CARRIERS` list.

It is its **own Netlify site**, on its own domain — separate from the branch
website. Build it with `./build-contracting.sh` and see DEPLOY.md.

Once deployed at, say, `vumi-contracting.netlify.app`:

| Page | URL |
|---|---|
| Sign in, then the application | `/` |
| Progress tracker | `/track` — or `/track/<code>` straight in |
| Your dashboard | `/admin` |

Everything below the "Works without a backend" line is optional. The wizard
fills and downloads all three PDFs with no server at all.

---

## What it produces

| Form | Pages | Fields filled |
|---|---|---|
| Solicitud de Productor/Agente | 11 | 267 |
| Formulario para Designación de Beneficiario | 1 | 80 |
| IRS Form W-8BEN (Rev. 7-2017) | 1 | 23 |

The applicant's drawn signature is stamped into every signature box, their
initials go on all 11 pages of the agreement, dates are split into the
per-character boxes the forms use, and the finished PDFs are flattened so
nothing can be altered after signing.

## Signing in

Everyone signs in with an **agent number and a passcode**, both kept in the
**Access** tab of the sheet.

| Who | Number | Sees |
|---|---|---|
| Ricky Rampersad | `RRP-001` | The pipeline, or an application to fill in |
| Kamla Dookran | `RRP-002` | The same — assistant has the same access |
| Each agent | `RRP-003`, `RRP-004`, … | Their own application |

`setupContracting()` creates the two staff logins with random passcodes and
shows them to you once. Change any passcode by typing over it in the Access
tab; set **Active** to `No` to switch a login off without deleting it.

Agents get their number and passcode two ways:

- **You invite them** from the dashboard — both details are in the invitation
  email, alongside the link.
- **They sign themselves up.** On the sign-in screen there is *I'm new
  here — get my agent number*: name, email and mobile, and they are issued a
  number and passcode on the spot, shown on screen and emailed. You get a
  notification and they appear in your pipeline at 0%, like anyone else.

Signing up approves nothing — it is a way into the paperwork, not into a
contract. If someone you do not know registers, set **Active** to `No` on
their row in the Access tab and they cannot sign in again.

Signing in as Ricky or Kamla also unlocks the dashboard, so nobody has to
know the admin key. It is handed to the browser only after a correct
passcode, and it is dropped when the tab closes.

**This is a shared-code login, not individual passwords.** Codes sit in the
sheet in plain text and anyone holding a number and passcode is that person
as far as the app is concerned. That is the right weight for an internal
recruiting tool; it is not the right weight for anything else.

## Choosing who the contract is with

After signing in, the applicant picks the partner, grouped by line of
business:

| Line | Partners |
|---|---|
| International Insurance | VUMI® Group · Best Doctors Insurance |
| Property | Real Estate |
| Finance | Premium Financing |

Only VUMI has forms behind it; the rest read *Coming soon*, which is honest
and shows an applicant what is on the way. To bring one live: put its PDFs in
`contracting/forms/`, map their fields in `packet.js`, and flip `available`
to `true` in the `CARRIERS` list — which lives in **both** `Contracting.gs`
and `contracting/app.js`, so change it in both.

## Works without a backend

Nothing to configure. Open the app, click straight past the sign-in, fill it
in, download the three completed PDFs and email them in. Progress is saved in
the applicant's own browser, so they can close the tab and come back to the
same device.

What you *don't* get: sign-in, cross-device resume, the recruiter dashboard,
and the automatic reminders. Those need the Apps Script backend below.

---

## Backend setup (30 minutes, once)

### 1. Create the Apps Script project

Contracting needs **its own** Apps Script project — the renewal script in
`apps-script/Code.gs` already defines `doGet`/`doPost` and only one can win.

1. Create a new Google Sheet, e.g. *Agent Contracting*.
2. **Extensions → Apps Script**.
3. Paste `apps-script/Contracting.gs` over the default `Code.gs`.

### 2. Fill in CONFIG

At the top of the script:

```js
RECRUITER_NAME:  'Ricky Rampersad',
RECRUITER_EMAIL: 'rampersadricky@gmail.com',   // the From on every letter
RECRUITER_PHONE: '(868) 678-5921',
BRAND_NAME:      'Ricky Rampersad Private',

CARRIER_NAME:    'Amalia Suraz',        // where finished packets go
CARRIER_EMAIL:   'contracts@woagp.com',
COPY_TO: [                              // internal copies, never shown outside
  'rampersadricky@gmail.com',
  'kamla.dookran@myguardiangroup.com',
],

// Your contracting site's address — whatever Netlify gave it, or your
// own domain. These build the links in every email the script sends.
PORTAL_BASE:     'https://vumi-contracting.netlify.app/?t=',
STATUS_BASE:     'https://vumi-contracting.netlify.app/status.html?c=',
ADMIN_KEY:       'pick-a-long-random-string',
```

**Change `ADMIN_KEY`.** Anyone holding it can read every applicant's data
through the dashboard.

### 3. Run setup and deploy

1. Run `setupContracting()` once and authorise the permissions it asks for
   (Sheets, Drive, Gmail, Triggers). It creates the *Contracting* tab, the
   *Access* tab with the two staff logins, the *VUMI Contracting* Drive
   folder and the daily reminder trigger. **Write down the passcodes it
   shows you** — they are also in the Access tab.

   Gmail access covers both sending and **reading**. The read scope is what
   lets the script notice that the carrier has answered — it looks only for
   the thread carrying that applicant's reference and never opens anything
   else. Decline it and everything still works; you just mark replies by
   hand on the dashboard.
2. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
3. Copy the `/exec` URL.

### 4. Point the site at it

Paste the same `/exec` URL into three places in `contracting/`:

- `app.js` → `CONFIG.API_URL`
- `admin.html` → `CONFIG.API_URL`
- `status.html` → `CONFIG.API_URL`

Then rebuild (`./build-contracting.sh`) and redeploy. Open `/admin`, enter
your admin key, and invite your first agent.

---

## Prefilling the agency's side

The applicant should never have to fill in your details. Set them once in
`contracting/app.js` → `CONFIG.AGENCY` and every packet comes out with them
already written in:

```js
AGENCY: {
  generalAgentName: 'Ricky Rampersad',
  generalAgentCode: 'VU-GA-0091',
  agentCode: '',                      // if VUMI has already assigned one
  effectiveText: '1 de septiembre de 2026',
  requiredProduction: '150,000',      // Anexo 1: annual production required
  requiredPersistency: '85',          // Anexo 1: minimum persistency %
  commissions: {                      // [first year, renewals] per plan
    absolute: ['20', '10'],
    universal: ['20', '10'],
    special:  ['18', '9'],
    access:   ['18', '9'],
    optimum:  ['20', '10'],
    direct:   ['15', '8'],
    senior:   ['15', '8'],
    prime:    ['18', '9'],
    termLife: ['40', '5'],
    travel:   '12',                   // first year and following
  },
},
```

Leave any value `''` and that box simply stays blank on the form. The VUMI®
representative's name, signature, date and the "PARA USO DE PERSONAL
AUTORIZADO" block are always left blank — the carrier fills those.

---

## Chasing the applicant

`dailyContractingCheck()` runs every morning and emails anyone who is not
finished. The email names the exact answers still missing, so nobody has to
guess what "incomplete" means.

- **Quiet period.** Someone who edited their application in the last
  2 days is left alone (`CONFIG.QUIET_DAYS`).
- **Widening spacing.** Reminders go out 2, 3, 4, 7, 7, 14, 14 and 21 days
  apart (`CONFIG.REMINDER_SPACING`) — attentive at first, then patient.
- **A hard stop.** After the last reminder the applicant is marked
  **Stalled**, the emails stop, and you get one message listing everyone who
  needs a phone call instead.
- **It stops on submission.** Submitting sets the status to *Submitted* and
  no further reminder is ever sent.

The wording adapts to where they are: not started, part-way (with the missing
list), or filled in but never sent.

**Every one of these is written down.** The invitation, each reminder, the
submission, each chase at the carrier, the approval — all of it lands on the
applicant's *Follow-up trail* on the dashboard, newest first, and in the
**Activity** column of the sheet. You never have to wonder whether the system
chased someone or how many times.

Turn the whole thing off from the sheet's **📝 Contracting** menu, or with
`disableContractingReminders()`.

---

## Day to day

**Invite someone** — sign in, then *Invite an agent* on your landing screen
or the button on the dashboard. It sends them a proper letter: what
contracting with VUMI® means, what the three forms involve, roughly fifteen
minutes, what to have on the table, their agent number and passcode, and a
button straight into the application. It is signed by whoever sent it, so an
invitation from Kamla says Kamla.

The same is on the sheet's **📝 Contracting → Invite an agent…** menu.

**Watch the pipeline** — the dashboard opens on *Needs attention*: everyone
not yet submitted, with their progress, how long they have been quiet, how
many reminders they have had, and what is still missing.

**Push a specific person** — *Nudge now* sends the reminder immediately
without disturbing the automatic schedule. *WhatsApp* and *Email* open a
pre-written message with their link.

**When a packet lands** — see *What happens on submission* below. Nothing
for you to do unless VUMI asks for something.

**Move someone forward** — *Code issued* on the dashboard marks the
contracting approved: the agent gets a congratulations email and their
tracker turns to complete. *VUMI replied* stops the carrier follow-ups
without approving. *Chase VUMI* sends a follow-up immediately.

---

## What happens on submission

The moment an applicant signs and sends:

1. **The packet goes to the carrier.** All three signed PDFs and every
   uploaded document are emailed to `CARRIER_EMAIL` (Amalia Suraz at
   contracts@woagp.com), with everyone in `COPY_TO` copied — so you, Kamla
   and your gmail all hold the same record.
2. **It is filed in Drive** under *VUMI Contracting → Name — TOKEN*.
3. **The applicant is thanked**, gets their own copy of the three forms
   attached, and is given a **tracking code**.

The carrier email carries a reference like `[VUMI-AB12CD34EF]` in its
subject. Leave that alone — it is how the script later finds the thread to
see whether the carrier replied.

## Chasing the carrier

Sending a packet is not the same as it being dealt with, so the same daily
check that chases applicants also chases VUMI.

- **Follow-ups** go to Amalia 3, 4, 7, 7 then 14 days after the packet was
  sent (`CONFIG.CARRIER_FOLLOWUP_SPACING`), under the original subject so
  they thread in her inbox rather than arriving as easy-to-miss new mail.
- **They stop the moment she replies.** The script looks for a reply on
  that reference; anything from outside your own addresses counts. You can
  also press *VUMI replied* on the dashboard.
- **A hard stop.** After the last follow-up everyone in `COPY_TO` gets one
  email saying VUMI has not answered on these packets and it is time to
  call. No more automatic mail on that packet.

## The agent's tracking code

Each submitted applicant gets a six-character code (`K4BQ7X`) and a link to
`/contracting/status.html`, also reachable at `/track/K4BQ7X`. It shows a
progress bar over four stages:

| Stage | Set by |
|---|---|
| Solicitud recibida y firmada | automatically, on submit |
| Enviada a VUMI® | automatically, on submit |
| En revisión por VUMI® | automatically, on submit — where it waits |
| Código de agente emitido | you, via *Code issued* on the dashboard |

The code is deliberately **not** their application token. It reveals a stage
and a first name and nothing else — no addresses, no bank details, no
documents — so it is safe to read down the phone or paste into a chat. Their
application token still opens their full form, so keep treating that one as
private.

---

## Files

The app is edited in `contracting/` and deployed from `dist-contracting/`,
where `build-contracting.sh` moves it to the site root — so `contracting/`
in the repo becomes `/` on the live site.

```
contracting/
  index.html    the wizard (applicant-facing, ES/EN) — becomes / when built
  app.js        wizard logic — steps, autosave, signature, submit
  packet.js     field map + PDF fill engine (also runs under Node)
  admin.html    recruiter dashboard (self-contained)
  status.html   the agent's progress tracker (self-contained)
  forms/        the three carrier PDFs the app fills
  vendor/       pdf-lib, vendored so the app has no CDN dependency
apps-script/
  Contracting.gs   backend: storage, submissions, both reminder engines
```

### A note on `forms/`

These are the carrier's original PDFs, rewritten once with a plain
cross-reference table. The originals use compressed object streams that
pdf-lib cannot parse; the rewrite changes nothing an applicant or the carrier
would see — same pages, same field names, same field count. If VUMI® issues a
new revision of a form, drop it in and re-check the field IDs in
`packet.js` before trusting the output.

### Editing the questions

`packet.js` holds the map from PDF field ID to a data path
(`'TEXTO 117': 'home.city'`). `app.js` holds the questions the applicant sees,
as a plain list per step. To add a question, add the field in `app.js` and
point a PDF field at the same path in `packet.js` — nothing else needs to
change. `REQUIRED` in `packet.js` is the single definition of "complete": the
progress bar, the review screen and the reminder emails all read from it, so
they can never disagree.

---

## Privacy

Applicants type ID numbers, tax IDs and bank details into this form.

- The pages are `noindex` and sent with `X-Frame-Options: DENY` and
  `Referrer-Policy: no-referrer` (see `netlify.toml`).
- Answers live in the applicant's browser, in your Drive folder, and nowhere
  else. Nothing is sent to a third party.
- The admin key is the only thing protecting applicant data on the dashboard
  endpoint. Treat it like a password, and change it if it ever leaks.
- Applicant links contain a 10-character token. Anyone with the link can see
  and edit that application — the same trade-off as the renewal portal.
