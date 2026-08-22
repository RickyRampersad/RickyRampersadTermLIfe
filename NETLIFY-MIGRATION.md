# Moving rickyrampersadbranch.com from GitHub Pages to Netlify

Written 22 August 2026. Companion to `DNS-BACKUP.md`, which records the
previous switch (GoDaddy Website Builder → GitHub Pages, 5 August 2026).

## Why

`netlify.toml` has been in this repository since the renewal portal was
built, and **GitHub Pages ignores it completely**. Verified on the live
site before this move:

| Check | Result on GitHub Pages |
| --- | --- |
| `/renew` — should redirect | `404` |
| `/claim` — should redirect | `404` |
| `/apps-script/Code.gs` — should be blocked | **`200`, 74 KB downloadable** |

That last row is the one that matters. `Code.gs` carries the deployed web
app URL and the branch's mail routing, and the comment beside `STAFF_KEY`
records that a previous key was published and had to be treated as burned.
The rule written to prevent exactly that has never once been in effect.

GitHub Pages cannot send headers or run redirects at all, so there is no
way to fix this while staying on it. Netlify runs `netlify.toml`, and the
protections start working the moment DNS points at it.

---

## ⛔ Do not let Netlify take your nameservers

Netlify will offer **"Use Netlify DNS"** and ask you to change the
nameservers at GoDaddy. **Decline it.**

`DNS-BACKUP.md` records that the zone holds 34 records, of which the `NS`,
`autodiscover` and nine `secureserver` records run **branch email and
calendar**. Moving nameservers to Netlify moves the entire zone: every one
of those records would have to be recreated by hand, and until it was,
branch email would stop arriving.

Choose the option Netlify calls **"Add domain without Netlify DNS"** /
external DNS. Two records change. Email is never touched.

---

## The move

### 1. Connect the repository

1. Log in to Netlify → **Add new site → Import an existing project**.
2. Authorise GitHub, pick `RickyRampersad/RickyRampersadTermLIfe`.
3. Branch to deploy: **`main`**.
4. Build command: **leave empty**. Publish directory: **`.`**
   (`netlify.toml` already sets both — confirm the form matches.)
5. Deploy. Netlify gives the site a temporary address like
   `something-random-12345.netlify.app`.

### 2. Test on the temporary address before touching DNS

Nothing is live yet and the domain still points at GitHub Pages, so this
is free to get wrong. On the `.netlify.app` address, check:

- [ ] The homepage loads and looks right.
- [ ] `/apps-script/Code.gs` returns **404** — this is the whole point.
- [ ] `/data/anything` returns **404**.
- [ ] `/renew` redirects to `/renewal/`.
- [ ] `/claim` redirects to `/claims/`.
- [ ] `/staff.html` and `/agent.html` open and unlock with their codes.
- [ ] `/meetings/` loads.

If any of those are wrong, fix them before step 3. After step 3 the site
is live to clients.

### 3. Rename the Netlify site (optional but worth it)

**Site configuration → Change site name** → e.g. `rickyrampersadbranch`.
The address becomes `rickyrampersadbranch.netlify.app`, which is what the
`www` record points at in the next step. Do this before the DNS change so
the name does not change afterwards.

### 4. Add the domain in Netlify

**Domain management → Add a domain** → `rickyrampersadbranch.com`.
Choose **external DNS** when asked. Netlify will show the records it
wants. They should match step 5.

### 5. Change exactly two things at GoDaddy

GoDaddy → **My Products → DNS → Manage Zones** → `rickyrampersadbranch.com`.

**Delete these four A records** (the GitHub Pages ones from 5 August):

| Type | Name | Data |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

**Add one A record:**

| Type | Name | Data | TTL |
|---|---|---|---|
| A | @ | `75.2.60.5` | 1 Hour |

**Edit the existing `www` CNAME** — change its data from
`rickyrampersad.github.io` to `rickyrampersadbranch.netlify.app`
(whatever you named it in step 3).

**Change nothing else.** The `NS`, `autodiscover`, `bounces.*`,
`calendar`, `email`, `fax` and `files` records stay exactly as they are.

> `75.2.60.5` is Netlify's load balancer. Confirm it against what Netlify
> shows you in step 4 — if their documented address has changed, theirs
> wins.

### 6. Wait, then verify on the real domain

DNS takes anywhere from a few minutes to an hour at the 1-hour TTL.
Netlify provisions the HTTPS certificate automatically once it sees the
records; if **Domain management → HTTPS** still says pending after an
hour, press **Verify DNS configuration**, then **Provision certificate**.

Then run the step 2 checklist again against `https://rickyrampersadbranch.com`,
plus:

- [ ] `https://` works and the padlock is clean (certificate issued).
- [ ] `http://` redirects to `https://`.
- [ ] `www.rickyrampersadbranch.com` reaches the site.

### 7. Turn GitHub Pages off

Repo → **Settings → Pages → Source: None**. This stops two hosts claiming
the same domain and stops GitHub re-adding the `CNAME` file.

Leave `CNAME` and `.nojekyll` in the repository. Netlify ignores both, and
keeping them means the rollback below is a DNS change only.

---

## Rolling back

Put the four GitHub Pages A records back, point the `www` CNAME at
`rickyrampersad.github.io`, and re-enable GitHub Pages in repo settings.
That is the whole rollback — `DNS-BACKUP.md` has the original values.

---

## What this does **not** fix

**The repository is public on GitHub.** Blocking `/apps-script/*` stops
the website serving those files; it does nothing about
`github.com/RickyRampersad/RickyRampersadTermLIfe`, where they remain
readable by anyone.

So the rule is unchanged after this move, and it is the important one:

> **Secrets go in the Apps Script editor, never in this repository.**
> `CONFIG.STAFF_KEY` in `Code.gs` and `MEET.JOIN_CODE` in `Meetings.gs`
> are placeholders on purpose. Set the real values in the Apps Script
> copy only. Anything committed here is public the moment it is pushed,
> whichever host is in front of the website.

Same for client data — `README.md` covers that, and it has not changed.
