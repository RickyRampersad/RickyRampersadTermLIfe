# Pension Application Wizard — setup & maintenance

The wizard lives at **`/pension/`** (`rickyrampersadbranch.com/pension/`, or the
short link `/pension`), and at **`pensionplantt.com`** on its own domain.

It opens by asking **who is signing in** — the agent, the employer, or the
employee — and gives each of them their own page (Part 4). The agent's page is
the wizard, which takes a company-owned (Section 134) pension case from a blank
screen to a signed-ready application:

1. **Section 134 computation** — the maximum the company may contribute
   tax-free, the BIR approval form, and the employer's plan.
2. **Declaration 1** — the employee's details, their own contribution, their
   plan and beneficiaries, with the real Guardian PDF filled in live.
3. **Declaration 2** — the third-party declaration, because the company owns
   the policy.
4. **KYC** — ID, utility bill, pay slip, beneficiary ID.
5. **Review & submit** — one Full Package PDF (cover, both declarations, the
   auto-built salary deduction form, and the KYC images), the employee's own
   three-page pack, plus the branch email.

The wizard runs entirely in the agent's browser. Case data is held in that
browser's `localStorage` and never leaves the device except in the PDFs the
agent downloads and the email they choose to send.

The employer's and employee's pages read from the **register** — the branch's
own sheet — and only ever with an access code the branch issued (Part 4).

---

## Part 1 — Deploying

The site is a plain static site; the wizard is just another folder in it. Push
to the branch Netlify builds and it is live. `netlify.toml` already sets:

- `publish = "."` and `functions = "netlify/functions"`
- `/pension` → `/pension/`
- `X-Frame-Options: DENY`, `nosniff` and `Referrer-Policy: no-referrer` on
  `/pension/*`
- a one-year immutable cache on `/pension/assets/*`

Netlify installs the one dependency in `package.json` (`@anthropic-ai/sdk`)
automatically. There is no build step.

> **On GitHub Pages** the pages all work, but Netlify functions do not exist
> there — RIA (below) falls back to its built-in answers. Everything else,
> including every PDF, is unaffected.

---

## Part 2 — Turning on RIA, the assistant

RIA is the gold button in the bottom-right of the wizard. It answers questions
about the current step using the live case on screen.

1. Get an API key from <https://console.anthropic.com> → **API keys**.
2. In Netlify: **Site configuration → Environment variables → Add a variable**
   - Key: `ANTHROPIC_API_KEY`
   - Value: the key (starts with `sk-ant-`)
   - Scope: leave it on all deploy contexts.
3. Redeploy (**Deploys → Trigger deploy → Deploy site**).

That is the whole setup. The key stays on Netlify's servers — the browser never
sees it, because the browser talks to `/api/pension-ai`
(`netlify/functions/pension-ai.mjs`), which talks to Anthropic.

**Without the key nothing breaks.** The endpoint returns "not configured" and
the wizard silently uses the built-in answers it has always had.

### Optional environment variables

| Variable | Default | What it does |
| --- | --- | --- |
| `PENSION_AI_MODEL` | `claude-opus-5` | Which model answers. |
| `PENSION_AI_EFFORT` | `low` | `low`, `medium`, `high`, `xhigh`, `max`. Higher = more thorough, slower, dearer. |
| `PENSION_AI_ALLOWED_ORIGINS` | — | Extra comma-separated hosts allowed to call the endpoint. The site's own domains and `*.netlify.app` are always allowed. |

### What it costs, and the guard rails

Each question is a short exchange — roughly a US cent or two at `low` effort,
depending on how much case context is on screen. To stop a public endpoint with
the branch's key from being used as a free chatbot, the function:

- accepts POST only, and only from the branch's own domains,
- caps the case context at 24 000 characters and the conversation at 12
  messages of 4 000 characters each,
- caps each answer at 2 000 tokens,
- rate-limits to 25 questions per 5 minutes per IP address,
- ships a system prompt that keeps RIA on this application and nothing else.

The rate limit is per running function instance, so it slows casual abuse
rather than stopping a determined attacker. If the branch ever sees unexpected
spend, set a monthly limit on the Anthropic console and rotate the key.

The branch's own instructions to RIA — the Section 134 rules, the document
list, the tone — are in `SYSTEM_PROMPT` at the top of
`netlify/functions/pension-ai.mjs`. Edit that file to change what RIA knows or
how it speaks.

---

## Part 3 — pensionplantt.com

