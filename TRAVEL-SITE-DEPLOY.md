# travelmedicalcover.com — how to put it live

The site is a single self-contained `index.html`. No build step, no
dependencies, nothing to install.

## GitHub or Netlify — which do you need?

They do different jobs:

- **GitHub** stores the files and keeps a history of every change. It does
  **not** put anything on the internet.
- **Netlify** takes the files and serves them to the public at your domain.
  This is the part you actually need.

So: you need Netlify. You do **not** need GitHub for the site to work.

There are two ways to get the files onto Netlify. Pick one.

---

## Option A — drag and drop (recommended, ~5 minutes)

Simplest, and it keeps this site completely separate from your other one:
there is no repository connected, so nothing links the two.

1. Download `travelmedicalcover.zip` and unzip it. You'll get a folder with
   `index.html` and three small files.
2. Go to **https://app.netlify.com/drop** and sign up (free — "Sign up with
   email" is fine; you don't need a GitHub account).
3. Drag the **folder** onto the page. Not the zip, and not just index.html —
   the folder. It deploys in a few seconds and gives you a temporary address
   like `something-random.netlify.app`.
4. Open that address and check the site works.
5. **Site configuration → Domain management → Add a domain you already own** →
   type `travelmedicalcover.com` and follow the steps below.

To update the site later, open your site in Netlify, go to **Deploys**, and
drag the new folder onto the drop area at the bottom. It replaces the old one.

The trade-off: no version history, and updates are manual. For a page that
changes when the rate table changes — roughly once a year — that's fine.

---

## Option B — connect the repository

Better if you want every change tracked automatically. This does link the site
to the repository, which is worth knowing given the whole point of the separate
domain (see "A note on privacy" at the end).

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

---

## Pointing the domain at Netlify (either option)

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

## Check it went out properly

- `https://travelmedicalcover.com` loads over HTTPS with no certificate warning
- The tab shows the green globe favicon
- Work an estimate through: dates, a date of birth, then **See my estimate**
- **How to apply** shows VUMI's links and asks for nothing
- View source and confirm the footer says the site collects no personal
  information

## Before you announce it

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

## A note on privacy

The published folder has been checked and contains nothing that identifies you:
no name, no personal email, no phone number, no agent code, and no link to your
other site. Anyone can view the page source and will find only the insurer's
details.

That holds as long as two things stay true:

1. **`CONFIG.MODE` stays `"referral"`.** Switching to `"intermediary"` means
   filling in contact details, and anything you put in that file is public.
   If you do switch, use the Apps Script endpoint (`API_URL`) and leave
   `EMAIL_TO` and `EMAIL_CC` blank — the script holds the addresses on Google's
   servers where nobody browsing the site can read them.
2. **Setup notes stay out of the `travel/` folder.** Everything in that folder
   is served publicly. This file lives outside it for exactly that reason.

If you use **Option B**, the site deploys from a public repository named after
you, so anyone who inspects the deploy source can connect the two sites. Option
A has no repository attached and avoids this entirely.
