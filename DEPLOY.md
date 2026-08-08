# Deploying to Netlify

There is no build step. The site is plain HTML, CSS and JS — pdf-lib is
vendored in `contracting/vendor/` — so Netlify publishes the repository root
as-is and a deploy has nothing that can fail.

## Two ways to deploy

### A. Connect the repo — recommended, deploys on every push

In Netlify: **Add new site → Import an existing project → GitHub →
RickyRampersadTermLIfe**. It reads `netlify.toml`:

| Setting | Value |
|---|---|
| Build command | *(none)* |
| Publish directory | `.` |
| Branch | whichever you deploy |

If the site was set up earlier with a build command, clear it under
**Site configuration → Build & deploy → Build settings**. `netlify.toml`
pins the publish directory, so that part is already handled.

### B. Drag and drop

```bash
./build.sh
```

produces `dist/` and `contracting.zip`. Drop either onto
<https://app.netlify.com/drop>. Both hold the whole site — a Netlify drop
replaces everything at the domain, not just the contracting pages.

`build.sh` is only for this manual route — a git-connected deploy never runs
it. Every later update means running it again and re-dragging.

## Keeping the private files off the web

The repository holds things that must never be served: the Apps Script
backends, the setup docs, the DNS record backup, and the client fleet
register. Publishing the root would serve them, so `netlify.toml` blocks each
one with a forced 404:

| Blocked | Why |
|---|---|
| `/apps-script/*` | Backend source, including your admin key once you set it |
| `/data/*` | Client fleet data — no page reads it |
| `/DNS-BACKUP.md` | Your DNS records |
| `/CONTRACTING-SETUP.md`, `/RENEWAL-SETUP.md`, `/DEPLOY.md`, `/README.md` | Internal notes |
| `/build.sh` | Build script |

**Add a rule whenever a new private file lands in the repository root** —
that is the one maintenance cost of publishing the root instead of a build
directory.

Worth checking after the first deploy: open
`rickyrampersadbranch.com/DNS-BACKUP.md`. It should be the 404 page. If it
serves the file, the rules are not being applied — tell me and I will dig in.

(The drag-and-drop bundle from `build.sh` leaves these files out altogether,
so the rules are belt-and-braces there.)

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