The wizard has its own GoDaddy domain. Point it at the Netlify site built from
**this repository** — not at a separate hand-uploaded copy — so the domain
always shows the current wizard and RIA works (functions only run on Netlify).

### Step 1 — add the domain in Netlify

**Site configuration → Domain management → Add a domain** → `pensionplantt.com`.
Netlify will also offer `www.pensionplantt.com`; add both. Netlify then shows
the exact DNS records to create — use the values it gives you if they differ
from the ones below.

### Step 2 — the GoDaddy records

In GoDaddy: **My Products → Domains → pensionplantt.com → DNS → Manage Zones**.

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| A | @ | `75.2.60.5` | 1 hour |
| CNAME | www | `<your-site-name>.netlify.app` | 1 hour |

Delete GoDaddy's default parking records for `@` and `www` first, or the domain
will keep resolving to the parked page. Leave every other record alone —
particularly MX and TXT records if email is on this domain.

DNS usually propagates within an hour. Netlify issues the HTTPS certificate
automatically once the records resolve.

> **Do not point this domain at `rickyrampersadbranch.com`'s records.** That
> domain resolves to GitHub Pages (see `DNS-BACKUP.md`), where Netlify
> functions do not exist and RIA would fall back to its built-in answers.

### Step 3 — nothing else

`netlify.toml` already contains the rules that serve `/pension/` at the root of
`pensionplantt.com` and route RIA's endpoint on that domain. The address bar
keeps showing `pensionplantt.com` — the rewrite is invisible to the client.

Check afterwards: `pensionplantt.com` loads the wizard, `pensionplantt.com/api/pension-ai`
returns a JSON error rather than the wizard's HTML (that means it reached the
function), and RIA answers a question.

### If a separate Netlify site already exists

`section134planscalculation.netlify.app` runs the original single-file build.
Once `pensionplantt.com` serves from this repository, that site is a stale copy
with a broken assistant — retire it, or leave it as an archive but do not give
the address to clients.

---

## Part 4 — The register: letting employers and employees see their own data

The first thing the site now asks is **who is signing in**, and the answer
decides what it shows:

| Door | What they get |
| --- | --- |
| **I'm the agent** | The wizard, unchanged. |
| **I'm the employer** | What a company-owned pension costs, what they can deduct, what they sign — and, with a code, **their company's whole schedule**. |
| **I'm the employee** | What has been set up for them, what they signed, what they may ask — and, with a code, **their own record**. |

The choice is remembered; a strip under the header says which door they came
through and lets them switch. RIA changes with the door too — it is told who is
asking, offers them their own questions, and reads the signed-in record.

The wizard itself still knows nothing but the case the agent is typing. The
data behind those two doors is the **register**, which lives in the same Google
Sheet and the same Apps Script web app as the renewal portal
(`apps-script/Pension.gs`).

### Step 1 — create the register

Open the renewals Sheet → **Guardian Renewals → Pension — create register tabs**.
That makes three tabs:

**`Pension Companies`** — one row per company

`Company Code · Company · BIR File # · Contact · Contact Email · Contact Mobile · Agent · Notes`

**`Pension Employees`** — one row per employee case

`Access Code · Company Code · Company · Employee · Position · Plan · Company Annual (TT$) · Company Lump Sum (TT$) · Employee Monthly (TT$) · Commencement · Stage · BIR Status · Policy # · Beneficiaries · Agent · Email · Mobile · Updated · Notes`

**`Pension Access Log`** — every lookup, with the code masked.

Fill in the companies and the employees, leaving the two code columns blank.
`Company Code` on an employee row is what ties them to their employer.

**Stage** is free text and drives the coloured pill on screen: anything reading
*issued / in force / approved / active / complete* shows green, anything reading
*waiting / pending / with BIR / submitted / underwriting / outstanding* shows
amber, everything else grey.

### Step 2 — issue the codes

**Guardian Renewals → Pension — issue missing codes**. Every blank code column
gets one (`CO-XXXX-XXXX` for a company, `EM-XXXX-XXXX` for an employee), drawn
from an alphabet with no O/0, I/1 or S/5 in it so codes survive being read down
a phone. **Codes already in the sheet are never touched** — one that has been
given to a client keeps working forever.

### Step 3 — republish the web app

The endpoint is a new route on the existing web app, so it only appears once the
script is redeployed: **Deploy → Manage deployments → edit → Version: New
version → Deploy**. Until that is done the site says *"the branch may need to
republish it"* rather than showing data.

