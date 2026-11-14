# agentmgt.com — putting the rebuilt page live

The recruiting page (the selection, the 60-second test, the five gates) lives
in **`agentmgt/`** in this repository and is served by **Netlify** at
agentmgt.com. Nothing else in the repository reaches that domain, and nothing
in `agentmgt/` reaches rickyrampersadbranch.com.

What is in the folder:

| file | what it is |
|---|---|
| `index.html` | the whole page: copy, styles and script in one file |
| `mark.svg` | the branch shield and check, in the page's wine (favicon.svg's own shape) |
| `icon.svg` | the same on a dark tile, for the browser tab |
| `qr.svg` | the QR code on the final card: it opens the TalentNest application |
| `og.jpg` | the picture a WhatsApp, Facebook or LinkedIn link preview shows |
| `netlify.toml` | the headers and the short links `/apply`, `/quiz`, `/test` |
| `trailer.mp4`, `trailer.jpg`, `trailer-story.mp4`, `trailer-story.jpg` | the 90-second film, wide and phone, with posters |
| `ad-a-square.mp4`, `ad-a-story.mp4`, `ad-b-square.mp4`, `ad-b-story.mp4`, and their `.jpg` posters | the 35-second feed ads: A for the advisor already contracted (0:35), B for the person new to the work (0:40); square 1080×1080 for the LinkedIn and Facebook feed, 1080×1920 for Reels and Stories; captions burned over the picture |
| `ad-a.html`, `ad-b.html` | the ads' source pages, drawn by `build-recruitfilm.py` in `ad` mode (not linked) |
| `recruit.mp4`, `recruit.jpg` | the full film, 1280×720, 7:34, thirty-two scenes (the journey from the day you apply), and its poster |
| `recruit-story.mp4`, `recruit-story.jpg` | the same film cut 1080×1920 for the phone (WhatsApp status, TikTok, YouTube Shorts; at 3:54 it is over Instagram's Reels limit, so post the link there) |
| `film.html` | the film's source page, drawn by `tools/film/build-recruitfilm.py` (not linked) |
| `player.js` | the branch's film player: tap to pause, a dot per scene, mute, full screen |

## The page lives on the branch site first: /careers/

Since 28 October 2026 the recruiting page is served on **rickyrampersadbranch.com/careers/** (GitHub Pages, from
`careers/index.html`), so the Careers button on the homepage opens it the moment main is merged, with no Netlify
step. `tools/careers/sync.py` writes that file from `agentmgt/index.html`: the HTML is copied, every asset (the mark,
the films, the posters, the QR, the player, the tab icon) is read from `/agentmgt/`, where GitHub Pages already
serves the folder, and the canonical address and the share card say `/careers/`. **Edit `agentmgt/index.html` and
run the script; never edit `careers/index.html`.** The homepage's Careers section, `/careersvideo/` and the posts all
send people to `/careers/`, one address. agentmgt.com stays the short address for the same page: either of the two
ways below, or a plain redirect of the domain to `https://rickyrampersadbranch.com/careers/` in Netlify, which is one
page fewer to keep right.

## Two ways to deploy

**A. Link the Netlify site to this repository (do this once, then every merge
to `main` publishes by itself).**

1. Netlify → the agentmgt.com site → *Site configuration* → *Build & deploy*
   → *Continuous deployment* → *Link repository*.
2. Choose `RickyRampersad/RickyRampersadTermLIfe`, production branch `main`.
3. **Base directory: `agentmgt`**. Build command: none. Publish directory: `.`
   (the folder itself; Netlify shows it as `agentmgt`).
4. Deploy. From then on, the folder on `main` is the site.

**B. Netlify Drop (quickest, by hand).**

Download the repository as a zip (GitHub → *Code* → *Download ZIP*), unzip it,
and drag the **whole `agentmgt` folder** onto the site's *Deploys* page. A
manual deploy replaces every file, so it must be the whole folder every time,
not one file.

The site is already on Netlify, so the domain, the certificate and the DNS
need nothing.

## Before you believe a report about the live page

The page served at agentmgt.com until 26 October 2026 was an earlier build
uploaded by hand, not from any repository. Check what the domain is actually
serving before hunting a bug:

```
curl -sI https://agentmgt.com/ | grep -i content-length
```

The rebuilt `index.html` is about 54 KB; the old page was 55,769 bytes, so
compare the etag or open the page and look for the shield with the five gates
circling it.

## Things that are deliberate

- **The apply button, the QR code and `/apply` all open the same TalentNest
  posting** (`guardianlifeofthecaribbean.talentnest.com/en/posting/215291/location/287275`).
  If Guardian issues a new posting, change it in `index.html` (`APPLY`, and the
  four `data-apply` links), in `netlify.toml`, and regenerate `qr.svg`:

  ```
  pip install qrcode
  python3 -c "import qrcode,qrcode.image.svg as s;q=qrcode.QRCode(border=2);q.add_data('<new url>');q.make();q.make_image(image_factory=s.SvgPathImage).save('agentmgt/qr.svg')"
  ```
  then set the path's `fill` to `#17191F` and give the root `width="164" height="164"`.
- **The view counter beacon** at the foot of `index.html` carries the
  `RRB_VIEWS_URL` placeholder, as every branch page does. Replace it with the
  deployed Apps Script `/exec` URL to count views on the RRB Site View Counter
  sheet; until then it does nothing.
- **Every piece of motion is inside `prefers-reduced-motion: no-preference`.**
  With motion off the page is the plain finished state: all ten chips around
  the shield, every card, every heading. Nothing depends on the script.
- The copy is the approved copy from the previous page, word for word. The
  quiz questions and the three verdicts are unchanged.

## The film

`recruit.mp4` plays on agentmgt.com (the "Watch the film" block under the figures) and on the branch site at
**rickyrampersadbranch.com/careersvideo/**, which is the page to post: it carries the Open Graph tags, so a link
pasted into WhatsApp, Facebook or LinkedIn previews with the poster. The same page offers the phone cut. The MP4
itself is served from both domains (`/agentmgt/recruit.mp4` on the branch site, `/recruit.mp4` on agentmgt.com).

To re-cut it: edit the lines in `tools/film/recruit-lines.json`, voice them on the `tts-run` runner (Andrew
Expressive, `en-US-AndrewMultilingualNeural` at +0%, `"check": true`), then in `tools/film/`:

```
python3 importvox.py <tts/out/recruit> vorecruit 1.15 --timing recruit-timing.json
python3 films-recruit.py && python3 build-recruitfilm.py
for k in recruit recruitv; do python3 sfx.py "$(python3 -c "import json;print(json.dumps(json.load(open('films.json'))['$k']))")" sfx-$k.wav; done
python3 usetrack.py ../../rr-branch-theme.mp3 recruit recruitv
node render.js ../../agentmgt/film.html cap-recruit 30 ../../agentmgt/recruit.jpg
RENDER_W=1080 RENDER_H=1920 node render.js ../../agentmgt/film.html cap-recruitv 30 ../../agentmgt/recruit-story.jpg
for k in recruit recruitv; do python3 mixany.py "$(python3 -c "import json;print(json.dumps(json.load(open('films.json'))['$k']))")" "$(python3 -c "import json;print(json.load(open('films.json'))['$k']['out'])")"; done
```

Then put the new `durs` from films.json on the three `data-scenes` attributes (agentmgt/index.html and
careersvideo/index.html, both cuts) and the length beside them; `scenes.js` and `pages.py` in the session scratchpad
did both on 26 October.

## The feed ads

The 7:34 film is what a candidate watches after the call, and the 1:27 trailer is for the page. Neither is what a
feed shows: LinkedIn and Facebook stop paying out after about thirty seconds, and most of the audience watches
muted. So the ad itself is about forty seconds, in two variants, one per reader.

**Both are built on LIMRA's own finding about the second year** (2025 Annual Conference, session 16): *"The second
year, commonly referred to as the 'cliff' … Agents are on their own, without much of the support provided during
the first year"*, and an industry four-year retention stuck at 14%. The cause LIMRA gives is that new agents
exhaust the friends-and-family market with no prospecting system behind it.

| | A — 40.4s | B — 40.6s |
|---|---|---|
| for | an advisor already contracted somewhere | somebody new to the work |
| 1 | "You are good at it. And the support stopped." | "No ceiling? Afraid of the first year?" |
| 2 | the cliff, with LIMRA quoted on screen | the names running out, struck off one by one |
| 3 | 14 of a hundred left — here, 31 | the leads come to you; trained before contracted |
| 4 | 39 things, the households, a coach not a clock | the industry keeps 14, this branch keeps 31 |
| 5 | seven places, the conversation, the address and QR | the same |

Post the **square** cut in the feed and the **tall** cut as a Reel or Story; the first frame carries the shield and
the question, which is what shows before anyone taps.

**The retention chart plots only points that have a source.** LIMRA gives year one and year four and *names* year
two without publishing a figure for it, so it is a slope chart of two sourced endpoints a series with year two
annotated on the axis — never a four-point curve, half of which would be invented. The footnote names both sources.

To re-cut one: the lines are `tools/film/recruit-adA-lines.json` and `recruit-adB-lines.json`, voiced on the
runner, then in `tools/film/` — **on python3.13, not `python3`**: the builder uses nested same-type quotes inside
f-strings (3.12+) and on 3.11 dies with a `SyntaxError` pointing hundreds of lines away from the real cause.

```
python3.13 importvox.py <staged vox> voadA 0.95 --timing recruit-adA-timing.json --lines recruit-adA-lines.json
python3.13 films-recruit.py
RECRUIT_MODE=ad RECRUIT_AD=A python3.13 build-recruitfilm.py                      # and B
node <scratch>/adcheck.js ../../agentmgt/ad-a.html 1080 1080                      # and 1080x1920, and ad-b
for k in adA adB; do python3.13 sfx.py "$(…films.json ${k}q…)" sfx-$k.wav; python3.13 usetrack.py ../../rr-branch-theme.mp3 ${k}q; done
RENDER_W=1080 RENDER_H=1080 node render.js ../../agentmgt/ad-a.html cap-adAq 30   # ×4, both pages, both shapes
for k in adAq adAv adBq adBv; do python3.13 mixany.py "$(…films.json $k…)"; done
```

The **0.95** is the air between scenes, not the films' usual 1.15: five scenes at 1.15 spend nearly six seconds of
a forty-second ad on silence, and a feed cut wants pace.

A square frame is "portrait" to the page's media query (height is not less than width), so the square block in
the stylesheet comes after the portrait rules and only resizes what a square cannot hold. The bottom fifth of every
frame stays clear: the mixer burns the captions there — **measure that with `adcheck.js` rather than eyeball it**,
which is how the chart's own source line was caught sitting inside the band on the square cut.

**Never start the closing line on the address.** Dropping "Go to" so the sentence began on *"Ricky Rampersad Branch
dot com"* collapsed it into gibberish at 0.885 confidence in both ads; with "Go to" restored it transcribes exactly,
at 0.993. And a number opening a sentence before a noun slurs: *"Four years in"* comes back as *"For years in"*,
where **"By year four"** is clean.

## What a candidate actually meets when they apply — read 12 November 2026

Traced end to end against the live posting. **The application half is Guardian's, not ours**, and these are
the facts rather than an impression:

1. `/careers/` &rarr; **Start the official application** opens
   `guardianlifeofthecaribbean.talentnest.com/en/posting/215291/location/287275` — title **Sales
   Representative**, location **Ricky Rampersad &mdash; Chaguanas Regional Centre, Saint Charles**. So the
   posting is branch-specific, and it says **Full-time / Commission-Based** in its own words, which agrees
   with the ad.
2. Pressing **Apply** there does not open a form. It redirects to
   `/en/candidate/account/new?apply_posting_id=215291`, **"Enter Your Information"**: e-mail, first name,
   last name, telephone, address, and *are you currently an employee of Guardian Life of the Caribbean*.
   **An account comes before the application.**
3. Only then the application itself. What it asks cannot be checked from outside without creating a real
   candidate record in the branch's live ATS, which is not something to do for a test.

**Our page used to promise "two minutes to apply", in five places.** That was a promise about somebody
else's form, and the candidate met an account wall instead — at the exact moment they are most likely to
abandon. Every one of those claims is now what the journey really is, and the apply section carries a
four-step strip (`.applyflow`) naming the account step **before** the button, so nothing is a surprise.
Apply also opens in its own tab now: it used to replace our page, so a candidate who balked at the account
wall had nothing to go back to, and the conversation door went with it.

**Two things in the posting work against our own ads, and both are HR's to change, not ours:**

- **"Persons between the ages of 25 and 45 years old."** Ad A is aimed at advisors who already hold a
  licence and a book — a good number of whom are over 45. They tap our ad, read the branch's own posting,
  and are told they are out of range. Worth a word with HR on two counts: the commercial one above, and
  because the ad platforms have their own rules about age in employment advertising, which is a question
  for Compliance rather than an assertion from me.
- **"Should be currently earning a minimum of $6,000 monthly."** Ad B is aimed at people new to the work
  who want a career with no ceiling. A current-income floor turns away exactly that reader at the last step.

Neither is in our control. Both are worth raising, because the ad spend pays for the clicks either way.

**The funnel is now countable.** The apply click fires a second ping on the existing view beacon, from
inside the `<!-- rrb-views -->` block so `tools/wire-views.py` still governs the address (it rewrites the
first `var u=` after that comment — keep it the first declaration or the tool stops finding the page).
It records a path and nothing else, as the beacon always has. In the "RRB Site View Counter" sheet the
apply clicks land as `rickyrampersadbranch.com/careers/apply` against the page's own
`rickyrampersadbranch.com/careers`, so views-to-apply is readable for the first time. Past Guardian's site
we can see nothing at all, which is the honest limit.

## The conversation is booked on the page, never in another app

Since 28 October 2026 ("book a call opens WhatsApp so remove this") every "Book a confidential conversation" button
on the recruiting page, the homepage and `/careersvideo/` opens **`/careers/#talk`**: a form on the page (name, phone,
e-mail, where they are now, the best time for the call, one optional line) that posts `q.quote` with the form key
`careers` to the Service Questionnaire backend, the road the branch's own quote forms take. The backend files one row
on the Quote Requests tab with a `QT-` reference, e-mails **the Branch Manager alone** (never the sales support inbox:
the person may be contracted elsewhere today), and sends the person a confirmation that says Mr Rampersad reads it
himself. If the backend cannot be reached inside 12 seconds, the page still shows a reference and opens the mail app
addressed to him with the same details.

**Paste `apps-script/Quotes.gs` into the Service Questionnaire project, put `TEAM_CODE` back in Service.gs if you
paste that too, then Deploy → Manage deployments → pencil → New version.** Until the paste, the live backend answers
"Unknown form" and every booking takes the mail-app road, which still reaches him. `?action=q.ping` lists `careers`
among `forms` once the new version is live.

## The posts

Two posts, one film, by the 27 October research (CLAUDE.md, "The reframe"): each names its reader in the first
line, because the ad platforms limit the targeting and the copy has to do the selecting; each leads with the
reader's own fear, then the specific answer, then one low-commitment ask. Under 120 words, WhatsApp bold.

Rewritten 12 November 2026 on the LIMRA cliff research, to match the ads: each post names the job in its first
line, states the pay model rather than implying it, and leads on **the support stopping** — because what moves a
producing advisor is not a better promise, it is recognising something they have lived. The one figure both posts
carry is LIMRA's own, and ours beside it.

**For practising advisors** (LinkedIn, the agents' WhatsApp groups, Facebook):

> *You are an insurance advisor. You are good at it. And at some point the support stopped.*
>
> The industry has a name for your second year. It calls it the cliff — agents left on their own, without the support they had in year one. Four years in, fourteen of every hundred are still with the company that hired them.
>
> In this branch it is thirty-one, and the reason is countable: thirty-nine things we do for an advisor, every week of your career. Clients matched to you household by household, with the file and the first thing to say. Leads on your own board. A coach, not a clock.
>
> Seven places in the first class of FY27, and one seat for a sales manager.
>
> One confidential conversation. Twenty minutes, this week. Nobody will know you asked.
>
> https://rickyrampersadbranch.com/careers/?from=ad-a-li
>
> Reply *TALK* and I'll call you.

Post it with `ad-a-square.mp4` attached (the feed plays the video; the link is for the rest).

**Change the tag at the end of the link to match where you are posting it** — `ad-a-li` on LinkedIn, `ad-a-wa`
in the agents' WhatsApp groups, `ad-a-fb` on Facebook. See "Which ad brought them" below; the tag is the only
thing that tells you afterwards which post produced the booking.

**For people new to insurance** (Facebook, Instagram, the branch's own circles):

> *A career with no ceiling, and afraid of the first year? Both are fair.*
>
> Straight with you: this is a sales career. But the year that breaks people is not the first. It is the second, when the names run out — your cousin, your old boss, the neighbour from church.
>
> Not here. The leads come to you, from people who asked to be called. You are trained, and in the field, before you are contracted. Thirty-nine things this branch does for an advisor, every week of your career, and a manager who is a coach, not a clock.
>
> Four years in, the industry keeps fourteen of every hundred. We keep thirty-one.
>
> Seven places in the first class of FY27. One conversation, twenty minutes this week — bring your questions.
>
> https://rickyrampersadbranch.com/careers/?from=ad-b-fb
>
> Reply *TALK* and I'll call you.

Post it with `ad-b-square.mp4` attached. Change the tag per platform: `ad-b-fb` on Facebook, `ad-b-ig` on the
Instagram Story's link sticker, `ad-b-wa` on WhatsApp.

**The branch's own post** (ad C, 13 November 2026 — the pinned one, for every platform). A and B each name one
reader and lead on that reader's fear. This one is the branch speaking for itself, so it answers the three
questions in the order the film asks them: what is this, what is the work, and what does this branch do that
nothing else here does. It is the only post that carries its sources, because it is the one that makes a claim
about the branch rather than about the reader.

> *A career in insurance sales. Paid on what you write. No ceiling, and no salary.*
>
> That sentence is the filter. If you want a salary band, this is not for you, and we would rather you knew now.
>
> The work is solving a problem: most families here have never seen their own numbers written down. Our fact find does the arithmetic while you talk, your client confirms it from their own inbox, and a manager reviews and signs it after they have.
>
> And it does not stop at the fact find. They sign, they rate you, and they hear from us when the policy is delivered and every year after. When something is outstanding, the branch chases it and tells you what was done. A journey, not a transaction — that is the part most advisors never get.
>
> You will not start from a cold list. The leads come to you, from people who asked to be called.
>
> And before you are contracted, you are profiled, your market is mapped, and you are trained — so you know whether this fits before you give anything up. Almost nobody in this market does that.
>
> Thirty-nine things this branch does for an advisor, every week of your career, and all of it digital.
>
> By year four the industry keeps fourteen of every hundred it contracts *(LIMRA and Finseca, 2022)*. We keep thirty-one, on our own roll — and the method is on the page, so you can check it.
>
> Seven places in the first class of FY27, and one seat for a sales manager.
>
> One conversation. Twenty minutes, this week.
>
> https://rickyrampersadbranch.com/careers/?from=ad-c-fb
>
> Reply *TALK* and I'll call you.

Post it with `ad-c-square.mp4` on Facebook and LinkedIn, `ad-c-story.mp4` on Reels, Stories and WhatsApp Status.
Change the tag per platform: `ad-c-fb`, `ad-c-li`, `ad-c-wa`, `ad-c-ig`.

**The bracketed source stays in.** It is six words and it is the reason the rest of the post is believed: every
other figure in it is the branch's own, and a reader who can check one assumes the others were checked too. The
same line is burned into the film under the chart, and the method behind our 31 — the cohort, the exclusions,
and that 31 is the low end of our own range — is under "See the figures, and how they are counted" on the page.

### The link is never in the video. It goes in the post.

**Nothing inside an MP4 is tappable.** The address on the closing frame and the QR beside it are both pictures.
A viewer on a phone cannot touch either one. So the link has to be in the post text every single time, and where
it goes differs by platform:

| | where the link goes | clickable? |
|---|---|---|
| **WhatsApp** (the agents' groups) | in the message, on its own line | yes — and it previews the page |
| **LinkedIn** | in the post text, last line before the sign-off | yes |
| **Facebook** | in the post text | yes |
| **Instagram feed** | **captions are not clickable at all** | no — put it in the bio and say "link in bio", or post it as a Story with a link sticker |

Instagram is the one that catches people out: a caption full of `https://` does nothing there. Ad B is the cut
aimed at Instagram's audience, so for that platform either run it as a Story with the sticker, or change the
bio link to `/careers` for the week it is up.

**The QR is for a screen the viewer is not holding** — a laptop feed, the branch's own wall, a printed flyer at
an event. On a phone it is decoration. It costs nothing and earns its place in the other cases, so it stays, but
do not count on it in a feed.

**Where the figures come from, if anyone asks.** The 14 is LIMRA's published industry four-year retention
(2025 Annual Conference, sourced there to LIMRA and FINSECA, 2022); the cliff quote is that deck's own words; the
31 and the 39 are the branch's own record and the live careers page's own count. Nothing in either post is an
adjective standing in for a number.

**Every "Book a confidential conversation" button opens `/careers/#talk`, a form on the page** — not WhatsApp,
and not another app. That changed on 28 October 2026 and the paragraph that used to sit here still described the
old WhatsApp road, which is the sort of stale instruction somebody follows. There is no `wa.me` link left in
`agentmgt/index.html`, `careers/index.html` or `careersvideo/index.html`; the booking posts `q.quote` with the
form key `careers` and e-mails the Branch Manager alone. See "The conversation is booked on the page" above.

### Which ad brought them

The link in every post ends in `?from=<tag>`. Whoever books a conversation off that link arrives with the tag,
and **"Came from" is the first line of the Branch Manager's own e-mail** and the first line on the card at
`/hiring/`. Without it, forty bookings look identical and nothing says which post paid for them.

| where you post it | the link to paste |
|---|---|
| **LinkedIn** (ad A) | `https://rickyrampersadbranch.com/careers/?from=ad-a-li` |
| **The agents' WhatsApp groups** (ad A) | `https://rickyrampersadbranch.com/careers/?from=ad-a-wa` |
| **Facebook** (ad A) | `https://rickyrampersadbranch.com/careers/?from=ad-a-fb` |
| **Facebook** (ad B) | `https://rickyrampersadbranch.com/careers/?from=ad-b-fb` |
| **Instagram Story's link sticker** (ad B) | `https://rickyrampersadbranch.com/careers/?from=ad-b-ig` |
| **WhatsApp** (ad B) | `https://rickyrampersadbranch.com/careers/?from=ad-b-wa` |
| the film page | `https://rickyrampersadbranch.com/careers/?from=careersvideo` |
| anything else | `?from=post`, or any short tag of your own — it prints as `Tagged "yourword"` |

**A QR scan cannot be tagged, and the row says so.** The code baked into the four MP4s encodes
`https://rickyrampersadbranch.com/careers/` with nothing after it, so a scan and somebody typing the address in
look the same; those rows read **"Direct, or a QR scan"** rather than arriving blank. Tagging scans would mean
re-rendering all four ads, which is an hour's work and worth it only if the QR turns out to carry real traffic.

**Nothing profiles the apply click.** "Start the Selection" leaves the site for Guardian's TalentNest posting;
the candidate makes an account in Guardian's own system and the tag, the referrer and any reference are all lost
at that hop. So the conversation booking is the only door that reports back, which is the other reason to lead
with it in the posts.
