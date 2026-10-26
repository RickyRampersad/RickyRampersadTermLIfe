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