### The three addresses

| Address | What it is | Who gets it |
| --- | --- | --- |
| `pensionplantt.com` | The app. Asks who is signing in, then the wizard or the register. | Agents, and anyone with a code |
| `pensionplantt.com/launch` | **The launch page.** The film, then the three sign-in steps for employers and the three for employees. | **This is the link to send a company or its staff.** |
| `pensionplantt.com/film` | The film on its own, full screen (2 min 38). | A meeting, a screen in reception |
| `pensionplantt.com/manual` | **The Pension Desk Manual** — ten sections on running a case end to end. | The team. Also linked from the agent's own case bar. |

`/start` is kept as an alias of `/launch`, so any link already handed out keeps
working. The desk manual prints to eleven A4 pages if the team would rather have
it in a folder. The film is also a plain file at
`pension/assets/RRB-Company-Pensions.mp4` — send it on WhatsApp, put it on the
branch's social accounts, play it from a laptop with no signal. It is captioned
throughout and needs no sound.

### Step 4 — give out the codes

Either tell the client their code, or send the link that fills it in:

```
https://pensionplantt.com/?code=CO-ABCD-EFGH
```

The prefix tells the site which door to open, so the client lands on their own
page already signed in. **Guardian Renewals → Pension — show the sign-in link**
has this to hand.

### What each code can see

This is the whole of the access rule, and it is enforced on the server in
`pensionLookup_`:

- **Nothing is returned without a code that matches a row.** There is no listing
  and no browsing.
- **A company code** returns that company's details and its own employees — name,
  position, plan, contributions, commencement, stage, BIR status, policy number.
  It never returns anybody's access code, so an employer cannot sign in as one
  of their staff.
- **An employee code** returns exactly one employee — theirs — plus their
  beneficiaries and agent. It returns nothing about any colleague.
- Company codes are matched first, so a value typed into the wrong column can
  never widen access.
- A code under six characters is refused by the browser and again by the server,
  so a half-typed code never reaches the sheet.
- Every lookup, successful or not, is written to `Pension Access Log` with the
  code masked to its first four characters.

The register is **read-only**. Nothing on the website can change a row; the
branch edits the sheet.

### If the register is unreachable

No deployment, no signal, or an older deployment that predates `Pension.gs` — in
every case the page says so in plain words and the email route underneath still
works. The wizard, the computation and every PDF are completely unaffected: they
have never needed the network.

---

## Part 5 — Enrolling an employee: the two-sided process

The register (Part 4) shows what the branch already holds. This is how a new
employee gets onto it — and it runs itself once it is started.

### Who goes first, and what happens

**1 · The employer's part.** Signed in, they press **Enrol an employee** and
complete the company-owned Section 134 side for one person: the employee's name
and email, the plan, the annual premium, any lump sum, their salary, the
commencement date, maturity age and guarantee.

**2 · The employee is written to immediately.** The moment the employer
submits, the employee gets an email that congratulates them, explains what a
company-owned plan *is* (the company owns it and pays, they are the person it
pays out to), states what the company is putting in, and asks for the part only
they can give. It carries their own access code and a button straight into
their record. **The employer, the branch and the team are copied.**

**3 · Every morning at 9, until they answer.** The employee is reminded on the
same email thread — so every reminder sits under everything already sent — and
each one carries a *"What we have sent so far"* list, the live timeline, and an
invitation to reply if something is stopping them. Everyone stays copied.

> After **45 days** the daily emails stop by themselves, the enrolment is marked
> *"Stalled — needs a phone call"*, and it is handed to the team. Past that
> point a daily email is noise rather than service, and a person should ring
> them.

**4 · The employee's part.** Their own contribution (minimum $200/month, and
the page says why it is worth doing), retirement age, guarantee, who the money
goes to, and their documents — photo ID, utility bill under six months old, pay
slip. Uploads are filed in a Drive folder of their own, never in the sheet.

**5 · Both are thanked.** The enrolment closes and both sides get a message
explaining that it now goes to the **B.I.R. for approval of both plans** — the
company's Section 134 contribution and the employee's own — with a link for
questions.

**6 · Every 10 days, until it is delivered.** Both sides get a progress note on
the same thread showing exactly where it stands. The day it is delivered they
get a final one.

### The timeline both sides watch

Five steps, defined once in `PSTEPS` and read by the website, the emails and
the sheet, so they cannot tell three different stories:

`The employer's part → The employee's part → B.I.R. approval → Policy issued → Policy delivered`

