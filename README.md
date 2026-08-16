# Ricky Rampersad Branch — Website

This repository **is the live public website** at https://rickyrampersadbranch.com
(GitHub Pages serves every file on `main`).

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
- `apps-script/` — backend source (deployed to Google Apps Script, not run here)
