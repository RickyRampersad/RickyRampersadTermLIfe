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
muted. So the ad itself is 35 seconds, in two variants, one per reader, each five scenes: the question, the fear
answered (A: never from zero, clients matched and leads on your board; B: leads from people who asked to be
called, the day set every morning, trained before you are contracted), a coach not a clock, five seats, and
agentmgt.com with the QR. Post the **square** cut in the feed and the **tall** cut as a Reel or Story; the first
frame carries the shield and the question, which is what shows before anyone taps.

To re-cut one: the lines are `tools/film/recruit-adA-lines.json` and `recruit-adB-lines.json`, voiced on the
runner under the keys `adA` and `adB`, then in `tools/film/`:

```
python3 importvox.py <tts/out/adA> voadA --timing recruit-adA-timing.json      # and adB
python3 films-recruit.py
RECRUIT_MODE=ad RECRUIT_AD=A python3 build-recruitfilm.py                        # and B
for k in adAq adAv; do python3 sfx.py "$(python3 -c "import json;print(json.dumps(json.load(open('films.json'))['$k']))")" sfx-$k.wav; done
python3 usetrack.py ../../rr-branch-theme.mp3 adAq adAv
RENDER_W=1080 RENDER_H=1080 node render.js ../../agentmgt/ad-a.html cap-adAq 30 ../../agentmgt/ad-a-square.jpg
RENDER_W=1080 RENDER_H=1920 node render.js ../../agentmgt/ad-a.html cap-adAv 30 ../../agentmgt/ad-a-story.jpg
for k in adAq adAv; do python3 mixany.py "$(python3 -c "import json;print(json.dumps(json.load(open('films.json'))['$k']))")" "$(python3 -c "import json;print(json.load(open('films.json'))['$k']['out'])")"; done
```

A square frame is "portrait" to the page's media query (height is not less than width), so the square block in
the stylesheet comes after the portrait rules and only resizes what a square cannot hold. The bottom fifth of every
frame stays clear: the mixer burns the captions there.

## The posts

Two posts, one film, by the 27 October research (CLAUDE.md, "The reframe"): each names its reader in the first
line, because the ad platforms limit the targeting and the copy has to do the selecting; each leads with the
reader's own fear, then the specific answer, then one low-commitment ask. Under 120 words, WhatsApp bold.

**For practising advisors** (LinkedIn, the agents' WhatsApp groups, Facebook):

> *Good at what you do, but stuck where you are?*
>
> The thing that keeps a good advisor where they are is the fear of starting from zero. At our branch you don't: clients whose agent has moved on are matched to you, household by household, with the file and the first thing to say. Leads land on your own board, in the prospect's words. The fact find does the arithmetic while you talk. Your name goes up every Wednesday. Your manager is a coach, not a clock. Thirty-two years in Trinidad. Five seats this year.
>
> One confidential conversation. Twenty minutes, this week. Nobody will know you asked.
>
> Watch (35 seconds, 90 seconds, or the whole journey): https://rickyrampersadbranch.com/careersvideo/
>
> Reply *TALK* and I'll call you.

Post it with `ad-a-square.mp4` attached (the feed plays the video; the link is for the rest).

**For people new to insurance** (Facebook, Instagram, the branch's own circles):

> *Want a career with no ceiling, but afraid of the first year?*
>
> Fair fear. Here is what is different: the leads come to you, so you are not selling to your friends and family. Every morning the system sets your day. You get training, boot camp and one-on-one coaching, and the Branch Manager interviews and coaches you personally. No salary band, no ceiling, and the ladder written down rung by rung. Thirty-two years in Trinidad. Five seats this year.
>
> One 20-minute conversation. Bring your questions; we show you the branch's own figures, not an adjective.
>
> Watch (35 seconds, 90 seconds, or the whole journey): https://rickyrampersadbranch.com/careersvideo/
>
> Reply *TALK* and I'll call you.

Post it with `ad-b-square.mp4` attached.

The "Book a confidential conversation" buttons on agentmgt.com and on `/careersvideo/` open WhatsApp to
**678-5821** (the number on the page's own footer) with the first line typed; `tel:` is the fallback in the
footer. If the conversations should go to another number, change the `wa.me/1868…` links in `agentmgt/index.html`
(five, `data-talk`) and `careersvideo/index.html` (one).