The employer sees a card per enrolment with the timeline, a progress bar, and —
where it applies — *"Waiting on Marcus. We have written to them 3 times…"*. The
employee sees the same five steps for their own plan.

### Moving one along

The branch marks the steps the branch controls. Put the cursor on the
enrolment's row in **`Pension Enrollments`** and choose **Guardian Renewals →
Pension — mark the next step done**. It asks for the policy number at issue, and
on delivery it writes to both sides straight away. The two client-owned steps
cannot be marked this way — the employee's part is theirs to finish.

### The forms, and where every field comes from

Between them the two parts collect **every field the four printed forms need**,
so a completed enrolment prints without anybody retyping it.

| Comes from | Fields |
| --- | --- |
| **The company's own row** (typed once, not per employee) | Company name, address, B.I.R. file no., date of incorporation, agent name and number |
| **The employer's part** | Employee name, email, mobile, position, department, employed since, plan, annual premium, lump sum, salary, commencement, maturity age, guarantee, first salary deduction |
| **The employee's part** | Date of birth, B.I.R. file number, home address, marital status, own contribution, own plan, retirement age, guarantee, beneficiaries, documents |

Date of birth and home address are **required** of the employee — the
declarations and the B.I.R. request cannot be completed without them.

### Turning an enrolment into the printed pack

Once both parts are in, the agent opens the wizard, puts the employee's
enrolment code into **"Already enrolled online? Load it"** at the top of Step 1,
and the whole case fills — all 28 fields. Declaration 1, Declaration 2, the
salary deduction authority, the B.I.R. request and the 15-page Full Package all
print from it.

Two things still need the agent: the **KYC images** (the employee's uploads are
in Drive, not in the browser) and the **beneficiaries**, which the employee gives
as free text and the agent enters as structured rows in Step 2 so the shares can
be checked to 100%. The loader shows their text so it can be copied across.

The register will not return a case until the employee's part is in — a
half-filled Declaration is worse than a blank one.

### Turning the automation on

**Guardian Renewals → Pension — install the 9am automation.** That creates the
`Pension Enrollments` and `Pension Activity` tabs and the daily trigger.
**Pension — run the 9am pass now (test)** does a pass immediately and reports
what it sent.

Then set who is copied, at the top of `apps-script/PensionFlow.gs`:

```js
BRANCH_EMAIL: 'support@rickyrampersadbranch.com',
TEAM: [
  'ricky.rampersad@myguardiangroup.com',
  // add the rest of the team here — one quoted address per line
],
```

Everyone on that list is copied on every message about every enrolment.

### On the email threading

The first message on an enrolment is sent through `GmailApp` and its thread ID
is stored on the row; every later message is a **reply on that same thread**, so
nobody ever reads a reminder without its history underneath. If the Gmail scope
is unavailable the code falls back to a plain `MailApp` send — the client still
gets their email, it simply will not thread.

The first time the automation runs, Apps Script will ask for permission to send
mail and to use Drive. That is expected — approve it once.

### What it does not do

It does not decide the maximum contribution. That is still the agent's
computation in Step 1 of the wizard, and the employer's figure is taken as
entered. If a company enters more than Section 134 allows, the wizard flags it
when the agent builds the B.I.R. form — the enrolment flow does not check it.

---

## Part 6 — Maintenance

### Replacing a blank Guardian form

The blanks are real PDFs in `pension/assets/`:

| File | Form |
| --- | --- |
| `RRB_Declaration1_blank.pdf` | Declaration 1 (employee) |
| `RRB_Declaration2_blank.pdf` | Declaration 2 (third party) |
| `RRB_Salary_blank.pdf` | Salary deduction authority |

Drop in the replacement under the same name. The wizard fills these by **field
name**, so if Guardian reissues a form with renamed fields, the matching
`setText(...)` calls in `buildD1` / `buildD2` / `buildSal` inside
`pension/index.html` need updating too. Bump `CACHE` in `pension/sw.js` after
any asset change so devices that cached the old form pick up the new one.

### What is calculated, and where each figure lands

Everything is computed once in `calc()` and held in `R`; every document reads
from there, so the forms cannot disagree with the screen.

**BIR Section 134 form — front page** (built by `buildForm()`, printed from
Step 1):

