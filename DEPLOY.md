# Deploying to Netlify

The site is plain HTML, CSS and JS — there is nothing to compile. `build.sh`
exists only to decide *what gets published*: it copies the public pages into
`dist/` and leaves behind the things that are in the repo but must never be
served.

```bash
./build.sh
```

produces `dist/` (the folder to publish) and `rickyrampersadbranch-site.zip`
(the same thing, zipped for drag-and-drop).

## Two ways to deploy

### A. Drag and drop — quickest

1. Run `./build.sh`.
2. Open <https://app.netlify.com/drop>.
3. Drag in `dist/` — or `rickyrampersadbranch-site.zip`.

Every later update means running the build and dragging again.

### B. Connect the repo — deploys on every push

In Netlify: **Add new site → Import an existing project → GitHub →
RickyRampersadTermLIfe**, then confirm the settings it reads from
`netlify.toml`:

| Setting | Value |
|---|---|
| Build command | `./build.sh` |
| Publish directory | `dist` |
| Branch | `main` (or whichever you deploy) |

From then on, every push rebuilds and republishes. This is the better option
if you expect to keep changing the site.

Both routes publish identical files.

## What is published, and what is not

Published: `index.html`, `agent.html`, `staff.html`, `renewal/`,
`contracting/`, plus `robots.txt`, `_redirects`, `_headers`, `netlify.toml`
and `CNAME`.

**Held back on purpose:**

| Left out | Why |
|---|---|
| `apps-script/` | Backend source, including your admin key once you set it |
| `DNS-BACKUP.md` | Your DNS records |
| `CONTRACTING-SETUP.md`, `RENEWAL-SETUP.md`, `README.md` | Internal setup notes |
| `data/fleet-register.csv` | Client fleet data — no page reads it |

Worth knowing: if the site is currently deployed from the repository root,
those files are reachable today at e.g.
`rickyrampersadbranch.com/DNS-BACKUP.md`. Deploying `dist/` fixes that.

## Custom domain

`CNAME` in the repo is a GitHub Pages file; Netlify ignores it and is
harmless to keep. Point `rickyrampersadbranch.com` at Netlify under
**Domain management → Add a domain**, and follow its DNS instructions.

Do not run both GitHub Pages and Netlify on the same domain — whichever the
DNS points at is the one people see.

## Short links

`_redirects` and `netlify.toml` both set these up:

| Link | Opens |
|---|---|
| `/r/<token>` | Renewal portal for that client |
| `/renew` | Renewal portal |
| `/c/<token>` | Contracting packet for that applicant |
| `/contract` | A fresh contracting application |

They only work once deployed to Netlify — opening the files straight off your
hard drive will not redirect.

## After deploying, check

- `/contracting/` loads and moves through the steps.
- The review step generates and previews the three PDFs.
- `/staff.html` → **Contracting Pipeline** opens the dashboard.
- `/c/TESTTOKEN` lands on the contracting app with the token filled in.

The contracting app works with no backend at all — fill in, download, email.
Wire up the Apps Script backend when you want cross-device resume, the
recruiter dashboard and the automatic reminders: see `CONTRACTING-SETUP.md`.
