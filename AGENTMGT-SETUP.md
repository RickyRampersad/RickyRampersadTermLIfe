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
| `recruit.mp4`, `recruit.jpg` | the recruiting film, 1280×720, 3:54, twenty-two scenes, and its poster |
| `recruit-story.mp4`, `recruit-story.jpg` | the same film cut 1080×1920 for the phone (WhatsApp status, TikTok, YouTube Shorts; at 3:54 it is over Instagram's Reels limit, so post the link there) |
| `film.html` | the film's source page, drawn by `tools/film/build-recruitfilm.py` (not linked) |
| `player.js` | the branch's film player: tap to pause, a dot per scene, mute, full screen |

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

## The post

For the branch WhatsApp group, Facebook and LinkedIn (under 120 words, one ask):

> *Good at what you do, but stuck where you are?*
>
> Four minutes on how our branch works now: leads that land on your own board, the Lead Desk that writes your opening from the prospect's words, the fact find that does the arithmetic while you talk, a live wall, a day the system sets for you, and Branch Intelligence on every file. Digital everywhere. Human at the heart of it. 23× MDRT. 32 years in Trinidad.
>
> Five seats this intake. Two minutes to apply, reviewed within 48 hours, and confidential if you are already contracted.
>
> Watch: https://rickyrampersadbranch.com/careersvideo/
>
> Know one person who should see this? Send it to them today.