| Line | Figure |
| --- | --- |
| 1–5 | Employer name, address and B.I.R. file no.; employee name and address |
| 6 (a) | Company annual premium |
| 6 (b) | Company lump sum |
| 7 | Employee's own contributions to approved plans (capped $60,000) |
| 8 | Total contributions — Line 6 + Line 7 |
| 9 | One third of chargeable income |
| 10 | Does Line 8 exceed Line 9? — Yes/No |
| 11 | 20% of emolument income |
| 12 | Does Line 8 exceed Line 11? — Yes/No |

**BIR form — overleaf:** salary (1a), company contribution (1b), total
emolument income, other income (2), total net income (3), personal allowance,
tertiary education and first-time-home deductions (4), assessable income (5),
Widows & Orphans / approved pension / approved deferred annuity / NIS 70%
(6a i–iii and 6b), total deductions capped at $60,000 (7), chargeable income
(8), one third of chargeable income (9), 20% of emolument (10).

Two rules are enforced rather than left to the agent: the company contribution
is always added into emolument income before the limits are worked out, and if
the entered contribution would make **both** Line 10 and Line 12 read Yes, the
printed form is scaled back to the maximum and the screen says what was
entered instead.

**How far this is verified.** Every figure above was checked against an
implementation written independently from the rules printed on the form, over
twelve cases — non-resident, other income, the $60,000 deduction cap, the
tertiary and first-time-home caps, negative chargeable income — and all twelve
agree. The reverse solver was checked against the property it must hold (at the
ceiling, total contributions may exceed at most one of Line 9 or Line 11) over
forty salary and deduction combinations, and holds in every one. The N.I.S.
table is the one input that comes from outside the Income Tax Act; it was
checked against the branch's NIB sheet in August 2026 and agreed. **Re-check it
whenever NIB revises its rates** — see the note above the table in
`pension/index.html`.

**Salary Deduction form** (`buildSal()`): employer and employee details, the
deduction frequency, the month and year taken from the commencement date, and
the employee's own contribution written three ways — in words, in cents, and in
figures — with the premium row and both totals rows tallied. Client # and
Policy # are deliberately blank: Guardian assigns them.

**Declaration 1** (`buildD1()`): branch code, employee first name and surname,
date of birth, agent name and number, the Part 1.E date, A and B pre-circled,
and the witness name in block letters.

**Declaration 2** (`buildD2()`): the same, plus the company name in both the
Proposer First Name and Legal Entity fields and its incorporation date.

The address, identification and expiry fields that sit unfilled on page 3 of
both declarations belong to the *"declaration in case where the proposer is
illiterate"* block — they identify the attesting witness in that specific
case, not the client, and must stay blank on an ordinary application.

### The plan knowledge

`PLANS` near the top of the script in `pension/index.html` is the single source
of truth for plan advice: it drives the recommendation, the comparison table,
the "Contract terms" panel under it, and everything RIA says about a plan.

Each plan carries a `src` field:

| `src` | Meaning | Shown as |
| --- | --- | --- |
| `"contract"` | Every figure is taken from the Guardian policy contract or quick-reference guide held by the branch. | "From the contract" |
| `"branch"` | Branch product notes, not yet checked against a contract. | "From the branch product notes" plus an amber *not yet checked* badge |

Verified against contracts: **TopHat Special Edition**, **TopHat Executive
Retirement**, **TopHat Elite**, **Lifestyle Pension Plan**. Still on branch
notes: **Life Secure**, **Life Secure Corporate**, **Lifestyle Special
Edition**, **Lifestyle Privilege** — send the contracts for those four and they
can be raised to `"contract"` the same way.

To update a plan: edit its `facts` (the short selling points) and `terms` (the
label/value rows in the panel), and set `src` correctly. RIA picks the change up
on the next question — nothing else to update. Charges in the contracts are
"current" figures the Company may alter, so both the panel and RIA present them
as the basis for advice rather than as a quotation.

### Adding an agent to the dropdown

In `pension/index.html`, find `<!-- AGENT LIST -->` in Step 1 and add an
`<option>` line under it.

### Offline use

The wizard registers a service worker (`pension/sw.js`) that keeps the page,
the PDF engine and the three blank forms on the device. After one online visit
an agent can work a full case with no signal — only RIA needs the network.
Change the wizard, bump `CACHE` in `sw.js`.

### The case file

The toolbar under the header shows that the case is saved on that device, and
offers:

- **Export case** — writes the typed case to a `.json` file (a backup, or a way
  to carry a case to another device). Uploaded ID photos are deliberately *not*
  in the file.
- **Import** — opens an exported case, replacing what is on the device.
- **New case** — clears the device and starts empty.
