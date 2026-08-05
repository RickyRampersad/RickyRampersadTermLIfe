# Sales Career Path Tracker

**A Ricky Rampersad Branch initiative** — the Guardian Life of the Caribbean
Sales Career Path (Amended April 2026), digitized so agents can log in and
track their own progress instead of reading a PDF.

**Live:** https://careerpathrrb.netlify.app
**Source:** [`career-path.html`](career-path.html) — the entire app, one file.

> Self-assessment guide only. All appointments remain at the discretion of the
> Company and are made by the President in consultation with the VP of Sales.

---

## What it does

| | |
|---|---|
| 🛡️ **Announcement intro** | Animated launch sequence, plays on first visit, replayable any time |
| 📊 **Dashboard** | Current position, tenure, and live stat tiles across the whole path |
| ⭕ **Progress rings** | Every position shows a filling gauge of requirements met |
| 📋 **Qualification checks** | All 8 positions with every requirement from the document |
| ⏱️ **Realistic estimates** | Time-to-qualify mapped to the April / October promotion windows |
| 📚 **Learning Hub** | FSCP modules, MDRT, CIAM and in-house programs with enrolment links |
| 📒 **Progress feed** | Monthly check-ins plus automatic milestone logging |
| 🎉 **Celebration** | Confetti when a position is fully qualified |

## Positions modelled

**Professional Sales Track** — Salesperson → Executive Agent → Senior Sales Consultant

**Sales Management Track** — ELP Candidate → Trainee Manager → Unit Manager →
Assistant Branch Manager → Branch Manager

Each carries its full requirement set from the April 2026 document: tenure,
production (API), persistency, client base, designations, courses, MDRT,
recruiting numbers, unit production and quota rules.

## Course data

Program details were researched from the providers (August 2026) and are
current as of then — confirm dates and fees with the provider before registering.

- **FSCP™ (2015)** — FA 200, FA 201, FA 202, FA 251, FA 257, FA 261, FA 271 in
  order, then FA 290 (Ethics) and FP 99 (Certification Exam). 5-Year Rule
  applies. Delivered online via TTAIFA.
- **MDRT** — 2026 qualification via commission / income / premium, with the
  50% risk-protection rule and COT/TOT multipliers.
- **CIAM** — LIMRA: Pacesetter + AMTC + AES + MAPS, 5 years' management
  experience, and a thesis.
- **Alternatives** — CLU, ChFC, CFP, MFA accepted wherever FSCP™ is required.
- **In-house** — Intermediate Development, Mentoring, ELP, Developing Future
  Leaders, POP7, GLOC Bootcamp.

## Technical notes

- Single self-contained HTML file. No build step, no dependencies, no backend.
- Each agent's data is stored in their own browser (`localStorage`), with an
  in-memory fallback where storage is blocked. Nothing is sent to a server —
  so there is no central view of agent progress, and clearing the browser
  clears that agent's data.
- Light and dark themes; responsive down to phone widths; honours
  `prefers-reduced-motion`.
- Sign-in is a name, not a password. It personalizes the tracker; it is not
  access control.

## Deploying

**Netlify** — drag the folder containing the file (renamed `index.html`) onto
https://app.netlify.com/drop.

**GoDaddy / cPanel** — upload as `index.html` into a `career-path` folder
inside `public_html`, then link to `yourdomain.com/career-path/`.

**Embedding as a tab** — host it first, then point an iframe at it on the same
domain so saved progress keeps working:

```html
<iframe src="https://YOURDOMAIN.com/career-path/"
        title="Sales Career Path Tracker"
        style="width:100%;height:900px;border:0;border-radius:12px"></iframe>
```

To publish an update, upload the new file over the old one — saved progress
is preserved.

## Status

Open testing: anyone may enter a name to try it. A fixed agent list will
replace free-text sign-in before the branch-wide rollout.
