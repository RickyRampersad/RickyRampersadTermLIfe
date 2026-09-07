# The Facebook and Instagram ad

Two cuts of the same 23-second spot, both with the narration burned in as
captions so they work with the sound off — which is how most of the audience
will see them.

| File | Ratio | Size | Where it goes |
|---|---|---|---|
| `donthaveanagent/dhaa-ad-reel.mp4` | 9:16 · 1080×1920 | 1.8 MB | Reels, Stories, Explore |
| `donthaveanagent/dhaa-ad-feed.mp4` | 4:5 · 1080×1350 | 1.3 MB | Facebook and Instagram feed |

Both are −14 LUFS with a −1.9 dBTP ceiling, which is what the platforms
normalise to, so neither will be turned down or clipped on playback.

**Voice:** `en-US-AndrewNeural` at `-8%` — the house rule in `CLAUDE.md`,
never the Multilingual variant, which will read a line in another language
without warning. This is paid media in front of the public; that is not a
risk to carry.

---

## What it says

> Your agent left. Your policy didn't.
> You are still paying it. Nobody is still calling you.
> Four minutes, and you don't need to find the policy number.
> You see what you hold, what it would pay, and who it would pay.
> Free. Even if we never speak again.
> Don't have an agent dot com.

Nothing in it promises an outcome, quotes a premium, or names an insurer other
than as a matter of fact. It offers a free review and says what the review
shows — all of which the site actually delivers.

---

## Copy to paste into Ads Manager

**Primary text**

> Your agent retired, moved on, or passed away — and nobody replaced them.
> Your policy is still yours, and you are almost certainly still paying it.
>
> We will go through it with you. Free, about four minutes, and you do not
> need to find the policy number — we trace it.
>
> You will see what you hold, what it would pay, and who it would pay. If your
> records are out of date we prepare the forms for you to sign.
>
> Free whether or not we ever speak again.

**Headline**

> Nobody has called you about your policy in years

**Description**

> A free four-minute review. No policy number needed.

**Call to action:** `Learn more`
**Destination:** `https://donthaveanagent.com/start`

### A shorter primary text, for Reels and Stories

> Your agent left. Your policy didn't. A free four-minute review — we even
> trace the policy number for you. See what you hold, what it pays, and who
> it pays.

---

## Targeting, as a starting point

- **Location:** Trinidad & Tobago
- **Age:** 35–70. The orphan problem grows with the age of the policy.
- **Placements:** leave Advantage+ on and supply both cuts; Meta picks per slot.
- **Exclusions:** upload the branch's existing client list as an exclusion
  audience so the ad does not spend on people already being looked after.

Do **not** build an audience from the orphan register or upload it to Meta.
That is client data, it never leaves the branch, and it is not what the
register is for.

---

## Rebuilding either cut

The two share one page, `donthaveanagent/ad-reel.html`. The 4:5 rules live in
a `@media (max-height:1400px)` block, so recording the same page at 1080×1350
produces the feed cut with no separate file to keep in step.

```bash
cd tools/film
node record-ad.js                      # 9:16 — writes adcap/
python3 mixany.py "$(python3 -c 'import json;print(json.dumps(json.load(open("films.json"))["reel"]))')" dhaa-ad-reel.mp4
```

The feed cut is the same with the viewport and config set to `feed`.

`mixany.py` takes `w`, `h` and `capmode` now. `capmode: "over"` burns the
captions across the picture with an outline, which is the social convention;
the films keep `"strip"`, where the picture is cropped and the captions sit in
a band beneath it. Everything else — the measured capture timeline, the
loudness pass, the caption clamping — is shared.

Music: "Inspired" by Kevin MacLeod, CC BY 4.0. The credit must appear wherever
the ad is published as an organic post. Paid placements have no description
field for it, so keep it in the page and the post.
