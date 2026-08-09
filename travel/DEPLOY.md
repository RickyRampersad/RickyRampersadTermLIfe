# travelmedicalcover.com — deployment

The site is a single self-contained `index.html`. No build step, no
dependencies, nothing to install.

## 1. Create the Netlify site

This deploys from the same repository as rickyrampersadbranch.com, but as a
**separate Netlify site** with the base directory pointed at `travel`.

Netlify → **Add new site** → **Import an existing project** → GitHub →
`RickyRampersad/RickyRampersadTermLIfe`, then:

| Setting | Value |
|---|---|
| Branch to deploy | `main` |
| Base directory | `travel` |
| Publish directory | `travel` |
| Build command | *(leave empty)* |

`travel/netlify.toml` supplies the security headers automatically.

## 2. Point the domain

Netlify → **Domain management** → **Add a domain you already own** →
`travelmedicalcover.com`.

Netlify then gives you one of two options at GoDaddy:

- **Netlify DNS** (simpler) — change GoDaddy's nameservers to the four Netlify
  gives you. Netlify then handles the A/CNAME records and the certificate.
- **Keep GoDaddy DNS** — add an `A` record for `@` pointing at Netlify's load
  balancer IP, and a `CNAME` for `www` pointing at your `*.netlify.app`
  subdomain. Netlify shows the exact values.

Either way, let Netlify issue the free Let's Encrypt certificate, and turn on
**Force HTTPS** once it's issued. DNS usually settles within an hour.

## 3. Check it went out properly

- `https://travelmedicalcover.com` loads over HTTPS with no certificate warning
- The tab shows the green globe favicon
- Work an estimate through: dates, a date of birth, then **See my estimate**
- **How to apply** shows VUMI's links and asks for nothing
- View source and confirm the footer says the site collects no personal
  information

## 4. Before you announce it

Two things still need your input — both are in the `CONFIG` block at the top
of the `<script>` in `index.html`:

- **`VUMI_OFFICE`** is empty. Fill in the Miami office details if you want them
  shown on the "How to apply" step.
- **VUMI's contact details** are taken from the plan overview and the June 2026
  rate card, which disagree with each other on the office address and the
  claims administrator. Confirm the current portal URL, phone numbers and email
  before you send anyone to them.

## Keeping it up to date

### When VUMI reissues the rate table

Edit the `RATES` object in `index.html`. It mirrors the layout of the rate card:

- `single.bands[].perDay` — the per-day premium for each age band
- `annual.bands[].premiums` — `[30-day, 45-day, 90-day]` for each age band
- `single.riders` / `annual.riders` — non-medical and trip cancellation
- `single.setupFee` — currently US$50

Then update the `rateCard` string (search for `"VUMI Travel VIP — June 2026"`)
so anything printed says which table it came from.

`SETUP_FEE_BASIS` is set to `"policy"` — one US$50 fee per application. If VUMI
confirms it's charged per insured person, change it to `"person"`.

### Switching the site's mode

`CONFIG.MODE` controls what the site does:

- **`"referral"`** (current) — informs, estimates, and hands off to VUMI.
  Collects nothing, transmits nothing.
- **`"intermediary"`** — the full application flow: collects the application
  and emails it to `EMAIL_TO` and `EMAIL_CC` for keying into VUMI's portal.

Only switch to `intermediary` once your registration clearly supports placing
this business. In that mode the footer names the intermediary, so set
`INTERMEDIARY_NAME` — until you do, it shows a visible warning on the page.

To capture applications to a Google Sheet in intermediary mode, deploy
`apps-script/TravelQuote.gs` and paste its `/exec` URL into `CONFIG.API_URL`.
That file has its own setup instructions at the top.

## Note on the repository

This site currently deploys from a public repository named after the branch.
Anyone who inspects the Netlify deploy source or finds the repo can connect the
two sites. If that matters, move `travel/` into its own repository and point
Netlify at that instead — the site is one file plus this folder, so it moves
cleanly.
