# Deploying to Netlify

This repository holds **two separate sites**, and they deploy independently.

| Site | What it is | Publish |
|---|---|---|
| **Contracts app** | Rampersad Private, on its own domain | `contracting/`, or `dist-contracting/` from `./build-contracting.sh` |
| **Branch website** | rickyrampersadbranch.com as it was | repo root, or `dist/` from `./build.sh` |

Neither needs a compile step — both are plain HTML, CSS and JS, with pdf-lib
vendored. The build scripts only decide which files go out.

---

# 1. The contracts app

Its own Netlify site, its own domain. This is Ricky Rampersad Private —
nothing to do with the Guardian branch website, and it must stay that way.

There are two routes to the same site. Both work from a phone.

## A. Connect the repo — redeploys on every push

**Add new site → Import an existing project → GitHub →
RickyRampersadTermLIfe**, pick the branch, then set **one** thing:

| Setting | Value |
|---|---|
| Base directory | `contracting` |
| Build command | *leave empty* |
| Publish directory | *leave empty* |

`contracting/` is a finished site — pages, 404, `netlify.toml`, `_redirects`,
`_headers` and `robots.txt` all sit together in it. Netlify reads
`contracting/netlify.toml` and publishes the folder as-is.

**There is no build step, so do not set a build command.** If Netlify ever
reports something like `./build.sh: No such file or directory`, a build
command has been filled in somewhere — clear it under **Site configuration →
Build & deploy → Build settings**.

## B. Drag and drop — no GitHub involved

```bash
./build-contracting.sh
```

produces `dist-contracting/` and `contracting-app.zip`. Drop either onto
<https://app.netlify.com/drop>. Nothing is compiled — the build only copies
`contracting/` and checks the site is self-contained. Every later update
means running it again and re-dropping, which is why route A is the one to
settle on.

## What lands where

Either route puts the app at the site root, so the pages are:

| URL | Page |
|---|---|
| `/` | the application |
| `/c/<token>` | an applicant's personal link |
| `/track`, `/track/<code>` | the progress tracker |
| `/admin` | your pipeline dashboard |

The whole site is `noindex` and `Disallow: /` — it is for invited applicants,
not for search engines.

Give it a memorable name in **Site configuration → Change site name**, or
attach a domain of your own. Whatever address it ends up on has to match
`PORTAL_BASE` and `STATUS_BASE` in `apps-script/Contracting.gs`, since those
build the links in every email the backend sends.

---

# 2. The branch website

Unchanged, and it no longer carries the contracting app — `/contracting/*`
is blocked on that domain so there is only ever one live copy of the app.

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
| `/contracting/*` | The app has its own site — this keeps one live copy |
| `/apps-script/*` | Backend source, including your admin key once you set it |
| `/data/*` | Client fleet data — no page reads it |
| `/DNS-BACKUP.md` | Your DNS records |
| `/CONTRACTING-SETUP.md`, `/RENEWAL-SETUP.md`, `/DEPLOY.md`, `/README.md` | Internal notes |
| `/build.sh`, `/build-contracting.sh` | Build scripts |

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

On the branch site:

| Link | Opens |
|---|---|
| `/r/<token>` | Renewal portal for that client |
| `/renew` | Renewal portal |

The contracting short links (`/c/<token>`, `/track`, `/admin`) live on the
contracting site — see section 1.

Redirects only work once deployed to Netlify. Opening the files straight off
your hard drive will not redirect.

## After deploying, check

On the **contracting site**:

- `/` loads and moves through the steps.
- The review step generates and previews the three PDFs.
- `/admin` asks for your key; `/track` asks for a code.
- `/c/TESTTOKEN` lands on the application with the token filled in.

On the **branch site**:

- `rickyrampersadbranch.com/DNS-BACKUP.md` shows the 404 page, not the file.
- `rickyrampersadbranch.com/contracting/` shows the 404 page — the app lives
  on its own domain now.

The contracting app works with no backend at all — fill in, download, email.
Wire up the Apps Script backend when you want cross-device resume, the
recruiter dashboard and the automatic reminders: see `CONTRACTING-SETUP.md`.
