# Service Questionnaire

The paper Guardian Life **Service Questionnaire** (form 2000-03-147) and the **EBD Group
Change of Agent Request** letter, rebuilt as one guided online review that files itself,
thanks the client, and routes the work to Customer Service.

Live at **`/service/`** — [rickyrampersadbranch.com/service/](https://rickyrampersadbranch.com/service/)

---

## What happens when a client presses send

1. **The answers file themselves.** One row per submission in a Google Sheet, one column
   per question — a new question on the form becomes a new column on its own.
2. **The client gets a real thank-you**, within seconds: their reference number, their
   Protection Score, a numbered list of what happens next *in their case*, and a PDF of
   everything they told us.
3. **Customer Service gets the work**, with the priority in the subject line, an action
   list, the completed questionnaire as a PDF, and — if they asked for one — the change
   of servicing agent request, filled in and signed.
4. **Anything unresolved is escalated.** A client who says "this was never fixed" is
   flagged URGENT, promised contact within one business day, and chased automatically if
   nobody marks it handled.

Nothing is ever lost. If the backend isn't deployed yet, or the client is on a bad
connection, the form falls back to a pre-filled email and an on-screen printable copy.

---

## The two forms

| | Individual & family | Group & company |
|---|---|---|
| Source document | Service Questionnaire, form 2000-03-147 | EBD Group Change of Agent Request |
| Who fills it in | The policy owner | HR, finance or a director |
| Questions | 75 | 60 |
| Ends with | Change of **Servicing Agent** request, signed | Change of **Agent** letter, ready for letterhead |
| Score shown | Protection Score | Plan Health Score |
| Sheet tab | `Service Questionnaires` | `Group Service Questionnaires` |

> **See [PAPER-MAPPING.md](PAPER-MAPPING.md)** for the full line-by-line table — every element
> of both documents against the question that carries it, generated from the live schema.

### Every paper question is still there

All twenty numbered questions from the paper form are in the individual questionnaire, in
the same order and meaning. Each one is tagged in `index.html` with its paper origin
(`paper: "Q5 — Have you had any problems…"`) so the two documents can be compared line by
line. The header fields (Life Assured, Policy No(s), Proposer, Date) and every field from
the change-of-agent section at the bottom of the form are there too.

Some were **upgraded rather than copied**, because a Yes/No box was throwing information
away:

| Paper | Now | Why |
|---|---|---|
| Q1 "Are you satisfied?" — Yes/No | Five-point scale | "No" tells you there's a problem. A 2/5 tells you how big. |
| Q6 "How often… 3, 6, 12 mths?" — Yes/No boxes | Pick one, and it sets the reminder | The paper form asked the question but had nowhere to put the answer. |
| Q11 "Is the Beneficiary Designation correct?" | Yes/No/Not sure → captures the new beneficiary | Knowing it's wrong doesn't fix it. Now the change starts the same day. |
| Q13 "Do you have a Will?" | Yes / Yes but out of date / No / Not sure | "Yes" hid the most common answer: one written before the children were born. |
| Q17 "When last reviewed?" — Yes/No | A date range | It was never a yes/no question. |

### What was added, and why

18 new questions on the individual form, 22 on the group form. The ones that earn their
place:

- **Life changes in the last 12 months** — marriage, a baby, a mortgage, a diagnosis, a
  redundancy. Nothing changes an insurance need faster, and almost nobody thinks to tell
  their agent. This single question surfaces more real work than any other on the form.
- **"If you couldn't work tomorrow, how long could your household manage?"** — the
  question that makes income protection concrete instead of theoretical.
- **Would you recommend us, 0–10** — the number you can actually track quarter on quarter.
- **"What is the one thing we could do to serve you better?"** — read first, every time.
- **Consent on referrals** — the paper form asked for a friend's contact details and never
  asked whether the friend had agreed. Now it does.
- **Trusted contact, paperless documents, Policy Location Record** — small things that
  matter enormously in the week after a death.
- **Group: claims turnaround, billing accuracy, member listing currency, employee
  education** — the four things group clients actually complain about, asked before they
  become complaints.

### What the client gets back

A **Protection Score** out of 100, built from eight pillars they've answered — beneficiary
known, Will in place, income protected, mortgage covered, emergency fund, health cover,
critical illness, retirement plan. It appears as they fill the form in, names the specific
gaps, and sells nothing. It is the reason people finish a four-minute form instead of
abandoning it at question six.

---

## Setup

The backend is `../apps-script/Service.gs`. It is **its own Apps Script project with its own
spreadsheet** — the same arrangement as `Market.gs`. It cannot touch or break the renewal
platform in `Code.gs`.

It also serves **[donthaveanagent.com](../donthaveanagent/README.md)** — one backend, two
front doors, one worklist. Paste the same `/exec` URL into `CONFIG.API_URL` in both
`service/index.html` and `donthaveanagent/review.html`. Submissions are told apart by the
`Source` and `Arrived via` columns, and each client's confirmation email is branded as the
product they actually used (`SQ-`/`GSQ-` references from here, `DHA-`/`DHAG-` from there).

1. Create a Google Sheet called **Service Questionnaires**.
2. **Extensions → Apps Script**. Paste in `apps-script/Service.gs`. Save.
3. Fill in the `SVC` block at the top — see **The one setting that matters** below.
4. Run **`setupService()`** once and grant the permissions it asks for. It builds the tabs
   and emails you a confirmation.
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**

   Copy the `/exec` URL.
6. Paste that URL into `CONFIG.API_URL` at the top of `service/index.html`, and commit.
7. Optional but recommended: run **`installServiceTriggers()`** to switch on the daily
   follow-up watchdog.

Use **Service Questionnaire → Send a test submission** from the sheet menu to fire a
realistic submission through the whole pipeline and see exactly what a client and Customer
Service each receive.

### The one setting that matters

```js
CS_EMAIL: '',   // Guardian Life Customer Service Department
```

It ships **empty on purpose**. Until you fill it in, every submission routes to the branch
alone, and each routing email says so at the top in red. A live form should never be able
to fire a half-configured letter at a carrier inbox because somebody deployed before
checking an address.

Put the real Customer Service address in, redeploy, and the routing switches on.

Everything else in `SVC` is optional: `CC` for your branch admin, `ESCALATION_CC` for the
people who should see URGENT and HIGH only, `AGENT_NO` if you want your agent number
printed on the change-of-agent letter.

---

## Links to send clients

| Link | Opens |
|---|---|
| `/service/` | The chooser — individual or group |
| `/sq/individual` | Straight into the individual form |
| `/sq/group` | Straight into the group form |
| `/service/?name=Jane%20Doe&policy=1234567&email=jane@x.com` | Prefilled |
| `/service/?type=group&company=Acme%20Ltd` | Group, prefilled |
| `/service/?agent=1` | Adds the agent-only "Agent's comments" field |

A prefilled link roughly doubles how many people finish. Send one from your phone with
their name and policy number already in it — they open it half done.

Prefill parameters: `name`, `policy`, `email`, `phone`, and `company` on the group form.

---

## Changing the questions

Everything lives in one place: the `INDIVIDUAL` and `GROUP` arrays in `service/index.html`.
Add an entry and it appears in the wizard, the review screen, the validation, the email,
the PDF and the spreadsheet — because the front end sends question labels along with the
answers, and the backend renders whatever it receives. There is no second list to keep in
step.

```js
{ id: "smoker", label: "Have you stopped smoking in the last 12 months?",
  type: "yesno", help: "It can reduce your premium.",
  showIf: { id: "lifeChanges", has: "New job, promotion or salary change" },
  flag: "lead",
  score: { pillar: "Non-smoker", good: ["Yes"] } }
```

**Types:** `text` `email` `tel` `date` `number` `textarea` `select` `yesno` `yesnona`
`choice` `multi` `scale5` `nps` `matrix` `signature` `statement`

**`showIf`** — `{ id, is }`, `{ id, not }`, `{ id, in: […] }`, `{ id, has: 'option' }`

**`flag`** — how the office routes the answer:

| Flag | Meaning | Effect |
|---|---|---|
| `urgent` | Something is broken for this client | URGENT, one-business-day promise, watchdog chases it |
| `records` | A policy record needs changing | ACTION, listed for Customer Service |
| `agent` | Part of the change-of-agent request | Feeds the generated letter |
| `service` | Needs a written reply | Listed in the action list |
| `lead` | They asked for something more | Listed as a follow-up |

**`score`** — adds the question to the Protection Score ring. `good` is the list of answers
that count as covered.

**`isNew`** and **`paper`** are documentation only: `paper` records which line of the
original form a question came from, so nobody has to guess later whether something was
dropped on purpose.

---

## Working the submissions

The sheet is the worklist.

- **Priority** — URGENT / HIGH / ACTION / NORMAL, coloured, computed on the server.
- **Status** — starts `Open` for anything needing action, `Filed` otherwise.
- **Set Status to `Handled`** when it's genuinely closed. Anything still `Open` past its
  deadline — one business day for URGENT and HIGH, five for ACTION — turns up in the
  morning chase email until somebody deals with it.
- **Handled by / Handled on** — fill these in. It's the accountability trail.

The `Service Activity` tab logs every submission, every failed email and every chase.

---

## If something breaks

- **Form loads but submissions don't arrive** — `CONFIG.API_URL` is empty or wrong, or the
  deployment isn't set to "Anyone". The client isn't stuck: they'll have been handed a
  pre-filled email instead. Check your inbox.
- **`ok:false` with an error** — the message is the reason. "Empty submission" is a bot
  poking the endpoint; those are rejected silently and don't email anybody.
- **A submission failed mid-processing** — you get a `[FAILED]` email containing the raw
  answers in full, so the client's work is never lost even when the script is.
- **PDFs missing from the emails** — PDF generation failed, and the emails carry every
  answer in the body anyway. Check the `Service Activity` tab for `pdf-failed`.
- **Test the endpoint** — open `YOUR_EXEC_URL?action=ping`. It returns
  `{"ok":true,"configured":true}` once `CS_EMAIL` is set.

---

## Privacy

The form collects what the paper form collected, plus contact preferences and a signature.
It deliberately does **not** ask for national ID numbers, bank details or medical history —
none of that belongs in a service review, and asking for it online invites trouble.

- Answers are held in your Google Sheet and emailed to the branch and Customer Service.
- Drafts are saved in the client's own browser (`localStorage`) so they can finish later,
  cleared on submit, and expire after 30 days.
- The client explicitly confirms the information is true and consents to it being used to
  service their policies. Marketing consent is separate and optional — declining changes
  nothing about their service, and the form says so.
- Referral details require the client to confirm they have that person's permission.
- Record changes — beneficiary, address, date of birth, servicing agent — take effect only
  once processed and confirmed in writing by Guardian Life. The form says this too, in the
  footer and in the confirmation email.
