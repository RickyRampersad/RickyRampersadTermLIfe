# Career Path Tracker

The Guardian Life of the Caribbean **Sales Career Path (Amended April 2026)**,
digitized so an agent can log in and track their own progress instead of reading
a PDF.

- **Page:** [`career-path.html`](career-path.html) — served at
  `rickyrampersadbranch.com/career-path.html`
- **Reached from:** the Agent Portal (`agent.html` → Career & Development)

> Self-assessment guide only. It changes nothing in the policy — all appointments
> remain at the discretion of the Company and are made by the President in
> consultation with the VP of Sales.

---

## What it does

| | |
|---|---|
| Dashboard | Current position, tenure in it, years contracted, and live stat tiles |
| Progress rings | Every position shows a filling gauge of requirements met |
| Qualification checks | All eight positions with every requirement from the document |
| Realistic estimates | Time-to-qualify mapped to the April / October promotion windows |
| Learning Hub | FSCP modules, MDRT, CIAM and the in-house programs, with where to enrol |
| Progress feed | Monthly check-ins plus automatic milestone logging |

## Positions modelled

**Professional Sales Track** — Salesperson → Executive Agent → Senior Sales Consultant

**Sales Management Track** — ELP Candidate → Trainee Manager → Unit Manager →
Assistant Branch Manager → Branch Manager

Each carries its full requirement set: tenure, production (API), persistency,
client base, designations, courses, MDRT, recruiting numbers, unit production and
quota rules.

## Editing the agent list

Sign-in is a dropdown. Open `career-path.html`, search for `const AGENTS`, and edit:

```js
const AGENTS=[
  "Ricky Rampersad",
  "Next Agent",
];
```

One name per line, in quotes, each ending with a comma. Anyone not on the list can
still sign in through **"My name isn't listed…"**.

## Course data

Researched from the providers (August 2026) — confirm dates and fees with the
provider before registering.

- **FSCP™ (2015)** — FA 200, FA 201, FA 202, FA 251, FA 257, FA 261, FA 271 in
  order, then FA 290 (Ethics) and FP 99 (Certification Exam). The 5-Year Rule
  applies. Delivered online via TTAIFA.
- **MDRT** — 2026 qualification via commission / income / premium, the 50%
  risk-protection rule, and the COT/TOT multipliers.
- **CIAM** — LIMRA: Pacesetter + AMTC + AES + MAPS, five years' management
  experience, and a thesis.
- **Alternatives** — CLU, ChFC, CFP, MFA accepted wherever FSCP™ is required.
- **In-house** — Intermediate Development, Mentoring, ELP, Developing Future
  Leaders, POP7, GLOC Bootcamp.

Ticking FSCP modules in the Learning Hub satisfies the matching checklist items
automatically (one module = commenced; all nine = designation attained; five
meets the ELP minimum in Appendix 3).

## House rules this page follows

- **The mark** is `logo-mark.png` — the gold shield with the check. Nothing draws
  a substitute.
- **Palette** is the branch navy `#07131f`, gold `#efc24b`/`#dca530`, teal
  `#00CFEA`, with Montserrat + DM Sans, matching `agent.html`.
- **The `rrb-views` beacon** sits before `</body>`. Keep it if the page is ever
  regenerated.

## Where the data lives

Each agent's entries are stored in **their own browser** (`localStorage`), with an
in-memory fallback where storage is blocked. Nothing is sent to a server.

- No data for the branch to store, secure or back up.
- **No central view of agent progress** — a manager dashboard would need a
  backend. The house pattern for that is Apps Script + a Sheet tab, as in
  `gs/views-counter.gs` and `apps-script/Service.gs`.
- An agent who changes device or clears their browser starts fresh.
- Sign-in is a name, not a password. The Agent Portal's access code is the gate;
  this page is reachable directly by anyone who has its URL.

If central progress tracking is ever added, the privacy line shown on the page
("saved on your own device only; nobody else sees them") must change first, and
agents must be told.
