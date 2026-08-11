# Pension Application Wizard — setup & maintenance

The wizard lives at **`/pension/`** (`rickyrampersadbranch.com/pension/`, or the
short link `/pension`). It takes a company-owned (Section 134) pension case from
a blank screen to a signed-ready application:

1. **Section 134 computation** — the maximum the company may contribute
   tax-free, the BIR approval form, and the employer's plan.
2. **Declaration 1** — the employee's details, their own contribution, their
   plan and beneficiaries, with the real Guardian PDF filled in live.
3. **Declaration 2** — the third-party declaration, because the company owns
   the policy.
4. **KYC** — ID, utility bill, pay slip, beneficiary ID.
5. **Review & submit** — one Full Package PDF (cover, both declarations, the
   auto-built salary deduction form, and the KYC images) plus the branch email.

Everything runs in the client's browser. Case data is held in that browser's
`localStorage` and never leaves the device except in the PDFs the agent
downloads and the email they choose to send.

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

## Part 4 — Maintenance

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
