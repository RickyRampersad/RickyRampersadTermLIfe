# Ricky Rampersad Branch — Website

This repository **is the live public website** at https://rickyrampersadbranch.com
(every file on `main` is served as-is — there is no build step).

> **Hosting is moving from GitHub Pages to Netlify.** GitHub Pages ignores
> `netlify.toml`, so the rules blocking `/apps-script/*` and `/data/*` have
> never been in effect and backend source is downloadable from the live
> site today. `NETLIFY-MIGRATION.md` has the runbook. Note that moving host
> does **not** make it safe to commit secrets: this repo is public on
> GitHub regardless of what serves the website.

## ⛔ NEVER commit client data

**This repo is PUBLIC. Every file on `main` is downloadable by anyone.**

- No client names, contacts, addresses, policy numbers, premiums, vehicle
  registrations, chassis/engine numbers, or exports from Salesforce/Sheets.
- No CSV/XLSX of client records — not even "temporarily".
- Client data lives in the **private Google Sheet** and is served to the
  portals by **Apps Script behind per-client tokens**. The site fetches it
  at runtime; it is never stored here.
- Local working copies belong under `data/` **only** at the gitignored
  paths (`data/risk-details.csv`, `data/vehicle-register.csv`).

Client data has been committed here twice by mistake and had to be purged
with a full history rewrite. Do not make it a third time.

## Layout

- `index.html` — homepage · `agent.html` / `staff.html` — code-locked portals
- `renewal/`, `renewalpal/`, `renewal-gateway/` — renewal system
- `claims/` — Claims TT intake · `market/` — Branch Trading League
- `meetings/` — Branch Meeting Builder: agenda, materials, attendance
  (signing in is the register), action tracker and minutes
- `apps-script/` — backend source (deployed to Google Apps Script, not run here)
