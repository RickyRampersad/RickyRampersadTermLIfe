# Ricky Rampersad Branch — house notes

Standing decisions for this repository. Read before regenerating narration,
scoring a film, or adding a product to the fact find.

## The mark — a gold shield with a check

`logo-mark.png` at the repository root, rasterised 4x from `favicon.svg`: a
**gold shield carrying a white check**, on the branch navy `#07131f`. That is
the branch's logo. It is not a monogram and there is no "RR" tile.

**Every screen and every letter uses that file.** Nothing draws a substitute.
Twice now a new screen has shipped with an invented "RR" on a blue gradient,
and both times it went out beside three screens carrying the real mark — a
branch whose own walls disagree about its logo is the first thing anybody in
the room notices.

```html
<div class="mark"><img src="<path>/logo-mark.png" alt=""></div>
```

**One exception, decided 17 September 2026**: the Branch Pending Wall slides
(`intelligence/wall/pending.html`, `intelligence/wall/reqs.html`,
`intelligence/wall/increases.html`, `intelligence/wall/codes.html`) carry a gold **nameplate** instead — `<div class="plate"><b>PENDING</b><span>wall</span></div>`
— because that is the one wall the branch stands in front of and argues from,
it runs over several slides, and the room has to know which wall it is watching.
Asked for in those words: *"remove the shield in this wall so persons will know
what wall they are watching."* A nameplate is a slide's name, not a substitute
logo; the rule against inventing a mark stands everywhere, this one included.
```css
.mark{display:grid;place-items:center}
.mark img{width:100%;height:100%;display:block}
```

**The mark has no dark tile behind it on the web, decided 21 October 2026.**
Asked for in those words: *"logo and changes as i dont like the blacks"*. The
shield and check are unchanged; what went was the rounded `#07131f` square they
sat on, which read as a black chip against the page. Web screens use
**`logo-mark.svg`** — the same artwork with nothing behind it — so the mark sits
on whatever colour the page is. `favicon.svg` keeps a tile, because a browser
tab needs one, but in the new navy.

**`logo-mark.png` is unchanged and still has its tile, on purpose.** It is what
the letters read, and e-mail is the one place the tile earns its keep: a
transparent PNG lands on the client's white background and the white check
disappears into it. So: `logo-mark.svg` on the web, `logo-mark.png` in e-mail.

**A fourth exception, decided 21 October 2026 and settled the same evening:
the homepage carries its own mark, in the homepage's own colours.**

It went blue first — asked for as *"change the gold!!!"* — using
`orphan-transition/board-mark.png`, the mark the assignment board, the board
films and RR Operations carry. That was wrong, and the manager said so:
*"Every thing is off and the site is horrible, all colors even the logo is
off!!!!"*. He was right, and the fault is nameable: the page was running
**three unrelated blues**. The mark was Guardian corporate `#13408F →
#2A6DE0` with a cyan check, the headings were `#0d3f5e`, the buttons were
teal `#00728d`. A mark that shares no hue family with anything around it
reads as pasted on.

Offered the two ways to unify — move the page to the mark's blue, or move the
mark to the page's teal — he chose **the mark follows the page**.

So the homepage carries **`site-mark.svg`**: `favicon.svg`'s own shield and
check, no tile, filled `#0e93b0 → #00728d → #0a3350`, the check white over a
navy casing. `site-icon.svg` is the same on a `#faf9f2` tile, for the tab,
and `index.html` alone declares it. Nothing is redrawn: it is the brand's own
silhouette in the page's colours, which is what `gcm-mark.png` and
`board-mark.png` already are in theirs.

**What this costs, and he accepted it:** the homepage mark no longer matches
the assignment board, the three board films or RR Operations, which keep the
corporate-blue shield; every other page and every letter keeps the gold one.
Four marks now, one per context. That is the price of a homepage whose logo
belongs to its own palette, and it was his call to pay it.

`logo-mark.png` does not move, as ever: the letters already sent load it.

The palette that goes with it: navy `#0d1f33`, gold `#efc24b` into `#c9942c`,
teal `#00CFEA`.

**The navy was lifted off near-black on 21 October 2026** — *"i dont like the
blacks"*. `#07131f` was dark enough to read as black, and worse, panels across
the site were flat `rgba(0,0,0,…)` laid over it, which on a coloured ground
reads as a grey haze rather than depth. The homepage and the 404 page now run:

| | old | new |
|---|---|---|
| base | `#07131f` | `#0d1f33` |
| raised | `#0d2137` | `#14314f` |
| card | `#163553` | `#1b4268` |
| card top | `#1b3d61` | `#22527f` |
| muted text | `#a9bbcf` | `#b9cadd` |

Gold and teal did not move. Two rules came out of it: **no flat black anywhere**
— panels are `--panel`/`--panel2` (navy tints) and shadows are `rgba(4,14,26,…)`
so they stay in the blue family; and **nothing dark sits on gold or teal except
`--ink` `#0a1a2b`**, never `#02141a` and never black. The muted grey had to come
up with the cards or it fell under 4.5:1 on `--card2`.

`IBRAND` in `Intelligence.gs` still carries the old navy, and the client letters
read it. Those were not touched here: an e-mail masthead is a different problem
from a web page, and changing it means re-checking every letter in Gmail first.

**A second exception, decided 8 October 2026: group client management** (the
four pages in `groupclientmanagement/` and the Monday letter built by
`gcmLetter_` in `GroupClients.gs`) has a corporate look and its own mark. The
mark is `groupclientmanagement/gcm-mark.png`: the same shield and check, white
on a corporate-blue tile. The manager asked for it in these words:
- *"change the yellow in the logo background and black"*;
- then, after six looks were turned down, *"a more corporate look"*;
- then *"dont like the white space"*.

The look:
- **Header band:** blue, `#13408F` into `#1D5BC4`.
- **Actions:** `#1D5BC4`.
- **Surfaces:** white panels on a grey ground, `#E9EEF5`.
- **Type:** IBM Plex Sans.
- **Status:** shown as a tinted label, never by colour alone.

The rest of the site keeps the gold shield. Do not carry this look further
without being asked.

**A third exception, decided 15 October 2026: the three board films**
(`orphan-transition/board-*.html` and their MP4s). On 14 October the manager
asked "can i have more graphics and motion and the colors scheme changed" and
chose the corporate blue from four offered; on 15 October, "can i have a
differnt colors and more motion and a bigger impact", and, shown four looks on
the same frames, "i like the purple", then "the yellow logo needs to change",
and, within the hour, "no leave dark blue instead and have the logo as well
blue". So the films are **midnight blue** (near-black navy `#070F26`, the
corporate blues `#13408F`, `#1D5BC4` and `#2A6DE0`, electric cyan `#00E5FF`)
and carry `tools/film/board-mark.png`: the same shield and check, white on a
blue tile, drawn from `favicon.svg`'s own shape by `tools/film/board-mark.js`,
as `gcm-mark.png` was for the groups.
It is embedded in the three films as a data URI, and a hosted copy,
`orphan-transition/board-mark.png`, sits on the board pages: asked the same
afternoon ("change the yellow logo to a blue i dont like the yellow"), and the
manager chose "the films and the board pages" over the films alone or the
whole site. So `assign.html` (the board), `board-films.html`, `wall.html`,
`dashboard.html`, `stream.html` and `responses.html` carry the blue shield
(their `.mark` tile is `#13408F` behind it, and their favicon is the same
file); never `gcm-mark.png`, never a redrawn shape. **The agent introduction
joined them on 16 October 2026** ("change the color i have said i do not like
the yello inside the logo nor the black!!!!!", on seeing the gold shield on
the near-black masthead of the Felicia sample): the "Meet your agent" e-mail
(`tIntroBuild_`, `tIntroTeamHtml_`, colours in `T_INTRO_LOOK`), the client's
page `your-policy/agent.html` and the sample carry the blue shield, and no
gold or near-black anywhere. The same evening the saturated blue masthead was
turned down too ("improve on the color as this is hurting the eyes"): a pale
`#F2F6FD` header, white panels on `#F4F6FA`, deep blue type `#14284B` and one
action blue `#2D5BB9`, with the moving banner `orphan-transition/intro-motion.gif`
for the impact (see the introduction below). Anything new built for the board
or sent from it takes the same blues. Every other page and every letter
keeps the gold shield, and the hosted `logo-mark.png` is untouched: the
letters already sent load it.

The letter's logo is the hosted copy at
`https://rickyrampersadbranch.com/groupclientmanagement/gcm-mark.png`. Merge
the branch before pasting a `GroupClients.gs` that carries it, or the letter's
masthead arrives empty.

**In e-mail the logo must be a hosted PNG**, never SVG and never a `data:` URI —
Gmail strips the first and blocks the second, so the masthead arrives empty.
`IBRAND.LOGO` points at `https://rickyrampersadbranch.com/logo-mark.png` for
exactly that reason.

**In a film it has to be embedded**, because the film is one file played in an
iframe and a linked image does not load there. The builder folds it in as a
data URI under the `mark` key.

## The homepage look — light, and off gold, decided 21 October 2026

Asked for in these words: *"horrible a total professional makeover different
colors and change the gold!!! more graphics and motion as well scalled
intelligently and professionally"*, and then, decisively, *"i said the black
hurts the eyes!!"*.

Two dark redesigns were rejected on the same day. The second one took the
ground back to near-black `#070e1c` — **darker than the `#07131f` he had
already asked to be lifted off black that morning**. Read the complaint
before reaching for a palette: "I don't like the blacks" meant go light, not
go to a richer dark.

**The homepage is light.** Ground `#faf9f2`, white cards, deep blue ink.
Those values are sampled from **Guardian Life of the Caribbean's own live
stylesheet**, so the branch now matches its parent company, and the answer to
"why did the gold go?" is that Guardian itself has no gold anywhere.

| token | value | measured on the ground |
|---|---|---|
| `--ground` | `#faf9f2` warm off-white | — |
| `--card` | `#ffffff` | — |
| `--ink` headings | `#0d3f5e` | 10.53:1 |
| `--body` | `#2b3b47` | 10.94:1 |
| `--muted` | `#5b6670` | 5.56:1 |
| `--action` | `#00728d` | 5.25:1, white on it 5.54:1 |
| `--line` decorative | `#e4e0d4` | 1.25:1, separators only |
| `--line-strong` controls | `#7d8890` | 3.43:1 |

**Gold could not stay, and this is arithmetic rather than taste.** On a light
ground `#efc24b` measures **1.68:1** against white and `#c9942c` **2.71:1** —
both below even the 3:1 floor for non-text, so gold can never again be a
button, a link, a focus ring or a distinguishable icon. The branch teal
`#00CFEA` fails identically at **1.89:1**. They only ever worked because the
page was dark. The homepage therefore carries **`site-mark.svg`**, the brand's
own shield in this page's teal and navy — see the mark section above for why
it is not the blue one any more. Its lightest stop `#0e93b0` measures 3.42:1
on the ground, so the mark reads as a shape and not only as a colour.

**`logo-mark.png` is still untouched and still gold**, on purpose: every
client letter already sent loads it from the server, and changing that file
changes the masthead of letters sitting in people's inboxes. Gold shield in
e-mail, blue shield on the homepage.

**Two tokens for borders, not one.** Almost no border reaches 3:1, and only
the one defining a control has to. A separator uses `--line`; an input
outline or focus ring uses `--line-strong`.

**Pick the muted grey against the real ground, never against white.** Stripe's
`#64748d` measures 4.75:1 on pure white but exactly **4.50** on `#faf9f2` —
on the line, so effectively a fail. That is why `--muted` is `#5b6670`.

### What the research changed, and what it cost us to learn twice

- **Light against dark splits on sector lines.** Regulated retail money is
  light (Ethos, Marshmallow, MetLife, Policygenius, Wise, Monzo); dev tools
  and trading are dark (Linear, Vercel, Robinhood). A dark life-insurance
  site is a trading-app aesthetic on the wrong product.
- **Bento cards with soft 3D is a named tell.** A study of 808 juried
  Awwwards winners lists it among the patterns that make work read as
  machine-generated, and found **no single effect moves the jury score by
  more than ±0.05**. Effects are table stakes; composition and story are not.
  Do not rebuild this page as a grid of equal glass tiles.
- **Montserrat and Poppins appear on none of 27 live finance sites** checked
  for their actual font stacks. Open Sans does (Chase, Prudential), Inter
  does (Wise, Revolut, Brex, Ethos), Lato does (Lemonade). Free fonts are not
  the problem; those two specifically are the wrong signal. The page uses
  **Inter Tight** for display and **Inter** for copy.
- **The local bar is low and that is an argument, not a boast.** Four of the
  five live T&T insurer sites serve WordPress/Elementor default colour values
  in their markup, and one declares `'Chewy', cursive`.

### Rules the rebuild is built on

- **Motion is opt-in, never opt-out.** Every finished state is the plain CSS
  default and movement lives only inside
  `@media (prefers-reduced-motion: no-preference)`. That satisfies WCAG 2.3.3
  with no second code path, can never strand content invisible if an
  animation fails, and degrades silently in Firefox, which still has
  scroll-driven animations behind a flag.
- **No animation library.** Native `animation-timeline: view()` covers the
  reveals, `scroll(root)` draws the nav progress, `@starting-style` with
  `allow-discrete` covers the dialogs. `animation-timeline` must be declared
  **after** the `animation` shorthand, which resets it.
- **`backdrop-filter` on three surfaces only** — the nav and the two dialogs.
  It re-samples and re-blurs its backdrop every frame; one measured case put
  a GPU process at 400–470MB with it on cards.
- **Never animate `box-shadow`** — it is on web.dev's do-not-animate list.
  Hover lift uses `translate`.
- **`min()` inside every auto-fit grid**:
  `repeat(auto-fit, minmax(min(100%, 18rem), 1fr))`. Without the `min()` the
  page overflows at 320–360px, and that is the commonest amateur tell in a
  hand-written grid.
- **One space token for every section's `padding-block`.** It is `--sp-2xl`,
  not `--sp-3xl`: two adjacent sections each contribute it, so `--sp-3xl`
  made every boundary a ~240px hole.
- **No two adjacent sections share a column shape.** A repeated three-across
  card grid reads as a list however good the cards are.
- **Type bounds in a `clamp()` are rem, never px** — a px bound is WCAG
  failure F94 and defeats the 200% zoom requirement. Form controls use
  `max(16px, 1rem)`, because iOS zooms on a *computed* size under 16.
- **Icons follow Lucide's published rules**: 24×24 canvas, exactly 2px
  stroke, round joins and caps, ≥1px padding inside the canvas. One stroke
  weight across the set is what makes it read as designed. Every icon is
  `aria-hidden` with no accessible name; the text beside it is the label.
- **No emoji.** Not taste: they render differently per OS, cannot inherit
  `currentColor`, sit on font metrics so they never align to a grid, and
  screen readers announce their Unicode names.
- **Shadows take their hue from the ground, not from black.** `--sh` is
  `32deg 20% 42%`; transparent black desaturates a warm surface.

### The impact layer, added the same day

First cut of the light page was correct and dead: *"there is no motion nor
apealing and not impactful"*. Correct is not the same as alive. What went in,
all of it still inside the no-preference query:

- **Kinetic headlines, word by word, never letter by letter.** Splitting to
  characters is the dated form and it wrecks the screen-reader read. The split
  is done in JS only when motion is allowed, and the heading first gets its
  whole sentence as an `aria-label`, so assistive tech reads the sentence
  rather than walking a pile of spans. The hero splits on load; every other
  heading splits when it is nearly in view.
- **Counters count UP TO the figure already in the markup**, never to it. The
  true number ships in the HTML, so no JS — or a thrown error — still leaves
  the right figure on screen. Shipping `0` and filling it in by script is how
  a page ends up showing zeros.
- **Two drifting colour fields behind the hero**, radial gradients with a long
  transparent falloff. Not `filter: blur()` on a moving layer: that has to be
  re-rasterised every frame and is what took an earlier build to about 5fps.
- **Hover depth moves an opacity, not a shadow.** The lift shadow lives on a
  `::after` and only its opacity transitions, because `box-shadow` is on
  web.dev's do-not-animate list.
- **A moving strip of what the branch covers**, paused on hover, and the
  open/closed dot breathes, so the page has a pulse at rest.
- **One statement moment** between the quotes and the applications: large
  type, scroll-driven, saying the thing the whole site is for.

Measured after: 16.7ms a frame over three passes, cumulative layout shift 0.

### The hero is the hovering shield, and it is not to be removed again

Asked for on 21 October 2026, after a rebuild replaced it with a stat panel:
*"I found the shield before with the motions and the logo and the animation
with it hovering, etc., was very effective. Just the color was not nice. And
I've asked you to improve on this and you've went backwards. We are very tech
driven."*

Read that carefully, because it is the whole lesson of the week. The complaint
about the dark build was the **colour**. The composition was right and was
thrown away with the palette. When a look is rejected, change the thing that
was named and keep the rest.

**Nothing sits on the mark.** The first cut put three instrument panes in
front of it, and the manager was right about them: *"things should be
circling around in terms of the lines that we covered, because that's the
shield, the objective of the shield. Not things blocking the shield is what
I'm seeing."* The panes were covering the thing the scene is about, and
their figures already repeated in the band directly below, so nothing was
lost in taking them out.

The hero is a stage: the mark at the centre, and **the twelve lines of cover
circling it** on two rings. That is a diagram of the business, not
decoration.

**Eight slots, twelve lines.** A ring of twelve reads as clutter, so four
slots are shared by two lines that take it in turn, one changing every 3.4
seconds. Every line is in the markup; the resting one sits at opacity 0,
which keeps it in the accessibility tree, so a screen reader hears all
twelve either way.

**With motion off, the ring spreads instead of cycling.** Each line carries
two angles: `--a`, the slot its pair shares, and `--a2`, its own place on
the ring. `--ang` is `--a2` by default and becomes `--a` only inside
`prefers-reduced-motion: no-preference`, and the opacity-0 rule for a
resting pair lives in that query too. Without this the script never runs and
four lines are invisible for ever — which the audit caught, and which is the
house rule about never stranding content. Six to a ring, sixty degrees
apart, and the static diagram is arguably the better drawing of the two.

**The composition is a fraction of the stage, not of the viewport.** The
stage is a container (`container-type: size`) and the radii, the chip and
the label size are `cqw`, so the drawing is identical at 320px and at 1920;
the `vw` clamps are the fallback where container queries are not supported.
Measured: the mark is 28.8% of the stage at every width from 768 up. Behind them a dot mesh, two drawn
rings, two arcs sweeping against the spin, and three pings leaving the
shield. The whole scene tilts to the pointer, which is what reads as
hovering. Mouse and trackpad only: a tilt that sticks where a finger left it
looks broken.

**How a chip stays upright.** Each is placed with
`rotate(a) translate(r) rotate(-a)` — the classic place-on-a-circle
one-liner — and an inner span counters the ring's own spin at the same
duration. The ring animates the `rotate` **property** while the node holds a
static `transform`: separate properties, so they compose instead of one
overwriting the other. `ring-out` reverses both its ring and its chips,
which still cancels.

**Short labels inside, long ones outside, and none at all on a phone.**
Labels at the 9 and 3 o'clock positions reach back across the inner ring, so
they wrap at `6.5rem` rather than running on, and the four short names take
the inner ring. Below 35rem the ring is icons only: the names cannot fit
around a circle that size without landing on each other or on the mark, and
the live strip immediately beneath the hero carries them instead.

**The stage is capped by the viewport too** — `min(32rem, 100%, 100vw -
2.5rem)`. The grid area can be wider than the page's own gutters allow, and
a stage wider than the screen puts the outer ring under `overflow: clip`.

**The mark is inlined, and it is still the mark.** The hero's SVG is the same
artwork as `orphan-transition/board-mark.svg` — which is `favicon.svg`'s own
shape in the board blue — inlined so the check can be stroked on rather than
arriving already drawn. Nothing there is redrawn or invented; the rule against
a substitute mark stands. `orphan-transition/board-mark.svg` is new and the
nav and footer use it, because a vector beats a 352px PNG on a web page.
**`board-mark.png` is untouched**: the board pages and the three films load it,
and the films carry it as a data URI.

The panes carry what the stat card carried — lines of cover, the MDRT record,
the years — so the move lost no content.

**Two traps, both of which drew the rings invisibly at first:**

- An absolutely positioned SVG with `width: 100%` inside a grid whose height
  comes from `aspect-ratio` has no percentage basis to resolve against. They
  are grid items in the one cell now (`grid-area: 1 / 1`), sized by their own
  square `aspect-ratio`. `place-self: stretch` does **not** help: an SVG is a
  replaced element and stretch leaves it at its natural size.
- `svg:not([width])` near the top of the sheet is specificity (0,1,1) and
  outranks a bare class, which pinned them to 20px even once they were grid
  items. The rule has to be `.stage .mesh`, `.stage .orbit`.

**On a phone, two panes, never three.** The first cut put the product pane
straight across the check and the mark read as a blue smudge. Below 48rem
`.pane-b` is hidden; the three products are in the ticker directly beneath
anyway.

**The loops park by a class added on exit, never removed on entry.**
`.hero.rest` pauses them when the hero leaves the screen. The other polarity
— JS adds `.live` to start things — freezes every `backwards`-filled entrance
at its invisible first frame when the script does not run.

**"How it works" was a void** and is the template for any section that reads
flat: each step carries an icon chip with its number on the shoulder, the
connector draws itself on scroll and a pulse runs along it (two animations,
one touching `scale` and the other `background-position`, so they compose —
`animation-timeline: view(), auto`), and the section sits on the same dot
field as the stage. `.mesh-bg` is that field, reusable.

### `scrollWidth` is not a test for sideways scroll

The audit used `scrollWidth > clientWidth` and it is the wrong measure in both
directions. With `overflow-x: clip` on the body — which **propagates to the
viewport**, so the body ends up visible and the html element clips — a
deliberately clipped marquee reads as a failure though nothing can scroll.
Worse, it hid a real one: the hero's decorative field at `right: -8vw` was
genuinely scrollable, 102px of sideways drag at 1280, and the proxy never
distinguished the two. The check now *attempts the scroll* and reads
`scrollX`, and separately reports any element overflowing with no clipping
ancestor. `.hero` takes `overflow: clip` (not `hidden`, which would make it a
scroll container).

### The audit harness

`qa/audit.js` in the session scratchpad measures the page rather than
asserting it: no sideways scroll at the real-world widths (360/375/390/414
and 1280/1366/1536/1920 — phones cluster at the first four), WCAG AA contrast
**composited through translucency**, WCAG 2.2 2.5.8 touch targets with the
inline-link exception, iOS input zoom, reduced motion, CLS, and content
hygiene. It caught three genuine bugs this build: a specificity collision
where `.nav-links a` (class + type) outranked `.btn-1` and rendered the Get a
Quote button's text dark-on-teal at 2.08:1; a 4px overflow at 360px from a
blanket `white-space: nowrap`; and the old page's 14px footer links.

Two of its own false positives are worth knowing about, because both would
otherwise be mistaken for page bugs: `color-mix()` computes to
`color(srgb r g b / a)` whose **channels run 0–1, not 0–255**, so a naive
parser reads a near-white nav as near-black; and gradient-backed text cannot
be read from computed style at all, so it is reported for the eye rather than
failed, the way axe reports "incomplete".

Measured after: every check passing, 16.7ms a frame across three passes,
cumulative layout shift 0.

## The voice — narration on every film

Rendered with **edge-tts**. Free, no account, no licence, so nothing here needs
clearing before it goes on WhatsApp, YouTube or a wall screen.

```
pip install edge-tts

VOICE="en-US-AndrewNeural"     # NOT the Multilingual variant — see below
RATE="-12%"                    # -8% for a trailer; -3% was rushing

edge-tts --voice "$VOICE" --rate="$RATE" --text "…" --write-media line01.mp3
```

**Never the Multilingual variant.** `en-US-AndrewMultilingualNeural` detects
language from the text and will read a phrase in another one. It was used for
the first cut of both wall films and the note back was "I am hearing a different
language" — which was exactly what it was. `en-US-AndrewNeural` is the same warm,
confident read with no language detection in it.

**Changed for the wall and the FY27 film, 21 October 2026.** Mr Rampersad heard
`en-US-AndrewNeural` at -4% as "robotic" ("needs to be more human"), listened to
five samples over the branch track and chose **"Andrew Expressive"**:
`en-US-AndrewMultilingualNeural` at +0%, with the lines rewritten in spoken,
conversational wording (contractions, short sentences, "we" and "you"). Because
the Multilingual voice can still slip into another language, every clip made on
the runner is transcribed with Whisper (`tts.yml`, `"check": true` in the job,
results in `tts/out/check.json`) and any clip not heard as English, or whose words
differ, is re-worded and re-made before it is used. Other films keep the rule above
until he says otherwise.

Output is 24 kHz mono MP3 — plenty for speech over a music bed.

**Why these settings.** Andrew at `-12%` reads under natural pace, lets a full
stop land, and does not smile. `-3%` was the first setting and it rushed: thirty
lines at that rate with half a second between them is a briefing, not a
walkthrough. The pauses come from the film's `GAP` — the silence between lines —
not from punctuation tricks in the text.

**Writing for it.** Short declarative sentences. State the fact and trust it —
do not sell. If a line needs to breathe more, split it into two sentences
rather than reaching for commas. The browser's own speech synthesis was tried
first and was not good enough; do not go back to it.

`benefits/audio/build-voice.sh` regenerates the narration and prints durations.
`benefits/audio/embed-audio.py` folds the MP3s back in as data URIs — the film
has to stay one file, because the wall plays it in an iframe and the hosted copy
will not fetch a sibling. A linked MP3 is silent in exactly the two places that
matter.

Timings come from the rendered audio, never from estimates. Scene boundaries sit
just before each line, every line gets a beat of silence after it, and reveal
counters fire on the words that name them — read those offsets off the subtitle
cues edge-tts emits. Measured drift across a full play is 0.02 s.

## The branch theme — why three films sound like one organisation

Written for the branch, not licensed from anyone. Every film shares its key and
tempo; that is the whole reason they sound related.

| | |
|---|---|
| Key and tempo | **D major · 108 BPM** |
| Progression | **D – A – Bm – G** |
| Voicing | Pads, pluck, brushed hat |
| File | `rr-branch-theme.mp3` |

### The launch film's bed is played, not loaded

`benefits/launch-eb.html` synthesises its own score in Web Audio — no track to
licence, no file to ship.

- Progression **D – F#m – Bm – G – D – A – G – D**, plain, major, unhurried
- `8.7 s` per chord; eight chords carry the film
- Four voices per chord: two detuned saws through a soft low-pass (900 Hz,
  Q 0.4) for warmth, a triangle an octave up for air, a sine underneath for
  weight
- Long attacks and releases, so chords bloom into each other instead of stepping
- Sits well under the voice, lifts into the reveal, opens out for the close —
  the only two places a bed like this should be noticed

## WhatsApp messages to the branch — short, or nobody reads it

Every message written for the branch group follows the same four rules, and the
first one is the one that keeps getting broken:

| | |
|---|---|
| **Compact** | Under about 120 words. A 280-word message is a memo, and a memo in a WhatsApp group is scrolled past. |
| **Motivating** | Address the agent, not the branch. "Your name is on it", not "agents can see their names". |
| **Innovative** | Lead with the number nobody in the room already knows. One finding, not five. |
| **Prompts a comeback** | End with a specific ask that is easy to answer — *"Reply with one client you're calling Monday."* A message with nothing to reply to gets no replies. |

Shape: a bold one-line headline, two or three short paragraphs, one bulletless
finding, the ask. WhatsApp bold is `*single asterisks*`. No hard line wraps
inside a paragraph — WhatsApp reflows, and wrapped text arrives ragged on a
phone. Long-form detail belongs in the reply to the branch manager, not in the
group message.

If the picture carries a caveat banner ("preview · sample figures"), the message
does not need to repeat it.

## Hosting — the two chains never touch

| Source | Host | Serves |
|---|---|---|
| `RickyRampersadTermLIfe` (this repo) | **GitHub Pages** | rickyrampersadbranch.com |
| `fact-find-analyzer` | **Netlify** (project `factfinds`) | factfind360.com |

The `netlify.toml` in this repo is **inert** — GitHub Pages ignores it, so the
`/data/` block and the `/claims/` and `/renewal/` security headers it declares
are not applied. Do not treat it as protection.

`factfind360.com/ffproject` is served from **lowercase `ffproject.html`**.
Renaming it or changing its capitals moves the address every advisor already
has. Never deploy that site by dragging a folder onto Netlify — a manual deploy
replaces every file, and on 23 August 2026 that silently deleted
`walkthrough.html`, `insights.html`, `wall.html` and the 22 MB tour video. Two of
those are not linked from the home page, so nothing on screen showed they were
gone.

## The fact find — things that have bitten

**Emails are not in any repository.** The client approval letter and the manager
digest are both built in the **Google Apps Script** project. Searching this repo
or `fact-find-analyzer` for their text finds nothing; that is expected.

**Only life sums assured count as life cover.** `health` reimburses against a
schedule of benefits, `pa-di` pays a monthly income, `annuity-deferred` is a
savings target — none is payable on death, so none belongs in a total tested
against the life underwriting ceiling. Adding them is what produced a branch
"cover recommended" figure of TT$121m against twelve fact finds and a
recommend-ratio above 100% for every advisor at once.

**Check the type, never the name.** `Life Secure` and `Tophat` read as life
products and are both `annuity-deferred`.

**Five products carry no `type`** — `Lifestyle Pension`, `Lifestyle Privilege`,
`IPI`, `Rejuvenator`, `SPIA` — so type-based rules cannot see them. Get the
classification from the product sheet; do not guess one into a compliance
system.

**Products outside `PRODUCT_RULES` get no checks at all.** `Lifestyle Special
Edition` is not in the library, which is why the row carrying the largest figure
in a case was the one row nothing validated.

## The view counter — every page reports, one sheet records

Every served HTML page carries a `<!-- rrb-views -->` beacon before `</body>`.
It pings the Apps Script in `gs/views-counter.gs`, which appends
`time · page · referrer` to the **"RRB Site View Counter"** spreadsheet
(ID in the .gs). No client data — path and referrer only.

- **Keep the beacon** when regenerating or rewriting a page; re-add it if lost.
- `RRB_VIEWS_URL` in the beacon is replaced with the deployed /exec URL —
  if you see the literal placeholder, the counter is armed but not yet live.
- Redirect stubs (`about-us/`, `health-1/`, `xpress-life-application/`) and
  `apps-script/` templates deliberately carry no beacon.

---
---

# donthaveanagent.com — working notes

Guardian Life of the Caribbean, Trinidad & Tobago. Two products live here:

- **`donthaveanagent/`** — donthaveanagent.com, the site for orphan
  policyholders. Publishes on Netlify with `donthaveanagent` as the base
  directory, so only that folder reaches the web at that domain.
- **`service/`, `renewal/`, root `netlify.toml`** — the branch site
  (rickyrampersadbranch.com), including the Service Questionnaire. That site
  is on **GitHub Pages**, so the root `netlify.toml` is inert there (see the
  hosting note above). donthaveanagent.com is on **Netlify** with
  `donthaveanagent` as the base directory, and **`donthaveanagent/netlify.toml`
  is live** — its redirects and headers are real.

Both talk to one Apps Script backend, `apps-script/Service.gs`.

### What the domain is actually serving — check before believing a report

On 7 September 2026 donthaveanagent.com was still serving a **snapshot from
22 August**: the oxblood theme, the 78-second launch film, three old MP4s,
and a 404 for everything made since (`client-film.html`, `process-film.html`,
`wall.html`, `preview.html`, the ad). `main` has never carried a
`donthaveanagent/` folder, so that snapshot did not come from a git deploy —
it is a manual upload, or a build that has been failing since.

So a note like "the birthday is not in one and in the other" is usually the
old cut on the domain against the new cut in the chat. Before hunting a bug,
`curl -sI https://donthaveanagent.com/<file>` and compare `Content-Length`
with the file in the repository.

To put the current site live: merge the branch, then in Netlify confirm the
site is **linked to this repository**, production branch `main`, base
directory `donthaveanagent`. If the site was created by dragging a folder, it
is not linked to anything — either link it (Site configuration → Build &
deploy → Continuous deployment) or download the repository zip and drag the
`donthaveanagent` folder onto Netlify Drop again. A drag-and-drop deploy
replaces every file, so it must be the whole folder every time.

---

## Where the soundtrack is stored

**`tools/film/audio/inspired-kevin-macleod.mp3`** — "Inspired" by Kevin
MacLeod, 4:46, CC BY 4.0. This is the single source every film's music bed is
built from.

It was for a long time held only in a session scratchpad, which is deleted
when the container is reclaimed. It now lives in the repository so the films
can always be re-encoded. `tools/film/audio/ATTRIBUTION.md` carries the
licence and the exact credit line that must accompany it.

The repository root is published for the branch site, so this file is
reachable on the web. That is acceptable — CC BY permits redistribution — but
do not put anything there that is not licensed for it.

To change the music, drop any audio file in and rebuild every bed at once:

```bash
cd tools/film
python3 usetrack.py /path/to/new-track.mp3     # rebuilds bed-*.wav for all films
```

Per film, `films.json` sets `start` (the second of the track to begin at, since
the opening of a cue is rarely its most lifting minute) and `musicgain` (the
bed level under the voice; the wall film uses `0.62`, about −21 dB RMS).

---

## The films

| Film | Page | MP4 | Length |
|---|---|---|---|
| Client film | `client-film.html` | `dhaa-film.mp4` | 148s |
| What happens next | `process-film.html` | `dhaa-process.mp4` | 110s |
| The agent's side | `agent-side-film.html` | `dhaa-your-side.mp4` | 86s |
| For agents | `agent-film.html` | `dhaa-agent-film.mp4` | 79s |
| How we work | `how-we-work-film.html` | `dhaa-how-we-work.mp4` | 87s |
| The branch wall | `wall-film.html` | `dhaa-wall.mp4` | 118s |

All six are narrated on **`en-US-AndrewNeural` at −12%** (the ad at −8%); the
lengths above are from the 7 September 2026 re-voice, which is also when the
process film gained its month-by-month birthday strip and the "looked after
by" chip on the worklist. Every film page pauses on a tap in the middle of the
screen and carries a clock in its control row.

**Never put a real client name or a real client count in an MP4.** The files
sit at public URLs even when the pages are `noindex`. Every number on screen
is illustrative.

### The player — every embedded film goes through `player.js`

A `<video>` with no `controls` is a film nobody can pause. The site pages
used to switch the browser's controls on after the cover was tapped, which
on a phone means a bar that hides itself in two seconds and a viewer who
cannot find the way back. `donthaveanagent/player.js` replaces that on every
`.vwrap` that holds a `<video>` and a `.vcover`:

- tap the picture to pause and to resume, with a glyph that flashes
- a seekable rail with **a dot for every scene** and the scene's name beside it
- elapsed / total, mute, full screen; the rail folds away while playing and a
  thin line at the foot keeps showing progress

The scene dots come from `data-scenes` (the film's `durs` out of `films.json`)
and the names from `data-chapters` (each scene's eyebrow in the film's own
page). **`tools/film/chapters.py` writes both onto every page** — run it after
any film is re-timed, never type them. A page that includes `player.js` must
not also switch native `controls` on; the two fight over the same taps.

`preview.html` (`/preview`) lists every film and both ad cuts through the
same player, grouped by who sees them. It is the place to check a cut.

### The social ad

Two cuts of one 23-second spot, both from `donthaveanagent/ad-reel.html`:
`dhaa-ad-reel.mp4` (9:16, Reels and Stories) and `dhaa-ad-feed.mp4` (4:5,
feed). The 4:5 rules are a `@media (max-height:1400px)` block in the same
page, so recording it at 1080×1350 gives the feed cut with nothing to keep in
step. Copy, targeting and the rebuild commands are in
`tools/film/AD-COPY.md`.

`mixany.py` takes `w`, `h`, `capmode`, `capsize` and `capwrap`. The films use
`capmode: "strip"` — picture cropped, captions in a band beneath. The ads use
`"over"` — captions burned across the frame with an outline, because most of
the audience watches with the sound off.

### Re-voicing one — `revoice.py`

When only the voice has to change, the words are already approved and the
scenes only need re-timing to the new read:

```bash
cd <scratch>            # the vox directories live outside the repository
python3 tools/film/revoice.py client voc3 voc4 donthaveanagent/client-film.html
```

It reads each scene's line back out of the old `NN.vtt`, renders it on
`en-US-AndrewNeural`, keeps the air every scene had around its old line
(floored at 1.2 s), rewrites `data-d` in scene order, and updates `durs`,
`dur` and the tick cues in `films.json`. Then `record.js` and `mixany.py` as
below. The wall page is generated, so after re-voicing it `wall-timing.json`
is rewritten and `build-wallfilm.py` must reproduce the same `data-d` — the
Phase A script asserts exactly that.

### Rebuilding one

The pipeline is in `tools/film/`. It needs `edge-tts`, `ffmpeg` **with
libass**, Playwright with Chromium, numpy.

1. **Narrate.** One file per scene, numbered, into a `vox` directory:
   ```bash
   edge-tts --voice en-US-AndrewNeural --rate=-8% \
     --text "…" --write-media vowall2/01.mp3 --write-subtitles vowall2/01.vtt
   ```
   **`en-US-AndrewNeural`, never the Multilingual variant** — see the house
   rule above. The Multilingual voice reads a phrase in another language when
   it feels like it, and it did exactly that on the first cut of the wall
   film. Every film was re-voiced on the plain voice on 7 September 2026
   with `revoice.py`; nothing published carries the Multilingual voice any
   more. `-8%` for a short spot, `-12%` for a walkthrough.
   Then convert each to WAV — **the mixer reads `NN.wav`, not `NN.mp3`.** Miss
   this and it encodes silently with no narration; the giveaway is
   `speech covers 0% of runtime` in the mixer's own output.

   Spell URLs as words: `donthaveanagent` as one token comes out as
   gibberish. Write "Don't have an agent dot com, slash wall".

2. **Time the scenes from the audio, not by guessing.** Measure each line and
   set `data-d` to the line plus about 1.15s of air. Put the same list in
   `films.json` as `durs`.

3. **Sound design and bed:**
   ```bash
   python3 sfx.py "$(python3 -c 'import json;print(json.dumps(json.load(open("films.json"))["wall"]))')" sfx-wall.wav
   python3 usetrack.py audio/inspired-kevin-macleod.mp3
   ```

4. **Record** with `record.js <page> <capture-dir> <seconds>` (Playwright,
   1280×720; `record-film.js` is the wall-only original). Run it with
   nothing else on the machine — CPU contention corrupts the capture timeline
   and the encode will be rejected.

5. **Mix and encode:**
   ```bash
   python3 mixany.py "$(…films.json…)" dhaa-wall.mp4
   ```

### What the pipeline knows that you don't

- **Playwright's capture runs slow.** It writes at a nominal frame rate it
  never achieves, so `video_t = LEAD + STRETCH * film_t`, with STRETCH around
  1.13. `mixany.py` measures this from the film's own scene transitions and
  undoes it. Do not assume the capture is real time.
- **The fit is by RANSAC, not index pairing.** Two adjacent scenes that look
  alike fall below the detection threshold, so the detected transitions do not
  line up one-for-one with the schedule. Every pair of correspondences
  proposes a (LEAD, STRETCH) and the proposal explaining the most transitions
  wins. It refuses to encode if the residual is too large — that guard has
  caught three corrupted recordings; do not weaken it.
- **libass.** The `imageio_ffmpeg` bundled build has no libass, so the caption
  burn has no filter to call. `mixany.py` now picks the first ffmpeg that
  reports a `subtitles` filter. On a fresh container: `apt-get install ffmpeg`.
- **Captions are clamped to the next cue's start**, so they never overlap —
  libass stacks overlapping cues and pushes a line out of the strip onto the
  picture.
- **The strip.** Video is cropped to 1280×616 and padded back to 720, with
  captions burned into the band. Scene content must sit inside the top 616px.
- **Loudness** is two-pass loudnorm to −14 LUFS with the true-peak target set
  to −2.0, which actually delivers about −1.8; linear mode will not reach its
  stated ceiling.

---

## The backend — `apps-script/Service.gs`

**Container-bound.** It uses `SpreadsheetApp.getActiveSpreadsheet()` and
`getUi()`, so it must be created from the Sheet (Extensions → Apps Script). A
standalone project returns null and throws.

**The project is three files, not one:** `Service.gs`, `Transition.gs` and
`ServiceSalesforce.gs` (the Salesforce trace a review runs before it files).
On 23 September the live project had only the first two, and every review
and questionnaire from the website failed on the backend with
"svcSplitName_ is not defined" — the client saw a done screen and nothing
was filed. `Service.gs` now guards those calls, but the file belongs in the
project. After any paste, submit one test review and read the reply: a
reference from the server, not the page's local fallback.

**A full paste of `Service.gs` blanks `TEAM_CODE`** (the repository copy
ships it empty because the file is public). Re-enter it after every paste,
or the wall and the responses page lock everyone out.

**Re-deploying:** Deploy → Manage deployments → pencil → New version. Using
*New deployment* instead issues a fresh `/exec` URL and every front end has to
be re-wired.

**Front ends holding `API_URL`** — all six must be updated together if the
deployment URL ever changes: `donthaveanagent/agents.html`, `how-we-work.html`,
`review.html`, `status.html`, `wall.html`, and root `service/index.html`. Both
POST paths send `text/plain` so Apps Script never gets a CORS preflight it
cannot answer.

**A POST to `/exec` returns a 302.** Browsers convert that to a GET and it
works. `curl -L` re-POSTs to the redirect target and gets a 405 — that is
curl, not a broken backend.

**Settings that ship empty on purpose:** `CS_EMAIL` (Guardian Customer
Service — until it is set, everything routes to the branch alone and says so),
`TEAM_CC`, `TEAM_CODE`. `SALES_SUPPORT_EMAIL` is
`rickyrampersadsalessupport@myguardiangroup.com`.

**Sheet tabs used as the datastore:** Service Questionnaires, Group Service
Questionnaires, Agent Skill Bank, Link Activity, Callback Requests, Service
Activity — plus two that create themselves on first write: **Client Responses**
(a client's one-click answer to a transition letter, `action=resp`) and
**Team Feedback** (an agent's verdict on a letter or the film from the team
review page, `action=feedback`).

### The campaign is the wall's first two slides

The branch agreed to work its own orphan book, and that is the core KPI, so
the wall opens on it rather than on activity counts. `SVC.CAMPAIGN` holds the
book size, the target, the end date and the per-agent weekly commitment;
`campaignStats_` derives everything else — progress, days left, the weekly pace
needed to finish on time, who has met their number this week and who has not.

The measured unit is **a review filed**, because that is the only thing the
system can see end to end. A conversation nobody files does not count.

`book` and `target` ship at zero and the wall says the target is not set rather
than showing a percentage of nothing. Do not put a placeholder number there —
a fabricated target on a screen the whole branch walks past is worse than no
target.

### The lifetime promise runs off one trigger

"A review every six months and every birthday month, for life" is on eight
pages and in every film, and all of it — plus the chase when we miss our own
deadline, and the "still on it" note while a file is open — hangs on the daily
`dailyServiceFollowUp` trigger.

`setupService()` installs it. It used to be a menu item nobody was told to
click, which meant the central promise of the product could silently never
fire. `automationOn_()` reports whether it is scheduled, the `ping` returns it
as `automation`, and the wall shows a red banner across the bottom when it is
off. Never remove those; a quiet failure here is invisible for months.

### The documents are the point

Form **2000-03-147** is reproduced exactly — same title, same twenty questions
in the same order and words, same YES/NO boxes, down to the form number. Both
front doors produce it; a review from donthaveanagent.com is mapped onto the
printed questions by `paperAnswers_`, and questions the shorter review never
asked are named in the addendum so a blank is never mistaken for a client who
declined to answer.

**Page 1 must fit one US Legal sheet** — 1344px at 96dpi, currently sitting at
about 1302. Anything added to page 1 has to be measured. Extra questions go on
the addendum page, inside the same document.

---

## The transition campaign — when agents leave

Built in September 2026 for nine books whose agents resigned together. The
manual is `orphan-transition/index.html`; the client-facing pieces are
`orphan-video/` (the film and the two doors) and `orphan-video/protected.html`
(the Insurance Act's policyholder protections, quoted and explained). **The
letters link to `/your-policy/` and `/your-policy/protected`**, two stubs that
forward to those pages with the query string intact — "orphan" is the trade's
word for these clients and must not appear in an address a client holds.
`/vid/` is the film alone, for WhatsApp, and `/templates/` is the one page
for the team: the film, letter F in full, every opening and one verdict
form, with all the letters folded away beneath — generated by
`build-letters.py` with the letters, never edited by hand (run `chapters.py`
after it, to mark the film's chapters there); `tools/film/chapters.py` walks
`/vid/`, `/templates/` and
`orphan-transition/` too, matching the film by file name, so a re-timing
reaches every page that embeds it.

**The branch film is built from one file.** `tools/film/orphan-lines.json`
carries, per scene, the spoken line, the words on screen and the visual
(`title`, `statement`, `keeps`, `keeps-off`, `keeps-find`, `pivot`, `lock`,
`act`, `creds`, `click`, `close`); `build-orphanfilm.py` renders the page from
it, and `voice-lines.py orphan-lines.json <vox> --changed-only --timing
orphan-timing.json --films films.json --key orphan` voices only the lines
whose words changed, keeps every other recording, and times the scenes from
the audio (line plus 1.15 s of air, plus `extra` where a scene asks for it).
Then `build-orphanfilm.py`, `sfx.py`, `usetrack.py <track> orphan`,
`record.js` (alone on the machine, with the poster path so the poster is
re-shot), `mixany.py`, `chapters.py`. The mixer reads the vox directory named
in `films.json` **beside itself** (`tools/film/voorph`, git-ignored) — copy
the new WAV and VTT files there before mixing, or it re-encodes the old
voice under the new timing and the caption gives it away.

- **Nothing characterises anyone who left: the letters state Guardian Life's
  notice and nothing else.** Until 30 September 2026 "Your representative has
  moved on from Guardian Life" was the whole reference. That day the manager
  reported that the agents who resigned "are on Facebook and social media and
  they are telling clients they are still with the company". So every letter
  except T and T1 now carries Guardian Life's own notice, in letter T's
  pattern (`NOTICE_R` in build-letters.py): "Guardian Life of the Caribbean
  has accepted the resignation of your agent, <name>, effective 21 September
  2026. <First name> is no longer authorised to conduct any business on
  behalf of Guardian Life." (Until noon on 30 September it read "accepted …
  with immediate effect on 21 September"; the manager: "we have accepted the
  resignation effective 21st Sept".) The agents' own letters said 30
  September; Guardian Life accepted each with immediate effect on the 21st.
  The date is the same for all ten agents, Tricia Baksh included, and is
  `RESIGNED_ON`. Under it goes "What this means for you" (`WHAT_NOW`):
  check with us before signing or paying anything, pay premiums only to
  Guardian Life, and on the keep and return letters, nothing needs to
  change. Every letter asks letter T's `contact` question, "Has your former
  agent, <first name>, been in touch with you since 21 September?", and a
  yes brings a call. Still never why anyone left, never where they went,
  never that anyone is saying otherwise, and no adjective about anyone: the
  facts answer them. **A client can confirm the notice by telephone**, asked
  for the same day ("226-2479 is our Sales Admin Department at Westmoorings,
  should persons need to call to confirm"; later the same day, the "head
  office contact"): every letter, T and T1 included, ends its notice card
  with "To confirm this notice, call our branch on (868) 226-6461, 226-6464
  or 226-6465, or Guardian Direct on (868) 226-MYGG (226-6944)" (`CONFIRM`,
  `BRANCH_TELS`, `DIRECT_TEL`), every number a `tel:` link a phone dials in
  one tap, and the first line of what to do says "call one of the numbers
  above". The number was 226-2479, Sales Admin at head office, until noon on
  30 September; then 226-6944, which is 226-MYGG, Guardian Direct ("urgently
  need to change the contact number to 2266944 (mygg)"); then the branch's
  own three lines went in front of it ("add these to the contact numbers for
  verification … and then the last number is 226 MyGG"). The 295 letters
  sent before noon that day carry 226-2479, and Sales Admin still answers
  it. The call scripts give the branch as (868) 226-6461, in place of
  678-5921. Guardian Direct
  is last so a client can also hear it from the company itself. Whoever
  answers those numbers has to know the calls are coming. The call scripts (`call-script.html`,
  `client-support.html`) read the same notice word for word and give the
  same number. When a client repeats something a former agent said, that
  they still act for Guardian Life or anything about the branch, the caller
  answers none of it, gives the number, and notes who, when, how and what,
  in the client's words. The film and the older site pages still say
  "moved on". Letter T keeps its own notice: see its bullet below.
- **Segment counts, client names and per-book figures stay outside the
  repository.** The segment file, merge file, send list, deep-dive report and
  household list are built in the session scratchpad from the Branch
  Portfolio sheet. Branch-wide activity counts (birthday notes, reminders) are
  fine on an internal page; per-book client counts are not.
- **Every Act quotation on `protected.html` was checked against the source
  text** (`act2018.dec.txt`, decoded from the published PDF — lowercase, no
  spaces, digits garbled). **No section numbers anywhere**: the PDF's font does
  not yield them reliably, and an invented one is worse than none. Compliance
  supplies them if they are ever wanted.
- The Act binds "an agent, agency, broker, brokerage or a sales
  representative" in one sentence. Wherever the material says what an agent
  may not do, say broker too — that is where departing agents go.
- **The letters are generated** by `tools/letters/build-letters.py` from the
  words in `tools/letters/openings.json`. Edit those two, never a letter. One
  run writes the letters, `/templates/`, and the letter cards and merge-field
  table on the manual and the team page (between `<!-- letters:start -->` and
  `<!-- fields:start -->` markers). The shell is compact on purpose, decided
  22 September 2026 ("a much more catchy, condensed letter"): a headline, one
  paragraph of under 45 words, a strip of facts read off the Branch Portfolio
  sheet for that client (`{{paid_to}}`, `{{days}}`, `{{projected_lapse}}`,
  `{{first_year}}`, `{{issue_date}}`, `{{app_received}}` — days and dates,
  never a money figure), the client's own record with the branch team (see
  below), the one-tap answers, the film in one line, and the closing.
  **The notice is the second thing the client
  reads**, straight after "Dear", in a gold-edged card headed "Important
  notice". It was asked for on 22 September ("now officially letting them
  know that the agents have moved on, that important letter") and made
  Guardian Life's formal notice on 30 September (see the first bullet). It
  is in the shell, once, in the same words on every letter; an opening
  never repeats it. `{{token}}` and
  `{{segment}}` travel with every tap so responses read by segment.
- **Fourteen letters: five situations, the in-force letter in five tenure
  versions, two check letters, T for a terminated contract (its own
  bullet below) and T1 for a client of that book whose application is
  still in progress (the terminated notice, then the application letter's
  own words and question, because cover is not in place until the policy
  is issued; T1 sorts with T, and `tHold_` holds it like T without an
  agent name or a date).** Condensed to six on 22 September ("condense the amount of
  letters so we will be focused"); on 23 September the in-force letter was
  split by how long the client has held their longest in-force policy —
  "we have banded 5 so each is different, wanting feedback with a catchy
  line" — F1 under two years, F2 two to three, F3 three to five, F4 five to
  ten, F5 ten or more, the same bands as the reassignment workbook. Each
  version has its own headline and opening and puts the feedback tap
  (`review`) first; the fixed notice and the shell are the same on all.
  The situations: A (matured, or maturing within six months), G (lapsed),
  I (a premium due: a row the sheet flags `Overdue` in Status(2) with more
  than sixty on its Days column — the days outstanding and the projected
  lapse date are printed, so the letter need not say how far behind),
  J (contract not delivered), K (application in progress). Paid up, waiver
  and payroll clients take their tenure version. Nothing-held clients are
  not written to. On 24 September, asked for because clients on these books
  had cover ended and restarted ("the only person that suffered was the
  client"), an in-force client with a policy that lapsed or was surrendered
  between six months before and a year after another began gets **R1**
  (newest such start inside three years) or **R2** (before that) instead of
  a tenure version: a free check of the file and of who the policy pays.
  Its "with us since" counts every policy ever issued, ended ones too.
  The letter states only what the client's own record shows — cover that
  ended and started again — never how, never by whom; the rule about
  anyone who left holds here more than anywhere. Do not grow the set beyond
  this without being asked: the team reads one page, and the taps carry the
  difference. A letter can reword a tap for itself (`tap_text` in
  openings.json — R1 and R2 call `callme` "Check my file with me") without
  changing what the tap records, so no backend change is needed for it.
- **Letter T names the agent, and it is the one letter that does.** Decided
  24 September 2026 on Guardian Life's own written notice that it had
  terminated an agent's contract with immediate effect following an
  investigation: every client on that book must know who may no longer act
  for Guardian Life ("his clients get a notification he was terminated with
  immediate effect … and is not authorised to conduct any business on behalf
  of Guardian Life"). The notice card and the subject carry the company's
  notice and nothing else. **Since 13 October 2026 it gives no reason**: the
  branch held the book from 6 October after a complaint about the letter,
  and on lifting the hold the manager
  took the investigation out ("remove as a result of an investigation … do
  not give a reason … no longer with the company as his services has been
  terminated as at the date"). `NOTICE_T` now reads "Please note that your
  agent, <name>, is no longer with Guardian Life of the Caribbean, as
  <first name>'s services have been terminated as at <date>", then that the
  agent may no longer act and the policy is not affected. The two call
  scripts say the same words. Never why, never the grounds, never anyone
  else's name. `{{agent_name}}` and
  `{{terminated_on}}` are filled from the sheet (the Agent column and a
  `terminated_on` column, letter T only), so neither the name nor the date
  is in the repository; a T row without either is held. The name in the
  notice sits between the `<!--agent-->` marks like the standard notice's,
  because `tLetters_` refuses any letter that carries `{{agent_first_name}}`
  without them (the first cut of T did not, and the Test run stopped with
  "carries no agent markers" before it sent a row). The letter asks
  whether the agent has been in touch since that date (`contact`: the agent
  is named on the letter through `LETTER_Q`, and the page and the receipt
  ask it in neutral words, because a merge field inside the recap would
  stop the receipt); "Yes" brings a call before anything else. It carries a
  `paid` tap for a premium handed over that is not showing, its checks sit
  above the taps (`checks_first`), and its rows sort first (`ORDER`). The
  subject says "no longer with Guardian Life", not "no longer with us",
  which reads as a death. Compliance sees the words before that batch goes.
  The rule that nothing characterises anyone who left holds everywhere
  else, and this letter goes only to a book whose agent Guardian Life
  itself terminated in writing.
- **The branded letter is the design; the plain letter is what the connector
  can carry.** Design pass of 24 September ("polish up the fonts and make it
  more appealing and graphical, a wow template"): a navy hero with the
  brand, the headline and the preheader as its subline; the notice in a
  gold-edged card; the facts strip; the service record as stat tiles; the
  checks as pills; the first tap a navy card with a gold title, the rest
  white; the film as a picture with a play badge (`orphan-video/film-card.jpg`,
  rendered by `tools/letters/film-card.js` from `film-card.html`, committed
  because the letters link to the hosted copy) over a navy caption bar; the
  signature on a gold rule. Fonts: the branch face where a mail app loads the
  `<link>` (Apple Mail, iOS Mail), the phone's own face elsewhere (San
  Francisco, Segoe UI, Roboto); Arial last. All tables, inline styles and
  two hosted images, so any mail app can show it. **None of it reaches a
  client through the Microsoft 365 connector**: that route accepts tags
  only (p, br, a[href], b, i, lists, h1–h6, table, hr, div) and rejects any
  attribute, image or style outright (checked with a draft on 24 September).
  The plain letters carry the same words with headings for structure and
  nothing else. The branded letter goes out only from Transition.gs through
  Microsoft Graph, which needs the Entra app; until then the "wow" is on the
  site and the team page, and the client gets the plain one.
- **Every subject line is the notice.** Decided 24 September ("on the
  subject line shall we put the names … more catchy"). Since 30 September
  it reads `Important: {{agent_or_rep}} has resigned and is no longer with
  Guardian Life.` followed by a short tail: "Your policy has not changed."
  on the in-force and check letters, and the urgent point on the action
  letters. `{{agent_or_rep}}` is the agent's first name, or "Your
  representative" when the sheet has none, filled by `fill-plain.py` and by
  `tFill_` in Transition.gs alike. **The reminder says "resigned" first.**
  Asked for the same day ("on the reminder email on follow up we can adjust
  to state resigned and head office contact"): the clients written to on 25
  September read "moved on", and their reminder, their own letter fetched
  from the site again, is where they first read the resignation. Its
  subject is `Reminder: <first name> has resigned and is no longer with
  Guardian Life. …`: `tSendRow_` puts "Reminder:" in place of "Important:",
  never both. Its line above the greeting (`REMIND_R`) says it is "an
  important update on your agent's resignation, with numbers you can
  call to confirm it". T and T1 keep "an important update about your
  agent" (`REMIND`): that book's agent did not resign.
- **Quick checks, answered in the e-mail itself.** First two questions on
  24 September — questions that would show a client what nobody had told
  them. A letter may not say or suggest that; it asks what the client
  knows, and an honest "not sure" makes the point by itself: *Do you know
  who your policy pays today?* and *Has anyone suggested you cancel, cash in
  or replace a policy?* Then, the same evening, after the staff test ("when
  click on this it taking too long to open and would like this as a check in
  the email! It must be easy for a client!"), the long review behind "Tell
  us more about yourself" became checks too: *How have we looked after you
  so far?* and *Has anything changed for you since you took out your
  policy?* The in-force letters ask all four, and ask them before the taps,
  because the rating is the letter's feedback; R1 and R2 ask the rating and
  the two originals; G asks the life change and the approach; the action
  letters keep the originals under their taps. Every answer shows as a box
  to tick (☐) and rides an existing tap — `informed` for a noted answer,
  `callme` for "Could be better", "Yes: family, home or work" and "Not
  sure", `urgent` for "Yes, talk to me first" — with the answer itself in
  `q=`, which lands in the Page column of Client Responses
  (`/your-policy/?q=rate_better`), so the backend needs nothing new. The
  full review is one line under the taps ("Would you rather tell us in your
  own words?"), not a tap. `QUESTIONS` in build-letters.py is the one list:
  the letters, and the page a tap opens, are both written from it.
- **The questions are offers, not check-ups.** Rewritten the evening of 24
  September 2026 after the manager read them as a client would: "asking if
  they advise to cash in is not a nice question, as the objective is to
  have them stay and not go with the agent, and want a review … deep dive
  and research very appealing questions that will give great responses as
  well as show our service levels". The principles applied (customer
  research on question wording: positive framing, help inside the
  question, the caring answer as the easy first option, "your policy"
  throughout, an easy question first and the commitment last): `rating`
  (unchanged, the feedback, first); `life` ("has life moved on: a new
  home, a new job, someone new in the family?" → "Yes, update my cover"
  brings a call); `pays` ("would you like us to confirm, in plain words,
  exactly what your policy pays and to whom?"); `checkfirst` ("if anyone
  ever suggests you change or replace your policy, would you like us to
  check it with you first, free?" → "Yes, always check with me first",
  "Someone already has. Call me", which is how a rival approach is heard
  without a question that sounds like suspicion, or "I will decide
  myself", the polite way out, because a question with no soft exit
  lowers response; the old `approached` question is gone); `stay`, last
  on every in-force letter ("Would you
  like our branch team to keep looking after your policy?", the letter's
  own version naming the year since which the team has looked after it,
  `LETTER_Q`, the year between fact markers so an application reads
  without it); `value` on the lapsed letter (the free look at what the
  policy still holds, as a question). Every "yes" that asks something of
  us is a `callme`; nothing on a check opens the form any more. The
  service record panel above the questions is the evidence the questions
  lean on; the questions never quote a count themselves, because a blank
  cell would break the sentence. **Modelled by band** (25 September: "did
  you model it by age bands … our biggest is the under 5 years"): F1
  swaps the life question for `walk` (a plain-words walk-through of what
  the policy does, since under two years it may never have been
  explained) and asks the rating "since you joined us"; F3 swaps `pays`
  for `built` (what the policy has built so far); F5 swaps the life
  question for `more` (what more the cover could do now: family,
  retirement, health) and asks the rating "after all these years"; a
  letter's own wording of a question is `question_text` in openings.json.
  **The two letters with a hard question first** (`checks_first`): J,
  "Has your policy contract reached you?" (`received`: "No, it never
  reached me" is the `deliver` tap itself; "Not sure what I should have"
  a call), because the record says the contract was collected for
  delivery and never acknowledged, and the letter says exactly that; and
  K, "Is anything you were asked for still outstanding: a medical, a
  document, a signature?" (`outstanding`: "Yes, help me finish it" is the
  `finish` tap, "I no longer wish to proceed" the `stop` tap), with the
  opening now saying plainly that the cover applied for is not in place
  until the policy is issued, because that is the truth that makes a
  client finish. T carries `received` too, since a third of that book's
  contracts were never acknowledged.
- **Who gets letter J: the contracts the Power BI export shows dispatched
  and never acknowledged, dispatched in the last two years.** The
  conservation export from Power BI (`pbi-conservation.xlsx` in the
  session scratchpad) carries, per policy, `Dispatch Date`,
  `Acknowledgement Date` and `Delivery Category` ("Undelivered" when the
  acknowledgement is blank); it is the acknowledgement of record. A first
  cut on 25 September read "no acknowledgement" off Salesforce and the
  Log Book instead and put four hundred-odd clients on J; the export
  showed all but a handful of them acknowledged, so never infer
  non-delivery from the Log Book, which records a fifth of
  acknowledgements at best. Salesforce adds two things: the "Guardian
  Life Policy Delivery Update and Next Steps: Policy Contract Received
  for <client> Policy Number <n>" e-mail task, dated the day the contract
  was given to the agent to deliver (that date is `collected_on`, a
  column on the send list and a fact on J and T, with the PBI dispatch
  date as the fallback), and the "Undelivered Script <client> <policy>"
  tasks, sales admin's chase, which stand in for a policy the export
  does not carry. Older undelivered contracts (dispatched before the
  two-year cut, some as far back as 2003) are not written to about a
  contract the client has plainly lived with: they go to the team as a
  call list. A client already on I, K, A, G or T keeps that letter and
  gains the contract date; the rest move to J, first wave. The pending
  applications are the rows the sheet flags `Pending` in Status(2)
  (every one of them reads "Underwriting incomplete", "Missing Reqts" or
  "Awaiting Settlement" in Status Description, which is the rule
  sendlist.py applies), and the team gets them as a list too, with the
  status description, for assignment. Counts stay outside the repository. The research behind the shape, checked
  on 25 September 2026: a positive frame rates better on identical facts
  (Levin, Schneider and Gaeth 1998); asking a customer how they were
  looked after cuts defection for a year afterwards (Dholakia and Morwitz
  2002); "your policy" is worth more to its owner than to anyone else
  (Kahneman, Knetsch and Thaler 1990); two or three options beat a list
  (Iyengar, Huberman and Jiang 2004); easy questions first and the
  commitment last (Dillman); a gift given before the ask lifts response
  far more than one promised after it (Church 1993), which is what the
  free checks inside the questions are; and the FCA's redress letters
  trial (Adams and Hunt 2013) found short bullets, "takes five minutes"
  and a reminder at three to six weeks lifted response, while a
  big-name signature lowered it. Words to keep out of a client's letter:
  orphan, reassigned, lapse, book, and "verify" or "confirm your
  details", which read as phishing. There is no controlled study of
  orphaned policyholders; the industry figures (Capgemini and LIMRA's
  World Life Insurance Report 2027: nearly forty per cent rarely or never
  hear from insurer or agent after buying; J.D. Power 2025: any contact
  in the past year lifts satisfaction) argue for the six-month and
  birthday reviews the branch promises, and for a second letter to
  anyone who has not answered in three to six weeks.
- **Every answer opens the page; the reply mode is built, tested and
  switched off.** Three decisions in an hour on the evening of 24
  September 2026, after the first Test letters were read on a phone. "When
  you are clicking on the question its opening the browser and this is not
  supposed to be happening, its supposed to be inside the email for easy
  use", then "for all it should not open any browsers": so every check and
  tap became a `mailto:` to support@ (`reply_link` in build-letters.py: the
  answer as the subject, the question and the answer as the first lines of
  the body, a spare line for anything more, `Ref: <token> <tap> <answer>`
  on the last line; the two questionnaire doors as replies whose body asks
  for the client's words, `REPLY_LINES`). Then the first reply was tried:
  "when i check the question and answer it moved to the email reply!!! its
  supposed to allow me to answer all the questions and capture the
  responses", which only the page does. Offered the three ways there are
  (the page; one reply per answer; one reply listing every question with
  an X to type), the manager chose the page. `ANSWER_MODE` in
  build-letters.py is `'page'`; `'reply'` rebuilds the letters the other
  way, and `receipt.json` `reply.mode` and `reply.form_taps` (every tap in
  page mode) tell the receipt and the test which way the letters were
  built, so Transition.gs needs no paste for a switch. `transitionInbox`
  (Transition.gs, every five minutes, installed by setup and go live)
  stays on in either mode: it reads the support@ inbox through Graph
  (application permission **Mail.Read**, admin consent, on the same Entra
  app), changes nothing in the mailbox (a reply stays unread for the
  team), files a reply carrying a reference on Client Responses exactly as
  the page files a tap (`Page` = `/reply?q=…`, `Referrer` = `reply <message
  id>`, which is how a message is never filed twice), matches a reply with
  no reference to the client by its sender address and files it as a
  `question` with `q=wrote` — never by a staff Test row's address, which is
  matched only through a reference (28 September 2026: a colleague standing
  in as a client sends everyday work mail that reaches support@, and her
  e-mails about other clients' renewals were being filed as her "replies",
  with receipts) — and puts the client's own words in the Note
  cell (`tWords_` strips the pre-written lines in `receipt.json`
  `reply.lines` and anything quoted beneath). So a client who simply
  replies to a letter is captured with what they wrote, and a person
  answers them: no receipt goes for a reply in their own words (see the
  receipt bullet below). **Every response has a trail, even from an address we do
  not hold** (30 September 2026: "all response must have the trail").
  Until then a reply from another address, or from an inbox two clients
  share, was passed over. One client asked from a work address to cancel
  an application, and another asked twice to be called from an inbox
  shared with a relative. Neither was filed, and nobody saw them. Now a reply to one of our own e-mails (`T_OUR_SUBJECT`:
  Re: a letter, a reminder, a receipt, a note) is placed by the first name
  it greets ("Dear X," in the quoted letter, "Thank you, X." in the
  subject). At a shared inbox the name is enough. From an address we do
  not hold, the former agent the subject names must agree too
  (`tGuessClient_`). Such a reply is filed with `[matched by name]` in the
  Note. When the name matches no one or several, the reply goes on the
  **Replies to match** tab, which is made the first time it is needed,
  with the clients it could be. A person types the token there, and the
  next five-minute run files it `[matched by hand]`, with the message id
  in Referrer so it is never filed twice. Mail from our own domains
  (`T_OUR_DOMAINS`) is never taken for a client's: a colleague answering a
  client on the thread is not the client. The inbox reader only looks
  back three days, so the three e-mails missed before this change were
  filed from a paste block (`Replies-to-file-30Sep.xlsx` in the
  scratchpad), marked so that no automatic receipt or follow-up goes: a
  person replies. `health/inbox-match-harness.js` covers it (16 checks).
  The receipt offers the letter's other checks, how to
  reach them and, once a call is coming, when (`[[more]]`), as page links
  or replies to match. A merge field can never appear inside a reply body,
  since it is URL-encoded: a reply carries QUESTIONS' own words.
  `tap-test.js` checks whichever mode the letters were built in;
  `svc/inbox-harness.js` in the session scratchpad runs the reader's
  parsing on sample replies.
- **A tap opens one small page, at once.** `/your-policy/` with `r=` in the
  address is the whole journey: it records the answer, says what happens
  next, and offers the letter's other checks and *What is the best way to
  reach you?* one tap each on the page, without loading the film page or the
  form. Only `urgent` (and "talk to me first") and the full review go on to
  the form, a quarter of a second later. Before this a tap loaded the stub,
  the film page with its fonts and poster, waited 900 ms, then loaded the
  108 KB form — behind the mail scanner's own check. Without `r=` (the film
  line) it forwards to `/orphan-video/` as it always did. **A scripted
  browser records nothing** (`navigator.webdriver`): mail security, Avanan
  at Guardian among them, opens links in a headless browser, and it must
  never answer for the client. `tools/letters/tap-test.js` follows every
  link in every letter on a local copy of the site, with the beacons
  intercepted; run it after any change to the letters or the page.
- **The receipt: one e-mail, a few minutes after the client's last tap,
  that recaps everything they told us.** Asked for on 24 September ("recap
  the concerns and a bit more … Thank you, client name, we have received
  your response … a wow experience, and follow through"). `tAckClient_` no
  longer sends anything; `transitionReceipts` runs every five minutes
  (installed by `transitionSetup`, made sure of by `transitionGoLive`,
  also on the menu) and, for every token this campaign recognises with
  taps not yet marked `[receipt]` in their Note cell, waits until the
  newest is `RECEIPT_WAIT_MIN` old (three minutes, so a client ticking
  four checks gets one e-mail) — and, when a tap opened the form, until the
  review is filed or `RECEIPT_FORM_WAIT_MIN` (thirty) has passed — then
  sends one receipt and marks the rows. The e-mail: "Thank you,
  {{first_name}}. We have received your response."; when it reached us;
  **What you told us** (each quick-check answer with its question, a bare
  tap in the words the client tapped on that letter); **Your concerns, in
  your words** (the review filed under `Link ref` `transition:<token>`,
  the questions in `REVIEW_RECAP` that were answered, quoted); **What
  happens next** (one line per thing asked of us, the most pressing first,
  never the same line twice, the review's reference first when there is
  one); **How we follow through** (`FOLLOW`); the reply line; signed by
  the Client Support Team. Every word is in build-letters.py and travels
  in `receipt.json` (`recap`, `review`, `tpl`); the blocks arrive in
  `receipt.html` as `[[recap]]`, `[[concerns]]`, `[[next]]`, `[[follow]]`,
  unescaped, and `<!--recap-->` / `<!--concerns-->` are cut when empty.
  The review's own confirmation ("your service questionnaire is in", with
  the reference and access code) still goes from Service.gs as before, so
  a client who fills the review gets both. A noted answer ("Very well") is
  thanked too, with "nothing about your policy changes". The page a tap
  opens says a copy is on its way (`receipts: True` in the page's CHECKS,
  written by build-letters.py): **set it False if the letters go by hand
  through the connector**, where nothing sends a receipt on its own.
  `tools/letters/…/svc/receipt-harness.js` in the session scratchpad runs
  `tReceiptMail_` in Node on sample taps and a sample review.
  **A receipt is held when the answers look automated** (`tLooksAutomated_`):
  two or more letter questions answered both ways, or every option of one
  ticked. Mail security that is not a scripted browser opens every link
  in a letter, and on 26 September a client wrote in to say she had sent
  none of the answers her receipt thanked her for. The rows stay recorded
  and are marked `[receipt] held: answers look automated`; a person who
  changes one answer, or how and when to call, still gets a receipt.
  Checked against all 120 clients who had answered by 27 September: it
  holds exactly the two the branch had identified by hand.
  **No receipt ever goes from an answer taken on a call, or to a held
  row.** Answers ticked on an `r=phone` link are marked `[receipt] by
  phone: read back on the call` the moment the receipts run sees them, and
  a row with anything in Exclude (bounced, a recovered address awaiting the
  go, a check, a claim) is marked `[receipt] held: row excluded (…)`. Until
  27 September a receipt went to whatever address the send row held, so a
  phone answer from a bounced client would have gone to the dead address,
  and a recovered address pasted in under a hold would have been written to
  before the branch's go. A client who tapped the letter and was also
  called gets a receipt for the taps alone. `health/receipt-guard-harness.js`
  in the session scratchpad runs `tReceipts_` in Node on those cases.
  **One receipt per answer, ever** (1 October 2026). A run used to look
  only at the taps not yet marked, so a client who tapped an answer again
  was thanked again for it: of the receipts sent to the first 278 clients,
  60 did only that. One client had four for the same "No" between 9 pm and
  6:30 am. A
  later receipt could also offer questions answered in an earlier one.
  `tReceipts_` now remembers what each client was thanked for and what
  they answered. A batch made only of answers already thanked is marked
  `[receipt] repeat: thanked before` and sends nothing. A receipt never
  offers a question answered before (`g.prior`). A reply with words of its
  own, or a tap that opens the form, is never a repeat. An answer whose
  receipt was held, or taken on a call, was never thanked, so a genuine
  tap of it is. `health/receipt-repeat-harness.js` covers it (15 checks,
  7 of them failing on the previous script).
  **No receipt for a reply in the client's own words** (1 October 2026,
  noon: "please ensure no duplicates are triggering to the client once
  they respond"). A client replied at 12:00, the manager answered her
  himself at 12:07, and at 12:10 the receipts run sent her "Thank you,
  <first name>. We have received your response." as well. By then 42 clients who
  wrote in had had one (45 e-mails), some only for writing "Noted, thank you", some
  minutes before or after the manager's own reply. A client who writes is
  owed a person's reply, as with the follow-up note. `tReceipts_` now marks
  such a row `[receipt] held: they wrote in their own words: a person
  replies` and sends nothing for it. Taps sent beside it still get their
  one receipt, and a reply that answers a question (a Ref line, the reply
  mode) still counts as a tap. Until then the branch saw each reply
  through the receipt's copy, so `tWroteAlert_` sends the two `TRANSITION.CC`
  addresses one internal e-mail a run naming who wrote and their words,
  with the internal footer. Nothing goes to the client.
  `health/receipt-wrote-harness.js` covers it (20 checks, 16 of them
  failing on the previous script).
- **Three automatic e-mails, then a person** (6 October 2026). Measured that
  morning: the reminder had brought 128 of the 323 clients who answered,
  84 of them the same day and none after day five; the receipts had gone
  without a complaint since the 1 October fixes; the "still on it" note had
  gone to 87 clients and brought 8 of them back in their own words. What
  clients were writing was not "stop e-mailing me" but "kindly seeking your
  response" and "why is my policy taking so long": the irritation is in the
  wait after the e-mails, not in their number. The manager: "it's a human
  interaction after the third … you don't want to irritate clients with
  automated emails right through." So a client gets the letter, one reminder
  if they do not answer, and one receipt when they do, and nothing else from
  a machine. `ONE_RECEIPT_PER_CLIENT` in Transition.gs: a client who answers
  again after their receipt is marked `[receipt] held: one receipt per
  client: a person follows up` and named, with what they answered, in the
  internal e-mail that names who wrote in (`tWroteAlert_`); a tap that opens
  the form still brings the questionnaire's own confirmation. `STILL_NOTE_AUTO`
  false: the chase keeps listing the late clients for the branch and marks
  them `[chase2] held: automatic notes are off since 6 October: a person
  sends it from the board`, and the note itself is a press on the assignment
  board (`tStillClient_`, `tell=still`): open the client, mark the call,
  tick "Still on it (the team's note, once ever)". The branch and Client
  Support may press it, because the note is the team's; it goes once ever to
  a client, is never ticked by default, and carries the same words as before
  (receipt.json `still`). `RECEIPT_WAIT_MIN` is 15, so the one receipt
  gathers a slow reader's taps. The receipt's last line tells the client it
  is the only automatic e-mail they will get about their answers. The call
  promise is `CALL_WHEN` in build-letters.py, "within two working days"
  (until then "today or tomorrow", which 223 "call me" taps against a team
  that reaches thirty clients a day had already broken); it is the branch's
  own late line (`WAIT_DAYS`), so the alarm and the promise agree, and one
  edit changes every letter, the page, the receipt, the manual and the call
  script together. What stands: the reminder at five days, the manager's
  notes, the introduction when an agent is named, "Send again" by hand. A
  complaint about a notice itself is never answered by the system: its rows
  are held for a person, and the manager decides how it is answered.
  `health/three-mails-harness.js` in the session scratchpad covers it (21
  checks).
- **Once a call is coming, the page asks when.** `WHEN` in build-letters.py
  ("When suits you best for a call?": morning, afternoon, evening) is asked
  on the page a tap opens whenever the tap was `callme`, and appears the
  moment an on-page answer brings a call, so the receipt's "at the time you
  chose" is true. The answer rides `informed` with `q=when_*` and is
  recapped like any other.
- **The review's own e-mails go from support@ too, once Microsoft 365 is set
  up.** `clientMail_` in Service.gs sends the questionnaire confirmation
  ("your service questionnaire is in", with the reference and access code)
  and the "Meet your agent" introduction through `tMsSend_` — which now
  takes Blob attachments for the PDFs — when the three Script properties
  exist, and from the script owner's account as before when they do not,
  because the reference and access code must always reach the client. The
  introduction is copied to `TRANSITION.CC`: it is the follow-through the
  receipt promises in writing.
- **The send goes in four families, one wave a day, and the reminder runs
  by itself from day 22.** Decided 25 September 2026 ("combine and regroup
  to ensure we scale proper and with a flow"). Every letter carries
  `family` in `openings.json` — *notice* (T, T1), *action* (J, K, I),
  *keep* (F1–F5, R1, R2), *return* (G, A) — and the family is the wave, so
  Client Support reads one day's responses before the next day's letters
  go: day 1 the notice and the action letters, day 2 F5, F4 and F3, day 3
  F2 with R1 and R2, day 4 F1, day 8 G and A, in working days from the
  go-live day (`WAVE` in `sendlist.py`, `WAVES` and `FAMILIES` in
  `build-letters.py`). The `Send on` column carries the dates; moving a
  wave is editing that column. **On the go-live morning, 25 September
  2026, every date was set to that day** ("so i need all to go out in
  batches today"; then "the run should be every 30 mins"): the whole list
  in one day, in batches of up to 120 every thirty minutes (`BATCH` and
  `SEND_EVERY_MIN` in Transition.gs; `transitionGoLive` replaces the send
  trigger with the configured cadence every time it is pressed, so a
  change is a paste and a press, never a second trigger beside the first).
  Three ceilings sit under that: Microsoft 365 takes thirty a minute from
  one mailbox, so a letter never follows the last inside `PACE_MS` (2.15 s,
  counted from when the last began, `tPace_`), which makes 120 a run four
  and a half minutes of the six a run is allowed, and a row is marked the
  moment it is sent, so a run cut short never sends a row twice — but a
  run Apps Script kills at six minutes writes no log line and shows no
  alert, which is what the first batch of the go-live morning did at 106
  letters (holding 95 same-address rows first cost it a minute and a
  half), so `RUN_BUDGET_MS` (five minutes) now stops the sending inside
  the run, says how many of the batch were left, and the next run takes
  them; and the
  script owner is a consumer Google account, whose triggers may run about
  ninety minutes a day in all — fourteen hundred letters take some fifty
  of them, the five-minute reads and receipts the rest — so on a heavy day
  the menu's "send a batch now" is the relief valve: a run started by hand
  is not counted. The team page opens on the four families and the path a
  tap follows, and the letter cards on the manual and the team page are
  grouped the same way. Every letter ends in the same four-step "What
  happens after you tap" strip (`FLOW`), which the receipt's
  follow-through and the team page repeat, so nothing is promised in one
  place that another does not keep. **The reminder is not a letter of its
  own**: `tRemind_`, at the end of every batch and inside the same
  cap, sends the client's own letter once more to any row sent
  `REMIND_DAYS` (**five** since 29 September 2026, when the manager asked
  for the follow-up "in about five days from the date it was sent"; 21
  before) or more ago, still `sent`, whose token has no row on
  Client Responses and no review (`tAnswered_`; details taken on a call
  do not count, see `tContactRow_` below), with `sent_on` set so the
  banner above the greeting says when the first went and the subject reads
  "Reminder:", and marks Status `reminded <date>` — never twice, `Sent at`
  untouched (it is the first send's date and what keeps the row out of the
  batch), never to an inbox that had a letter that day, at most
  `REMIND_MAX_PER_RUN` a run (120 since 30 September 2026, when the manager
  wanted the whole follow-up out in one day, "another mass email in the
  next 2 hours"; 30 before, about 480 a day at a run every thirty minutes
  from 9 to 5, which would have spread it over four days), in its own try/catch so
  it can never stop the day's letters; `REMIND_DAYS` 0 turns it off. The
  FCA's redress-letter trial (Adams and Hunt 2013) found a reminder at
  three to six weeks lifted response more than any change of words, which
  is why it was 21; the manager chose sooner. On 29 September, 1,199 of the
  1,477 clients e-mailed on 25 September were due it (unanswered, not held,
  not bounced), all waiting on the hold. `svc/remind-harness.js` in the
  session scratchpad runs the pass in Node on a mocked tab.
  **No reminder to anyone who responded** (30 September 2026, keeping the
  reminder: "if they have answered or responded please ensure we dont
  resent"). Besides an answer, a reply or a review on the token, the pass
  now skips two more kinds of client (`tRespondedAt_`). One is a client
  Client Support spoke to after their letter went, which is any contact
  row dated after Sent at. The other is a client who sent a review from
  their own address after it without the letter's link. A call before the
  letter is not a response to it: when an e-mail was taken for a client
  the letter had not reached, their first letter goes, and its reminder
  after it. On the rehearsal of 30 September this took 121 people who had
  confirmed their address on a call off the reminder. A person can stop
  anyone else's reminder by typing anything but "sent" in their Status.
  **A run that cannot read the answers reminds nobody** (7 October 2026,
  the manager: "client do not get the reminders a second time whom have
  responded"). `tAnswered_` and `tRespondedAt_` used to count nobody as
  answered when Client Responses could not be read; on that morning's
  sheet one such run would have sent 120 reminders, every one to a client
  who had answered. `tRemind_` now reads them strictly, so the run throws
  and the batch logs `remind-failed`; every other caller reads them as
  before. The same morning, before the paste, a one-off script outside the
  repository set Status to `no reminder: answered` or `no reminder: spoke
  to us` on the 446 clients who had responded and still read "sent". That
  is the hand-stop above, so the reminder can never pick them whichever
  script is pasted. Nothing else reads those words. A whole book can be held
  the same way, with a mark in Exclude (`hold: manager's hold, <date>`):
  every client e-mail checks Exclude first (the letter, the reminder, Send
  again, the receipt, the notes and the introduction), and a mark not in
  `tFilePhoneEmails_`'s list is never lifted by a call. Answers are still
  recorded.
  **One inbox, one e-mail a day, across runs too.** Sent at keeps the
  first letter's date, so a reminder sent in the 9:00 run did not make its
  inbox busy for the 9:30 run. In the rehearsal, five families in Tricia
  Baksh's book sharing an inbox got both reminders on one day. The batch
  now also counts a Status of `reminded <today>` or `sent again <today>`
  (`health/followup-harness.js`).
  **"Send again" is a tick box on Transition Send** (asked for the same
  day: "a way to run again … to send off a client a survey"). `tAgainCol_`
  adds the column the first time the five-minute run finds none; a person
  ticks a row, and the next batch (`tSendAgain_`, after the day's new
  letters and before the reminders, inside the same cap) sends that
  client's letter once more — with the "we wrote to you on" line and
  "Reminder:" when it went before, as its first letter when it never went —
  whatever its Send on and whether or not the client answered, because a
  person asked. Every hold still stands: the manager's hold on client
  e-mail, anything in Exclude, a Test row, one letter an inbox a day; a held
  row keeps its tick and goes when the hold lifts. Sent, the tick clears
  and Status reads `sent again <date>`, which also keeps the automatic
  reminder off it. **Bounced letters are held by themselves.** Until 29
  September the inbox reader passed over every non-delivery report, so
  the 139 letters that bounced on 25 and 26 September (read by hand off
  support@ on 27 September) still read `sent` and would have been followed
  up. `tInbox_` now knows a report by its subject (`tIsBounce_`), takes the
  failed address as whichever address in the report's own part — cut
  before the original message's headers, which also carry the CC — is on
  the tab, and holds every row at it with `bounced: <no such mailbox,
  mailbox full, bad domain, no response, blocked> (<date>)` in Exclude and
  `bounced` in Status (`tBounceMark_`); a row held for anything else is left
  as it is, and a report about a CC never touches the client. The first run
  after the paste sweeps the inbox back to the day before the first letter
  (`tBounceSweep_`, once, remembered in the `bounce_last` property, which
  the five-minute reader carries on from). That Exclude is exactly what
  `tFilePhoneEmails_` replaces when Client Support takes a working address
  on a call, and the letter then goes again after the go.
  `health/followup-harness.js` in the session scratchpad covers the three.
- **The Act's own words are on every letter whose situation it speaks to,
  and the days are worked out on the day the letter goes.** 25 September
  2026: "include the insurance act and days to deliver and come across
  relevant … the agents who left hate you and your team". `act` and `plain`
  in `openings.json` put a teal card above the answers: the quotation, and
  what it means for this client in our words. J quotes the premium rule (a
  premium handed to a representative is deemed received by the insurer, so
  anything paid when the contract was brought counts and the receipt is
  Guardian Life's) and states the branch's own standard, personal delivery
  within 28 days — the words of the branch's delivery-update e-mail, sent
  to a client whenever a contract is ready since September 2025; K and T1
  quote the issue rule (an individual life policy is issued within twenty
  business days of acceptance of the risk); T quotes the revocation of a
  registration on notice of a termination, and says the Act requires the
  insurer to notify the Central Bank within five business days and that a
  premium handed to the agent while registered counts as paid; A the cheque
  rule (five business days); G the non-forfeiture rule (a policy whose
  surrender value covers the overdue premium is not forfeited); I as
  before. Under the check-first question on every letter, one line
  (`Q_NOTE`): no agent or broker may cause a policyholder to discontinue or
  replace a policy without first discussing the advantages and the
  disadvantages. **Every quotation was checked against `act2018.dec.txt`**
  with the capitals dropped and a hyphen read as `b`, which is how the
  decoded PDF garbles them (the check lives in the session scratchpad);
  still no section numbers anywhere. The days: `days_held` (J, from
  `collected_on`) and `days_open` (K and T1, from `app_received`) are
  derived at send time by `tDerive_` in Transition.gs and `derive()` in
  `fill-plain.py`, never stored on the sheet (`T_DERIVED`). `promised_on`
  (J) is the date of the branch's delivery-update e-mail to that client,
  taken from the Salesforce task by policy number, and the sentence "On
  {{promised_on}} we wrote to you that your policy contract would be
  delivered to you personally within 28 days" sits between fact markers
  inside the opening, so a client who got no such e-mail reads the letter
  without it. T also asks how the client pays today (`paying`: "in person,
  to a representative" is the `pay` tap, the one exposure after a
  termination). The send list is now 30 columns (`promised_on` after
  `collected_on`), and **Transition.gs must be pasted before any send, the
  Test rows included**: every letter now carries `{{sent_on}}` for the
  reminder banner, and the previous script stops each row with "carries
  {{sent_on}}, which this script cannot fill" rather than send it.
- **Two reports: the digest twice a day, and the Monday insight report.**
  Asked for on 25 September 2026 ("I need to have some serious insights").
  `transitionDigest` goes at the hours in `DIGEST_HOURS` (8 and 12, sheet
  time; Apps Script fires within the hour) to `DIGEST_TO` (blank = the
  script owner): tiles (sent, waiting, taps, reviews, late), then the
  insight block for the last day, by letter, taps, the late list, reviews,
  verdicts, last runs. `transitionWeekly` goes every Monday within
  `WEEKLY_HOUR` (7) to `WEEKLY_TO` (blank = `DIGEST_TO`; several addresses
  comma-separated): the week to that day, read for what it means.
  `tInsights_(days)` computes everything on the fly from the three tabs,
  staff Test rows never counted, and `tInsightHtml_` lays it out — tiles;
  "What it means" in sentences written only where there is data (response
  and how fast it comes, approaches by former book, the rating, who wants
  the pays check, stay or talk, contracts missing, applications, in-person
  payers, reviews, open and late answers with the median working days to a
  name, reminders and the answers after them, failed sends); by family; by
  letter; every question with each answer's count, share and bar (the words
  from receipt.json, so report and letters agree); by former agent's book
  sorted by approaches (the poaching map); when the first answer comes,
  from the day the letter went; taps by type; follow-through; the "to act
  on" list (clients whose answer is in `T_RISK`, open first, with who is
  named); the next seven days and the reminders due. Installed by
  `transitionSetup` and by `transitionGoLive` (`tWeeklyTrigger_`); the
  menu item "Transition: e-mail the weekly insight report now" needs a
  Service.gs paste, and until then the editor's Run button on
  `transitionWeekly` does the same. `svc/insights-harness.js` in the
  session scratchpad runs both on a mocked campaign.
- **Every client e-mail ends in the confidentiality footer, and every
  internal one says it is internal.** Asked for on 25 September 2026 ("the
  proper disclaimer … in the event of confidentiality you can take action
  and you are protected; review the laws in Trinidad under data
  protection"). `LEGAL` in build-letters.py is the one text: on the branded
  and plain letters, the receipt, and in receipt.json (`legal`), from which
  `tLegal_` in Transition.gs puts it on the "still on it" note and
  `clientMail_` in Service.gs on the questionnaire confirmation and the
  introduction, with the same words as a fallback in the script. The law
  it rests on, checked that day: the Data Protection Act 2011 (Chap.
  22:04) is only partly in force — Part I with the General Privacy
  Principles and the sections establishing the Office of the Information
  Commissioner came into operation on 6 January 2012; the private-sector
  obligations and penalties have not been proclaimed — so the footer
  commits the branch to the Principles by name, never to a section, and
  names the Commissioner's office as the authority the Act establishes,
  not as a court; the confidentiality duty is the Insurance Act 2018's own
  (no registrant, officer, employee or agent may disclose a policyholder's
  affairs without express consent unless the law compels it), quoted on
  protected.html. What it promises the client: the e-mail is for them
  alone; tell us and delete it if it came in error; their information is
  used only to look after the policy, never sold, never disclosed without
  express consent; they may ask what we hold and have it corrected; a
  concern can go to the branch, to Guardian Life or to the Commissioner's
  office, and raising it never changes how the policy is looked after.
  Compliance sees the wording. The digest, the Monday report and the
  internal chase carry `INTERNAL` ("do not forward outside the branch")
  because they carry client names.
- **The clients with no e-mail are a call list, and a phone answer is
  recorded on the client's own link.** Asked for on 25 September 2026
  ("persons who don't have email: the call list to get in touch with, how
  to handle"). The send list holds them with `no e-mail` in Exclude; the
  call list is built beside it in the session scratchpad from those rows,
  with the letter they would have had, the facts off the sheet, the phone
  and address off the portfolio, one line on why we are calling, and the
  client's own `/your-policy/?t=…&s=…&r=phone` link. `orphan-transition/call-script.html`
  is the call: the letter spoken, in the same order, with the same
  questions, and the caller ticks the answers on that link with the client
  on the line, so they land on Client Responses and in the reports like a
  tap. **The link must end in `r=phone`.** Without an `r=` the address is
  the film line and opens `/orphan-video/`, which is what the first call
  list (25 September), the agent's brief and the board all did until 27
  September. `r=phone` is the caller's copy of the page: every check of the
  letter plus how and when to reach them, nothing ticked, nothing recorded
  until Send, and each answer filed with `Page` = `/your-policy/phone?q=…`
  so a phone answer is never read as a tap. `tInsights_` counts them on their own (`calls`: listed, reached,
  approached, by letter; the risk list marks them "by phone"), never among
  the letters sent, so the response rate stays the letters' rate;
  `tReceipts_` marks every answer taken by phone `[receipt] by phone`
  rather than e-mailing it, because on that call the caller is the
  receipt. Never call a row the list holds for a person to check first.
  **Client Support calls before any agent is named, and they update
  records; they never advise** (27 September: "remember they are not
  licensed agents, so they should not be giving any sort of advice, but
  asking questions. The objective is to get the data cleaned, the correct
  email, then send off the email … to have it on record"). Sasha, Liz and
  Azariah split the call list, whole households together, most urgent
  first: everyone the letter could not reach (no e-mail, or bounced) and
  the terminated book and action letters that went unanswered.
  `orphan-transition/client-support.html` is their day from 7:00, the six
  steps of the call in words, what to say when a client asks something
  (anything about the policy is a call-back from a licensed agent), and
  what they never do. Their links end in **`r=update`**, the staff copy of
  the page: no policy questions at all (letters T and T1 keep the two
  factual ones, whether the agent has been in touch and how the premium is
  paid), only how best to reach them, the e-mail, spelled back and ticked
  as read back (it refuses one that looks cut off, like `gmail.co`, or
  misspelt, like `hotmial`), or "no e-mail", a new number or address only
  if changed, and the caller's own name, kept on the device. `r=phone`
  stays the licensed agent's copy, with every check of the letter. Each
  detail is filed as its own row under `/your-policy/phone` —
  `q=email_given` (or `email_none`), `phone_given`, `address_given` — with
  the Referrer cell reading `call by <name>: <value>`, and every other
  answer from that call reads `call by <name>`, so nothing is retyped.
  **The e-mail files itself onto the send row, held for the go.**
  `tFilePhoneEmails_`, first thing in the five-minute receipts run, writes
  each `email_given` address onto the client's Transition Send row with
  `hold: e-mail by phone` in Exclude and who took it, and when, in Reason;
  a row whose letter went to another address (bounced, or the client reads
  a different one) has Sent at and Status cleared so the letter goes again
  to the new one, except for a client who already answered a letter that
  reached them (7 October 2026): their address is updated and nothing
  else, so the letter never goes to them a second time, while a bounced or
  no-e-mail client's letter still goes after the go
  (`health/phone-answered-harness.js`, 8 checks); the same address already
  sent to is left alone; a row
  held for anything else (an agent, a household, staff, a claim, a check)
  is never touched; each Client Responses row read is marked `[filed…]`.
  The address a letter bounced from is never filed back onto its row, even
  when a caller marks it confirmed (29 September 2026: ten bounced
  addresses kept as they were, two visibly misspelt): a row held
  `bounced: no such mailbox` or `bad domain` with the same address is
  marked `[filed: this address bounced …]` and stays held; a full mailbox
  may be confirmed, since the address is the client's own.
  The branch's go is `transitionReleasePhoneEmails` (menu: "Transition:
  release the e-mails taken by phone (the go)", which needs a Service.gs
  paste; until then the editor's Run button, or clear those Exclude cells
  by hand), and the ordinary batch sends the letters. A new number or
  address stays on Client Responses for Salesforce. The staff lists are
  built in the session scratchpad (`calls/build-staff2.py`) and never
  enter the repository; `health/file-emails-harness.js` there runs the
  filing and the release in Node.
- **Every letter shows the client their own record with the branch team.**
  Asked for on 24 September ("they are to see us as from onboarding and a
  team service, as we have all the data on service levels"). A gold panel
  under the facts, "Handled for you by our branch team", one cell per count:
  documents handled (the Log Book, by policy number), requests handled
  (completed Salesforce service tasks), premium reminders, and the month of
  the last birthday note. `tools/letters/service-record.py` writes them onto
  the send list as `svc_docs`, `svc_requests`, `svc_reminders` and
  `svc_birthday`; run it after `sendlist.py`, on the same copies, outside the
  repository. A zero or a blank cuts its cell like a blank fact, and a client
  with nothing on record reads one line about the team instead (between
  `<!--nosvc-->` marks). The premium and lapsed letters leave the reminders
  out: a count of reminders beside a premium still unpaid reads as a
  reproach. **Only precise links count**, because the client reads the
  numbers: their own portfolio record, their policy numbers, a contact whose
  name is theirs, never an Account, which would lend one client a
  household's or an employer's history. Every service task in the branch's
  Salesforce was created by the branch team (sales support, the manager's
  assistant, the personal assistants, the manager), none by an agent, which
  is what lets the panel say "our branch team". Tasks begin in 2025 and the
  Log Book in 2023, so a count understates a long relationship and never
  overstates one. The pace line ("most within a working day") is the Log
  Book's own: three documents in four went on to Guardian Life within one
  working day in the twelve months to September 2026. Measure it again
  before changing those words. The panel says what the team did, never what
  anyone else would not do.
- **Transition.gs stops a run on an unfilled field.** A letter on the site
  carrying a `{{field}}` the pasted script does not know would reach the
  client as `{{svc_docs}}`, so the send throws before the first one. The
  copy in the project predates the service record: paste the current
  `Transition.gs` before any send from Apps Script. Import the send list
  with "Convert text to numbers, dates and formulas" ticked: the dates then
  print long, and the birthday month, which the import also reads as a date,
  is printed back as a month ("August 2026", never "1 August 2026").
- **The `review` tap opens the form.** It is the full review line now, not a
  card; the page a tap opens logs it and carries the client into the
  review, like `urgent`. Until 24 September it showed a thank-you and dimmed
  the review door, so the first tap on every in-force letter led nowhere.
- **Team verdicts on any letter are accepted.** `FEEDBACK_ITEMS` in
  Service.gs used to list the six original letters, and the backend
  dropped every verdict on F1–F5 in silence (the page still said logged).
  It now takes any letter key, one capital and an optional digit.
- **The `urgent` tap is the questionnaire door.** "I want an agent now. Let
  me tell you my concerns first" is on every letter (a card where it is one
  of the taps, a line beneath them where it is not). The client page logs it
  with the token and then forwards to the review, so the client states what
  went wrong before anyone is named and the branch reads it before it
  assigns. **No timeline is promised for the agent**, decided 24 September
  ("don't commit to assign an agent … their concerns will be reviewed and
  we will assign the appropriate agent, don't give a timeline"): every
  letter, tap, page line and receipt says the concerns are read by a
  person first and then the client is matched to the agent who fits, and
  nothing says when. "Next working day" and "within two working days" are
  gone from the campaign's client-facing words; `WAIT_URGENT` and
  `WAIT_DAYS` in Transition.gs are the branch's own targets for the chase
  and are never shown to a client. What is still promised is what Client
  Support controls itself: a call today or tomorrow, a receipt checked
  within two working days, a document on to Guardian Life mostly within a
  working day. The film's own line ("be matched, within two working days")
  and the donthaveanagent.com pages still carry the standing two-day
  promise; changing the film means re-voicing one line.
- **The pages are wired to the Service Questionnaire deployment** (the same
  `/exec` URL the six front ends hold) and ask it `action=ping` on load. Only
  a version carrying the `resp`/`feedback` actions answers with
  `campaign: 2`, so the team pages keep their amber "not recording yet"
  notice until Manage deployments → New version is published, then clear it
  themselves. Nothing to paste. Client taps fire regardless; against an old
  version they fall through to the form redirect and are lost, which is why
  no letter goes out before the notice has cleared.
- **The send runs from `apps-script/Transition.gs`**, a second file in the
  same container-bound project as `Service.gs`. It fetches the six generated
  letters from the site, fills the `{{fields}}` from the **Transition Send**
  tab, cuts a blank fact out between the `<!--fact:key-->` markers the
  generator writes, and sends it through Microsoft 365 as
  support@rickyrampersadbranch.com from a trigger every `SEND_EVERY_MIN`
  minutes (thirty), working hours only, up to `BATCH` (120) a run, the
  notice and the action letters first. A projected lapse date already gone by is cut at
  send time (`tDerive_`, and `derive()` in `fill-plain.py`): the sheet still
  flags the policy `Overdue`, so the projection did not happen, and
  "Projected lapse 18 August 2012" is not a fact a client can use — 88 of
  the first day's rows carried one; Paid to and Days outstanding still
  print. Forty of the I rows were more than a year past their paid-to date
  (the sheet's `Overdue`, most likely an automatic premium loan); the count
  was put to the manager before the first batch. No letter
  text lives in the script: rebuild the letters and the next batch carries
  the change. `transitionSetup` makes the tab and the 8:00 digest only;
  `transitionPreviewToMe` sends one of each to the owner;
  `transitionSendTest` sends the rows marked `Test = Y`, live or not, and
  sends them all again on every press, sent before or not (24 September,
  evening: the branch could not find the Sent at cells to clear) — and a
  Test row is always a team member standing in as a client, never a client's
  own row, because that button sends whatever carries the mark;
  `transitionGoLive` (menu: "Transition: go live") sets the `transition_live`
  script property and installs the hourly trigger, and `transitionPause`
  clears both — until go live, the hourly run sends nothing, however long the
  list sits in the tab. A row with anything in Exclude never sends; a row with
  no Send on date is held; a sent row never sends twice; a row the sender
  cannot use (no e-mail, no first name, no letter for its segment) is moved
  to Exclude with the reason. The page and the digest show a red banner while
  the send is off, and the last runs with their reasons.
- **A sent row never sends twice, even when the tab is sorted mid-run.**
  The batch picks only rows with an empty Sent at, and stamps Sent at the
  moment each letter goes. On 30 September 2026 the live tab turned out to
  have been sorted by Sent at, which moved every row ("i need to ensure
  that the email will continue in the batches not send again to the ones
  received"). A run reads the tab once and writes back by row number, so a
  sort during a batch would have put the stamps on other clients. The
  client just sent would read unsent and get the letter again next run: 6
  of 30 in `health/sort-safety-harness.js`, run on the previous script.
  `tAt_` now checks each row's Token before every write to the tab. When
  the row has moved, it reads the Token column again and finds every row
  of the run by its token. That covers the stamp, the hold, the bounce,
  the phone-filed e-mail, the release and the "Send again" un-tick. A row
  with no token is written only where it still is, or the run stops and
  the next one starts fresh. Sorting is still better done in a filter view
  (Data → Filter views), which moves nothing. **Every check a row faces
  goes by address and name, never by row number.** The old `check: same
  e-mail as row N` notes all pointed at the wrong clients after the sort,
  so `tSharedInboxRows_` finds the inbox's letters by the address. The
  sender takes an inbox's first letter by its date, not its place in the
  tab. A hold names a client number (`tWhoRow_`) instead of a row. The
  rehearsal on the sorted tab (`ops/go-sim2.js` in the scratchpad) found
  0/92/0 before and 42/24/26 after, the same as on the unsorted copy.
  **The "Next e-mail" column** (`ops/next-email-formula.txt` in the
  scratchpad) is one formula in the first empty header cell of Transition
  Send. It spills two columns, Answered and Next e-mail, and says for every
  row what the batch will do: "got it 25 Sep: never again, except one
  reminder if no answer", "nothing more: spoke to us after the letter, no
  reminder", "next batch: first letter", "held for a check", and so on. It
  reads the same rows the script reads.
- **Automatic client e-mail is on hold until the manager's go** (28
  September 2026: "hold any emails going to clients until I say so").
  `HOLD_CLIENT_MAIL` (true) in Transition.gs, overridden by the
  `client_mail_hold` script property that `transitionHoldClientMail` and
  `transitionReleaseClientMail` set (menu items after a Service.gs paste; the
  editor's Run button until then). While held, the batch (letters, and the
  reminder pass inside it) stops before the sender, a press by hand included,
  and logs `held`; the chase still tells the branch and keeps the client's
  note due. Nothing is marked, so the go picks everything up. **Since 7
  October 2026 the receipts and the board's introductions are held too.**
  That day an introduction went to a client while an agent was being trained
  on the board. The manager asked to "hold off all auto email for now
  please!", then said "yes" to the hold stopping both. Until then receipts
  were not held, decided on 28 September ("if they answer on an old one, one
  going out is ok and logged"). `HOLD_RECEIPTS` (true) holds only the e-mail
  to the client. The receipts run still marks what it always marks, still
  tells the branch who wrote in, and still sends support@ the trail. So a
  hold never hides a client's own words. A receipt that waited is not
  marked, and goes once on the first run after the go, if the answer is
  under fourteen days old. `HOLD_INTROS` (true) has a naming brief the agent
  and send the client nothing and mark nothing (`introHeld` in the reply).
  An introduction held does not go by itself after the go, because a naming
  made in practice would go with it. Until 7 October `HOLD_RECEIPTS` stopped
  the whole receipts run, alerts included. The board says what is held
  (`introsHeld`, `receiptsHeld`). The introduce box is then unticked and
  cannot be ticked, and the hold and release messages name both. Still not
  held: a note the manager presses on the board (his go for that note), the
  Test rows (colleagues), the preview to the owner, the digest and the
  reports, the agent's brief, the inbox reader, the filing of e-mails taken
  by phone, and the questionnaire confirmation from Service.gs's
  `clientMail_`, because the reference and access code must reach a client
  who has just filed. `health/hold-harness.js` in the session scratchpad
  runs the hold in Node. `hold7oct/receipts-hold.js` (14 checks) and
  `hold7oct/intro-hold.js` (16, Node and Playwright, the real tabs) cover
  the 7 October change.
- **Every client e-mail goes out as support@rickyrampersadbranch.com,
  never from Gmail.** Decided 23 September: "we need to have
  support@rickyrampersadbranch.com and copy" the sales-support and branch
  manager's Guardian addresses. The letters, the receipts and the "still on
  it" notes go through Microsoft Graph (`tMsSend_`), carry both Guardian
  addresses in **visible** CC (`TRANSITION.CC`, the manager's choice), take
  replies at support@, and land in its Sent Items. The sign-in is an Entra
  app registration with the Graph **Mail.Send** application permission, held
  in three Script properties — `MS_TENANT`, `MS_CLIENT`, `MS_SECRET` — and
  never in the code, because the `.gs` files are public on the website.
  Until they are set nothing client-facing sends: no fallback to MailApp,
  which sends from the personal Google account that owns the script and
  allows about a hundred recipients a day, every CC counted — two copies on
  every letter would have held the send to some twenty-five letters a day.
  The mailbox's display name read "querymypolicy.com" until 24 September
  2026, when it was renamed "Ricky Rampersad Branch" (Microsoft 365 admin →
  Users → Active users → Edit user → Display name); the address did not
  change and must not — the letters send from it.
  **Until the Entra app exists, the letters go through the Claude Microsoft
  365 connector instead** (24 September 2026: "I don't know how to do the
  Entra, it's complicated, can you just work with what we have"). The
  connector is signed in as support@; it could only read mail until the
  admin granted it consent through the admin-consent link for its app, which
  added Mail.Send and Mail.ReadWrite. It sends from support@, saves to Sent
  Items and keeps the visible CC, but it accepts only p, br, a, b/strong,
  i/em, lists, headings, tables, hr and div — no logo, no colours — so it
  sends the plain letters `build-letters.py` writes to
  `orphan-transition/letters/plain/`, filled per row by
  `tools/letters/fill-plain.py` (run in a scratch directory; it holds the
  same rows the sender would hold and checks every body against that
  allowlist). A Claude session sends them one by one; nothing is automatic
  on this route, and client receipts go only when a session sends them. The
  eight staff tests went this way on 24 September; no client letter goes
  without the manager's word. Internal mail (the digest,
  the late nudges) still goes through MailApp. The older service e-mails in
  `Service.gs` (the daily follow-up's "still on it" notes, the six-month and
  birthday reviews) still send from Gmail, so the `dailyServiceFollowUp`
  trigger stays off until they are moved over too.
- **The send list is built by `tools/letters/sendlist.py` outside the
  repository**, on a copy of the Branch Portfolio sheet, with the departed
  agents' names in the git-ignored `departed.txt` beside it. It fills the
  exclusions before it picks a letter: the agents' own policies (full-name
  match), their households (same surname and the same address, phone or
  e-mail as the agent's own rows), staff addresses, death claims. A shared
  surname alone in the agent's own book, a matured policy and a postponed
  application are `check`, never auto-sent. Asked for on 22 September:
  "exclude the agents' policies who left … and his family, etc."
  **The Days column is days past the paid-to date only on a row the sheet
  flags `Overdue` (Status(2)).** On every other row it means something else,
  often days since issue. The first list read it bare and put 665 clients
  who owed nothing on the premium letter, printing a false "days
  outstanding"; caught on 23 September before any client letter went out.
  Test with the flag, never with Days alone. And the tool never marks a
  row `Test`: the Test rows are team members standing in as clients.
  **Two more exclusions, added 23 September ("not sending to the agents or
  their direct families"):** a client whose e-mail on file is one of the
  departed agents' own addresses (two rows would otherwise have mailed an
  agent directly), and anyone sharing a home address, phone or e-mail with a
  departed agent's own policy whatever their surname — a spouse or child
  under another name. An address, phone or e-mail shared by more than six
  clients is an office line, not a family, and does not count.
- **Every response gets a receipt, and the branch gets a copy.** The moment
  a client taps, `tAckClient_` (Transition.gs) e-mails them a short
  thank-you naming what happens next, CC'd to `TRANSITION.CC` — asked for
  on 22 September ("are responses coming in
  and I am to be copied"). `tChase_`, run from `transitionDigest`
  (never from `tSummary_`, which the responses page polls every two
  minutes, so a chase can never double-fire), tells the branch once a
  client's answers have been `Open` past the wait (`WAIT_DAYS`, or
  `WAIT_URGENT` for the urgent tap), and — still open at
  `WAIT × CHASE_MULT` — sends the client a warm "still on it" note.
  Both stop the moment Status reads anything other than `Open`; the level
  already sent is recorded in each row's own Note cell, appended rather
  than overwritten, so a human note there survives.
  **One client, one chase** (28 September 2026). Since the quick checks,
  every answer is its own row, and the chase worked row by row: run on the
  first weekend's answers it would have sent 103 clients the note, 54 of
  them more than once and one fifteen times, and put some eighty "Late:"
  e-mails a day in the manager's inbox. It now groups by token: one
  internal e-mail a run listing every client newly late (`tChaseSummary_`),
  and one note per client, ever, whichever row carries `[chase2]`. The
  note is never sent, and the rows are marked `[chase2] held: <why>`, when
  the send row has anything in Exclude (bounced, an e-mail taken by phone
  awaiting the go, a check), when there is no e-mail, or when the answers
  look automated (`tLooksAutomated_`, the same test the receipts use: the
  client who wrote on 26 September that she had sent none of her answers
  would otherwise have been told the branch was still on them).
  `CHASE_MAX_PER_RUN` bounds the notes a run sends. A staff Test row is
  never chased.
  `health/chase-harness.js` in the session scratchpad runs it in Node on
  made-up rows, and `chase/sim.js` on a copy of the live sheet.
  **The note owns the wait and asks for the client's own words** (30
  September 2026: "we did thank persons for responding and should we not
  send a follow up email as these persons are awaiting a response … would
  like to hear from persons the concerns to ensure the correct agent is
  assigned"). The first notes were due to clients whose receipt had
  promised a call "today or tomorrow" four working days before, with
  nobody yet named. So the note now says it has taken longer than it
  should. Anyone waiting on a call, a review or an agent is asked what
  they would like us to know before an agent is named, with a link,
  "Tell us in your own words", to **`/your-policy/words.html?t=<token>&s=<letter>`**:
  one box under the branch's own name, asking the note's own question.
  Until 2 October 2026 the link opened `/your-policy/review.html`, the
  six-step review form under the donthaveanagent.com name, which starts
  "Do you have your policy number?"; the morning the first notes went,
  the branch reported "the link not working". `review.html` now sends a
  bare `from=client&type=individual&t=` link (the notes already sent) to
  the words page, unless it came from our own pages; the letters' answer
  page adds `via=tap` on its way to the full review, which is still a
  letter's own line. The words page sends the words to `Service.gs`
  (`action=resp`, a POST in text/plain, `w=`), which files a `question`
  row, `Page` `/your-policy/words?q=wrote`, the words quoted in Note
  exactly as `transitionInbox` files a reply. So no automatic receipt
  goes, the branch gets the wrote-in alert, the follow-up note holds, and
  the board shows the words as the client's ("Wrote to us on the page").
  A backend older than that (ping below `campaign: 5`) cannot take the
  words, so the page opens the client's own mail app instead, addressed
  to support@ with `Ref: <token> question wrote` under the words, which
  the inbox reader files as the same row. A scripted browser sends
  nothing. **The words come with the trail** (asked the same day: "can
  this include the trail"). A reply by e-mail arrives in support@ with
  our e-mail quoted under it; words from the page have no thread, so the
  receipts run sends support@ one e-mail per writer (`tTrailMail_`), the
  branch copied, reply-to the client, subject `Re: Still on it, <first
  name>.` so it threads with the note here and in the client's inbox:
  their words on top, then the trail, newest first (`tTrail_`): our
  letter by its subject line, a reminder, their answers in the letter's
  own words, our receipt, a call, their replies, the manager's notes, the
  introduction of their agent, the follow-up note. It is built from
  Transition Send and Client Responses in words the client saw, never a
  staff name, a hold or a mark, because a reply carries it to the client;
  their reference sits at the foot, so their answer files on their
  record. Page writers get this in place of the wrote-in alert; if
  Microsoft refuses it, the alert goes instead. `health/words-harness.js`,
  `health/trail-harness.js`, `svc/words-board-harness.js` and
  `words/words-test.js` in the session scratchpad cover it. A payment, a
  contract or an application gets its own line instead (`still.follow`
  in receipt.json, from `STILL` in build-letters.py). `still.line` is
  what a Transition.gs older than this reads.
  A client who wrote to us in their own words gets no note. They are owed
  a person's reply, and their rows are marked `[chase2] held: they wrote
  to us in their own words`. Nor does a client with an agent already in
  Assigned to (1 October 2026, when agents began to be named): the note
  says one is about to be named, so it is held as `[chase2] held: an
  agent is named (<name>): the agent follows up`, and the branch's late
  list still shows them until the agent marks the call. A day counts once it is over, so an answer
  from a Friday reaches four working days the next Friday morning.
  `health/still-note-harness.js` covers it (14 checks). `chase/sim30.js`
  ran it on the live sheet on the evening of 30 September: 163 clients
  over the following week, once each, 75 of them on Friday 2 October, and
  34 held because they wrote. The note ends with the client's reference
  (`Your reference: <token>`, small and grey). A reply that quotes the note
  files on that client's record from any address (`T_YOUR_REF`, read after
  the address and before the name). One of our own addresses counts only
  when it is the one the row was written to, a colleague on a Test row. A
  note Microsoft refuses is marked `[chase2] held: the note did not send`
  and listed for the branch, never counted as sent. **`transitionStillTest`**
  (the editor's Run button; asked for as "can i see a test") sends the
  Test rows the note exactly as the chase would, each in the version its
  letter brings: J the contract, K and T1 the application, I the payment,
  the rest the review link. It marks nothing, and refuses while the site
  still serves the old words. `health/still-test-harness.js` covers it
  (29 checks).
- **The chase only ever acts on a token this campaign's own Transition Send
  tab recognises.** Client Responses has recorded taps from the site's
  original doors since before this campaign — months of rows that still
  read `Open` because nothing before 22 September ever looked at that
  column again. The first version of `tChase_` did not know the
  difference, tried to chase all of it in one run — up to three per-row
  full re-reads of the Transition Send tab, times however many rows had
  piled up — and timed out at Apps Script's six-minute ceiling with an
  unknown number of internal nudges and client "still on it" notes already
  sent to people who had nothing to do with this campaign. Fixed the same
  day: the token map is read once per run (`tTokenMap_`), any row whose
  token is not on it is passed over in silence, and `CHASE_MAX_PER_RUN`
  bounds how much a single run will act on regardless, logging what was
  deferred. Never widen the chase back to "every `Open` row" — that is the
  exact bug — and never back to one chase per row, which is the other.
- **What comes back is watched on `orphan-transition/responses.html`**
  (opens with the branch code, like the wall; `action=transition`) and in
  the digest from `transitionDigest`, which fires as many times a day as
  `TRANSITION.DIGEST_HOURS` lists (`[8, 12]` by default — the noon run was
  asked for on 22 September, for a lunchtime VP meeting).
  `transitionSetup` tears down and rebuilds the digest triggers from that
  list every time it runs, so changing the hours is just running it again.
  First on both page and digest: taps waiting more than two working days
  with nobody assigned. The manager's `dashboard.html` and the branch's
  `wall.html` (six big slides, first names only) read the same answer.
  **All three share one answer**: `transitionData_` caches `tSummary_`,
  because on the go-live afternoon the summary took seven seconds a request
  and one request in eight was lost to the web app's own timeout while
  several screens polled at once, which read on the screens as "no walls
  are opening". **A cache value holds 100 KB, and the answer outgrew it.**
  On 8 October 2026 it was 166 KB (653 late taps), the put threw, the throw
  was swallowed, and every screen read the whole sheet on every refresh:
  "taking too long and not opening". It is now kept gzipped (about 17 KB)
  by `tCachePutBig_`, in 90 KB pieces under one stamp if it ever needs
  them: fresh for two minutes (`T_WALL_CACHE`), and kept six hours as the
  last good answer, which a screen gets at once while another screen is
  reading the sheet, or when the sheet fails. Anything else cached whole
  must stay under 100 KB or go through the same pair.
  `wall8/cache-harness.js` in the scratchpad covers it (24 checks, 3 of
  them run on the previous script). A gate that could not reach the sheet tries
  again by itself after fifteen seconds; only a refused code (the backend
  says `refused: true`) sends a viewer back to the gate for good. **The wall
  and the dashboard open on their last good answer** (25 September, "have
  the wall a little faster"): each keeps it in `localStorage`
  (`rrb-wall-snapshot`, `rrb-dash-snapshot`, twelve hours at most), paints
  it the moment the page loads with "updating from the sheet…" on the
  stamp, and swaps in the fresh answer when it arrives, so a wall switched
  on again or a phone opening the page a second time never waits on the
  gate; the first open on a new device still waits for the sheet, and a
  refused code clears the saved picture. The branch code is `TEAM_CODE` in
  Service.gs, never in the repository.
- **Who is looking after whom is decided on the assignment board, not in
  FactFind360.** Asked for on 26 September 2026 ("a link for who you are
  going to assign which agent to meet with the client, an agent's login view
  and a manager's login view, on these codes; shall I put FactFind360?").
  **Its short address is `/orphanmanagement`** (7 October 2026: "a log in
  so staff can view and log as well agent can do as well"): a stub that
  forwards to `orphan-transition/assign.html` with the query and the hash,
  so a `#t=…` link still opens one client. It is a staff address, never one
  a client holds, which is the only place "orphan" may appear in a URL.
  No: factfind360.com is the fact-find analyzer on Netlify from another
  repository, with no sheet, no codes and none of these clients, and the two
  hosting chains never touch. `orphan-transition/assign.html` sits beside the
  dashboard and reads the same sheet through three actions in Service.gs's
  `doGet` (`board`, `assign`, `update`, all in Transition.gs; `ping` answers
  `campaign: 3` or more once they are deployed, 4 with the Client Book's
  `book`). The branch code opens the whole
  board: every client who answered, most pressing first (`T_PRIORITY`), with
  their answers, taps, words and review, who is named and where it stands;
  `all=1` adds the clients who have not answered, so a caller can be named on
  them too. An agent's own portal code from the Agent Skill Bank opens their
  list alone, and so does the branch code with the agent's name, the way the
  agent portal works. Nothing is a new column: `assign` writes the agent into
  Assigned to and Assigned on on the client's actionable rows of Client
  Responses (a new `assign` row for a client with none), which the responses
  page, the digest, the chase and the reports already read; `update` writes
  the outcome into Status (Called, Met, Declined, Closed, Open; "No answer"
  is a stamped note only), which is what stops the chase. Every write is
  stamped in the Note cell (`[assigned 28 Sep · Name]`, `[met 28 Sep ·
  Name]`), appended, never overwritten. Assigning sends the agent one
  internal brief for the batch (MailApp, to the roster's e-mail, with the
  internal footer) and, when the box is left ticked, the client the
  introduction the receipt promised ("Meet your agent: Name", through
  `clientMail_`, so from support@ when the Entra properties exist), once per
  client per agent, marked `[intro Name]`. **Since 16 October 2026 the brief is a first look, not the file** ("we can just
  give a sneak peek, but he is required to log into the portal"): per client the name, age, town, the former book,
  what they do (occupation and employer) and how they pay, since when they have been with Guardian, how many policies
  (in force, lapsed, applications), the household and whether it was named with them, up to four lines of what the
  records show (`tInsightsFor_`: who the policies pay, cover ending, a premium due, a record to check; never the cover
  against income), how we have served them (the letter's service record, `tSvcOf_`), the one thing they told us that
  matters most, an open call-back, and a link that opens that client on the board (`/orphanmanagement#t=…`); never a
  phone number, address, e-mail, words or money figure of the client. Then **Your
  TT$200** (`tBriefClaims_`, from the Retention Payments tab, their own claims only): owed (with the Retention unit),
  found and held, to be paid on the commission run, paid, and still to earn (every client named to them with no claim,
  TT$200 each). `brief16/brief-test.js` in the scratchpad covers it (39 checks). The roster is the Agent Skill
  Bank: name, e-mail, Areas covered, Active, Portal code, and a Phone column
  if one is added, which the introduction then carries; the sheet has no
  client phone numbers unless a Phone column is added to Transition Send
  (built from the portfolio copy in the scratchpad), and the board and the
  brief read it when it is there. Codes never come back out of the backend.
  `svc/assign-harness.js` (Node, mocked tabs) and `svc/assign-test.js`
  (Playwright, mocked endpoint) in the session scratchpad cover it. A paste
  of Service.gs blanks `TEAM_CODE`: put the branch code back before the New
  version, or every screen locks out.
- **The introduction shows who the agent is, and the client picks when and how they call** (16 October 2026: "write a
  very nice bio on each of the agents. So different ones would template differently to show the caliber of the agents
  … the backing of the entire branch … the client checks when can the agent call and the preferred method … it directly
  goes to the agent and copy the branch manager and the sales support team, as well as the agent's manager", then
  "don't depend on the agent skill bank … Depend on pulling social media, LinkedIn, Facebook, anything at all to build a
  profile, and let's help the agent build their profiles").
  - **The Agent Profiles tab** (Name, Kind, Shown as, Title, Since, Headline, Bio, Ask me about, Before Guardian,
    Designations, Awards, Education, Phone, E-mail, Photo, Found online, To confirm, Agent approved, Branch approved,
    Updated, Updated by) holds one row a person: every agent, the branch manager (`manager`), the support lead (`lead`)
    and sales support (`support`). The drafts were written in the scratchpad (`profiles17/build-profiles.py`) from the
    agent records in Salesforce, the Central Bank's registers of sales representatives and agents, TTAIFA's award pages
    and membership listings, Guardian's own pages and the person's own pages, and imported once
    (`Agent-Profiles-import.xlsx`). A draft bio states only what a source confirms with high confidence; everything
    else is a question under To confirm with the sentence it would become. No pronouns: nobody's were given. **No draft
    and no source about anyone goes in this repository**, which is public; the tab is private.
  - **Two approvals, both on the last words.** A person opens "Your profile" on the board (agents, unit managers and
    staff; matched by `tProfSame_`, so "SASHA LALLA" finds "Sasha Lalla-Jagassar"), edits, presses "See it as a client
    does" (the real e-mail with a made-up client, `profile=preview`) and "This is me". The branch manager (or the branch
    code) has "Profiles": every row with where it stands, the sources and the questions, and "Approve for clients" or
    "Take it off clients". An edit by the person takes the branch's approval away and an edit by the branch takes the
    person's, so a client never reads words their person has not read last. The branch code's "This is me" is the
    branch manager's own. A client reads a profile's words only when both are on (`state` `live`); until then the
    introduction carries the card with the Salesforce dates and no words. Everything goes through `action=board&profile=`
    (`tProfileApi_`), so Service.gs needs no paste.
  - **The dates are never typed.** `tSfAgentFacts_` reads every agent record with a hire date (Date Hired, License Date
    Life and General, mobile, e-mail; kept six hours) and `tProfFacts_` gives the years with Guardian, the year licensed
    and whether both licences are held. A general licence dated before 1950 is a placeholder and never shown. The number
    on the card is the profile's, else the Salesforce mobile; the e-mail is the profile's, else a myguardiangroup.com
    address on Salesforce, never another (one record holds a personal Gmail, one an outside agency's address).
  - **The template follows the years with Guardian** (`T_PROF_TIER`): veteran 20 and more (the years lead the
    headline: "27 years of looking after families like yours"), seasoned 10 to 19, established 3 to 9 ("your agent
    from today", licensed since), new under 3 ("your new agent, with our whole branch behind them", and the branch team
    comes before the picker). On 16 October: 2 veteran, 5 seasoned, 8 established, 3 new.
  - **The e-mail** (`tIntroBuild_`, sent by `tIntroMail_` through `clientMail_` as before), calm since the evening of
    16 October (`T_INTRO_LOOK`, see the mark section). In order:
    - the moving banner, `orphan-transition/intro-motion.gif` (you, our branch, your agent; 1200×300, about 5 s,
      under 240 KB, made by `motion/make.py` in the scratchpad). Its first frame is the whole picture, because
      Outlook on Windows shows only that frame, and Gmail strips CSS animation;
    - a pale header: the shield, the tier's eyebrow and line, "<first name>, meet <agent>.", the agent's photo or
      initials, "Your agent · Sales representative of Guardian Life" (what the register lists), number, e-mail and
      three figures;
    - **You told us** (below), then **Our record with you**: "We have looked after you since <first year>." and up to
      three figures off the send row's service record (requests and documents handled, premium reminders, the last
      birthday note; never the reminders on letters I or G);
    - the picker and "When <agent> calls:", then About (headline, bio, their own words, what they can help with
      two-up, the promise, and a short table: works with, covers, speaks, awards, before Guardian, outside work,
      registered with the link). A new agent's template puts About and the support team before the picker;
    - **the support team only** (`tIntroTeamHtml_`, 16 October: "branch manager and support staff pooled too much
      for the client they need to just see the support"): their faces in a row, first names, "<names> handle every
      request with <agent> …", one figure for the team's client requests in the past year, and how to reach them.
      The branch manager is no longer on the client's e-mail; he is still copied on it;
    - Query Pal (`T_INTRO.QUERY`, www.querymypolicy.com, the branch's 24-hour query service), the branch and
      Guardian Direct numbers, and the sign-off.

    The hold on introductions (`HOLD_INTROS`) still stands: nothing goes to a client until the branch releases
    client e-mail. `transitionIntroTest` (the editor's Run button) sends the branch manager one of each template from
    the real profiles, drafts included and marked TEST.
  - **The client's choice.** Every tap opens `/your-policy/agent.html` with the choice made; the client confirms it with
    one press (a mail scanner opening every link never chooses, and a scripted browser sends nothing). It files one
    Client Responses row, Response `informed`, Page `/your-policy/agent?q=when_<part>&h=<way>`, Referrer `intro <agent
    key>: <the day and time>` (`tPickRow_`, `tPickWords_`), and offers a calendar entry. The five-minute run
    (`tIntroPicks_`) sends the agent one internal e-mail per client with the newest choice and a link to the client on
    the board (never the client's number), copied to `TRANSITION.CC` and the agent's unit manager (the Unit column of
    the Agent Skill Bank), posts it on the client's open Salesforce tasks, and marks the rows `[pick sent d MMM → Name]`.
    No receipt goes for it (`tReceipts_` skips it): the agent's call is the answer. The card shows "Asked for a call".
  - **Photos are the person's own, never found by a face.** A Photo is a hosted https link (the e-mail cannot carry a
    picture otherwise), shown in a circle on the card and beside a team line. The first three (16 October) came from
    screenshots the branch manager sent of pictures that name the person themselves: an agent's own Instagram profile,
    a Guardian "Advisor of the Week" card, the branch's own Facebook post. A picture that names nobody is never matched
    to a person by their face: the branch says who it is. Each person approves their photo with the rest of the profile.
    Four more came the same evening, in screenshots the branch manager sent and named one by one. One (sunglasses,
    in a car) is held for a head-and-shoulders picture, and one, cut from a group photo, asks for a sharper one. Kamla's
    Salesforce user record carries a profile photo; Sasha's and Azariah's do not. Until a photo is in, the team line
    shows the person's initials.
  - **Skillsets, from what clients look for** (16 October 2026, evening: "add more to this ok more skillsets etc do
    industry research as to what clients look for and build in"). Seven columns on Agent Profiles:
    - *Works with* (the clients an agent knows best, from `T_PROF_WORKS` or their own words);
    - *Areas* and *Languages*;
    - *Promise* (one thing a client can hold them to, in their own words, printed in a navy band);
    - *Own words* (why they do this work, printed as a quote under their name);
    - *Outside work*;
    - *Registered as* (what the Central Bank's register lists them as; the branch alone sets it, and it prints as a
      "Registered" badge with a link to the register when `T_INTRO.REGISTER` holds one).

    "Ask me about" now prints as "What <first name> can help you with", each topic with one line in plain words from
    `T_PROF_SKILLS` (`tProfSkills_`, up to six); Motor and home shows only with a general licence on the agent record.
    The board's form offers the topics and the client types as taps. Every introduction now says what happens on the
    first call (a hello, what the client holds in plain words, anything to look at noted; no charge, nothing changes
    unless they ask) and that a review follows every six months and in the birthday month.
  - **The team's own record** (`tTeamRecord_`): the client requests each of them closed in Salesforce in the past year.
    The client reads the team's total in one sentence; the per-person counts stay on the sample page for the branch.
    Logged e-mails, the birthday flow and internal work (training, staffing, operations) never count; under 20 for a
    person, their count is left out.
  - **"You told us": every answer replied to by a named person, on the board** (16 October 2026: "the ai is supposed
    to have read the questions … to show we are listening", then "the ones that answered the questions they are to see
    who answered it as felicia and team need to answer this on the portal and reflected in the email template … a very
    interactive email").
    - **Where the answers are written.** A board card for a client who told us something has "What they told us ·
      answer each one" (`answerPanel` in `assign.html`, shown when the backend says `answersApi`): each answer
      (`tClientItems_`: the letter's questions by their code, a tap as `tap_<type>`, their own words as `words`, most
      pressing first) with a box, **Draft with AI** and **Save answer**. Whoever may open the client may answer (`tOpenClient_`):
      the agent named on them, Client Support, the branch, and a unit manager on his team's clients; another agent
      may not. Every route is
      `action=board&answer=save|draft|preview|send` (`tAnswerApi_`), so Service.gs needs no paste.
    - **The Answer Replies tab** (When, Token, Client, Key, Question, Answer, Reply, By, Role, Drafted by AI), made the
      first time: one row a save, the newest per client and answer counts (`tRepliesAll_`), an empty reply takes it
      back. A reply starting with `=`, `+`, `-` or `@` is written as text. **Role** is the writer's as the client reads
      it (`tReplyRole_`): Your agent, Client Support, Branch Manager, Unit Manager.
    - **Draft with AI** (`T_REPLY.SYSTEM`, `gcmClaude_`, the `ANTHROPIC_API_KEY` Script property) writes a first answer
      in the writer's voice from the question and the client's answer, their words fenced as data. `tHeardOk_` checks it
      (length, a link, an amount or long number, a refund, guarantee or promise, a greeting or sign-off, the former
      agent's name from the Agent column); a draft that fails is not offered. Nothing is saved until the person edits
      it and presses Save, and the row says it began as a draft.
    - **In the e-mail** (`tIntroHeard_`) each answer shows, under the client's own words, the reply with the writer's
      first name, role and initials, and two taps: "✓ That helps" and "Talk to me about this" (`k=<key>&v=ok|call` on
      `your-policy/agent.html`). Only when nobody has replied to anything does one short line stand in: the AI's,
      written from the answers under `T_HEARD.SYSTEM` and checked by `tHeardOk_` (kept six hours, so the preview and
      the send read the same words), else the plain line ("Thank you for telling us. <agent> has your answers and will
      start your first call with what matters most to you."). A test with no answers shows `T_HEARD_SAMPLE` (one reply
      by the agent, one by the first support person) and says so.
    - **The introduction waits for them** (`T_REPLY.WAIT`, true). Naming an agent no longer sends it: the naming
      answer counts it as `introDue`, the board marks the card, and the agent (or Client Support, or the branch) answers,
      presses **Preview the introduction** (the e-mail exactly as the client reads it, `answer=preview`) and **Send the
      introduction** twice (`answer=send`). Send keeps every rule of the naming: only a client who answered, never twice
      to one agent, never a held or bounced row, never while client e-mail is held. `WAIT` false brings back the send
      at the naming.
    - **The client's tap back.** "That helps" sends at once on a press; "Talk to me about this" sends on a press and
      keeps the time picker under it. Each files `informed`, `/your-policy/agent?q=reply_<ok|call>_<key>`, Referrer
      `intro <agent key>: reply <v>`; no receipt goes for it (`tPickRow_`). `tIntroPicks_` adds it to the agent's
      five-minute e-mail with his own reply beside it ("<client> wants a call about your answer" when no time came with
      it), copies `TRANSITION.CC` and the unit manager as before, and puts it on the Salesforce task. The card shows
      "Client tapped: talk to me about this" under that answer (`c.replyTaps`).
  - **The e-mail is short on purpose**: four topics at most (`T_PROF.SKILLS_MAIL`), the first call in two sentences,
    the support team in one paragraph, one line of help. Under 820 words with every part filled in and two answers
    replied to.
  - **The sample**: Felicia's introduction, drawn by the script from her draft, is the example for the whole branch.
    It is published as a private Artifact page the branch manager shares, never on the website: the drafts are not
    in this repository. The page shows the e-mail on a computer and in a phone frame side by side, a moving mock of
    the board where Felicia types her answer and it lands in the client's e-mail beside Sasha's, the four steps, a note
    on every part, the research and the team. Jordan, the client, is made up, and so are his answers and record; three
    fields carry sample wording, marked, until Felicia writes her own. Built by `sample17/build-email.js`, `pins.py` and
    `assemble.py` in the scratchpad.
  - `profiles17/prof-test.js` in the scratchpad covers it (194 checks, the AI mocked: Node on the 16 October tabs with
    the drafts and a mocked Salesforce, then Playwright on the board as an agent and the branch, the answer panel from
    save to send, a phone, and the client's page with its reply taps). The demo backend has no network, so the test
    puts the site's `receipt.json` and `receipt.html` in the cache; without them no board card carries an answer.
- **After a call, one press on the board marks the file and can write to the
  client in the manager's name.** Asked for on 28 September 2026 ("a button
  where I click so I can update the notes and let them know that I will
  assign their agent as discussed and will review etc, to create the
  experience"). An outcome button (Called, Met, No answer, Declined, Closed)
  opens a panel, not a prompt: the outcome; a note for the file, stamped in
  the Note cell as before and never seen by the client (the card and the
  agent's brief show it as a file note, `tFileNotes_`, never in quotes: a
  client's own words come only from a reply, `tNoteWords_`, without the
  phone's "Sent from my iPhone". Until 29 September the card quoted
  whatever a Note cell held after its stamps, so a phone answer read "by
  phone: read back on the call" as the client's words, a note the manager
  typed would have too, and a reply was labelled "My details have
  changed", the tap its row type shares; it now reads "Wrote back by
  e-mail"); and, with the branch
  code only, "E-mail <first name> a note from you". There are four notes, in `T_NOTES` in
  Transition.gs: I am matching you with your agent, I am looking into your
  file myself, Thank you: all noted, and I tried to reach you. The manager
  can add a line of his own, and the panel shows every word before it goes
  (`tNotesForBoard_` hands the board the backend's words). It goes from
  support@ through Graph, signed by the manager (`TRANSITION.MANAGER`), with
  the branch copied and the confidentiality footer, and never through Gmail.
  The client's rows are marked `[told d MMM · key]`, and the same note never
  goes twice in a day. A row that bounced, is held for anything, or has no
  e-mail gets no note. An e-mail taken by phone and waiting for the go may
  get one (`tNoteBlock_`). The notes never give a date for the agent,
  never mention anyone who left, and never advise. Only the manager's press
  sends one, so the hold on automatic client e-mail does not stop it: the
  press is his go for that one note.
  **The Client Support calls Google Sheet is one-way.** It reads the
  campaign sheet through IMPORTRANGE. Nothing typed on it reaches Client
  Responses, the board, the reports or the chase: not the callers' Try,
  Reached? and Outcome columns, and not the manager's "Called on" and
  "Outcome". On the first day of calls (28 September) the callers typed
  nine e-mails into the sheet and recorded none on the page, so none could
  reach a send row. By the next afternoon it was 107: of 120 new addresses
  the three callers had taken, 13 went through the page, and one caller
  had typed the addresses over the Call for column. They were filed from a paste
  block for Client Responses, built in the scratchpad
  (`sasha/build-fix.py`, checked by running `tFilePhoneEmails_` on a copy
  of the live tabs, `sasha/dry-file.js`), rows exactly as the page writes
  them (`informed`, `/your-policy/phone?q=email_given`, `call by <name>:
  <address>`, `Logged`). The same file gives each caller the rows to put
  right: a Reached? their own notes contradict ("voicemail"), and asks
  (an agent, a cancellation, a statement) left without a call-back flag,
  which the Staff call-backs tab never sees. `assign.html#t=<token>&s=<letter>`
  opens the board on one client, and a HYPERLINK column on the sheet is
  how a row gets to its outcome buttons. `svc/tell-harness.js` and
  `svc/assign-panel-test.js` in the session scratchpad cover it.
  **Details taken on a call are the branch's record, never the client's
  answer** (`tContactRow_`, 29 September 2026): a `/your-policy/phone` row
  whose `q` is `email_given`, `email_none`, `phone_given`,
  `address_given`, `reach_*` or `when_*`. Until then any Client Responses
  row counted, so every client whose e-mail Client Support took would have
  been "answered": no five-day follow-up after their first letter, a tap
  on the wall, an answer in the Monday report, and a card counted among
  the answers on the board. Now `tAnswered_`, `tSummary_` and `tInsights_`
  pass those rows over (a no-e-mail client on the call list still counts
  as reached), and the board shows such a client as **reached by phone**
  (state `reached`, its own tile and filter, after the answers), still
  there to be named on, never in "have answered", the glance or the
  insight counts; in the family line they read as their send row stands
  ("e-mail taken by phone, waiting for the go"). The letter's own
  questions ticked on a call (`rate_*`, `contact_*`, `pay_*` …) are
  answers like any other. `health/contact-rows-harness.js` and
  `svc/assign-reached-test.js` in the scratchpad cover it.
  **An agent named from the board is the branch's record too**
  (`tAssignRow_`, 30 September 2026). Naming an agent on a client who has
  not answered writes an `assign` row with Page `/assign`, so the name has
  a row to sit on. Every reader took that row for an answer. The receipts
  run, which the hold on client e-mail does not stop, would have e-mailed
  "Thank you, <first name>. We have received your response." to a client
  who never answered. The chase would have sent them "still on it", their reminder
  would have stopped, and the board would have counted them as answered.
  Naming them again would have sent the introduction that thanks a client
  for answering. No such row was on the sheet when it was caught.
  `tOursRow_` (a contact row or an assign row) is now what `tAnswered_`,
  `tSummary_` and `tInsights_` pass over, and the receipts run and the
  chase skip `/assign` rows. The board shows such a client as **named, no
  answer yet** (state `named`, with its own tile and filter). A client
  reached by phone or named without answering never gets the
  introduction (`tHasAnswered_`). `health/assign-rows-harness.js` (12 checks,
  11 of them failing on the previous script) and `svc/assign-named-test.js`
  cover it.
- **Households are numbered, and the board shows the family beside each
  card.** Asked for on 29 September 2026 ("group by addresses … assign a
  household number so we can see whom from the household responded"). The
  **Households** tab (Token, Household, and live Answered columns) is built
  in the session scratchpad by `hh/build-households.py`, with the
  reassignment's own rule: the same address, the same phone or the same
  e-mail. A key shared by more than six clients is an office, not a
  family, and a departed agent's or a staff member's own contact details
  never link anyone. It is imported into the campaign sheet as its own tab
  (File → Import → Insert new sheet, formulas converted); client names
  never enter the repository. `tHouseholds_` reads it. On the board, each
  card shows "Family on our list": each member, whether they answered and
  what mattered most, or where they stand (no e-mail, sharing an inbox and
  so without a letter of their own, an e-mail waiting for the go, written
  to with no answer yet). "Select the family" ticks every member, those off
  the board included, so one Assign names them all. The agent gets one
  brief, and the introductions go one per inbox, never to a held address.
  "Family of someone who answered" lists the members still to reach. The
  rule misses some families: on file, a husband's policy can carry a house
  number and his wife's a light-pole number on the same street, as one
  couple's on these books do. For those, the update panel's "A family
  member on our list" field (`transitionUpdate_` `family=`, `tLinkFamily_`,
  branch code only) links the two. It gives them a new number, or joins
  one household to the other, keeping the older number.
  `svc/household-harness.js` and `svc/assign-household-test.js` in the
  session scratchpad cover it.
- **Families sharing one inbox: one letter a day, and a different surname
  is confirmed first.** Until 29 September 2026, the sender sent a shared
  inbox the first member's letter and held the rest for good as `check:
  same e-mail as row N`: 95 clients, re-held on every run. The manager
  chose the rule that day. A client whose inbox already had a letter gets
  their own when they share a surname with the client written to. A
  married name counts on either half ("Persad-Singh" and "Singh"); a lone
  initial never does (`tSameFamily_`). They get it on a later day, because
  an inbox never gets two letters on one day. A different surname may be
  an office's or a relative's inbox. That client is held as `check: shares
  an inbox with <name> (client N), a different surname: confirm the address`
  for Client Support. An address a person confirmed on a call (a Reason of
  "e-mail taken by …") passes. `tFilePhoneEmails_` files a confirmed
  address onto such a row like any other. **One person on two client
  numbers is not a family**: 26 of the 95 had the same name as the client
  already written to at that inbox (one man on two consecutive client
  numbers), and the family rule would have sent each the same letter a
  second time. `tSamePerson_` (the same first name and a surname in
  common, a letter out allowed: "Mohamed" and "Mohammed", "Ricki" and
  "Ricky") holds such a row as `check: same name and inbox as <name> (client
  N): likely one person on two client numbers, one letter is enough`,
  compared against every letter the inbox has had, not only the first,
  and a call that confirmed the address does not lift it. In 7 of the 26
  the second number carries a different situation (a premium due, a
  lapsed policy) that the first letter did not mention: a call, not a
  letter. The 95 were sorted once by `tSharedInboxRows_`, first in the
  five-minute receipts run after the paste: 43 family members freed for
  their own letter after the go, 26 held to confirm the address, 26 held
  as one person. It sets the `shared_inbox_sorted` property and never
  runs again. Client Support's list for the 26 to confirm is built in the
  scratchpad (`calls/Shared-inbox-confirm.xlsx`), with the `r=update` link
  on every row. `health/shared-inbox-harness.js` there covers it, and
  `health/shared-inbox-real.js` runs the sort on the latest sheet export.
- **Each client's policies are on the board, from the live Branch
  Portfolio, rebuilt every morning.** Asked for on 29 September 2026 ("we do
  need to push more data the total cover, plan, tenure, premium etc"). The
  manager chose the live portfolio read daily, the figures on each card, in
  the agent's brief, in a "most at stake" order and on the roster, and
  plan and paid-to only for Client Support. `transitionBuildClientBook`
  (Transition.gs, 6:00 daily, and on the menu) opens the Branch Portfolio
  by the ID in the `BOOK_SHEET_ID` Script property, and **since 15 October
  2026, with no property set, the Branch Intelligence workbook itself**
  (`T_BOOK.DEFAULT`, `tBookId_`: the ID `Intelligence.gs` already carries
  as `INTEL.WORKBOOK`, so nothing new is public). Until then the build
  refused to run without the link, so the Client Book was never built and
  the board carried no policies ("I don't want to import a sheet as we do
  have access to the data and can build"). The menu ("Transition: set the
  Branch Portfolio link") still sets another sheet, and "rebuild the Client
  Book now" builds at once; go live installs the 6:00 build whether or not
  a link is set. Nothing else is imported by hand: the Client Profile tab
  is made by the same build from Salesforce once the `SF_*` properties are
  in the project. The
  build reads only the columns it needs, in chunks, and writes every policy
  of every client on Transition Send to the **Client Book** tab, whole,
  new rows over old, so the board never reads an empty tab. The board
  (`tBook_`, `tBookFor_`) gives each card "Their policies with us": life
  cover, a year's premium, in force and lapsed, the years with us, and a
  line a policy. Rows without a card carry the totals and fetch the list
  when opened (`action=book`, branch code only). The roster shows what each
  agent has been named on; the household line shows the family's total;
  the agent's brief lists each client's policies.
  **Where a policy stands comes from Status Description.** Status 0 is also
  surrendered, matured, expired and never taken. Premium Paying is in force,
  or "premium due" with Status 2. Paid up, Waiver of Prem and Vested annuity
  are in force with no premium. Status 3 is an application pending. Tenure
  starts at the first policy that was ever issued. Not Proceeded With, Not
  taken, Postponed, Rejected, Declined and File Closed never count.
  **A year's premium is estimated**, because the portfolio's Mode column is
  empty. A premium is monthly unless it is 10,000 or more, or 2,000 or more
  with the paid-to date on the policy's anniversary, and single premiums
  count as nil. Against the 2,120 policies whose mode the PBI export gives,
  all but 44 come within half of their true year; the 44 are mostly
  quarterly and half-yearly payers, which nothing on the sheet shows. The
  board says how the figure is made.
  **Life cover adds only confirmed life plans** where Salesforce gives no
  split (see the Client Profile bullet below, which comes first). The
  **Plan Codes** tab
  holds a Plan name, a Class (life, critical illness, accident, health,
  savings, other) and Confirmed for each code. A sum assured counts only
  when the class is life and Confirmed is Y. It counts at once, without a
  rebuild, because the tab is read on every request. An unconfirmed life
  plan or an unclassified one shows its sum assured as "not counted"; the
  other classes are listed and never added. The build refreshes the counts
  and adds any new code with no class. The proposal for sales support
  (`Plan-codes-to-confirm.xlsx`, `tbook/plan-codes.py` in the scratchpad)
  takes names and classes from the PBI export's Plan column. It leaves 19
  codes blank, CR2RP1, CR3RP1 and CR4RP1 among them. For Evolution the
  portfolio's Sum Assured can include riders; sales support is asked.
  **Who sees what.** An agent sees the figures for their own clients only:
  a family's total only when every member is theirs, no other agent's
  figures, and `book` refuses their code. Client Support sees no money
  (since 5 October the plans, status and paid-to dates, and the insights,
  without a figure: see the sign-in bullet below). The build writes two money-free
  columns onto Transition Send, `Plans on file` ("Econo Life to 65: in
  force, paid to 21 Sep 2026; …") and `Paid to on file`. The calls sheet's
  Feed tab already imports `'Transition Send'!A:AZ`, and each caller's tab
  looks them up by Token. That is a display rule, not a wall: anyone who can
  edit the calls sheet could IMPORTRANGE the Client Book tab too.
  `svc/book-harness.js` (mocked tabs) and `svc/assign-book-test.js`
  (36, Playwright, fixtures written by the harness from the backend) in the
  session scratchpad cover it.
- **Each card says who the client is, and the household shows everyone's
  cover.** Asked for on 29 September 2026: "have the husband as the <name>
  household and include the wife cover so we can see the wife and his
  cover as well anyone else who is covered in the household, we should also
  have the occupation and incomes etc as well any other data like
  beneficiary etc to make some insights".
  **The Client Profile tab** holds, one row a policy, what Salesforce's
  `CLIENT_PORTFOLIO__c` and its Contact record: date of birth, gender,
  smoker, occupation, employer, income, the life, critical illness,
  accident and waiver cover, when the life cover ends, up to three
  beneficiaries ("Benificiary" there), insured, owner, family role. It is
  imported once from the scratchpad (`profile/build-profile.py`, from the
  connector pulls). The morning build rewrites it straight from Salesforce
  (`tProfileRefresh_`) once this project has the four `SF_*` Script
  properties that `ServiceSalesforce.gs` uses; until then the imported tab
  stands, and the build's message says which. **It was never written live until 16 October
  2026**, for two reasons. `svcSfQuery_` puts the query in the web address,
  and URL Fetch refuses one over 2 KB; two hundred policy numbers make
  about 3 KB. And the build gave the profile only what was left of its
  five minutes after the workbook. Every query in Transition.gs now goes
  through `tSfQuery_`: a long one is sent in the body of a composite
  request (`tSfComposite_`, which also reads every page), a short one as
  before. When the build has used `T_PROFILE.INLINE_MS`, it marks the
  profile due (`profile_due`). The five-minute run then refreshes it in a
  run of its own, after releasing the lock (`tProfileDue_`).
  `transitionRefreshClientProfile`, on the editor's Run button, does it at
  once. `sfq16/sfq-test.js` in the scratchpad covers it (13 checks). The refresh asks by policy
  number, never by client number: clients opened from about mid-2026
  (numbers from about 0000745000) carry no `Client_Number__c` there.
  **The name and date of birth on a policy record are the life insured's,
  not the owner's.** The portfolio's client is the owner; a policy a
  parent took out on a child's life carries the child's name and birth
  date (one mother on these books owns two on her daughters' lives, issued
  at 3 and at 0, each paying "Proposer - Female", the mother herself). `INSURED__c` is
  filled on a few policies in a hundred, so the Insured column is
  `INSURED__c`, else the record's own name (`tProfileRow_`,
  `Client-Profile-v4.xlsx` in the scratchpad for the import). Who a client
  is comes only from policies on their own life (`tOtherLife_`: not the
  same first name with a surname in common or beginning alike), unless
  none is, when every policy is read as before; until 29 September the
  board took the first birth date it met and read that mother as 5. On the
  families' policies that corrected ten ages, and 69 policy lines now say
  whose life they cover. "Proposer" as the beneficiary is on adults'
  policies as often as children's (median issue age 33): it means whoever
  took out the policy, a parent or guardian only where the policy was
  issued before 18.
  **What is there, measured on 29 September 2026 over the campaign's live
  policies:** date of birth 98%, gender 93%, a life figure 74%, critical
  illness 38%. Who a policy pays, over every live policy of the books'
  clients: the estate 33%, "(See Special Provisions)" 30%, a role only
  ("Proposer", "Annuitant") 24%, a named person 4%, nothing on our file 9%.
  (A first count over part of the pull said one in eight for the estate; the
  whole pull says a third.) **Occupation** is on the policy record
  (`Occupation__c`) for only 7 clients in 100, but the branch has always
  typed the job into the Contact's **Title** ("TEACHER", "POLICE OFFICER"),
  so the Occupation column falls back to it once courtesy titles and
  placeholders are dropped (`tJobTitle_`: never "MR", "Mrs.", "UNKNOWN",
  "NOT ON LIST"). That raised occupation to 56% of the books' clients
  (1,312 of 2,333), and to 88 of the 149 who had answered, from 3. The
  refresh asks for `Contact__r.Title` too. An income is on file for about 1
  client in 20. `Contact.Employer__c` mostly holds a household's or an
  agent's name ("RAMROACH, KERWYN HH"), so only a value that reads as an
  employer or a status is shown (`T_EMPLOYER`), about 1 client in 9. The
  board shows what is there and never guesses the rest. Occupations and
  employers typed in capitals or lower case print in title case, with the
  island's acronyms kept whole (`tNiceLabel_`: T&TEC, WASA, NGC).
  **Life cover now comes from Salesforce's split first** (`tCoverOf_`). The
  portfolio's Sum Assured lumps an Evolution policy's life and critical
  illness together: on 206 of 509 live Evolution policies it equalled
  life plus CI. So a policy with Salesforce figures counts its life figure;
  a savings, accident or health plan never counts as life, whatever its
  fields say (house rule), and an accident plan's figure shows as accident
  cover. Without Salesforce figures, the Plan Codes rule above applies.
  Critical illness is shown and totalled separately, never added to life.
  **The card** gets a profile line (age, gender, date of birth, and the
  occupation, employer and income when recorded) and **what the records
  say** (`tInsightsFor_`), as chips, most pressing first: a premium due 30
  days or more, life cover ending within five years (Salesforce's date, or
  the plan's name: "to 65" from the date of birth, "20 years" from the
  issue date), a policy that pays the estate, a beneficiary in the special
  provisions or recorded only as a role, no life cover in force, a lapsed
  policy, life cover against the income on file, a birthday within 30
  days. A paid-to date more than a year gone on a policy the portfolio
  still calls premium paying reads "Paid to Aug 2018 on Evolution to 65,
  still shown as premium paying: check the record", never "Premium due
  2954 days" (50 of the 371 overdue policies in the families on 29
  September; `APLamount` is 0 on every one, so nothing says why). Only
  what the records show; never advice. The policy table gains
  the cover split, who each policy pays, and who it insures when that is
  someone else. The branch gets a bar of counts over the clients who
  answered, each a filter; the same filter reaches silent rows through the
  keys they carry (`ik`).
  **The household** holds everyone at the address, phone or e-mail, not
  only the send list. `hh/build-households2.py` (scratchpad) adds the
  branch's other clients who share a campaign client's keys, with their
  client number and current agent. It counts a key shared by more than six
  clients across the whole portfolio as an office, never links through a
  departed agent's or staff member's own details, never includes a departed
  agent, their household, staff or anyone with a death claim, and carries
  the links the branch has told us about (`MANUAL`: one husband and wife
  whose policies carry two addresses for one house). The Client Book build reads
  those members' policies too. **The head** is the member marked Head on the
  tab, else the adult with the most life cover, then the most premium a
  year, then the eldest; the household is named after them ("<head's
  name> household"). The panel lists every member, the head first: age and
  gender, where they stand, and their cover. It totals the family's life
  cover, critical illness and premium, and names any adult under 65 with no
  life cover with us.
  **Who sees what here:** the branch sees every member and figure,
  including family members with other agents. An agent sees the members on
  our list by name, age and where they stand, and figures only for their
  own clients. Never a member with another agent, and a family total only
  when every member is theirs. The brief carries the client's profile, what
  to raise first, the cover split, who each policy pays, and the family on
  our list by name and age.
  `svc/book-harness.js` (78 checks), `svc/assign-profile-test.js` (29,
  Playwright) and `svc/board-dryrun.js` (the whole board on the latest sheet
  export, the portfolio copy and the pulled profile) in the session
  scratchpad cover it.
- **The board suggests who looks after whom, and shows the book at a
  glance.** Asked for on 29 September 2026, late: "Where is the occupation
  and other insights given the data you have?? Also how is the assignment
  going to be??" Until then the agent was picked card by card ("it was just
  randomly we assign").
  **The suggestion** (`tSuggest_`, for whoever may name: the branch, and
  since 5 October the staff) sits on every client
  nobody is named on, with the reason, in this order. First the family: if
  someone in the household already has an agent, the rest go to that agent.
  Then the plan: the 24 September split as the team checked it, imported as
  the **Assignment Plan** tab (one row a client: Plan agent, Team's pick,
  Band, Area, Plan household, Moved; `plan/build-plan.py` in the scratchpad
  from `Transition-split-checked-24Sep.xlsx`). It covers 1,479 of the 2,333
  clients of the books; most of the rest have nothing in force (the G
  letter) or are on the terminated book. A household on the board takes its
  head's plan agent, so the two lists' different ideas of a family never
  split one. Last the lightest list: the active agent with the fewest
  clients named or suggested so far, counted as the pass goes, so what is
  left goes round the roster evenly, one household at a time. A plan name
  matches the Agent Skill Bank by full name, or by a first name only one
  active agent carries. An agent the plan names who is not on the roster is
  shown as such ("the 24 Sep plan names Narissa, who is not on the Agent
  Skill Bank yet"), never swapped for someone else, and the note under the
  roster lists them. **Nothing is named until the press:** "Assign to
  Narissa" on a card, "Assign" on a row, or tick any number and "Assign each
  as suggested", which sends one request per agent (40 clients at most per
  request, as the tokens travel in the address). "Select all N shown" ticks
  what the filters show, and a "Suggested agent" filter shows one agent's
  share. The roster chips say how many are suggested to each. On the real
  data, with the twelve plan agents on a trial roster: 1,050 from the plan,
  460 to the lightest list, about 125 each, and no household split.
  **The introduction goes only to a client who answered.** It thanks them
  for answering, so a silent client, or the family of one who answered, is
  named and briefed but gets no e-mail (`notAnswered` in the reply; the
  toast says so). Until 29 September "Select the family" sent it to
  everyone. **A brief shows 25 clients in full** (`T_BRIEF_FULL`) and names
  the rest, so a big batch never builds an e-mail too large to send. The
  board read for an assign skips the glance (`tBoard_(w, all, lite)`).
  **Four more insights**, from data the book already holds: `payroll`
  (a live premium by salary deduction or military pay; a change of job, or
  leaving the service, stops the deduction), `waived` (the waiver benefit
  pays the premium), `surr` (surrendered a policy with us before), and
  `noci` (an adult under 65 with life cover and no critical illness cover,
  only where Salesforce has split every live policy). The profile line says
  "pays by salary deduction" or "paid from military pay" (`pay` in
  `tProfileFor_`), which tells the agent the client is employed even where
  no occupation is recorded. Over those who answered: payroll 12, surr 22,
  noci 37.
  **The book at a glance** (`tGlance_`, branch only, folded until opened,
  with a switch between every client of the books and those who answered):
  clients, premium a year, life and critical illness cover, a premium due,
  a lapsed policy; then age bands with the women and men, years with us,
  what they hold, how they pay, who the policies pay, the top occupations
  and employers with how many have one on file, and the median income. The
  whole-book view is cached for ten minutes. The books' clients are the
  send list's, never a departed agent's own policies, their household,
  staff, a death claim or someone who holds nothing (`T_NOT_BOOK`).
  **A card never runs wider than the screen.** A client's reply can carry a
  250-character link from an e-mail signature; on the real data that pushed
  the board 1,090 px past a phone's edge. The card column now shrinks and
  long words wrap.
  `svc/book-harness.js` (110 checks), `svc/assign-suggest-test.js` (29,
  Playwright) and `svc/board-dryrun.js` (a trial roster of the twelve plan
  agents; aggregates only) in the session scratchpad cover it.
- **Assignments made in Salesforce reach the board and the wall, by
  household.** Asked for on 1 October 2026, for the next morning's branch
  meeting: "i have started assign through salesfroce so the firlds is date
  assigned, campaign orphan, the agent name as assigned agent", then "i want
  this built as some 3 slides on the transition wall, would like to assign
  the households". The manager names the agent on the policy record
  (`CLIENT_PORTFOLIO__c`): Assigned Agent (`Assigned_Agent__c`, a Contact),
  Date Assigned to Agent, Campaign (`Campaign__c`, "Orphan"), and Campaign
  Feedback Update (`Campain_Feedback_Update__c`, spelt so) for what the
  agent reports. The first pull that day found 13 policies, 9 client
  numbers and 8 households, named from 22 to 30 September. Campaign was
  blank on 5 of the 13, so a Salesforce report filtered on Campaign =
  Orphan misses them; filter on Date Assigned to Agent. `Orphan_Assigned__c`
  was blank on all 13. The Contact's `Agent_Assigned__c` and
  `Date_Assigned__c` have not been used lately. The household Account ("X
  HH") has only `AGENT__c`, mostly empty and otherwise an old or departed
  agent, with no date, so an assignment is not recorded there.
  **The Household Assignments tab** has one row per client of the books:
  Household, Household name, Members, Token, Client, Client number, Letter,
  Book, Policies, Agent assigned, Date assigned, Source, Feedback, Suggested
  agent, Why suggested. It is built in the session scratchpad
  (`sfassign/build-ha.py`, from the send list, the 29 September households
  and the policy numbers) and imported once. `tHaSync_` keeps the four agent
  columns current. It runs inside the five-minute receipts run, at most
  every fifteen minutes; `transitionSyncAssignments` on the editor's Run
  button forces it. It reads Salesforce when the `SF_*` properties are set:
  every assignment dated since 9 September, matched by policy number, else
  client number, else a name only one row carries. Then it reads the
  board's Assigned to. It rewrites only a row it wrote itself (Source
  `Salesforce` or `board`) or one nobody has named, so a name typed by hand
  under any other Source stays. When Salesforce does not answer, the names
  it gave last stay. The Token column is read again before any write, as
  on Transition Send. More than 25 changes are written as four whole
  columns, so a board assigning by the hundred never runs into the
  six-minute limit.
  **Wall slides 6 to 8** come from `tHaWall_`, inside `tSummary_` as
  `assign`:
  - *Assigning the books*: households with an agent, out of all of them;
    answered households with one; the last fortnight by day.
  - *Who looks after whom*: each agent's households and clients, with the
    feedback recorded in Salesforce.
  - *Next households to assign*: families half named first, with the agent
    the family already has; then answered households with nobody, most
    pressing first, each with its suggestion.

  Clients appear by first name and agents by first name and initial.
  Answers marked "look automated" do not count here either. A backend
  without the block, or a sheet without the tab, leaves the three slides
  out of the cycle; the promise is slide 9.
  **An agent logs in to see their assignments.** `tBoard_` reads the tab, so
  a client Salesforce names to an agent is on that agent's list in
  `assign.html`. A client who never answered appears as a "named, no answer
  yet" card. Where the board and Salesforce name different agents, the
  newer name wins. A label in brackets is not part of a name (`tNameKey_`,
  and the sync drops it): Salesforce's agent Contact for one agent reads
  "Narissa (Agent) Mohammed", and until 13 October a client named to her there
  would never have reached "Narissa Mohammed" on the Agent Skill Bank. An agent opens their list with **their agent number and
  their own code, both** ("agent Number, and name and code", 1 October
  2026). The number is the Agent no. on the Agent Skill Bank (A10024,
  10024, or the name as written there), and the code is that row's Portal
  code. A code opens only the list of the agent it belongs to, a code with
  no number opens nothing, and a refusal never says which of the two was
  wrong. The codes are eight digits, because the gate shows a number pad.
  They are made in the scratchpad and never enter the repository. **They
  are not the Branch Portfolio's passwords.** Those run 1 to 33 in list
  order, and on 1 October that list still showed the departed agents as
  Active, so one guessed code would show an agent's orphan clients and
  what they told us. The Skill Bank's Active column locks a person out
  when it reads No, Not Active, Inactive, Resigned or Terminated
  (`T_INACTIVE`; until 1 October only "No" did). **An agent's code never
  opens the wall, the dashboard or the responses page**: their one answer
  (`transitionData_`) carries every client's name and answers, so
  `tCodeOk_` takes the branch code only. Until 1 October any active
  agent's portal code opened them, which would have shown every agent all
  the clients the moment the codes were handed out. With TEAM_CODE empty
  after a Service.gs paste, those pages now say so. The follow-up note
  holds for a client Salesforce names, as it does for one named on the
  board.
  **Sign-in by role, from the Agent Skill Bank** (3 October 2026; ping
  `campaign: 6`). The branch manager set up the access on the Agent Skill
  Bank itself ("I did put the agent access in the Service Questionnaire"):
  Agent ("A00427 - <name>"), Agent no., **Password**, **Role**, **Unit**,
  Active, then the old columns, a second Active among them. He asked that
  "an agent uses his agent number and password assigned. I am the branch
  manager so when I log in I can see what's happening in the branch by
  units and persons that also fall under me. Akaash should see his team as
  he is a unit manager." `tTeam_` reads the tab (the number in front of a
  name dropped, either Active reading inactive taking the person off) and
  `tWho_` signs in by agent number and Password, as a digest, never the
  password itself; the old Portal code still works for anyone with no
  Password. What each role sees on `assign.html`: a **Branch Manager** (or
  an Assistant Branch Manager) the whole board, the roster grouped **by
  unit and person** (`tUnits_`: each unit under the manager its Unit column
  names, with named, answered, open, late, done and the premium a year;
  someone whose unit manager has left under "no unit manager now"); a
  **Unit Manager** his team, himself and everyone whose Unit is his name,
  their clients and figures, his unit only; an **agent** their own list;
  **Staff** (Client Support and the manager's assistant) every client who
  answered, marking calls in their own name, with `r=update` links.
  **Since 5 October 2026 staff get the insights too, still with no
  money** ("I do need the staff to log in with the insights shared"; the
  manager chose insights without figures over everything the agents see):
  `tBoard_` passes their cards through `tPolNoMoney_` and
  `tProfileNoMoney_`, so a card carries who the client is (age, gender,
  date of birth, occupation, employer, how they pay), every insight line
  but cover against income (`T_MONEY_INS`), and each policy as its plan,
  where it stands, when issued, what it is paid to and whose life it
  insures, with the totals as counts and years; never a premium, a sum
  assured, cover, a beneficiary or an income. The page reads
  `book.money === false` and draws the money-free panel (`polPanelPlain`),
  hides the order-by-value control, the premium tile and the
  cover-against-income filter. Until then staff saw no policy or profile
  at all. `svc/book-harness.js` checks nothing with a figure reaches them
  and `roles/roles-test.js` that none shows. **The branch and the staff
  name an agent; a unit manager and an agent never do** (5 October 2026,
  later the same day: "as the branch manager i and the staff has to be
  given the option of which agent to assign"; until then the branch alone).
  `tCanAssign_` is the one rule, `transitionAssign_` and `tBoard_` both
  read it, and the page is told (`canAssign`; an older backend says
  nothing and the page falls back to the branch alone). Staff get the
  whole roster with no figures on it, the suggestion with its reason on
  every card nobody is named on, "Assign to …", the tick boxes, the bar,
  "Select the family" and "Assign each as suggested", and may name only
  a client on their own board (never a silent row). The manager chose
  that a staff naming does everything his does: the agent's brief, and
  the introduction to a client who answered (the tick box stands, so a
  staff member can untick it for one client). The file says who named:
  the stamp stays `[assigned d MMM · Agent]` so the claims and the history
  read it as before, and "named by <staff name>" follows it as the file
  note the card and the brief show; an assign row made for a client with
  no row carries `staff: <name>` in Referrer. Akaash, as unit manager,
  was offered naming within his unit and the manager kept it to himself
  and the staff. The notes to clients stay the Branch Manager's: only the
  Branch Manager (or the branch code) e-mails a client a note,
  because the notes go in his name, and staff are never on the roster to
  be named. "Branch Manager Assistant" is staff, never the branch manager
  (`tRoleOf_`). The locks, whatever the tab says: anyone who was the agent
  on these books (the Agent column of Transition Send, `tFormer_`) never
  signs in and is never on the roster; and ten wrong tries on one number
  close it for fifteen minutes. **The passwords are the ones on the tab, at
  the manager's choice** (7 October 2026: "i still want to keep as is").
  Until then a password shorter than eight characters opened nothing. That
  day every password on the tab was one or two digits, eighteen of the
  twenty-three the row number and several shared, and he was told that a
  guess from an agent number would open the board, his own view included.
  `T_USERS.MIN` is 1; raising it brings the rule back and changes nothing
  else. Do not raise it without him. The
  manager's performance portal keeps its own Users tab with the same
  scheme; the board does not read it. New eight-digit passwords, the
  1 October code kept for whoever had one, are built in the scratchpad
  (`roles/build-passwords.py`) and never enter the repository; the menu's
  "Transition: check the agent access" says how many can sign in, never a
  password. `skillBank_` in Service.gs reads the same tab the same way, so
  the agent portal and the service wall see clean names, no staff, and an
  eight-character Password as the agent's own code. Until the paste, the
  live board lists each name with its number in front and the staff as
  agents: nobody is named from the board before it. `roles/roles-harness.js`
  (66 checks), `roles/roles-test.js` (Playwright, 27) and
  `roles/real-check.js` (the real tab with the new passwords) in the
  scratchpad cover it.
  **On 1 October 2026 the live web app still answered `campaign: 2`**, so
  the board, its login included, answered nobody. Its routes are in
  `Service.gs`. The fix is to paste Service.gs and Transition.gs, put the
  branch code back into TEAM_CODE, and publish a New version.
  **The departed agents in Salesforce** are Contacts of record type AGENT.
  Their Employment Status reads Resigned for nine, set by sales support
  on 29 September, and Not Active for the other two.
  Their Termination Date reads 21 September for the ten who resigned; it
  was set on 1 October at the manager's word ("the resignation date
  should be the 21st September"). Before that, nine read 30 September,
  the date in the agents' own letters, and one read 25 February 2026.
  The terminated contract is not a resignation: that record reads 10
  September, and the branch's reports say 9. Salesforce has no separate
  resignation-date field. Only one of them ever had a Salesforce login,
  and both of its accounts are inactive. **Client names stay out of these
  notes and out of code comments**: the site publishes the repository
  root, CLAUDE.md and the `.gs` files included, so a name written here is
  on the open web. Describe the case ("one couple", "a client") instead. The wall on factfind360.com was
  considered and left alone: the two hosting chains never touch.
  `sfassign/ha-harness.js` (Node, mocked tabs and Salesforce) and
  `sfassign/wall-test.js` (Playwright, the real summary) in the scratchpad
  cover it.
- **What a naming writes in Salesforce, every time** (22 October 2026, the branch manager: "when you assign the agent
  you need to update the campaign to Orphan and the date assigned as well. Create a task on the Household assigning to
  the agent Support"):
  - **Every policy record of the client** (their Contact's records, and a policy they own on someone else's life):
    Assigned Agent (the agent's Contact), Date Assigned to Agent (the day), and Campaign `Orphan`, over whatever
    Campaign held before ("Disbursement" included).
  - **One task on the household Account** ("<SURNAME>, <FIRST> HH", the Contact's AccountId), WhoId the client:
    subject `Orphan Project: follow up with <agent> re <client> (assigned <d Mon yyyy>)`, owned by the agent's support
    person, due the day of the naming, High, Call. Description: who assigned the agent and when, the client and
    household, every policy with its status, the former agent, what the client asked, then "<support>: follow up with
    <agent> on contact made with the client and the outcome. Log <agent>'s feedback in the task trail. Keep this task
    open until the service questionnaire is signed." One task a household and agent: an open one with that subject on
    the Account is found and none is added.
  - **Both are automatic** on every naming: the board's (`transitionAssign_`), Match's and staff's, and a naming made in
    Salesforce (`tSfBriefs_`, after the brief). `tSfAssignWrite_` reads the client's policies by number and then every
    record on their own Contact (`tSameClient_`, so a daughter's own policy on her own Contact is never touched), and
    `tSfHouseholdTasks_` opens the task. The board's answer says how many records and tasks (`sf.policies`, `hhTask`).
  - **Who supports whom** (`T_SUPPORT`, `tSupportFor_`): a **Support** column on the Agent Skill Bank wins, when one is
    added; else `T_SUPPORT.MAP` (Liz for Neil, Felicia, Rajiv and Randolph; Sasha for Varun, Fawwaz and Malcolm;
    Azariah for Premchand, Darryl, Meera, Narissa and Daniel, from who has owned each agent's tasks); else whichever of
    Sasha, Azariah and Liz has the fewest open orphan tasks. The owner is that person's Salesforce user, else the
    branch manager's. `hh22/test.js` (21 checks) and `hh22/sf-test.js` (5) in the scratchpad cover it.
- **Every orphan on the branch's board, the open tasks, a comment on one chosen task, and an AI guide** (22 October 2026:
  "on my log in i am not seeing all the orphans and must be able to search and must be able to see the tasks opened and
  build in intelligence, agent when logged in must be able to post on a chatter on the task … and use our AI for
  intelligent guided responses").
  - **Every client of the books, by default, for the branch.** The board used to ask for the clients who had not answered
    only when "include clients who have not answered yet" was ticked, and it never showed a client whose letter was held
    (a check, no e-mail, bounced, the manager's hold): 239 of 2,473 on 22 October. The page now asks with `all=1` unless
    that device turned it off (`rrb-assign-all`), and `tBoard_` adds the held and unsent clients as states `held` and
    `unsent` (never one `T_NOT_BOOK` leaves out), each with its policy numbers (`pn`). `all` counts for the branch only:
    staff, unit managers and agents get their own lists whatever the page asks. About 3.4 MB for the branch.
  - **The search** (`hay`) reaches the name, client number, every policy number, the e-mail, the phone numbers (as digits
    too), town, address, occupation, the former agent ("was with …"), the agent named, the letter and the household.
  - **Tasks** (a tab under Act on, for every role; `tTasksView_` through `action=board&tasks=1`, so Service.gs needs no
    paste): every open Salesforce task whose subject starts "Orphan", matched to its client by the policy record, or by the
    contact for a household task on the Account (`tPolTokens_`), with who holds it, its age in working days, its due date,
    the last post and its writer (a board post is read by the name at its head), and whether the agent named on the client
    has written on it. Tiles for overdue, nothing posted, quiet two working days, agent named with no word, not matched; a
    row per person holding them. The branch and staff see every task, a unit manager his team's clients and tasks, an agent
    their own. Read once every five minutes (`T_TASKS`). "Open and post" opens the client (`#t=…&k=<task id>`) with the
    comment set to that task.
  - **A comment on one task.** Each open task on a client's details has "Post on this task", and the comment box says where
    it goes; `transitionComment_` takes `task` and posts only there, and only if it is one of that client's open tasks.
    Without one it goes to the newest three, as before. An agent named in Salesforce can open the client and post.
  - **Guide me** (`tGuideApi_`, `action=board&guide=1&token=…`): on a client's details, the Claude API (`GCM.AI_MODEL`,
    structured output, effort low, `ANTHROPIC_API_KEY`) reads what the board holds on them (where they stand, what they
    told us, the call-back, the file notes, the history, the policies and what the records show, the open tasks and their
    last posts) and writes where things stand, a priority, what to do next, what to say first, what to ask, what to be
    careful of, and a note for the task with [brackets] to fill. The client is "[first name]" to the API and the page puts
    the name back; the former agent is "the former agent"; numbers, e-mails and links are taken out both ways. Staff's
    facts carry no figure, and the rules say Client Support never advises. Nothing is saved or sent: "Use as my comment"
    puts the note in the box. Kept six hours for the same facts.
  - `hh22/tasks-test.js` (38, Node) and `hh22/page-test.js` (37, Playwright, a phone included) in the scratchpad cover it,
    Salesforce and the API mocked.
- **Follow-ups: the clients chasing us, and who on the team answers** (22 October 2026: "run a report on customers who
  are following up and analyze the staff who are not responding … and have my log in to my dashboard filled with all
  that was asked for"). A tab second on the branch's board, after Urgent (`tFollowupsView_`, `action=board&followups=1`,
  so Service.gs needs no paste; the branch alone; kept ten minutes, `T_FU`).
  - **The clients**: everyone who came back on a later day than their first answer (Client Responses, campaign tokens,
    never a Test row, a detail taken on a call, a naming or an answer that looks automated). Each is *chasing* (their
    words ask why nobody called, for an update or a person, `T_FU.CHASE`, or they asked again for the same thing),
    *wrote with details*, *declined* (`T_FU.DECLINE`) or *came back with more answers*. Then whether anyone answered after
    their last message: a post by staff or an agent on their task, a call marked on the board, or the task closed; with
    the working days it took, or the working days they have been waiting.
  - **The team**: every person holding orphan tasks. The branch's asks are the manager's posts on their tasks (follow-ups,
    moves, reopenings, notes, his own posts), addressed by the name in the post, else to the owner; never a hold, a
    carry-on or a board naming note. An answer is any post or comment by that person after the ask (a board post is read
    by the name at its head; the tracker's "not done" lines by the person they name, "not touched" never an answer).
    Per person: asks, answered, the same working day, the median wait, the asks unanswered now on open tasks with the
    working days since their own last entry or since the task became theirs (a move counts from the move), the days of
    the last ten working days they did anything, open, overdue, untouched, and the tasks closed (with the standard "no
    questions or concerns" text, with nothing written that day) and reopened by the branch.
  - **Waiting on the branch**: staff questions to the manager ("who to assign …", "awaiting new agent") on a client nobody
    is named on yet.
  - On 22 October: 87 clients came back (21 chasing, 2 with no answer since); 1,036 asks in 21 days, 50% answered, 12%
    the same day; 96 unanswered now; 53 clients waiting on the branch to name an agent. `fu22/run.js` (the view on the
    real sheet and Salesforce as pulled that afternoon) and `fu22/page.js` (13, Playwright, a phone included) in the
    scratchpad cover it; `fu22/build-xlsx.py` writes the same view as a workbook.
- **A naming in Salesforce now briefs the agent, as a naming on the board does** (22 October 2026: "can a template be
  created that will trigger a notification to Neil once the Assignment is done? … log in and place his comments in the
  portal … and give a lot of intelligence"). Until then Salesforce sent nothing (no flow on the policy record reads
  Assigned Agent, and no e-mail went to any agent after a Salesforce naming), and the sync only copied the name to the
  board.
  - **When:** `tSfBriefs_` runs after each `tHaSync_` in the five-minute run (so every 15 minutes). It takes the
    Household Assignments rows with Source `Salesforce` dated on or after `T_SFBRIEF.FROM` (22 Oct), groups them by agent
    and sends each agent one `tBriefMail_` (from the script owner's account, internal, nothing to a client, so no hold
    applies).
  - **Once:** per client per agent, recorded on the **Agent Briefs** tab (When, Token, Client, Agent, Named on, Source,
    Status), made the first time. A board naming writes it too, and a board naming from before the tab is known by its
    Assignment Log row, so a naming the board made and wrote to Salesforce is never briefed twice. A reassignment in
    Salesforce briefs the new agent. An agent not active on the Agent Skill Bank is recorded `held: …` and not sent;
    delete that row once the Skill Bank is right and the next run sends it. A send that fails records nothing.
  - **The brief** (every brief, the board's too): "The branch named you as their agent in Salesforce on <date>" for a
    Salesforce naming; a numbered **What to do** (sign in, read the file, call within two working days, Log call the same
    day, Save comment under History · tasks · comments; both go onto the Salesforce task); up to six lines of what the
    records show (`T_BRIEF_INS`, four until then). Still no client phone, address, e-mail, words or money figure.
  - `transitionSfBriefTest` (editor Run) sends the branch manager the brief for the newest Salesforce naming, marked
    TEST, recording nothing; `transitionSfBriefsNow` syncs and sends at once. `sfbrief22/test.js` in the scratchpad
    covers it (30 checks, the 21 Oct tabs), with `brief16/brief-test.js` (39) still passing.
- **A questionnaire after the naming earns the agent TT$200, and the claim
  is chased until Salesforce has the payment date** (3 October 2026; ping
  `campaign: 7`). The manager asked: "when a questionnaire is recieved the
  agent is compensated 200.00 as an email goes to retention email
  GlocConservationRetentionunit@myguardiangroup.com with the details and to
  track payments, the email have to be followed up until the payment date is
  updated on salesforce". He set the rules the same day. A claim needs a
  service questionnaire received on or after the day the client was named to
  an agent, whoever sent the link. There is one claim per client. Each claim
  is e-mailed when it is found, with the manager and the agent copied. Every
  Monday one list of the unpaid claims goes, oldest first. The machinery is
  `T_CLAIM` and `tClaimsRun_` in Transition.gs, at the end of the five-minute
  receipts run. A questionnaire is placed on a client by its Link ref, else by
  a policy number only that client holds, else by an e-mail only they have.
  The agent is the one they were named to when it came in: the board's names,
  the `[assigned …]` stamps that keep the earlier ones, and Salesforce's. A
  questionnaire from before the naming earns nothing. So do a staff Test row,
  a departed agent's own policy or household, a TEST policy and the pilot.
  The agent must be active on the Agent Skill Bank, matched by full name, or
  the claim is held. Each claim is a row on the **Retention Payments** tab
  (`RP-yyMMdd-nnn`). The claim e-mail goes from support@ through Graph,
  signed by the manager, a reply going to him, with the confidentiality line
  for Guardian Life. **Salesforce already keeps the branch's claims** on the
  policy record: Date Subm to Retention, Was Agent Paid (Yes or No) and Date
  Comm Paid, the commission run's date, the 4th of a month. On 3 October it
  held 250 claims since 2024, some marked Yes with no date. A claim writes the
  first two the same way on one of the client's policies, in this order of
  choice: the questionnaire's, the one the agent was named on in Salesforce,
  then the live one with the largest premium. It never writes over an
  earlier claim's date. A submission already entered by hand, on or after
  the naming, is recorded and never e-mailed twice. **The claim is closed**
  when Date Comm Paid, on or after the naming, is on any of the client's
  policies; Was Agent Paid is then set to Yes. A date still to come counts,
  and the board reads it "to be paid". A Paid date typed on the tab also
  closes a claim, and Void, Declined or Withdrawn in Status stop it. **The
  list of unpaid claims goes every working day at 10:00** (`T_CLAIM.FOLLOW_HOUR`,
  `tClaimsFollow_`; until 15 October 2026 every Monday at 9: "if the field
  is not updated, every day a daily run goes out at 10 o'clock, copying the
  sales support team to the retention department … once they close off,
  then the email stops") to the Retention unit with sales support and the
  manager copied (`tClaimCc_`: `FOLLOW_CC`, else `TRANSITION.CC`), never the
  agents, because it carries every agent's clients; each agent sees their own
  claims on the board. A claim joins it three days after it was sent
  (`MIN_DAYS`) and leaves it the day the date is there. **When the date
  appears, the agent is told** (`tClaimPaidMail_`, `CONFIRM_PAID`): one
  e-mail from support@ naming the client, the policy, the date and where it
  was read (Salesforce, or Paid typed on the tab), sales support and the
  manager copied, once per claim (`[agent told]` in the Note), only once the
  claims are live. The menu item "send the retention follow-up (the daily
  list) now" keeps its old function name. `claims15/claims-test.js` in the
  scratchpad covers the daily list and the confirmation (25 checks).
  **Nothing goes until the manager's go**:
  `transitionClaimsStart`, on the menu as "Transition: start the TT$200
  claims". Until then a claim is found, recorded and held. The board shows
  the branch every claim, a unit manager his team's and an agent their own,
  by the agent the claim pays. Staff see none. Without the `SF_*` properties
  the e-mails still go, and the tab says to enter the dates by hand.
  `claims/claims-harness.js` (68 checks) and `claims/claims-test.js`
  (Playwright, 31) in the scratchpad cover it.
  **Since 16 October 2026 the questionnaire's dates in Salesforce drive every claim** (`T_SQ`, `tSqRun_`; `T_SQ.ON`
  false puts back the flow above). The manager: "the date service received is updated by the staff … sales support
  follows up with customer service … after 5 working days … a follow up email is sent attaching the trail as support is
  copied. If … date SQ processed by CSR is filled then there is no further automation. Once the date SQ processed is
  filled an automated email to GLOC retention is sent … with a 3 working days timeframe with reminders [until] date SQ
  comm paid". Every claim since 1 October had been submitted by hand, and none started from a questionnaire on the sheet.
  - **The fields** (CLIENT_PORTFOLIO__c): `Date_SQ_submitted__c` (the completed questionnaire, staff),
    `Date_SQ_submitted_to_CSR__c` and `Date_SQ_processed_by_CSR__c` (sales support; both new on 16 October, and both
    dates), `Date_Subm_to_Retention__c` and `Was_Agent_Paid__c` ("Was Agent Paid for Orphan?", the system),
    `Date_Comm_Paid__c` ("Date SQ Comm Paid", Retention or sales support). The integration user needs read and edit on
    the two new fields, or the query fails.
  - **A claim** is one client (their Contact, else client number) and one questionnaire (the day it went to Customer
    Service), with every policy that carries those dates. Only dates from 16 October (`T_SQ.FROM`) count. It is a row on
    the Retention Payments tab (`SQ key`, `Records`, `Sent to CSR`, `CSR follow-ups`, `Last CSR follow-up`, `Processed
    by CSR`, added by name to an older tab), so the board, the brief and the points read it as before; the board shows
    the new stage as "with Customer Service".
  - **Customer Service**: every 5 working days (`CSR_DAYS`, counted as `tWorkingDays_` counts them) until processed is
    filled, in the first run from 10:00 on a working day, one follow-up: to the desk the SQ task went to (the task's
    contact when it is a desk, else `CSR_TO`), sales support and the task's owner copied, a reply to sales support; the
    task's subject as its own, the trail in the body (the task and its Chatter), and the original e-mail attached as
    `.eml` when support@ was copied on it (found by policy number, `tSqOriginal_`). A line goes on the task's Chatter.
  - **Retention**: the day processed is filled (8:00 to 17:00, working days) the claim goes to `T_CLAIM.TO`, the manager,
    sales support and the agent copied, to be paid within 3 working days (`RET_DAYS`), and Date Subm to Retention (and
    Was Agent Paid No) is written on each policy. A reminder every 3 working days at 10:00, never copying the agent,
    until Date SQ Comm Paid is in; then Was Agent Paid Yes and the agent told (`tClaimPaidMail_`). A Date Subm to
    Retention already entered is "Submitted by hand", never e-mailed, still reminded.
  - **Held**: no agent; an agent who left (`tFormer_`); not active on the Agent Skill Bank; a questionnaire received
    before the Date Assigned to Agent. A second questionnaire for a client already claimed is Void.
  - **The agent paid** is Assigned Agent, else the agent on the policy (`AGENT__c`, which is who Sasha's by-hand claims
    paid).
  - Nothing goes before the go (`claims_live`); `transitionSqTest` sends the manager one follow-up, one claim and one
    reminder, marked TEST, from the real records where there are some; `transitionSqNow` runs it at once.
  - `sq16/sq-test.js` in the scratchpad covers it (54 checks, a made-up Salesforce and mailbox, the clock moved over two
    weeks). The board film's claim line ("at once … every working day at ten") is now out of date: re-voice it with the
    next cut.
- **One client in full on the board: the history, their Salesforce tasks,
  and the team's comments** (3 October 2026, the same request: "so the agent
  can see the email and history and tasks opened on salesforce assigned to
  the staff and a place for their comments"). *History · tasks · comments*
  on a card asks `action=detail`, and the board opens on it from a
  `#t=` link. **The history** is `tTrail_` read about the client rather than
  to them: the letter by its subject line, a reminder, their answers and
  replies, our receipts and notes. Beside it is what the branch did: who they
  were named to, each call marked with its file note, the questionnaire and
  the claim. It runs newest first, each line marked whose it is. **The tasks**
  are every Salesforce task on their policy records or their contact record,
  open or changed in the last fourteen days. Each shows who it is assigned
  to, its due date, who opened it and its Chatter, posts and replies, as
  plain text. A flow's broken subject (`$Record.FirstName`) reads "Birthday
  e-mail (automatic)". **A comment** is kept on the **Board Comments** tab.
  It is posted to the Chatter of the client's newest three open tasks, or to
  a policy record when none is open, headed with the writer's name, since
  Salesforce shows the integration user as the poster. Who may open a client
  is who sees the card: the branch and staff anyone, a unit manager his
  team's, an agent their own. Staff never see the claim. The board's
  two-minute refresh waits while a comment is being written. Signing out
  forgets every client opened, every comment not yet saved, every policy
  fetched and the board kept on the device, so the next person on the
  device starts clean.
- **The calls moved onto the board, and the branch opens on what to act on**
  (7 October 2026: "where does staff make their notes and who to call as we
  move from the spreadsheet to data entry when call and can see the scripts",
  then "as the branch manager when you log in where do you see what is to
  action urgent, the naotes and history staff mande organized and poae to
  reassign"). **The Call List tab** is each caller's list from the Client
  Support calls Google Sheet, imported once (built in the scratchpad by
  `calls7oct/build-call-list.py`): Token, Caller (the full name on the Agent
  Skill Bank), Order (the caller's own row number, so the terminated book
  and the action letters stay first), Letter, Call for, Phone, Other
  numbers, E-mail on file, Address on file, Notice agent, From the calls
  sheet (the tries, Reached? and outcome typed there, as one line), Call-back
  and Done. `tCalls_` reads it. A client on it with nothing on Client
  Responses is a light "to call" row (`tToCall_`: on a caller's list or the
  no-number list, not Done, never under the manager's hold on a book, never
  one the books leave out), for the branch and for staff, never for an agent
  or a unit manager. Staff open on **your calls** (their own list, matched by
  full name); the branch opens on **act now**: clients still open whose most
  pressing answer scores 80 or more in `T_PRIORITY` (an agent now, the former
  agent in touch, a change suggested, a payment to trace, paying in person) or
  who are late. **A try is logged on the board.** `transitionUpdate_` on a
  client with no row writes a `/call` row (Response `call`, Referrer `staff:
  <name>`, `agent: <name>` or `branch`). The branch and staff may log on
  anyone. An agent or a unit manager may log only on a client Salesforce named
  to them or their team (the Household Assignments tab): on 13 October ten of
  the fifteen clients named in Salesforce had never answered a letter, so they
  had no row, and the agent's Log call was refused with "No rows for that
  client" (`cb13/agent-log-harness.js` in the scratchpad, 18 checks). `tCallRow_` makes it the
  branch's record everywhere `tAssignRow_` already did: never thanked, never
  chased, never an answer, never a tap on the wall or in the reports; a call
  marked Called or Met counts as having spoken to the client, so it stops the
  five-day reminder (`tSpokeCall_` in `tRespondedAt_`). The card then reads
  "called, no answer yet" with every stamp and note. The panel offers the
  usual outcomes as one-tap notes and no "still on it" note for a client who
  has not answered. Nothing typed on the old calls sheet ever reaches the
  board: the board is the record now. **From the team** (branch only) counts
  each person's outcomes today and over seven days from the stamps every
  outcome leaves, and lists their notes newest first; a name opens that
  client. **Reassign to…** replaces Assign to… on a card that already has an
  agent. **Scripts** (`client-support.html`, `call-script.html`,
  `agent-brief.html`, `if-they-say.html`) are linked under the title and on
  every call row. While automatic client e-mail is held the board says so and
  the introduce box starts unticked, after an introduction went to a client
  during training that afternoon; with a backend that holds introductions
  too (see the hold bullet), the box cannot be ticked at all while the hold
  is on. **Households** come from the Household
  Assignments tab when there is no Households tab (`tHouseholds_`; a family
  link is then made there too, so one linked pair never hides every other
  household), and so does the 24 September suggestion when there is no
  Assignment Plan tab (`tPlan_`). **Speed:** a board request reads Transition
  Send and the Agent Skill Bank once (`T_READ_ONCE`), and the page draws sixty
  cards at a time ("Show the next"): on a phone's CPU the branch board went
  from 6.3 to about 2 seconds after the answer arrives; Apps Script itself
  still takes some ten seconds to read the sheet. `slow7oct/calls-harness.js`
  (25 checks, Node, the real tabs) and `slow7oct/board-calls-test.js` (26,
  Playwright) in the scratchpad cover it. **The board opens on the last
  board it showed** (the same afternoon: "logging in as me too long to
  refresh"). The page keeps it on the device as `rrb-assign-snapshot`, as
  the wall and the dashboard keep theirs. It is painted at once when the
  page opens again, and the sheet's answer replaces it seconds later. It is
  kept twelve hours at most and only for the person it was read for (a hash
  of the number and password, never the password itself). It goes on
  sign-out and on a refused password. Nothing is saved from it: an outcome,
  a naming or a comment waits for the fresh board. Refresh reads
  "Updating…" while the sheet answers. A reload asked for during another
  is made straight after it; until then, a save that landed mid-refresh
  waited two minutes to show. Every tab is read once per board request
  (`tSheetRows_` under `T_READ_ONCE`), so Household Assignments is read
  once instead of two or three times. `speed7oct/snap-test.js` (24,
  Playwright) and `speed7oct/same.js` (the answer byte for byte the same
  before and after, for every role) in the scratchpad cover it.
- **The board is in tabs, and every card says who the client is, where they
  live and who they live with** (7 October 2026, evening: "need more data and
  spaced out properly scaled professionally and need address and occupation
  and households!", then "there should be tabs re a call list as staff did
  indicate an urgent call is needed so deep insights for the branch manager to
  review and assign … very important on the format, fonts for easy reading on
  any device", then "the orphan data is pulled from the google branch
  intelligence sheets … there are many sheets with data").
  **The tabs.** The branch: Urgent, To assign, Call list, In progress, Done,
  Households, All clients, then Team and Insights. Staff open on Your calls.
  An agent gets To call, Done and All (Urgent and Claims only when they have
  some). Each list tab opens with its own numbers, and a tap on one shows that
  sub-list. Under them are its breakdowns (why they need us, who asked for the
  call-back, where they live, letter, was with, age, suggested agent, agent
  named); a tap on any line filters the list. The breakdowns fold away on a
  phone. **Households** shows each family as one card, with "Assign the 2 to
  …" for the family's agent or the head's suggestion.
  **The card** has five blocks:
  - Reach them: every number once (`tContactFor_`), the e-mail, how and when.
  - Lives at: the town, then the address.
  - About: age, gender, occupation, employer, born, how they pay.
  - With us: since when, in force, the premium a year, cover.
  - Household: its name and size, who answered, the family's agent.

  The policies and the household open on the card. The base type is 16 px,
  and long e-mails wrap (`overflow-wrap:anywhere`), so no tab is wider than a
  phone.
  **Call-backs.** The calls sheet's Call-back column (136 for a licensed
  agent, 6 for the branch, 6 do not call) was buried: 98 of the agent
  call-backs sat among the "reached by phone" cards. It is now a flag on the
  client (`tBackOf_`). Staff and the branch set one on the board with the
  outcome (`transitionUpdate_` `back=agent|branch|dnc|clear`), stamped after
  the note, so the note is its reason (`[call-back agent 7 Oct · Name]`). It
  stays open until one of these happens:
  - it is cleared;
  - the client is marked Met, Closed or Declined;
  - for a licensed agent's call-back, the agent named on the client marks the
    call;
  - for the branch's call-back, the branch manager or an assistant does.

  It is read from the row holding the most stamps (`tSeq_`). Every update
  writes the same stamps on each of the client's rows, and `c.markers` keeps
  each stamp once, so a second flag by the same person on the same day would
  otherwise vanish behind an earlier clear. Do not call is its own state
  (`dnc`): off every list to call, with no call buttons. Urgent lists the
  call-backs first (board flags newest first), then the pressing answers,
  then the late ones.
  **Where the card's data comes from.**
  - The Client Profile: Salesforce's address lines with the town apart, the
    mobile and home numbers, plan, status, paid to and issued. It was
    imported once from the scratchpad (`Client-Profile-7Oct.xlsx`, built by
    `board8/build-profile.js` with the script's own `tProfileRow_`). The
    morning build refreshes it when the `SF_*` properties are set.
  - The Client Book: the Branch Portfolio, which is the branch intelligence
    workbook (`INTEL.WORKBOOK`). Its first tab is now the premium-dues
    extract: that evening it held 1,359 of the campaign's 4,805 policies. So
    the build also reads the workbook's in-force book tab (Policy Id, Client
    Id, Plan, Annual Premium …, found by its columns as `iTabInforce_` finds
    it). It adds every in-force policy of the campaign's clients and takes the
    plan's name and the premium a year as recorded (`tInforceRead_`). The
    portfolio's Address runs its lines together, and `tAddrSplit_` puts the
    commas back.
  - The Call List, last.

  `tProfileFor_` reads the profile by client number when the Client Book is
  not built, so the cards say who the client is either way. The page never
  reads the row numbers, or the old sheet's copy of the address once the
  contact carries it, so `tBoardSlim_` leaves them out: 1.3 MB for the
  branch.
  Tests in the scratchpad:
  - `board8/board-test.js` (49, Playwright on the real tabs);
  - `board8/book-build.js` (18, the build on the real first tab and a
    made-up in-force tab);
  - `board8/back-harness.js` (23, the call-back rules);
  - `board8/ported/` (the snapshot test 24, calls 25, the introduction hold 16).
- **Everyone sees what they have logged, and signs in with a first name** (8 October 2026: "have you made the log in
  easy and can staff place the notes in the log in and see what they have done as well managers log in and agents?").
  - **Your work** is a tab for anyone signed in as themselves: staff, agents and unit managers. It is second for
    staff, after Your calls, and second for an agent, after To call. It gives today's and the last seven days' counts:
    clients logged, reached, no answer, call-backs flagged (staff only), and agents named (whoever may name). Under
    them is every outcome they marked, newest first, one line a client a day, with the call-back flagged and the note
    they wrote. A name opens the client.
  - The tab reads the same stamps as the branch's Team tab (`[no answer 8 Oct · Name] note`), matched to the signed-in
    name, so the two always agree. A naming made by staff is read from its "named by" file note.
  - Stamps are kept once each, so two tries on one client on one day count as one.
  - **A unit manager's Team tab** now shows "On your team's clients": the same table and notes the branch sees, over
    his team's clients.
  - **Sign-in** (`tWho_`):
    - A first name alone opens, when exactly one active person on the Agent Skill Bank carries it. Two people with
      one first name, and neither opens on it: the number or the full name does.
    - A full name matches whatever its spacing, hyphens or capitals.
    - Wrong tries count against the person, however they were named (`tries-p-<name>`), never per spelling.
    - Someone who was the agent on these books still never signs in.
    - The gate asks for the "agent number or your name" and says the device keeps you signed in until Sign out.
  - **Signing out clears the client that was open** (`#t=`), so the next person on the device never lands on it.
  - **A name written on a `/call` row is read** (`tBoard_`). An agent named on a client who never answered, after
    staff logged a call on them, is written onto the call row, the only row there is. Until 8 October the board
    returned from a call row before reading Assigned to, so the agent's list missed the client until the assignment
    sync caught up.
  - `work8/work-test.js` in the scratchpad covers it (36 checks, Node and Playwright, the real tabs, test passwords in
    memory).
- **Who is signing in** (15 October 2026: "i want the login to see whats happening and is staff logging in and agents?").
  Until then nothing recorded a sign-in. The only trace of the board's use was what people logged on it, and on 15
  October that showed the 7 October training (the branch closing five, a unit manager marking 27 calls and naming 27
  clients to his two agents) and nothing since: no call logged, nobody named from the board, no comment, the Call List's
  Done column empty, while Client Support worked in Salesforce. The view counter had no rows either.
  - **The Sign-ins tab** is written by `tSignIn_` on every board request that passes `tWho_`: When, Who, Role, Unit, Via
    (password, or the branch code), Device (the page sends `dev`: phone or desk, and the width, never the browser) and
    What. One row a person an hour (`T_SIGN.EVERY_MIN`, a cache key), so the two-minute refresh never fills it. The tab
    is made the first time, and a failed write never stops the board. A refused sign-in is never logged.
  - **The branch and a unit manager read it** (`tSignIns_`, `signins` in the board answer): everyone active on the Agent
    Skill Bank, never a former agent, a unit manager his team only and never the staff: the last sign-in and its device,
    the opens today, the days of the last seven, the opens since the first, and who has never signed in. The branch code's
    own opens, with no name, are counted apart, for the branch alone. Staff and agents get nothing of it.
  - **On the page**: "Who is signing in" at the top of the Team tab (a seven-day strip a person, and what they logged on
    the board in the same seven days beside it, from the stamps `teamStamps` reads), and "N of M signed in today" on the
    masthead stamp, which opens the tab. A backend without it says to paste Transition.gs; Service.gs needs no paste.
  - `signin/signin-test.js` in the scratchpad covers it (Node and Playwright, the 15 October tabs, test passwords in
    memory).
- **The household is the unit of a naming, who named whom is on the Agents tab, the team's progress and points are on
  the Team tab for staff too, and a call logged on the board goes onto the Salesforce task** (15 October 2026: "ensure
  always the household is assigned and not a policy … all staff and managers are supposed to be able to view the
  analytics as to who assigned whom to agent … see the progress each support has and who is pulling their weight, there
  should be a reward system on the conversions for staff … show up staff who has things to do … when the agent logs,
  comments etc, can they see the task opened if any and it's logged on the task, as a task is supposed to be opened until
  closed").
  - **A naming names the household.** `transitionAssign_` adds every member of each named client's household on our
    list (`tHouseholds_`), whichever row the press was on and whoever presses: staff too, members off their board
    included. `solo=1` names the one client, for a family the branch decides to split. The answer says how many came
    along (`family`) and how many households (`households`); the row's control reads "Assign the household (N) to…".
    The Salesforce write (`tSfAssignWrite_`) therefore covers every member's policies, and a line "Named to <agent> on
    <date> by <who>" goes onto each client's open tasks (`tSfNoteTasks_`, `T_SFTASK.NOTE_ON_NAMING`).
  - **Who named whom** (`named` in `tAgentsView_`, from every client's naming history: the board's stamps and the
    Assignment Log, the Household Assignments tab for Salesforce's own): by person (clients, households, this month,
    seven days, last, to whom) and by agent (received, from whom), with the last fourteen days. Staff and the branch read
    all of it; a unit manager the namings to his own agents. Drawn by `agNamed` on the Agents tab.
  - **The team's progress and points** (`tTeamStats_`, `stats` in the board answer for staff, unit managers and the
    branch, never an agent). Read from the record the board keeps: the outcome stamps on Client Responses, the details
    taken on calls (`call by <name>`, the first name a caller keeps on the device, resolved to the one person on the
    Agent Skill Bank it can be, `T_NICK` for "Liz"), the namings (the Assignment Log, else the stamps; "the branch" for
    the branch code), the call-back flags and the TT$200 claims. **Points** are `T_POINTS`: no answer 1, reached 3,
    met 5, closed or declined 3, an e-mail taken 2, a number or address 1, a household named 5 (once a household,
    never a policy), a call-back flagged 1, a conversion 10, a questionnaire after the naming 10. A **conversion** is a
    client the person reached or named who was then met, closed or declined by someone else, on or after that day.
    **Still to do**: their call list never tried on the board, the call-backs they flagged still open, the clients they
    reached with nobody named. Everyone on the Agent Skill Bank who is staff or a manager is listed, with or without
    activity; whoever has nothing this period and work waiting is marked. The Team tab (now for staff too, `statsPanel`)
    ranks by the period's points (this month, seven days, everything; kept on the device) and says how the points are
    made. Work done only in Salesforce is not counted; the Dashboard's Salesforce table has it. What the points are paid
    as is the branch manager's to set.
  - **The log on the Salesforce task** (`tSfLogCall_`, from `transitionUpdate_`; `T_SFTASK`). A call logged on the board
    goes as a Chatter post, in the person's name (the tab's capitals in title case, `tNiceName_`), with the outcome, the
    note and any call-back, onto the client's open tasks. With none open, a task is opened on the client's policy and
    contact, "Orphan transition: <client> · <outcome> by <who>", in progress, due two working days on, owned by the
    person's own Salesforce user (`tSfUserId_`: first name and surname, so the Skill Bank's "SASHA LALLA" finds her
    married name in Salesforce) or, for an agent with no login, the branch manager's; a picklist the org refuses is
    left off. Nothing here closes a task. The Log call panel says what Salesforce holds before the save (the open task,
    or that saving opens one), and the toast says where the log went. `OPEN_ON_LOG` false keeps the log to the board.
  - `team/team-test.js` in the scratchpad covers it (57 checks, Node with a Salesforce in memory, and Playwright, on the
    15 October tabs).
- **Families the household rule missed, and the service record on every client** (16 October 2026: "she also has a
  husband and how am i to link to a household as the data is supposed to tell me that another person lives there and have
  not been assigned", then "what to do to fix this for the staff? and branch manager as deeper insights needed", then
  "all that we have done to service their account pulling all our salesforce history so a person can see the service
  levels"). The case: a couple on the books sat in two households because one record has the house as "12A Mango
  Road" and the other "12A Mangoe Road" (a made-up example of the kind), and each has its own phone and e-mail; both had answered, and nobody was named.
  - **`tMaybeFamily_`** (Transition.gs) finds pairs like that over the books: the same surname (`tSurnames_`), and either
    client numbers within `T_MAYBE.NEAR` (3) of each other, which is policies taken out together, or the same house in
    the same town. The house is the number the address opens with (`tHouseNo_`: "12A", "12 A", "#12a", after No, Lot or
    Apt; never a light pole, a mile marker such as "8 1/2 MM", or a number later in the line), the town through the
    gazetteer (`tTownKey_`), and the street must be the same street with a typing slip allowed (`tSameStreet_`: a word
    in common, the same first three letters, or two letters apart), because two different streets share house numbers.
    More than `HOUSE_MAX` (6) at one house is flats or an office. A pair already in one household, a pair with someone
    the books leave out (`T_NOT_BOOK`), or a pair decided on the **Family Checks** tab is never shown. `tSamePerson_`
    marks a pair as possibly one person on two client numbers. Measured on the 15 October export: 72 pairs on the live
    sheet (13 with someone who answered); 123 once the Client Profile gives the addresses.
  - **Who sees it**: the branch and Client Support (`tCanAssign_`), never an agent or a unit manager. The card gets a
    yellow "Possible family on our books" block with the reason and two buttons, One household and Not family, and a
    "possible family" pill on its row; the Household block points to it. The Households tab opens on "Possible families
    to confirm", fifteen at a time, those with an answer first, searched with the tab's own box. The Dashboard's "What
    stands out" counts them. The board answer carries `maybe` (the pairs) and `c.mf` on each card; `counts.maybe` has
    the pairs, those with an answer, those half named and those named to different agents.
  - **One press, no call logged.** `transitionUpdate_` with `family=` or `notfamily=` and no outcome goes to
    `tFamilyOnly_`: it links them (`tLinkFamily_`) or records "not family", and writes the decision, the household and
    who made it on the Family Checks tab (made the first time). Linking from Log call with an outcome still works, staff
    included now (until 16 October the branch alone), and is recorded there too. Log call's family field, filled with
    nothing else, links them with no outcome.
  - **The two side by side, with the family's cover and its gaps** (asked the same day: "if a possible family you could
    also provide all the policy details and occupation etc as well our history with the person so we can see the cover
    for the family … intelligence would tell us if there is a gap"). Each pair on the board carries both people
    (`tFamSide_`, `tFamBrief_`: age, gender, occupation, employer, town, how they pay, what they hold with us, the plans
    in force, the send row's service record) and the two together (`tFamGaps_`: policies in force, life cover, critical
    illness, premium a year, since when, the two people's genders and ages and the years between them, and the gaps,
    most pressing first). The gaps are facts off the record, never advice:
    - neither holds a policy in force with us;
    - an adult from 18 to 64 with no life cover with us, and whether the other has it;
    - life cover and no critical illness cover, where Salesforce split the cover (both, as one line);
    - each one's premium due, cover ending within five years, lapsed policy, estate beneficiary, waived premium;
    - both or either paying from the pay packet;
    - a policy naming the other as beneficiary;
    - for the branch, the family's life cover against the incomes on file;
    - the same date of birth on both records (first on a possible same person), or different ones;
    - only one of the two readable yet, so the figures are one person's.

    **Compare in full** asks `action=detail&token=A&pair=B` (`tPairDetail_`, the branch and Client Support only, so
    Service.gs needs no paste): each person's every policy, the insights, the whole Salesforce service record and the
    last twelve lines of their history. Policies come from the Client Book, or from the Client Profile's own rows when
    the book is not built or lacks the client (`tPolsFor_`): Salesforce's plan, status, paid-to and cover split, no
    premium (`noPrem`, and the page says so), a premium due only 45 days past the paid-to date (`T_PROFILE_DUE`). Staff
    get all of it with no figure (`tFamNoMoney_`, and no income line). **Sign-out forgets a compared pair** (`PAIRX`):
    the first test caught the branch's figures still on screen when Client Support signed in on the same device. The
    pairs add about 200 KB to the branch board (1.68 MB on the 15 October export with the 7 October profile).
    `fam16b/pair-test.js` (56 checks, Node and Playwright, with the 8 October Client Book for premiums) covers it.
  - **The service record.** Every card shows the record the letter printed from the send row (`tSvcOf_`: `svc_docs`,
    `svc_requests`, `svc_reminders`, `svc_birthday`, as at 24 September), or says plainly that the branch had nothing on
    record for that client. Under History, `tSfService_` reads every Salesforce task on the client's policy records and
    contact record, ever (up to `T_SVCREC.MAX`): requests handled and since when, the last served, days to close (median and
    average), the share closed within a day and by the due date, open and overdue now, by year, by kind of work (the
    Task Type in words: "Renewa/PDl/Bill" reads Premiums and billing, Pendings Applications, "Claims/ Mat" Claims and
    maturities) and by who served them, then every task behind a fold. Logged e-mails and the birthday flow are counted
    apart and never as work (`T_SVC_LOGGED`, the rule `GCM_LOGGED` keeps for the groups). Staff see it: it holds no
    money. Without the `SF_*` properties it says what to set, and the rest of the history still opens.
  - Tests in the scratchpad: `fam16/fam-harness.js` (32), `fam16/fam-page.js` (20, Playwright) and `fam16/svc-test.js`
    (20, Salesforce mocked with made-up tasks), on the 15 October export (`fam16/tabs16.json`, and `tabs16p.json` with
    the 7 October Client Profile added).
- **The workflow on one page, and a test for each role** (15 October 2026: "help me to confirm, agent sees their own
  things that's assigned to them and by whom. And managers has a different dashboard … Help me to streamline the proper
  workflow for all to read more or less and do a test regarding the orphans. So agents do the test, what they're supposed
  to do. Staff do the test and managers.").
  - **Confirmed on the real tabs** (`wf15/confirm.js` in the scratchpad, 20 checks): an agent's board holds only the
    clients named to them, each row's last line reads "Assigned 15 Oct · <agent>: named by <staff>" and the opened card
    "Named: … on …" with the history (`c.hist`, from `tAssignHist_`); the roster they get is themselves alone; no team
    points, no sign-ins, no Match. The branch opens on Urgent, Dashboard, Agents, Match …; a unit manager on his unit
    with Dashboard, Agents and Team; staff on Your calls, Your work, … Team, with no Dashboard.
  - **`orphan-transition/workflow.html`** is the one page: a flow strip (letter, answer or call, household named,
    conversation in two working days, logged on the board and the Salesforce task, met or closed, the review, paid),
    **the outcomes** (O: every household named, a first conversation in two working days, every call logged the same
    day, met or closed with what was agreed, a review filed, the TT$200 paid, the policy kept), the three rules on
    every call, **the TT$200 start to finish** (C, added 15 October 2026 with the daily list: the four steps and who
    fills each Salesforce field), then one section per role (agents 6, Client Support 6, managers 5), each
    with the day, the steps on every client, what counts, what nobody does, and the links. `#agents`, `#staff` and
    `#managers` show one role; "Show all three" and print show every section. Every `<article class="msec">` carries
    `data-sec` (F, O, R, C, A1–A6, S1–S6, M1–M5), which the test and the questions' Manual column refer to. No client,
    no figure from the sheet. The board's menu and Help link each sign-in to its role's section and to the test. A
    table whose last column is words, not a number, is `pts two` (the class is styled on both pages).
  - **`orphan-transition/training.html`** signs in as the board does (the same two localStorage keys, so a device signed
    in to the board is signed in here), fetches `workflow.html` and shows the common and the role's sections as the
    manual, each ticked as read; then the role's test; then My results, and Team results for the branch (every attempt,
    the written marks to confirm) and "My team's results" for a unit manager (their agents only). Branch look: the
    gold shield, never the blue.
  - **The backend is the group test's, with a course** (`GCM_COURSES`, `gcmCourse_`, `gcmTrainWho_`, `gcmTrainFor_`,
    `gcmTrainReads_` in GroupClients.gs; the page sends `course=orphan` on `gcm.train`, `gcm.trainSubmit`,
    `gcm.trainView` and `gcm.trainMark`, so Service.gs needs no paste). The orphan course signs in every role through
    `tWho_`: an agent, staff, a unit manager and the branch (the assistant branch manager too) take, in turn, the
    agents', the staff's and the managers' questions; the sheet's **Roles** column (agent, staff, manager, all) says
    whose a question is, and the weights are worked out over the role's own questions. A unit manager reads their
    team's attempts; the branch marks. The Results row's Role is the Agent Skill Bank's role word. The e-mail subject
    is "Orphan transition test: …" and links the orphan page; the AI marker gets the orphan brief
    (`GCM_MARK_SYSTEM_ORPHAN`). `gcm.ping` answers `orphanTrain`. The group course is untouched: its own sheet, its own
    sign-in, every question to everyone.
  - **The questions are in the private "Orphan Transition Training" Google Sheet**, created 15 October 2026 from
    `wf15/bank.py` in the scratchpad (39 rows: 3 shared critical questions on the three rules; 10 choice and 2 written
    per role; 73 marks a role; the right answer never the longest option; the answers spread A to D). Its ID goes in
    the **`ORPHAN_TRAIN_SHEET_ID`** Script property of the Service Questionnaire project; until it is set the page says
    the test is not linked. Edit a question there and the next test uses it; keep the right answer off the longest
    option when adding one. Never in the repository.
  - `wf15/train-test.js` in the scratchpad covers it (60 checks: Node with the sheet mocked from the CSV, then
    Playwright on the workflow page, the training page as an agent, a unit manager and the branch, and the board's
    links). `tools7oct/backend.js` gained `newSpreadsheet(tabs)` for a sheet opened by id.
- **The Dashboard tab: how far the work has got, as shares, with filters** (8 October 2026: "need to have dash analytics
  and % of work completed etc a lot of insights and filter ability").
  - **Who sees it.** The branch has it second, after Urgent, which stays the opening tab. A unit manager has it after
    Your work, over his team's clients. Staff and agents have no Dashboard. Their own shares are at the top of Your
    work: a caller's list tried and reached, or an agent's clients spoken to and completed.
  - **One filter row scopes every number:** the period (today, 7 days, 30 days, since the letters; remembered on the
    device), the former agent's book, the letter, the town, one person (a caller or an agent), and one unit (the branch
    only). Tapping a row in any table narrows the whole page to it.
  - **The words have fixed meanings** (the page's "How the numbers are made" says them):
    - *Asked*: a client who answered with something that needs a person, not a note alone.
    - *Spoken to*: Called, Met or Declined on the board, reached by phone, or "reached: Yes" on the old calls sheet.
    - *Tried*: any outcome logged, or a try on the sheet.
    - *Completed*: every answer closed, or Met, Closed or Declined.
    - *Late*: open past `WAIT_DAYS` with nobody named.
  - **What it shows:**
    - One hero figure: the share of the clients who asked that have been spoken to, named or completed.
    - A stage bar (completed, agent named, spoken to, nobody yet), on an ordered teal ramp checked with the dataviz
      validator (`#62bfd2`, `#1d8fa6`, `#07606f`), and tiles, the late one in the stop colour with its "!".
    - The call lists (reached, tried, not tried) and the open call-backs.
    - The period's numbers.
    - Two charts by day, answers coming in and clients with a call logged. Each has a column a day, the period in teal
      and the days before it in grey, a hover or focus value on every column, and every number in a table under them.
    - "What stands out": computed facts, never advice.
    - Client Support on the board, the agents (with the clients named more than `WAIT_DAYS` ago and nothing logged),
      and every book, letter or town.
  - **Client Support in Salesforce** is the branch's alone (`tSfWork_`, asked for as the board request with
    `sfwork=1`, so Service.gs needed no new route and no paste). It counts the orphan tasks since 1 October per
    person:
    - tasks held and closed;
    - closed with no note, which means no post or comment by anyone but the branch manager, whose user also posts the
      routine's instructions;
    - open and untouched, overdue and due today;
    - closures and notes in the period.

    It is kept ten minutes, and says how to link Salesforce when the `SF_*` properties are missing. Tasks carry no book
    or letter, so only the period narrows that table, and the page says so.
  - Calls written only in Salesforce Chatter are not on the board, so they count only in the Salesforce table.
  - `work8/dash-test.js` in the scratchpad covers it (42 checks, Node and Playwright, the real tabs, made-up Salesforce
    tasks). It serves the site's `receipt.json` and `receipt.html` to the demo backend, which has no network. Without
    them the board has no answers, and every count that reads one, such as "former agent in touch", is 0 in a test.
- **The board's look: a side menu and one row a client** (8 October 2026, after Client Support's first morning on it:
  "the interface is so confusing … a much more professional layout … scale properly").
  - **The bar along the top** has the shield, the board's name, when the sheet was read, Help, Refresh and Sign out.
  - **On a laptop the lists are a menu down the side**, grouped Yours, Act on, Lists, The branch, under who is signed in
    and as what, with the scripts beneath. On a phone the menu is a row of pills that stays at the top.
  - **Each list opens on its title, its count, one line on what to do there, and its numbers.** The breakdowns stay
    folded until someone opens them (`rrb-assign-breakdowns2`).
  - **One row a client.** It shows the name and state, why they are on this list, the town, age and occupation, and the
    last thing on the file (an open call-back first). Beside it are the number to tap and **Log call** (Update for the
    branch).
  - **Log call opens the panel with nothing chosen.** "What happened?" comes first, and nothing saves without it.
  - **The name or Details opens everything else under the row**: the five blocks, what they told us, the notes, the
    policies, the household, the history, Assign, WhatsApp, their page and the script.
  - To assign and Urgent carry the suggested agent, with its one-press button, on the row itself.
  - A phone cell holding two numbers is dialled one number at a time (`phonesOf`); until then the two ran together.
  - How the board works, the three rules on every call and the scripts are in Help.
  - `board8/board-test.js` (60) and the work, dashboard, snapshot and introduction-hold tests in the scratchpad cover
    it, moved to Log call.
- **Match: who should look after whom, by weight and by town** (8 October 2026: "scrub agent address and client
  address and weighting on the client to know who to assign, how many in force policies, lapsed, maturities, spotting
  opportunities … lives in household … a super intelligent and professionally laid out with graphics, interactive and
  motion"). A tab under Act on, for the branch and for staff (who name agents); never for an agent or a unit manager.
  - **Every row gets a weight in four parts**, each 0 to 100 (`tMatch_`, `c.w = [total, urgent, at risk, value,
    opportunity]`):
    - *urgent*: a call-back, an answer that cannot wait, past the branch's line;
    - *at risk*: the former agent in touch, a change suggested, paying in person, a premium due, surrendered before;
    - *value*: the premium a year and the life cover against everyone on the board, the policies in force, the family
      on our books;
    - *opportunity*: what the record shows (`T_OPPS`): a policy maturing within the year (`sum.mat`, from the Client
      Book's Matures), a lapsed policy, life cover ending, no life cover, a family member without, no critical
      illness cover, no beneficiary, a birthday, and for the branch only cover low for income and a fund value.
  - The branch weighting is `T_MATCH.W` (35, 25, 25, 15). The page's sliders re-rank the queue live and keep a
    person's own weighting on their device (`rrb-match-w`).
  - **Towns only, never a street.** `T_PLACES` is a gazetteer of the places the books' addresses name, looked up on
    OpenStreetMap on 8 October 2026 and checked by hand: a town's centre, never its region's; ambiguous names left out.
    `T_PLACE_ALIAS` maps the spellings on file ("Chaguans", "San Ferando") to them. 98.9% of town mentions map.
  - **An agent's base** (`tAgentPlaces_`): a "Lives in" column on the Agent Skill Bank, else the first place in Areas
    covered, else the mailing town on their Salesforce agent record (`tSfAgents_`, read once a day into the
    `sf_agents` property). On 8 October Areas covered was empty for everyone, and 9 of the 15 Salesforce mailing towns
    read Chaguanas, which may be the branch's own address, so the branch was asked to confirm each agent's town.
  - **The suggestion is now family, then the 24 September plan, then the nearest agent with room, then the lightest
    list** (`tSuggest_`). "With room" means under 1.2 times the even share (`T_MATCH.ROOM`), within 25 km
    (`NEAR_KM`). A household keeps one agent whichever step chose them.
  - **The best fits under each client nobody is named on** (`c.mt`, up to three) weigh nearness 65 and room 35.
  - **A naming writes Salesforce** (`tSfAssignWrite_`, from `transitionAssign_`, so the board, Match and staff namings
    all do). It sets Assigned Agent (the agent's own Contact), Date Assigned to Agent (that day) and Campaign "Orphan"
    on each of the client's policies in force, else the first on file, in one composite PATCH, `allOrNone` false.
    Skipped, and said in the answer, until ServiceSalesforce.gs and its SF_* properties are in the project. An agent
    Salesforce has no record of, or a policy it refuses, is named in the answer; the board naming stands either way.
  - **Staff see no money here either.** No premium, cover or fund figure on any row or in the block, and no opening
    that is a figure. The same change strips money from rows not answered yet on a staff board, which no page asked
    for but the backend would have sent.
  - **The view**: a navy hero with the numbers counting up, and a dark map of Trinidad with Tobago in an inset (Natural
    Earth's coastline, smoothed). Each town is a bubble sized by its clients and coloured by their average weight, and
    pulses when someone there weighs 60 or more. Each agent is a gold pin at their base. A town draws arcs to the
    agents who fit it; a pin draws the agent's 25 km reach and arcs to their clients. Then the queue (heaviest first,
    the four parts as bars, the reasons, one press to name the best fit), the openings as tiles, and every agent's
    list against the share.
  - **Motion**: everything moves when the view is opened, the queue and the arcs after a tap, nothing on the two-minute
    refresh (`c-map`, `c-all`), and nothing at all with reduced motion asked for.
  - The match adds about 9% to the branch board. `match9/match-harness.js` (39, Node, mocked Salesforce) and
    `match9/match-test.js` (37, Playwright) in the scratchpad cover it, on `match9/tabs9.json`: the real tabs with the
    Client Book built from the 7 October portfolio export.
- **Agents: how each agent is getting on, and the households still to name** (14 October 2026: "can I log in to see the
  branch manager dashboard and how the agents assigned are going and how they are making progress and the unassigned, a
  lot of data is needed especially batching in households"). A tab under Act on, after the Dashboard, for the branch, for
  a unit manager (their team only, with nothing to name) and, since the same day, for Client Support ("staff can also
  reassign the orphans as well as a manager with the history of when it was assigned"). Staff see no TT$200 claims on
  it, and name or reassign only the clients on their own board (`nb: 0` marks the rest). Agents have no Agents tab.
  - **One answer, read when the tab opens.** `tAgentsView_` in Transition.gs, asked for as the board with `agents=1`, so
    Service.gs needs no paste. The page reads it again after five minutes, never on the two-minute refresh, so a batch
    being worked is not redrawn under the hand. A backend older than this answers with the board, and the tab says to
    paste Transition.gs.
  - **Every household of the books** comes from the Household Assignments tab. That is never a departed agent's own
    policy or household, staff, a death claim or a Test row (`T_NOT_BOOK`). Held clients and clients not written to are
    included, with why the letter is held.
  - **Where each member stands with us**: answered and asked, answered with a note, reached by phone, called, on a call
    list, written to, or held. What they answered is in the wall's words (`T_HA_SAID`).
  - **How far each named client has got** (`g`):
    - *completed*: Closed or Declined, by the agent or by anyone after the naming;
    - *met*: the same, for Met;
    - *spoken to*: a call the agent marked, a comment they wrote on the board, or their Campaign Feedback Update in
      Salesforce;
    - *tried*: a no answer the agent marked;
    - *nothing logged*: none of these. Two working days after the naming (`T_AGV.QUIET`) it is flagged.

    An agent who reports only in Salesforce Chatter shows as nothing logged until they write the feedback field or mark
    the call.
  - **How long, and how many conversations** ("the objective is to have a conversion as fast as possible … tracking these,
    how long it's assigned and how many conversations"). Each named client carries `da`, the days since the naming,
    `cv`, the conversations since (a call marked Called, Met or Declined by the agent, or by anyone after the naming, one
    a day; the agent's Salesforce feedback counts as one when nothing is marked), `tr`, the tries with no answer, and
    `dm`, the days from the naming to the first meeting. Each agent's line adds the conversations, *converted* (met or
    completed), the average days their open clients have waited, the median days to a meeting, and how many came to
    them from another agent. **Since the naming** groups every named client by 0 to 2, 3 to 7, 8 to 14 and 15 or more
    days since the naming.
  - **Who it was named to, and when** (`tAssignHist_`). Three sources, oldest first, one line an agent and a day: the
    board's `[assigned d MMM · Agent]` stamps (with "named by" when staff named), the Household Assignments tab's
    Salesforce name and date, and the **Assignment Log** tab (When, Token, Client, From, To, Named on, Source, By), made
    the first time something is written to it. `transitionAssign_` logs every naming and reassignment it makes, and
    `tHaSync_` logs a name Salesforce gives or changes, once, since the tab keeps only the newest. The Agents tab shows
    the history on every named client, with a **Reassign to…** list for whoever names agents. The board's card shows
    it under "Named:" (`c.hist`).
  - **Each agent's line**: households, clients, a progress bar, spoken to, nothing logged, last activity, the median days
    to first contact, feedback, comments, when they were named and where, and TT$200 claims. Agents on the Skill Bank
    with no clients are named under the table. An agent opens on their households, client by client. The "nothing logged"
    tile opens every quiet client.
  - **The households to name come in six batches** (`bt`), the most pressing first:
    - *urgent*: an open call-back, or an answer at `T_AGV.URGENT` (80) or more. Waiting past the line alone is not
      urgent, since nearly everyone who asked has;
    - *finish the family*;
    - *asked us*;
    - *answered or reached*;
    - *not answered yet*;
    - *letter held*.

    Each household carries one suggestion (`sg`): the family's own agent first, else what `tSuggest_` gave its members.
    Held clients get theirs from a second `tSuggest_` pass, seeded with every naming and suggestion the board already
    made.
  - **Naming from the batches.** One press names a household. "Assign these N to <agent>" names a batch by suggested
    agent, and one press names the whole batch each as suggested. Households can also be ticked. Each naming goes as
    `assign` requests of at most 40 clients, so the brief, the Salesforce write and the introduction rules are the
    board's own. Since 14 October `transitionAssign_` takes a client of the books the board does not show (a letter held
    or not sent), for the branch only, as an `/assign` row. Staff still name only their own board's clients.
  - In the 13 October export: 2,168 households, 17 clients named (15 in Salesforce), and nothing logged by any agent.
    The batches held 151 urgent households, 257 that asked us, 236 answered or reached, 1,313 not answered and 197 with
    every letter held.
  - **Tests** in the scratchpad: `agv14/agents-harness.js` (51 checks, Node, the 13 October export, Salesforce mocked
    for the sync) and `agv14/agents-test.js` (47, Playwright, staff and a phone included).
- **The board on film: one film per sign-in** (14 October 2026: "there's three videos. There is what the agents see,
  there's what the staff see, and there's what management sees"). `orphan-transition/board-films.html` plays the three,
  and the board's menu links each person to theirs ("The film: the board for you").
  - *The board, for management* (`boardmgr`, 2:21): Urgent, the Agents tab, conversations and conversion, since the
    naming, households in batches, one press, reassign with the history, what a naming does, a unit manager's team.
  - *The board, for Client Support* (`boardstaff`, 2:09): Your calls, opening a client, Log call and the call-back
    flag, take details and never advise, the Salesforce task, naming a household, reassigning, Your work.
    The Salesforce scene was added on 15 October 2026, when the manager asked whether the films showed everyone what
    is expected: every step on the task's Chatter the same day; a no answer is a try, not a close; a task closes only
    with a note of who was spoken to and what was agreed; it stays open until the agent is named; and the standard
    "no questions or concerns" e-mail is never the close for a client who asked for something. Those rules are what
    the routine's late-client follow-ups chase.
  - *The board, for agents* (`boardagent`, 1:48): your list every day, opening a client, Log call, comments, what
    counts, two days to a conversation, the branch sees it.
  - *The client transition, start to finish* (`boardflow`, 3:48, `board-workflow.html` and `.mp4`), added 16 October 2026
    for everyone ("where is the revised video to post that will guide all on the revised process, workflow etc so all
    will understand and take the test"). It is the storyboard approved the day before, one client from the letter to the
    TT$200: the letter, the answer or Client Support's call, the three rules, the household named, families the records
    missed, what a naming does, the agent's call, the service record, Log call, the Salesforce task, the claim and the
    10:00 list, what the branch sees, the seven outcomes (`workflow.html`'s O section, in its order), and the training
    page. It sits first on `board-films.html` (`#start-to-finish`), at the top of `training.html` above the sign-in, under
    the title of `workflow.html`, and in the board's Help ("The film: start to finish, for everyone"). It draws six
    visuals of its own (`letter`, `family`, `record`, `claim`, `outcomes`, `test`), and a scene may carry `role` to show
    another sign-in's board (its Client Support scene does). The test scene shows the question as grey bars, never a
    question from the private sheet. If a rule in the workflow changes, re-voice the line that says it.

  Each is a page drawn by `tools/film/build-boardfilm.py <key>` from `<key>-lines.json` and `<key>-timing.json`
  (`orphan-transition/board-management.html`, `board-client-support.html`, `board-agents.html`), recorded and mixed
  into `board-*.mp4` with a poster `board-*.jpg` beside it. The board's screens are drawn, not captured, with made-up
  names and numbers, and every motion lands on the word that names it: the timing file holds each spoken word's start
  from edge-tts's WordBoundary events. To re-cut one, edit its lines, run `voice-lines.py <key>-lines.json <vox>
  --changed-only --timing <key>-timing.json --films films.json --key <key>`, write the word timings back into the
  timing file, then `build-boardfilm.py`, `sfx.py`, `usetrack.py audio/inspired-kevin-macleod.mp3 <key>`,
  `render.js <page> cap-<key> 30 <poster>`, `mixany.py` with the vox copied to `tools/film/vo<key>`, and `chapters.py`.
  - **The look, twice** (14 October 2026: "can i have more graphics and motion and the colors scheme changed"; the
    manager chose the group client management look, corporate blue. 15 October 2026: "can i have a differnt colors
    and more motion and a bigger impact"; shown four looks on the same three frames, "i like the purple", "the yellow
    logo needs to change", then "no leave dark blue instead and have the logo as well blue"): **midnight blue**.
    - **Colours and type:** near-black navy `#070F26` ground, the corporate blues `#13408F`, `#1D5BC4` and `#2A6DE0`
      for actions and bands, electric cyan `#00E5FF` for progress and highlights, light blue `#BFD3F7` for quiet
      text, the board's white windows floating on it with a blue rim, and IBM Plex Sans (`tools/film/fonts/`, SIL
      Open Font License beside it). The side column reads in white; inside the windows the ink stays dark (the
      `--ink`, `--slate` and `--mute` tokens are re-set on `.sd` and on `.cue`).
    - **The mark:** `tools/film/board-mark.png`, the shield and check white on a blue tile (see the mark section
      above; the board pages carry the hosted copy `orphan-transition/board-mark.png`). Red only for "nothing
      logged", and every status as a word as well as a colour.
    - **The motion:**
      - scenes zoom through: the new scene opens a little larger, bright and soft, and sharpens as it settles, while
        the one it replaces pulls away and dims behind it (the page script marks it `out` for the hand-over, and
        `render.js` clears it at 720 ms), and a streak of light crosses the cut;
      - headlines land a word at a time, each from large and soft to sharp, with the key words underlined as they
        land; the chapter headlines are larger (48, 74 and 54 px);
      - the screen floats and turns in 3D (±8°), a glare passes over the glass every six seconds, and a camera
        pushes in on what the voice names, under a spotlight that dims the rest;
      - a cursor (a finger on the phone) presses each button;
      - counters, donuts and a day-by-day track fill, and **every counter lands on a punch in the sound**: the
        builder writes each counter's second into `films.json` as `hits` (and the chapter scenes as `dark`), which
        `sfx.py` plays;
      - an aurora drifts behind every scene, and the chapter scenes run rings and motes on blue.
  - **Nothing is placed by hand.** The cursor, the clicks, the spotlights and the camera name a selector, and the page's
    own script finds it when the scene opens, so a new font or layout cannot leave them pointing at the wrong place.
  - **Rendered, not recorded.** With that much motion, Playwright's real-time capture ran unevenly. Its timeline stopped
    being a straight line, and `mixany.py` matched 7 of 12 cuts and refused the film, as it should. `tools/film/render.js`
    renders the page frame by frame instead: every animation is paused and set to the frame's own moment, and the
    outgoing scene stays until the band has crossed it. It writes `cap-<key>/rendered.mp4` and `rendered.json` (lead 0,
    stretch 1). `mixany.py` takes that exact timeline only when `rendered.json` is there. A real-time capture is still
    measured and still refused when its cuts do not fit.
  - **The shell's own class names leak into the scenes.** The film shell (`donthaveanagent/client-film.html`) styles
    `.stage`, `.ph`, `.drop`, `.tk`, `.ring`, `.prow`, `.url`, `.hot`, `.mt`, `.tick` and others, so the board films use
    their own names (`.bstage`, `.phn`, `.dropl` …). `build-boardfilm.py` now refuses to write a page whose scenes use a
    class the shell already styles; the first cut rendered a phone toast as a second phone.
  - **edge-tts pins certifi's certificate bundle**, so on the session proxy it fails with "self-signed certificate in
    certificate chain" whatever SSL_CERT_FILE says. A wrapper that points `certifi.where` at `/root/.ccr/ca-bundle.crt`
    and runs `edge_tts.util.main` works (kept in the scratchpad, not the repository).
- **The stream: the campaign on a screen anyone in the room may see** (8 October 2026: "I need to stream the wall
  without the confidential information and drive further analysis of how the automations and humans are managing and
  what the clients are saying, group by households"). `orphan-transition/stream.html`, ten slides on a cycle:
  - households: how many answered, how far the ones that asked have got, and the family members still to reach;
  - the automations: letters, reminders, receipts, what was held for a person, replies filed, bounces, what runs now;
  - the people, then who did what, on the board and in Salesforce;
  - day by day;
  - what clients are saying, and what they asked for and wrote about;
  - signals by household;
  - the agents;
  - what stands out.

  **Its answer carries counts and nothing else.** `tStream_` in Transition.gs builds it, and it holds no client's name,
  number, token, address, e-mail, phone, words, policy or money, no household's name and no former agent's name. So the
  screen, a call it is shared on, and the page's source show nothing about any client. A client's own words are read by
  the script for their subject only (`T_STREAM_THEMES`) and never leave it. The team appears by first name and initial
  (`tShortName_`), because what the people did is half of what the stream is for.
  - **Access.** It opens with the branch code, through the board's route as `action=board&who=stream`, so Service.gs
    needs no paste. A script older than the stream reads "stream" as a person, finds nobody and refuses, so it never
    sends the board for it. The page then says to paste Transition.gs.
  - **Definitions.** The words mean what they mean on the board's Dashboard tab (dSpoken, dTried, dDone). A household
    counts as far along as its least-served member who asked.
  - **Caching.** The answer is kept like the wall's (`tServeCached_`, three minutes fresh).
  - **Tests.** `wall8/stream-harness.js` in the scratchpad looks for every client name, first name, surname, token,
    number, e-mail, phone, address, household name, former agent's name and every piece of client words in the answer
    on the real tabs (46 checks). `wall8/stream-look.js` (32, Playwright) checks every slide fits a television and
    nothing runs off a phone.
  - **Never add a client's anything to it.** If a slide needs a name, it belongs on the wall or the board, behind the
    same code, not here.
- **The daily findings to Head Office** (8 October 2026). Head Office had written to the branch formally about one
  client's response. The manager asked for "a daily update on our findings and frame for him to advise what are they
  doing, as these are the documented findings from the clients by responses and support staff contacting them; no
  agents have been on calls as there is a process tracked daily".
  - **What it is.** `tFindings_` and `tFindingsSend_` in Transition.gs send one e-mail each working day at 17:00
    (`T_FIND.HOUR`). It goes from support@, signed by the manager, copied to him, and replies go to his Guardian address.
    It sets out what clients have reported about their former agents, from two sources only:
    - the clients' own answers and replies to the letters;
    - the calls Client Support and the manager made, read from every caller's tab of the Client Support calls sheet
      (`CALLS_SHEET_ID` Script property, read only).
  - **What each finding carries.** Every finding has its date, its source, the former agent and the client's number.
    It never carries the client's name: the client's own name, any other client's name, phone numbers, e-mail addresses
    and links are scrubbed from the words.
  - **How it reads.** First the frame (Client Support are not licensed, give no advice, and no agent has been on these
    calls). Then what is new: the words in full, and the ticks as counts per former agent. Then everything by former
    agent, then how it was documented, then what the branch asks the Company to advise. Everything to date travels as a
    CSV.
  - **How a finding is filed.** A note is filed under what it is about (`T_FIND_KINDS`) only when it names that client's
    own former agent. So "Akaash is his agent" or a note about an agent from years ago is never one.
  - **The Findings Log tab.** It keeps each finding with the day it first went, so each day's e-mail lists only what is
    new.
  - **What is left out.** The terminated agent's book (T, T1) stays out while the branch's hold stands
    (`INCLUDE_HELD`): its findings are counted in one line, never listed. The address is the `FINDINGS_TO` Script
    property, never in this public repository.
  - **Switching it on.** Nothing goes until `transitionFindingsStart`. `transitionFindingsPreview` sends one to the
    manager alone and marks nothing.
  - **Tests.** `findings8/findings-run.js` in the scratchpad covers it (32 checks, on the 8 October tabs and calls sheet).
- **The team sees it first.** `orphan-transition/team-review.html` before any
  letter reaches a client; then the roster of receiving agents by town, from
  the ticks on the Team Feedback tab.
- Never send the branch a link to any of this before the branch is merged to
  `main`. A 404 in the WhatsApp group has happened once already.

## Group client management — the employers' weekly service report

Built 7 October 2026 ("staff logs in … on the days that we send off clients
group, they actually see the groups that they assign … when they click send,
they can preview the template … all of these things are logged … the group
logs in with the code and sees … the task, but underneath can read the
comment, verify if it's correct … the manager's login view … the ratios, the
responses, and the star ratings by staff … it builds into the group
management wall"). `GROUP-CLIENTS-SETUP.md` has the steps.

- **Live, not a weekly static build.** A project built elsewhere generated
  code-locked pages once a week from a GitHub Action and published them on
  Netlify. It was replaced the same day: its setup moved
  rickyrampersadbranch.com to Netlify (which would have taken every other page
  off the air), its register of group names and contacts was a public file,
  and a static page cannot show each person their own groups, send and log a
  letter, or read and post Chatter. `apps-script/GroupClients.gs` does it in
  the Service Questionnaire project, routed by two lines in `Service.gs`
  (`gcm.*`), signing staff in through `tWho_` like the assignment board,
  reading Salesforce through `ServiceSalesforce.gs`, sending through
  `tMsSend_`. The pages under `groupclientmanagement/` hold no client data.
- **The group tabs have their own spreadsheet, the script does not.** Asked
  the same day ("if this is the sheet for managing groups why import into the
  service questionnaire"): `Group Register`, `Group Tasks`, `Group Increases`, `Group Milestones`, `Group Sends`,
  `Group Responses`, `Group Shares` and `Group Queue` live in the **Group Client Management**
  Google Sheet. The script stays in the Service Questionnaire project, where
  the sign-in, the Salesforce login, the support@ mailbox and the web address
  are, and opens the group sheet by the `GCM_SHEET_ID` Script property
  (`gcmSS_`), never by an ID in the code. Without it, the tabs are looked for
  in Service Questionnaires. The register (group, Salesforce account ids,
  list bills, match words, contact, code) is built in the session scratchpad;
  its codes and the group names never enter the repository, its comments or
  its docs.
- **Salesforce signs in with client credentials, as the KPI Tracker does.**
  On 7 October 2026 the KPI Tracker's Script properties held `SF_KEY`,
  `SF_SECRET` and `SF_LOGIN_URL` and no `SF_USER` or `SF_PASS`: the org has
  retired the username-password flow. `ServiceSalesforce.gs` signed in only
  that way, so the Service Questionnaire project could never reach
  Salesforce. `svcSfAuthMode_` now picks client credentials unless `SF_PASS`
  is set (`SF_AUTH` forces either), and `svcSfReady_` needs only the key and
  the secret for it. Copy the three values; the login URL must be the My
  Domain address. With them, everything in the project that waited for
  Salesforce switches on (the trace a review runs, the Client Profile
  refresh, the assignment sync, the board's tasks); the TT$200 claims still
  write nothing until the go.
- **Who looks after a group is its account owner in Salesforce, and nothing
  else** (7 October 2026: "read who is the account owner in Salesforce instead
  of a spreadsheet"). The refresh writes Owner in Salesforce and Owner active
  onto the register as a mirror; there is no override column, so the board and
  Salesforce never disagree. A group on two accounts takes the first active
  owner. An owner who is no longer an active user (two groups' owners were, on
  7 October) puts the group first on the manager's "To act on", and the
  group's page never names them.
  **A staff member is matched to the owner by e-mail, then by name**
  (`gcmMine_`, `gcmSameName_`). The same afternoon the first staff member to
  sign in saw an empty board: she is "SASHA LALLA" on the Agent Skill Bank
  and "Sasha Lalla-Jagassar" in Salesforce, and the names were compared
  whole. The refresh now writes the owner's Salesforce e-mail onto the
  register (Owner e-mail), and a name matches on the same first name with
  every other part of the shorter name inside the longer. A first name
  alone matches nothing. Letters and Chatter notes are signed with the name
  as Salesforce has it (`gcmSigner_`), and a group's answer is e-mailed to
  the owner's Salesforce address.
- **Every staff member sees every group; only the owner, the deputy and the branch
  manager change one** (13 October 2026: "all staff are able to see other members'
  groups via a filter … and they can see all the tasks. So your dashboards need to
  be very interactive from the entire team"). The board lists all groups, each
  marked `own` and `canAct`; a staff member opens on "Mine", with chips for
  Everyone and each colleague, and a second row by where a group stands (to
  approve, approved, sent, past target, needs a reason, waiting on the group, not
  ready), remembered on the device. Everyone has the Team dashboard, and every
  tile, person and group on it opens the groups behind it. A colleague's group
  opens read only: its items, Chatter, history and letter preview, but no
  approving, no ticking what the group sees and no note for the group
  (`gcmNotYours_` says who can). Anyone may leave a **comment for the team** on
  any item: it goes onto the task's Chatter headed with the writer's name, is
  logged on Group Shares as Kind `comment`, shows on the board as "Team comment ·
  never shown to the group", and can never be shared, not even by the owner. The
  **deputy** is the assistant branch manager ("she needs to approve more or less
  some, she can comment"): an Assistant Branch Manager on the Agent Skill Bank,
  or anyone the `GCM_DEPUTIES` Script property names by name or agent number,
  the property so that naming her changes nothing on the other boards. She acts
  on every group as its owner would, her approval is logged in her name with
  Role `deputy`, and the letter is still signed by the staff member who looks
  after the group; the rehearsal and "Send now" stay the branch manager's. A
  unit manager's view of an agent's group was asked for and set aside the same
  day ("forget Akash for now"). `teamview/team-test.js` (26 checks) and
  `teamview/team-page.js` (18, Playwright) in the session scratchpad cover it.
- **A group's answer reaches staff three ways, and stays on "To act on" until it is dealt with** (13 October 2026:
  the manager could not find Dansteel's answer of 12 October). It is filed on Group Responses and posted to the
  task's Chatter, and `gcmTell_` e-mails the account owner, copied to sales support alone (`GCM.TELL_CC`; asked for
  the same day: "to the account owner and copy the Ricky Rampersad sales support"; the branch manager is no longer
  copied and sees every answer on the dashboard), as "Group review in: …". That e-mail went by
  Gmail alone and a failure was swallowed: Dansteel's never went. It now goes from support@ first, Gmail second; one
  that cannot go is kept (`GCM_TELL_FAILED`) and named to the branch on the dashboard, and `gcmTellAgain` (the
  editor's Run button, the last three days) sends it again. An answer marking an item "Needs a change" or "Not ours"
  is first on "To act on" for fourteen days, until the item is closed or a note for the group follows on a later day.
  The "group answers this week" tile opens "What groups told us". **The stars are required** ("ensure the star
  rating is pressed"): the page will not send until one to five is tapped, and `gcmReview_` refuses an answer
  without one; Dansteel's, the first, had none. `answers/answers-test.js` (21 checks) and `answers/client-page.js`
  (5, Playwright) in the session scratchpad cover it.
- **The letter goes to the account's Contact Person in Salesforce** (7 October
  2026: "there is a contact on the account with an email, why is it she is not
  able to send?"). Until then only the register's To was read, and it was
  filled for two groups of seventeen, so most staff could not send at all. The
  refresh reads `Contact_Person__r` on each account (else the account's own
  `Email__c`) and mirrors it onto the register as Contact in Salesforce,
  Contact e-mail and Contact greeting; the register's To counts only for a
  group with neither, and its Cc still applies. Its Greeting applies only
  when it names the person the letter goes to (`gcmGreetsName_`): on 13
  October 2026 a letter to the Contact Person opened with the first name of
  the register's old To, which a staff member caught in the preview. Several accounts'
  Contact Person carries a personal mailbox, and the letter carries the
  group's access code, so the page and the preview name the address, say
  where it came from and point out a personal one; staff tick that they
  checked before it goes.
- **A group signs in with its list bill and its code, both.** The list bill is
  printed on every bill and known to the employees, so it is the name, never
  the password. List bills live on the policy records (`List_Bill__c` on
  `CLIENT_PORTFOLIO__c`), typed several ways ("TGM 1099", "TGM1099"):
  compared as letters and digits only. The account fields `List_Bill_Life__c`
  and `List_Bill_Pension__c` are empty on all but one account.
- **What a group sees.** Never a member's health or a claim (`GCM_PRIVATE`),
  and a health reimbursement is a claim whatever its subject says: the first
  live refresh carried "Reissue Cheque (health)" with a member's name, which
  the words medical and claim did not catch.
  Items on its account, its billing records (`TRANSACTIONS__c`) or naming it:
  shown unless staff untick. Items reached only through an employee's own
  policy or contact: hidden unless staff tick. Chatter only when staff tick it
  or write a note for the group from the page. A group's answer goes onto that
  task's Chatter.
- **Match words start a word; a single word must end one.** SOQL `LIKE`
  matched one group's short match word inside a medical term and put another
  person's medical requirement on that group's page (`gcmNames_`).
- **Logged e-mails and the birthday flow are not work.** They were 615 of the
  groups' 1,176 completed tasks in 2026, and 62 of one group's were birthday
  wishes to its staff; counted, they show an on-time record the work does not
  have (`GCM_LOGGED`). "On time" counts only tasks with a due date, and the
  dashboard shows average days beside it because a due date can be moved.
- **A recurring series of tasks is never a group item** (22 October 2026). A staff member could not send a group's
  letter: an internal reminder on its account, set up in Salesforce as a recurring task in January 2025, counted as an
  item the group sees open more than 30 days, and Salesforce refuses any Chatter post on a recurring series
  ("INVALID_CROSS_REFERENCE_KEY … a recurring series of tasks"), so its reason could never be written. Salesforce's own
  search does not show a series either. The refresh now reads `IsRecurrence` and leaves a series out, as it does a
  logged e-mail (the org held 11 open series that day); the tasks made from a series are ordinary tasks and stay. A
  note or team comment Salesforce refuses now says so in plain words (`gcmFeedRefused_`); for a series, untick "The
  group sees this item", which lifts the 30-day rule on it. `day/series-test.js` in the scratchpad covers it (12 checks).
- **Salesforce takes a subquery only at the top of a WHERE, never inside an
  OR**, so the refresh asks five ways (account, billing, name, employees'
  policies, employees' contacts) and keeps a task once. Every query goes
  through the composite resource (`gcmQuery_`), so a long one never meets URL
  Fetch's limit on an address. Salesforce ids are unique in their first 15
  characters; everything is keyed on those.
- **The letters go by themselves at 10:00 on Monday; staff approve, they do
  not send** (8 October 2026: "as we have automated our queries will now
  change to a monday at 10am to go out to client"). Until then Tuesday was send
  day and each staff member pressed Send. Now a staff member checks a group
  during the week, previews its letter, ticks that they checked and presses
  **Approve for Monday**. That writes a row on the **Group Queue** tab (When,
  Group, Staff, the items they saw, their opening line), and the group reads
  "Approved" on the board and the wall. At 10:00 on Monday `gcmMondaySend`
  (a weekly trigger, made by `gcmSetup` or by the first hourly run that finds
  none) refreshes Salesforce and then rebuilds each approved letter, so the
  group reads Monday's figures. It sends from support@ through Graph. A letter
  waits, with the reason, when:
  - the group is no longer ready;
  - a letter already went since the approval;
  - an item open more than 30 days still needs a reason;
  - **an item arrived that the approver never saw**. The letter goes only with
    what a person checked.

  One internal e-mail a run tells the branch, and whoever approved a waiting
  letter, what went and what waited. The hourly refresh runs the same queue
  afterwards, so a missed 10:00 firing goes at 11:00, and a group approved
  again after ten on a Monday goes that hour. An approval made after Monday
  10:00 is for the next Monday. Approving again replaces the earlier one, and
  "Cancel the approval" withdraws it. Whoever looks after the group, the deputy
  and the branch manager can still send at once ("Send now", or Outlook; until
  14 October 2026 the branch manager alone); doing so closes that group's approval.
  The group is asked to answer by Friday. Every letter is logged on `Group
  Sends` with the letter itself. `gcmlive/queue-test.js` in the session
  scratchpad covers it (26 checks).
  **The run can be rehearsed** (11 October 2026: "i want to test before going to me and the team today at 10am").
  `gcmQueueRun_({ test: true })` writes every letter approved for the next run exactly as the run would, with the same
  checks, and sends each only to the person who approved it and `TRANSITION.CC`, subject `[TEST] …`, with a banner
  naming who would have received it. One summary, subject `TEST · Group letters …`, lists what would go, what would wait
  and the groups not approved yet. Nothing reaches a group, nothing is logged on Group Sends and no approval changes, so
  the real run is untouched. The branch manager presses **Rehearse now** on the staff page (`gcm.rehearse`, branch
  only; the board says `canRehearse`). In the editor, `gcmRehearse` runs it now and `gcmRehearseAt10` sets a one-off
  trigger for 10:00 that day (`gcmRehearseTick`, which removes itself). `gcmlive/rehearse-test.js` (25 checks) and
  `staffvid/rehearse-page.js` (6, Playwright) in the scratchpad cover it.
- **Every open item says why it is still open** (7 October 2026: "when the
  client sees the opened task shall we not give some history why opened so
  long, to use intelligence", then "you need to scrub emails with the subject
  line"). Salesforce's feed tracking is on for tasks: `TaskFeed` with its
  `FeedTrackedChanges` gives the target date first set, each real move of it
  (each change is written as three rows: old to new, new to blank, blank to
  new), the status changes and the hand-overs. Each billing record's
  `EmailMessage`s are the item's e-mails; on an account, only those with the
  task's own subject line once Re:, Fw:, DRAFT: and FINAL DRAFT: are set
  aside (`gcmSameSubject_`). The refresh keeps both per open task in the
  History and Mails columns (`gcmHistories_`, `gcmMails_`) and `gcmStory_`
  writes the line and the history. **The group sees only e-mails to or from
  its own contacts** (`gcmToGroup_`: the register's To and Cc, or their
  company's domain, never a public one): the branch's own notices, drafts to
  the manager and forwards stay with staff. The manager chose the target
  "first set for X, now Y" for the group, never the count of moves, which
  staff see. **An item the group sees, open more than 30 days, needs a note
  for the group shared in the last 30 days before the letter goes**
  (`gcmNeedsReason_`; Preview and Send both refuse until then). **Draft with
  AI** (`gcmDraft_`, `gcmClaude_`) sends the item's facts, e-mail subject
  lines and internal Chatter to the Claude API (`claude-opus-5-5`, effort
  low, `fallbacks: "default"`), at the manager's choice, with the key in the
  `ANTHROPIC_API_KEY` Script property; the draft is never shared until a
  person edits it and presses Post. A health or claim item gets no draft.
- **No one sends a group a letter before the manual and the test** (8 October 2026: "a staff manual as well
  as a test … before they start … with weighting, with building in the performance appraisal, the taking
  initiative to try to solve things, the follow up … all results logged with a feedback").
  `groupclientmanagement/training.html` holds the manual (nine sections until 26 October, fifteen since) and the test; the staff page links to
  it. The questions, their answers and their marking guides are in the private **Group Client Training**
  Google Sheet (`GCM_TRAIN_SHEET_ID`), never in the repository, because the site and the `.gs` files are public:
  the page gets the questions without answers, and `gcmTrainSubmit_` marks them. Written answers are marked by
  the Claude API against the Rubric (structured output, the answer fenced as data, never an instruction) and
  stay provisional until the branch manager confirms them (`gcmTrainMark_`). The competencies are the
  appraisal's: each question's Points are its weight. A pass needs 80%, every critical question right and no
  competency under 60%. Every attempt is a row on that sheet's Results tab and an e-mail to the person and the
  manager (`GCM_TRAIN.TO_MANAGER`), never the sales support inbox, because a result is an appraisal. The bank
  was written so that the right answer is never the longest option and the answers spread across A to D; keep
  it that way when adding questions. The standards the manual sets that were not set before (an
  acknowledgement within a working day, a call within two working days for a rating of 3 or less, and a call
  or e-mail before the next approval to a group that did not answer) are proposals for the manager to confirm.
- **The training programme, revised for billing and for roles** (26 October 2026: "a very detailed training
  program that will cover the billings, step-by-step … with questions and answers, as well as the weekly task
  report revised. Kamla is overseeing the task. She has a role … so everyone has a responsibility").
  - **The manual is fifteen sections**: the job; who does what (Branch Manager, Branch Manager's Assistant, the
    support team, the system, and a table of who does, checks and is told at each step); the week; the six
    checks; escalations; the billing calendar (the next six billing and report days, worked out by
    `gblBillDayOf_` and `gblReportDayOf_`, so re-check them with the script when the holiday list changes); the
    eight billing steps; the Guardian forms; what the group sees on its three tabs; writing to the group;
    follow-up; the audit trail (what is recorded where); initiative; fourteen practice questions with their answers
    (not the test's); the appraisal. The device key is `rrb-gcm-train2:` so everyone reads the revised manual
    afresh.
  - **The test is by role.** The group course now filters by the bank's Roles column like the orphan course
    (`gcmTrainFor_`): the support team take `staff` questions, the Branch Manager's Assistant, a deputy and the
    branch manager take `manager` questions, and `all` is everyone's. A bank with no Roles column still gives
    everyone everything.
  - **The bank was rewritten** (`roles26/bank26.py` in the scratchpad: 41 rows, 35 for the support team, 16 for
    the managers, the right answer never the longest, the answers spread A to D). The live sheet still asked about
    "Tuesday's letter" and "Letter due". It went to a new private sheet, "Group Client Training (private: test
    questions and answers) · revised 26 Oct 2026", and `GCM_TRAIN_SHEET_ID` must be pointed at it. The earlier
    attempts stay on the old sheet's Results tab.
- **The Branch Manager's Assistant signs in under her own role** (26 October 2026: "Kamla is overseeing the task.
  She has a role, so she's logging in her role"). `gcmWho_` reads her role on the Agent Skill Bank
  (`gcmIsBma_`: "Branch Manager Assistant", "BMA", "Branch Manager's Assistant") and makes her the deputy with no
  Script property, titled `GCM_ROLE_TITLE.bma`. Every answer that carries the role now carries `title` too, and the
  staff page, the billing door and the training page show it ("Branch Manager’s Assistant", "Support team",
  "Branch Manager"). Her approvals are still logged with Role `deputy`. `roles26/bma-test.js` in the scratchpad
  covers it (12 checks), `train26-test.js` the test by role (11) and `page26.js` the page (17, Playwright).
- **The new-way films** (26 October 2026: "a video that will go to the clients on our new process moving forward, a
  video for the staff on the new process forward … very short … a new initiative of the Ricky Rampersad branch … this
  will go viral … motions and graphics … sample data").
  - **For groups: `/groupmgt/client/`** (`groupmgt/client/index.html`; `/groupnewway/` and `/groupmgt/` forward to it), "Our new way of looking after your group", 1 min 23 s:
    `groupclientmanagement/new-way.mp4` (wide, 1920x1080) and `new-way-phone.mp4` (upright, 1080x1920, for Reels,
    Status and Stories), with posters `new-way.jpg` and `new-way-phone.jpg` and the share card `new-way-card.jpg` for the
    Open Graph preview. A phone held upright opens on the phone cut; buttons switch. Ten scenes: the promise, the Monday
    report, the three tabs, the bills on the 26th, the people, the forms, the stars, the named team, and a call to action
    on the branch number for employers who are not clients yet. No staff name is spoken or shown.
  - **For staff: `/groupmgt/staff/`** (`groupmgt/staff/index.html`, kept out of search) plays `groupclientmanagement/staff-new-way.mp4`, 2 min 53 s, also first on the training page: who does what
    (the Branch Manager, Kamla as the Branch Manager's Assistant, the support team, the system), the sign-in, the week,
    10:30, the month, the billing day, the eight steps, the cut-off and its reason, the audit trail, Kamla's oversight,
    test mode, the training and the test.
  - **How they are made** (all in the scratchpad, `films26/`): `lines.json` (the words), voiced on the `tts-run` runner
    as Andrew Expressive (`en-US-AndrewMultilingualNeural`, +0%) with the Whisper check, keys `gcmc` and `gcms`;
    `shots.js` (the real pages on the made-up branch, `people/setup.js`, with the Drive folder linked so no warning
    shows); `timing.py` (scene times from the audio, word times from edge-tts); `engine.js`, `film.css`,
    `cfg-gcmc.js`, `cfg-gcms.js` (every frame a function of t: kinetic headlines, devices that float and pan to the
    named box, rings and taps on the word, counters, drawn lines, push transitions, captions that light word by word);
    `render.js <film> <h|v>` (frame by frame at 1.5x); `mix.py` (the branch theme `rr-branch-theme.mp3`, looped with a
    crossfade past two minutes, 16 dB under the voice, -14 LUFS). The late-reason screen comes from an older capture,
    cropped to the dialog with the attached file's name painted out, because that name was a real group's.
  - Re-cut when the pages change: re-run `shots.js`, then `render.js` and `mix.py`. The figures, people and groups on
    screen are all invented.
- **The staff film** (8 October 2026: "do a video and a waht app message to guide staff what to do as this is the way
  forward"). `groupclientmanagement/staff-guide.mp4` (2:42, with the poster `staff-guide.jpg`) is at the top of the
  training manual. It covers the week: sign in, the test, your groups, check, reasons, what the group sees, preview,
  Approve for Monday, the 10:00 run, a letter that waits, the group's page, their answers, the branch's view.
  - **What is on screen.** It is shot from the real pages over a made-up branch: five invented groups and invented
    people, tagged "Sample groups and figures" on every shot. It shows no client, no real count and no test question.
  - **Sound.** Narration on `en-US-AndrewNeural` at -12%, the Inspired bed 18 dB under the voice, loudness -14 LUFS.
    The credit is on the closing card and under the player.
  - **How it is made.** Everything is in the session scratchpad (`staffvid/`):
    - `demo-world.js`: the made-up branch;
    - `shots.js`: screenshots and element boxes;
    - `lines.json` and `tts.py`: the narration;
    - `timing.py`: scene times from the audio;
    - `film.html` with `render.js`: frames rendered one by one, so no capture drift;
    - `mix.py`: the soundtrack.

    Re-shoot it when the pages change.
  - **Part 2, what the group sees** (10 October 2026: "show also the video what the client see and the flow of
    communication"). `groupclientmanagement/group-view.mp4` (1:57, poster `group-view.jpg`) sits under the first film in
    the manual. It shows the loop as one picture (the letter on Monday, their answers by Friday, the e-mail and Chatter
    back to staff, staff acting, the next letter). Then it follows the group: the letter in their inbox, sign-in, their
    items, the history, Correct / Needs a change / Not ours, the stars, the thank-you, the internal e-mail that reaches
    the staff member, the answer on the staff page, and the manager's view. It is built the same way as the first film
    (`shots2.js`, `lines2.json`, `timing2.py`, `film2.html`, `mix2.py` in `staffvid/`). `group-loop.png` there is the
    loop picture alone, for the group chat.

- **The welcome: one e-mail to each employer, with the film** (13 October 2026: "with the video embedded so to
  greet the employer in a new way of managing their account … test with me first as this is supposed to pop").
  - **The film is the employer's own cut**, `groupclientmanagement/welcome.mp4` (2:26, poster `welcome.jpg`), on
    its page `welcome.html`. The staff film's part 2 speaks to staff ("their answer comes straight to you") and shows
    the staff page and the manager's dashboard, so it is never sent to a group. The employer cut is voiced to the
    employer, on a sample group with made-up figures and invented people. It covers:
    - the letter;
    - the sign-in;
    - the applications and increases pending, and what is coming up for their people (both added 14 October);
    - the items, the history, the answers, the stars and the thank-you.
  - **Re-cut with motion, 14 October 2026** ("can the video be revised and add animation as well motion built in?").
    Every frame is a function of its time, rendered one by one, so nothing drifts:
    - push transitions between sections, and dissolves between phone screens;
    - headlines whose words rise into place, and a phone that floats;
    - a finger that travels to each button and taps it, with a ripple, the screenshot switching to the pressed
      state on the tap;
    - a spotlight that dims all but what is being described;
    - counters that run up, a dot that travels round the weekly loop, and a closing checklist that ticks itself;
    - captions that follow the voice a sentence at a time.

    Built in the scratchpad (`welcome4/`):
    - `world4.js`: the sample;
    - `shots4.js`: before and after each tap;
    - `lines4.json`: four new lines, eleven kept;
    - `timing4.py`, `film4.html` (`film4.js`, `film4.css`), `render.js`, `mix4.py`;
    - `card.js`: the poster and `welcome-card.jpg`.

    Encoded at CRF 23 for the web: 14 MB. `GCM_WELCOME.LENGTH` reads "2 min 26 s"; change it with the film.
  - **The film to post: `/groupwelcomevideo`** (14 October 2026: "can this be streamed on the rickyrampersadbranch page
    as groupwelcomevideo, need to post this").
    - `groupwelcomevideo/index.html` plays the same `welcome.mp4`; it streams because the server answers byte ranges.
    - It carries Open Graph and Twitter tags, so a posted link previews with `welcome-card.jpg`, the title and the
      description.
    - It has a door for a group client (the service page) and one for an employer who is not one yet (the branch's
      number).
    - Re-cut the film and this page follows.
  - **No mail app plays a film inside an e-mail** (Gmail and Outlook strip a video tag), so the e-mail carries the
    film's first frame with a play button, `welcome-card.jpg`, hosted, opening `welcome.html` in one tap.
  - **It carries the sign-in** (14 October 2026, at the manager's word: "yes please fix this"). Until then it said
    "Your sign-in comes with your Monday letter", and three groups welcomed that day had never had one; the first
    wrote back within half an hour that she could not open her page. The welcome now gives "Open your service page",
    the list bill and the access code in the same blue box as the Monday letter. It still goes only to a group a staff
    member checked, to the Contact Person, never to one of our own addresses.
  - **It is signed by the staff member who verified the group** (14 October 2026: "it has me as the branch manager,
    the letter must have verified by the staff who clicked verified"). `gcmWelcome_` signs it with the verifier
    (below), says "I look after your account" when the verifier is the account owner and names the owner otherwise,
    carries the green "Checked against our records by …" label, and gives the group its year with us so far (below).
    `gcmWelcomeList_` picks the groups: ready for a Monday letter, **verified**, written to the Contact Person, never
    one of our own addresses, never twice, never a group named in the `GCM_WELCOME_SKIP` Script property. A group
    nobody has verified waits; the Group Sends Staff column is the verifier.
  - **The branch manager gets the test first**: `gcmWelcomeTest` (editor Run) sends him one welcome as a group would
    get it, marked TEST, with who would and would not get it. `gcmWelcomeNow` then sends it at once (chosen the same
    evening, to all eleven ready groups), or `gcmWelcomeAt9` / `gcmWelcomeAt6` by itself at 9:00 / 18:00 (today if
    the hour has not come, else tomorrow; asked for on 13 October: "triggered tomorrow at 9am but wait until I give
    instructions", so nothing is set until one is run); `gcmWelcomeCancel` stops a scheduled one, and the scheduled
    run does what `gcmWelcomeNow` does. From support@ only; without Microsoft 365 nothing goes.
    `gcmWelcomeNow` also sets the `GCM_WELCOME_ON` Script property: from then on the hourly run (weekdays, 8:00 to
    17:00) welcomes a group within the hour of a staff member approving it, says nothing when there is no one to
    welcome, and the approval toast tells the staff member it will go signed by them. `gcmWelcomeStop` ends that.
  - Each welcome is logged on Group Sends with Status "welcome sent". The weekly run passes those rows over, so a
    welcome never counts as that week's letter. One internal summary goes to `TRANSITION.CC`.
  - **Sales support is a visible copy on every group e-mail** (14 October 2026: "sales support is not being copied").
    It had been a blind copy, which reached their inbox but showed on nobody's copy of the e-mail. `gcmCc_` puts
    `GCM.COPY` in Cc on the welcome, the Monday letter, Send now and Send again, beside the register's Cc, each address
    once. The e-mail itself sits in support@'s Sent Items.
  - `welcome/welcome-test.js` in the session scratchpad covers it (29 checks, with the verifier and the 9:00 run).
- **The verifier is whoever approved the letter, and every letter says so** (14 October 2026). It is the newest
  approval on Group Queue that was not cancelled (`gcmVerifier_`): the person who ticked that they checked every item
  and pressed Approve for Monday, the branch manager included when he approves. The name is written as Salesforce has
  it when the verifier is the account owner (`gcmVerName_`, through `gcmSameName_`), else in title case, never the
  Agent Skill Bank's capitals. The Monday letter keeps its signature (the staff member who looks after the group) and
  adds the same green label under it, naming who checked it and when (`gcmVerifiedLine_`, `gcmVerifiedHtml_`); the
  label is a tinted label with a tick, never colour alone.
- **The year with each group: what we did, the trend, and what the records suggest** (14 October 2026: "show how we
  are servicing the client account for the year and spot opportunities and trends on tasks closed year to date and by
  type"). `gcmYear_(g, today, forStaff)` reads the Group Tasks tab, which already leaves out logged e-mails and the
  birthday flow:
  - **By month**, items completed this year for the company, and apart from them those for employees' own policies
    (`level` member). A member's health or claim never reaches the group's view, not even as a count; staff see the
    count. On-time counts only items with a target date.
  - **The trend** compares the last 91 days with the 91 before, in counts and in average days (only with three items
    on each side), as sentences of fact, **for staff only**. The group gets the months and the totals, never the
    comparison: fewer items in a quarter can be a group that asked for less, and on the first real run the welcome
    would have told an employer "5, against 19 before … up from 28 days".
  - **What the records suggest** (staff and the branch only, never the group), most time-critical first: a notice of
    non-renewal in the last year; a renewal within 120 days (from the effective date in the subject, else a year on
    from when last year's renewal work began); premiums late, in arrears or queried; premium-due notices on employees'
    own policies, which point at payroll deductions; three or more joiners; individual pension plans taken through the
    employer; Group Life or Health work with no pension work on file, Life with no Health; three or more leavers;
    nothing logged in 90 days; items taking a week longer than before; three or more health and claims items; an open
    Salesforce Opportunity. Never advice, only what the records show.
  - **The words in a subject that fooled the first cut, read on the real tasks:** "Renewal Date m/d/yyyy" on a
    payment is the monthly billing date, never a renewal, and "Courtesy Reminder" is an employee's own health plan
    (`GCM_YEAR.NOT_RENEW`); "Payment Received" is the monthly receipt, not a late premium (`GCM_YEAR.PAY`). Real
    renewals read "Group Health Renewal", "Feb 1st Renewal Letter", "Notice of non-renewal".
  - **Where it shows:** the group's page on the staff board ("The year with this group": tiles, the months as a chart
    with a table under it, the trend, by service, the Salesforce task types, the opportunities); the group's own page
    ("Our service record for you this year": the company's months and a line for the employees); the welcome; and the
    dashboard's "The year so far" (`gcmYearAll_`: every group's months, each category, each group with its last three
    months against the three before, tap to open, and every opportunity with its group and owner).
  - The charts are one series in the action blue, with the value on every column and the same numbers in a table.
  - `year/year-test.js` (32 checks) and `year/page-shot.js` (12, Playwright) in the session scratchpad cover it.
- **Every account on the team dashboard, and send or resend from the page** (14 October 2026: "the team dashboard so
  staff can view all the accounts and owners and they can also have the ability to resend or send … this has to pop
  and be a wow experience for the staff, client", then "a much more professional look, filters and scaling and colors
  for visibility").
  - **Every account** opens the Team dashboard (`accountsHtml`): four meters (welcomed, approved or sent for Monday,
    answered, ready), one toolbar (a search over group, owner, contact and list bill; who looks after it; the order;
    where it stands, each with its mark; "Showing N of M" and Clear filters), then one row an account: the owner, who
    the letters go to (a personal mailbox marked), the welcome, this week's letter, the last answer with its stars, and
    the buttons. A coloured rail says where the row stands, with a key under the table: red, something is due from
    us; amber, it needs setting up; green, welcomed and this week's letter approved or sent. Every state is a word as
    well as a colour. `gcmAccount_` in `gcmBoard_` is the row's data. The Groups tab takes the same toolbar, and the
    greeting and the week's numbers sit in the masthead.
  - **The send window** (`openAct`): the e-mail exactly as it goes, who it goes to and from where, who signs it, a
    tick, the button; then a tick mark naming who it went to and when. Three things go from it, for whoever looks
    after the group, the deputy and the branch manager (a colleague's group stays read only):
    - this week's letter: Approve for Monday or Send now (`gcmSend_`, no longer the branch manager's alone; the same
      checks as an approval; the opening line of a waiting approval is kept);
    - the last letter again (`gcmResend_`), exactly as it went, under a line saying when it first went, to the
      contact as Salesforce has it now. Group Sends keeps each letter's HTML in a new **Html** column (`gcmSheet_` adds
      it to an older tab by name, once); a letter sent before 14 October has none and is sent fresh instead. Logged as
      `resent: …`, never counted as the week's letter;
    - the welcome, or the welcome again (`gcmWelcomeSend_`), signed by the person who ticks and sends it, logged as
      `welcome sent` or `welcome resent`.
    Nothing goes to one group twice inside ten minutes (`gcmJustSent_`), and every send is a row with who pressed it.
  - **A group's own page** opens on who looks after them, the film, when their next letter comes and when they last
    answered; the year in four tiles; the three answers with their own marks; a progress track; and a thank-you that
    names them and says what happens next.
  - `wow/actions-test.js` (31 checks), `wow/after.js` (24, Playwright) and `wow/showcase.js` (screenshots) in the
    session scratchpad cover it, on the made-up branch.

- **Who opened their page, and a daily reminder to rate** (15 October 2026: "deep dive in all the group … who viewed it … If a group have
  not rated us the stars, we need to automatically send … a reminder. They have viewed it, but they have not rated"; then "if they
  have not responded, it's a daily run until we get a response referencing the email we sent").
  - **The sign-in log.** Until then nothing recorded a group opening its page, and an answer was the only sign of one. Every
    sign-in is now a row on the **Group Views** tab (`gcmViewLog_`), at most one per group each half hour:
    - when it was;
    - the name that device last answered under;
    - phone or computer;
    - whether it came from a letter, the welcome or the reminder (each e-mail's link carries `?from=`).

    A sign-in needs the list bill and the code, which are never in a link, so a mail scanner cannot make one. Nobody knows who
    opened a page before the paste.
  - **Where each letter stands** (`gcmRateState_`): rated; items answered with no stars; opened with no answer; or no answer yet.
    Only answers and sign-ins after the last weekly letter count.
  - **The reminder** (`gcmRateMail_`): one every working day, from the day after the letter, until the group responds. It is signed by
    whoever looks after the group. Its subject is the letter's own ("Reminder: Your weekly service report: …"), and it opens by
    naming the e-mail it follows, by its day and subject, and the last reminder before it. Then its words follow what we know:
    - "thank you for going through your items … one thing was left: your rating";
    - "thank you for opening your service page";
    - or "our letter of Monday set out where each of your items stands".

    It carries five stars, each a link that opens the page with that star chosen (`?rate=`). Nothing is recorded until the
    group signs in and presses Send. It also carries the sign-in and the Friday date, and goes from support@ with sales
    support in visible Cc. It is logged on Group Sends as "reminder sent", which the weekly run passes over.
  - **A response ends it.** A rating on the page is a response. So is any e-mail to support@ since the letter from the group's
    contact or its company's domain (`gcmMailIn_`, `gcmRateInbox_`). A group that wrote is owed a person's reply, not another
    automatic e-mail. An automatic reply ("out of office") pauses it two days. A run that cannot read support@'s inbox reminds
    nobody. A new weekly letter starts it again, for that letter.
  - **When it waits:**
    - the group rated, or wrote to us since the letter;
    - no weekly letter has gone, or the letter went today;
    - it was reminded today already;
    - any e-mail went to it in the last 20 hours;
    - the letter went to an address Salesforce no longer names as the contact (`gcmRateMoved_`). The dry run on the real
      tabs found one group whose Contact Person had changed since its Monday letter. The new contact would have been told
      about a letter, and a code, they never had. Send the letter again, or the welcome, first.
  - **The go.** `gcmRateRemindTest` (editor Run) sends the branch manager one of each kind, marked TEST, with who would get it,
    who rated and who would not. `gcmRateRemindNow` sends it now to every group on the list. It also sets `GCM_RATE_ON`, so
    from then on each group that has not responded gets one reminder a working day. Since 21 October that is in the 10:30
    group day (below), not the hourly run. `gcmRateRemindStop` ends that. A group that never answers gets its Monday letter
    and up to four reminders a week.
  - **The staff page:**
    - the accounts table's "Opened · rated" column;
    - filters for "Not rated their last letter" and "Opened their page";
    - a "Remind to rate" button (or "Remind again") for whoever looks after the group, the deputy and the branch manager;
    - "Who opened their page" on a group's own page.

    A failed reminder is logged as failed and goes on the next run.
  - `rate/rate-test.js` (60 checks), `rate/page.js` (19, Playwright) and `rate/real/dry.js` (the real tabs and the replies in
    support@, nothing sent) in the session scratchpad cover it.

- **10:30 every working day: the group day** (21 October 2026: "emails are supposed to be triggering with insights to
  clients for a response if they got the email but did not provide a rating, as well an email to the respective staff to
  provide a response as to why this week's email was not approved so it could have sent out at 10am on Monday, reference
  the training … done at 10:30am daily", then "a task is opened for the respective staff as this pertains to task type
  Lic/HR … as this is a KPI"). Until then neither part ran: the star reminder was never pasted, and nothing asked staff
  anything. `gcmDay_` runs once a working day from a 10:30 trigger (`gcmDay1030`). The hourly refresh runs it from 11:00
  to 16:00 if 10:30 did not fire (`gcmDayCatchUp_`), and `GCM_DAY_LAST` keeps it to once a day. In order:
  - **On a Monday, the queue first.** Any approved letter the 10:00 run has not reached goes, so it is never called missed.
  - **The star reminder** (above), for every group that had a letter and has not rated or written, with the reminder's
    own summary folded into the day's.
  - **Each staff member whose group had no letter this week is asked why** (`gcmChaseList_`, `gcmChaseMail_`). A group
    misses the week when it was ready and no weekly letter went since the Monday run. The e-mail gives:
    - each group, with why it did not go (not approved, approved after the run, or held at the run with the reason) and
      what to do today;
    - the groups that did have their letter, and what came back from each;
    - the groups that cannot have one yet, and what is missing;
    - three passages of the training manual (Friday is the day to approve; Monday 10:00 the letters go; no answer by
      Friday means a call). They are quoted in `GCM_DAY.TRAIN`; change them with the manual.

    It asks for a reply by 12 noon, goes from support@ with the branch manager copied, and replies go to him. A group
    whose owner is not an active Salesforce user goes to the branch manager. A group approved for this week's run and not
    yet sent is never asked about.
  - **A Salesforce task for each group that missed the week** (`gcmChaseTasks_`), because the reason is a KPI:
    - Task Type `Lic/Staffing/SA/HR`, owned by the staff member, on the group's account, Priority High, Not Started, due
      that day;
    - subject `RR/<NAME> - GROUP LETTER NOT SENT - <group> - week of <Monday>: reason needed`, the branch's own pattern;
    - closed by the staff member with the reason.

    The owner is found by e-mail among **standard** users only: the branch manager's address is also on four site guest
    users, and a task must never go to one. One task per group per week, remembered in `GCM_CHASE_TASKS` and checked
    against the tasks already in Salesforce, so a run again by hand or a lost property never opens a second.
    `gcmExcluded_` already treats the type as internal, so the task never reaches a group's page.
  - **One summary to the branch manager** (`gcmDaySummary_`): how many ready groups had the week's letter, each that
    missed with its owner, its reason and its task, what came back from those that had one, each star reminder, and
    who was asked.

  **The go.** `gcmGroupDayTest` (editor Run) sends the branch manager every e-mail as it would go, marked TEST, and opens
  no task. `gcmGroupDayStart` turns on the star reminder and the staff e-mails and tasks, makes the 10:30 trigger, and
  runs today. If the project has no trigger left, it says so, and the hourly run takes the day at 11:00.
  `gcmGroupDayStop` ends all of it. `gcmRateRemindNow` also makes the 10:30 trigger, for the star reminder alone.
  **A busy lock is tried again** (22 October 2026). The script lock is the whole project's, and on the first live run
  (21 October) the hourly refresh held it: the summary read "Busy: the letters or the refresh are running", and no
  group was reminded that day. The reminder now tries again after the staff part, and failing that the hourly run tries
  it from 11:00 (`GCM_RATE_RETRY`), with its own summary to the branch; the staff are never asked twice.
  `day/day-test.js` (46 checks) and `day/real/dry.js` (the 21 October tabs, test mode, nothing sent) in the session
  scratchpad cover it. On those tabs one staff member would have been asked about five groups and another about one.

- **Applications and increases still pending are the first thing a group sees** (14 October 2026: "when the groups log in they should
  also see at the top … applications that remain pending … the name, days outstanding, who it's assigned, what's
  outstanding … pension groups, health groups and life groups … and who was last liaised with").
  - **What counts.** An open task of type `Pendings` (the branch's own mark for one), reached the way the refresh
    reaches any group task. The word "pending" in a subject does not count. The refresh reads each task's policy
    (`gcmApplications_`) and writes the line, the applicant, the application date and who the task is with into a new
    **Application** column on Group Tasks.
  - **The line** is the policy's record type: LIFE(GROUP) reads Group Life, HEALTH (GROUP) Group Health, PENSION
    Pension. **A policy on the employer's own account is the employer's application, whatever its type**, and reads
    as its type ("Life"). On 14 October, 34 of the branch's open Pendings tasks sat on policies, and only one was a
    group type: 11 were keyperson applications, ordinary LIFE policies a commercial client owns on the lives of the
    people who run it.
  - **Kept off a group's page:**
    - a task reached only through an employee's own contact;
    - one on an employee's individual policy tied to the group only by its list bill;
    - a claim;
    - anything a person unticked.

    When a run cannot read the policies' types, every policy-reached task is kept off.
  - **A medical requirement** reads "An underwriting requirement: the details stay between the person insured and us",
    with neither the doctor nor the department beside it ("Guardian Life" only). `GCM_APP.MED` is wider than
    `GCM_PRIVATE`, because the keyperson tasks read "LABS at …" and "physician(s) consulted". Staff see the subject,
    marked.
  - **The group's page** opens on the panel, under the welcome and above everything else. It shows one card an
    applicant, oldest first, with:
    - the lines, each a word with a mark, and a filter for each;
    - the days outstanding from the application date, as a word and a colour, and "past target";
    - each requirement with who it is assigned to, who it is liaising with ("(you)" for the group's own contact),
      its status in the group's words, its target date and its last contact. The last contact is an e-mail to or
      from the group, else "Last worked on", else "Opened on …, nothing logged since".

    The requirements are listed there and not again among the open items.
  - **Staff** get the same panel at the top of a group's page, unredacted, with what the group cannot see marked. They
    also get a chip on the account row, and an "Applications pending" filter on the Team dashboard.
  - **The Monday letter** says how many are pending and the oldest, never a name.
  - **Increases still pending sit on the same cards** (asked for the same day: "it's important on the increases on the
    pension plans … on the object called increases … once it's not settled, it's pending"). An increase is a
    `Policy_Increases__c` record on a policy. It is pending until **Date Settled** is filled in, unless it reads NPW
    or not proceeded with. The refresh writes them to a **Group Increases** tab of their own (`gcmIncreases_`), so
    they never swell a group's open items, its year or the dashboard.
    - Which ones: any increase on a policy on the group's own account, and a pension or group policy tied to it by its
      list bill, because the employer's payroll deducts it. An employee's own life policy tied only by the list bill
      stays off.
    - Only an increase submitted in the last `GCM_INC.DAYS` (365) counts. The branch has used Date Settled only since
      2024, and about half the increases since then never had one entered, many reading Premium Paying with their
      production picked up. Staff see those marked "Date Settled is empty: if it is done, enter it in Salesforce",
      and entering it takes the increase off the group's page at the next refresh.
    - What is outstanding on an increase is the open tasks on the increase record. Salesforce's Requirements object
      holds six records on increases ever. Support (a first name) is read as the one active Salesforce user who
      carries it. Days outstanding are Days O/S, never fewer than the days since it was submitted.
    - The group reads "Pension increase", where it stands (waiting to be settled, requirements outstanding, with
      underwriting, being corrected, awaiting settlement), who has it, when it was submitted and the last contact. It
      never sees an amount. Staff also see the policy number, the amount, the agent and whether it came through the
      list bill, and can take an increase off the group's page with its tick box.
    - On 14 October there were 13 unsettled increases in the last year on employer accounts (7 life, 5 pension, 1
      personal accident), and 12 on employees' own pension plans.
    - When Salesforce refuses the read, the tab keeps the last good list, and the refresh says so.
  - A backend older than this sends no `pending`, and both pages leave the panel out.
  - `pending/pending-test.js` (50 checks) and `pending/page.js` (21, Playwright, phone and desk) in the session
    scratchpad cover it, on the made-up branch with an invented keyperson case and six invented increases.

- **Coming up for the group's people: conversions at 65, dependents coming of age, retirements within five years**
  (14 October 2026: "a person … their dependent is coming of age to convert. We need those letters. Those will be
  included in the weekly reports … approaching age 65 … convert to an individual plan … pension plans, five years
  prior to retirement, tasks will be opened … future value projections … what is company owned pensions, and what is
  individual owned pensions … insights the group can actually see and we can manage for clean data").
  - **Where it comes from.** The refresh reads the group's in-force Group Life, Group Health and pension policies, on its
    account or its list bill (`gcmMilestones_`). The date of birth is the policy's, else its contact's. It writes a
    **Group Milestones** tab: one row a person and event, plus a summary row per group.
    - *Turning 65* (`convert65`): within 183 days, or the last 60.
    - *A dependent reaching the dependent age* (`dependent`): `GCM_DEP_AGE`, default 21, which the branch confirms.
      Dependents come from Relationship Groups (Child 1–3, Dependent 1–3) and from Dependant 01–04 on the group's own
      billing records. Salesforce holds few: on 14 October, 119 billing records and 62 relationship groups named one.
    - *Retiring within five years* (`retire`): the date is Maturity Date, else Retirement Age, else `GCM_RETIRE_AGE`
      (default 60), assumed and marked. On 14 October 85% of in-force pensions had no retirement age.
      - **Company-owned or personal** comes from Ownership, else from the account's type: a commercial or business
        account is the company's, a household the person's own. Ownership was blank on 96% that day.
      - That day: 120 company-owned and 128 personal pension members aged 55 to 65, and 5 group life or health members
        within six months of 65.
    - *No date of birth* (`nodob`): a person to put right in Salesforce.
  - **The group** sees, under the pending panel, three columns, soonest first, each with how long until it:
    - turning 65: "we help them convert to an individual plan";
    - dependents coming of age;
    - retirements on its **company** pension.

    Under them, "Help us keep your records right" names anyone with no date of birth. It never sees a personal pension,
    an e-mail, a policy number, a task or an assumed age.
  - **The Monday letter** counts them and lists each one (who, what, when), ten at most.
  - **Staff** see all of it, including:
    - personal pensions, marked;
    - the assumed ages;
    - each person's e-mail;
    - the projection task's state;
    - the clean-data counts.

    The account row says how many are coming up.
  - **Pension projection tasks.** One opens in Salesforce for each retirement within five years: on the policy, owned
    by the group's account owner, Task Type Servicing, due in 30 days, subject `Pension projection: <name> retires
    <date> at <age> (company-owned | personal pension)`. An assumed age says so and asks for the real one.
    - They open only after the branch manager's go: `gcmLifeTasksStart` (editor Run); `gcmLifeTasksStop` ends it.
    - At most 25 a run. A task already on the policy with that subject is found each run, so none opens twice.
    - Until the go, the board lists who would get one.
  - Letters to the members themselves (the conversion and the dependent's move) are not built yet.
  - When Salesforce refuses the read, the tab keeps the last good list, and the refresh says so.
  - `coming/coming-test.js` (32 checks) and `coming/page.js` (11, Playwright) in the session scratchpad cover it, on
    the made-up branch.

- **Billings Management: the monthly bills checked against Salesforce before they reach a group** (24 October 2026:
  "on the 26th the billings go out … create a section called Billings Management as well include in this section
  Terminations and Enrollments", then "the staff log in … upload the group health, then life, then pensions if any and
  do the reconciliation … the client has a list bill so it pulls the pension … using intelligence and data to guide",
  then "it should be an experience … it guides them what they have to check … it verifies our Salesforce records …
  scrubs all the open tasks … scrubbing the inbox … comments on the task, and it goes on to Chatter … on the client's
  side … the group health, their billing, the group life in the tabs, the billing, and the group pensions plus any
  concerns"). `apps-script/GroupBilling.gs` (a fifth file in the project; `gcm.bill*`, `gcm.claimsUpload` and
  `gcm.clientTell` routed from GroupClients.gs), `groupclientmanagement/billread.js` (the readers) and
  `groupclientmanagement/billing-ui.js` (the staff page's review). `GROUP-CLIENTS-SETUP.md` has the steps.
  - **The bill is read on the staff member's device**, never kept by the backend: `BillRead` turns Guardian's Group
    Health invoice (summary, outstanding balances, member detail, credits and adjustments, transmittal), the Group Life
    member bill, its Statement of Adjustment and its covering letter, and the branch's own pension and life list bill
    (a spreadsheet, or built from the policies carrying the list bill in Salesforce) into figures and member lines.
    pdf.js and SheetJS come from cdnjs. Checked on the first real October bills: every member premium ties to the
    rates, the members add to the totals, the three life documents combine to the letter's amount.
  - **The checks (`gblCheck_`)**, each a finding with its level (fix, check, note, ok) and whose it is (Salesforce,
    Head Office, the group, us): the month's `TRANSACTIONS__c` record and its amount (one press patches
    `Group_Billing_Premiums__c`); the arrears the bill shows against `Payments__c` and `Payments_Made__c` (a month the
    bill shows unpaid that Salesforce has paid goes to Head Office, not the group); every member on the bill against
    the group's `HEALTH (GROUP)` / `LIFE(GROUP)` policies, matched on the employee id's first two parts or the cert
    number, then by name (`gblSamePerson_`, which reads "QUAN KEP ; KEITH" and "QUANKEP, KEITH" as one person); who
    joined, left or changed tier since last month's stored bill; each back-charge and statement adjustment against the
    tasks on file, with "Open a task" where none is; the life rates and the 31-day rule; the list bill against the
    policies tagged with it (not tagged, tagged but not listed, premiums that differ, paid-to dates behind); payments
    keyed long after they were made. On the first real group: Salesforce was 1,430 short on health and 614 high on
    life, a joiner since August had no record, 43 records in Salesforce were live for members no longer on the bill,
    and the pension list disagreed with Salesforce on four policies and six premiums.
  - **Reconciled is a person's tick** (`gblAct_` `reconciled`): fixes open block it unless the branch forces; the
    Salesforce record is marked `Reconciled__c` and the line's billing task gets the note on Chatter
    (`gblPostBilling_`: the task whose subject carries the month, else the line's newest open billing task).
    **Send** (`gblSend_`) goes from support@ with the PDFs attached (base64 from the page, under 3 MB each) and a cover
    note; **test mode until `gblGoLive`** (`GCM_BILL_LIVE`): to the staff member and the branch, marked TEST. Logged
    on Group Sends as `bill sent` / `bill test`, which `gcmLoad_` keeps apart (`g.billSends`), never the weekly letter.
  - **The claims experience** (`gblClaims_`, `gblExperience_`): the claims summary is aggregated by month and
    division in the browser, so no patient's name reaches the sheet; plan years are cut where the monthly premium
    steps up `GBL.RATE_JUMP` and stays (the renewal lands on the March or April bill, not January). Staff see the loss
    ratio by plan year; the group sees what the plan paid by calendar year and how many claims, never a ratio.
    On the first real group: 82% in 2023, 98% in 2024, 90% on the old rates, 43% in the eight months since a 40%
    increase; 89% of claim money is processed within 30 days of service, 99% within 60.
  - **The AI read** (`gblAi_`, `gcmClaude_`): the findings with every name taken out (`aiText`), the Salesforce
    figures and the task ages; answers where / first / careful / say. Staff only.
  - **The group's page** (`gblClientBlock_` on `gcm.client`): one tab a line with the latest sent or reconciled bill
    as figures and counts, twelve months of billed and received, the open billing items, what they told us, and for
    health what the plan paid by year. **Tell us** (`gblClientTell_`): a payment, a joiner, a leaver, a dependent or a
    question, filed on Group Changes (Source `client`), posted to the billing task's Chatter, e-mailed to the account
    owner; a joiner or leaver opens a Salesforce task for the owner (`gblOwnerId_`: a standard, active user by e-mail,
    never a site guest user).
  - **The place to comment, and a task for the owner with guided prompts** (24 October 2026, on the first sample: "NOT
    SEEing the place for comment … can the person open a task? and assign to the owner with guided prompts?"). Every open
    billing task sits under its own line (`blLineTasks`, by the record type in its subject; the rest at the foot), with its
    Chatter, a comment box, one-tap prompts (`blCmt`: chased Head Office, the group confirms paid, waiting on the group,
    corrected in Salesforce, checked against the bill, a question by a date; the [blanks] are selected to overtype) and a
    tick, on by default, that tells whoever has it: the comment goes through Connect with the owner @mentioned
    (`gblNoteTask_` with `notify`, a plain FeedItem when Connect refuses) and they get an e-mail from support@
    (`gblCommentMail_`); never e-mailed to themselves. **Open a task** on every finding, on every line and at the foot opens
    a four-step panel (`blTaskPanel`): what it is about (`BL_TASKS`: a member to add, a termination, a tier change, a
    dependent, a payment to trace, an amount to correct, a back-charge to query, a rate query, something to ask the group,
    something else; the finding suggests one, `blKindOf`), who should act (`gblPeople_`: the account owner in Salesforce
    first and chosen by default, then everyone on the Agent Skill Bank who is staff or a manager with an active standard
    Salesforce login, by e-mail; never an agent, never a site guest), by when (the kind's working days, Normal or High), and
    what they need to know (the kind's prompts, a note template with the check's facts). The subject is written in the
    branch's pattern ("Group Health Termination – <name> – <group> – effective <date>"). `gblTaskOpen_` (act `task`)
    refuses a [blank] left in, a note under 20 characters or a past date; opens the Task on the account, owned by the
    person, Servicing, with who opened it and why; logs it on Group Changes as the enrolment or termination it records
    (`GBL_TASK.CHANGE`), else as `task`; notes it on the line's billing task; resolves the finding ("Task opened for …");
    and e-mails the person from support@ (`gblTaskMail_`, never to oneself). The guide asks for a word on every open
    billing task. Covered in `billing/billing-test.js` (75) and `billing/page-test.js` (69).
  - **The change form EB0010, filled from our records and sent to EB Customer Care; the owner's task chased on Chatter
    every three working days** (24 October 2026: "the form uploaded called GROUP AND INDIVIDUAL POLICY CHANGE FORM is
    filled as we do have the data and always sent to EBCustomercare@myguardiangroup.com and copy
    rickyrampersadsalessupport@myguardiangroup.com as well support@rickyrampersadbranch.com", then "when a client wants
    to terminate they should be able to search the name and all the data mapped onto the form populated as it's pulled
    from our data … all data should be on the forms exactly", then "a task is opened assigned to the account owner to
    advise to follow up if no response on Salesforce, this is automated by Chatter comments every 3 working days").
    Guardian's form is EB0010 (2024/3), found on the renewal reminders in support@; `gblFormHtml_` reproduces it section
    by section (the policy number, A the insured, B the termination, C dependents to add or remove, D the address, E the
    beneficiaries, F the plan administrator) with the form's own boxes, and `gblFormPdf_` renders it to PDF.
    - **The member is searched, never typed** (`gblMembers_`: every Group Health and Group Life policy of the group, by
      its accounts and list bills, in one query, with the dependents from Relationship Groups in a second, kept ten
      minutes; `gblMemberSearch_`: every typed word starts a word of the name, the policy or the certificate, live
      members first, twelve at most). Section A fills from the record: name, date of birth, e-mails, telephones, address,
      the plan and its issue date. **What Salesforce does not hold is listed as "not on record", never guessed**
      (`d.missing`): marital status is on no record; a dependent fills only where the member has a Relationship Group,
      and on 24 October 2026 no group member had one, so dependents are typed. The signatures stay blank, with a line
      that the signed and stamped copy follows on request. Only the effective date and the kind's own facts block a
      send (`d.blocking`); the plan administrator is prefilled from the group's contact.
    - **Where**: the group's own page ("Terminate or change a member": search, pick, the kind, the details, preview,
      send, with a tick that the person is authorised; `gcm.clientForm` and `gcm.clientFormSend`, routed in
      GroupClients.gs) and the staff billing review (the "Change form EB0010" button in Record a change and a Form button
      on every register row; acts `members`, `form`, `formSend` through `gblFormAct_`). A group is never shown the
      beneficiaries on file.
    - **The send** (`gblFormSend_`): from support@ to `GBL_FORM.TO` (EB Customer Care) with `GBL_FORM.CC` (sales support
      and support@) and, when ticked and not one of our addresses, the group's contact; subject
      `EB0010 Policy Change Form – <group> – <member> – <kind>`; the PDF attached; then `gblChange_` logs it on Group
      Changes (the new **Form** column keeps the HTML; `gblSheet_` adds the column to an older tab) as the leaver,
      dependent, address, beneficiary, bank or plan change it is, opens the owner's task and notes the billing task.
      **Test mode until `gblGoLive`**, the same switch as the bills: to the staff member (or the account owner, for a
      group's submission) and the branch, marked TEST.
    - **The chase** (`gblFormChase_`, in the 10:30 group day; `gblFormChaseNow` and `gblFormChasePreview` from the editor):
      every Group Changes row whose Note begins `form: sent` and is still open. Its task closed in Salesforce closes the
      row. A reply at support@ from a Guardian address that is not ours, after the send, whose subject carries every word
      of the member's name marks it `answered` and is noted on the task. Otherwise, three working days after the send or
      the last follow-up (`GBL_FORM.CHASE.DAYS`), a Chatter post headed "Branch Intelligence · <date>" goes on the task
      with the owner @mentioned (a plain post when Connect refuses) and the owner is e-mailed; the fifth and last
      (`MAX`) goes to the branch manager. The day's summary lists them under "Change forms with EB Customer Care".
    - Covered in `billing/billing-test.js` (106) and `billing/page-test.js` (90, the group's flow on a phone and a desk).
  - **The forms are Guardian's own PDFs, filled exactly; enrolments and the ACH form join** (24 October 2026, the same
    evening: "forms have to be exactly on the forms I've uploaded to you. Enrollments, everything. It needs to be exact").
    The HTML rendering of EB0010 is retired (`gblFormHtml_` stays only as the fallback when Guardian's PDF cannot be
    read). The blank forms live in the repository at `groupclientmanagement/forms/` (`GBL_PDF.FILES`: EB0010 2024/3 and
    GIO001 V.1/10-2016, both fillable PDFs from Guardian); a file of the same name in the Drive folder the
    `GCM_FORMS_FOLDER` Script property names wins (`gblFormFile_`), so a new edition from Guardian is a file swap, and the
    sent copies go to its "Sent forms" subfolder with the link on Group Changes (`gblKeepSent_`; without the folder the
    Form column just names the PDF). **The EASI Collect form has no blank yet**: the copy uploaded on 24 October was a
    filled one, so it is not in the repository; `EASI-Collect.pdf` goes in the Drive folder (or the forms folder on the
    site) when a blank arrives, and until then the EASI flow says which file is missing and sends nothing.
    - **How a PDF is filled** (`gblPdfFill_`): pdf-lib (cdnjs, or a `pdf-lib.min.js` in the Drive folder) is loaded with
      `new Function` under a Promise that settles at once (`gblSyncPromise_`) and a `setTimeout` that runs its callback
      at once, because a web app cannot await and pdf-lib only ever waits on the CPU; the whole fill runs inside one call
      (about 0.1 s). Text goes into the form's own fields (`setText`, the size fitted to the box between 6 and 11 pt),
      checkboxes are ticked, radio groups selected, and on a flat form the values are drawn at measured positions
      (`draw`). Nothing is flattened, so EB Customer Care can still correct a box. Apps Script's bytes are signed:
      `gblU8_` and `gblSigned_` convert both ways.
    - **The maps.** `GBL_EB0010` names each of EB0010's 119 fields (random names, mapped box by box from the form); the
      account number is drawn into the printed cells (`accountCells`). `GBL_GIO001` uses Guardian's own field names and
      radio options. `GBL_EASI` holds the positions on the flat EASI form. The uploaded "Change of Dependent Status" form
      is EB0010's 2019/10 edition, which the 2024/3 edition covers, so it is not used.
    - **Enrolment** (`gblEnrolData_`, `gblGio001Fill_`, `gblEnrolSend_`; acts `enrol` / `enrolSend`; the group's page
      with `form=enrol`): what the group types goes onto GIO001 section by section; the group's own policy numbers are
      read off its members' certificates (`gblGroupPolicyNos_`, the part before the first dash) and can be typed over;
      a name, date of birth, gender, a coverage, the effective date and the administrator block a send, the rest is
      listed as not given. The cover note lists what follows from the employee (`GBL_ENROL.FOLLOWS`: the Declaration of
      Insurability, the ID copy, the bank statement header, the signatures). It is logged as a joiner, opens the
      owner's task and is chased like any form.
    - **EASI Collect** (`gblEasiData_`, `gblEasiFill_`, `gblEasiSend_`; acts `easi` / `easiSend`; `form=easi`): the
      member is searched as for a change, Section A fills from the record, the account, its type and the ID are typed;
      an enrolment or change needs all three, an ending needs none. Logged as a bank change.
    - **One send path** (`gblSendPack_`): the cover note, test mode, the register row, the owner's task and the kept
      copy are the same for every form; the subject is `<code> <title> – <group> – <member> – <kind>` (EB0010 keeps
      "Policy Change Form", which the chase's reply matching reads).
    - **The pages** draw the PDF page by page with pdf.js (`pdfPages` on the group's page, `blPdfPages` on the staff
      page) and offer the PDF to download; both have the three forms as pills (`CF.form` / `BF.form`), the enrolment as
      a sectioned form (`ENR` / `BL_ENR`), and the EASI fields after the member is picked.
    - Tests: `billing/billing-test.js` (122, the real blank forms from the repository and the EASI copy from the
      scratchpad placed in a mocked Drive folder) and `billing/page-test.js` (99, pdf.js from the vendor copies); the
      harness (`gcmlive/env-sq.js`) mocks `DriveApp`, serves the site's forms from the repository and pdf-lib from the
      scratchpad. `forms/gas-sync.js` there is the proof that pdf-lib runs under the synchronous Promise.
  - **The billing day: the 26th at 10:00, or the next working day; approved by staff, sent by the system, reported on the
    25th at 13:00, chased at 10:30** (24 October 2026: "on the 26th group billings go out and weekly on a Monday at 10am
    the queries go out but staff has to approve". On 25 October it went to a Tuesday for a few hours, so a client would
    never have the weekly letter and a bill on one morning, and came back the same day: "I would leave it for the 26th of
    the month, excepting when it falls on a holiday or a weekend … We get the billings on the 25th, but on the 25th, we
    check it and verify it. And on the 26th, it's sent out … on the 25th in the afternoon, I get the report … So at 1
    o'clock, I have a report"). `GBL_DAY` in GroupBilling.gs:
    - **The day** (`gblBillDayOf_`): the 26th (`GCM_BILL_DAY` moves it, 1 to 28), and when that is a Saturday, a Sunday
      or a public holiday, the next working day (`gblWorkingDay_`): Mon 28 Sep, Mon 26 Oct, Thu 26 Nov, Mon 28 Dec 2026
      (Boxing Day is a Saturday), Tue 26 Jan, Fri 26 Feb, Wed 31 Mar 2027 (Good Friday, the weekend, Easter Monday and
      Spiritual Baptist Liberation Day in a row). When the 26th is a Monday (26 October 2026) the bills and the weekly
      letters both go at 10:00 that morning; that was accepted.
    - **The holidays** (`GBL_DAY.HOLIDAYS`, `gblHolidays_`): Trinidad and Tobago's, the fixed ones as MM-dd and the
      moveable ones by date for 2026 and 2027 (the same list as `Claims.gs`; add each year's in January), plus the
      `GCM_BILL_HOLIDAYS` Script property (yyyy-MM-dd or MM-dd, comma separated) for any day the branch is closed. A
      holiday on a Sunday is kept on the Monday after (Divali 2026, Boxing Day 2027); a Saturday one is not. Read once a
      run.
    - **A late bill goes the next working day** (`gblNextRunDay_`): an approval before the billing day's 10:00 run is for
      that day; one made within `LATE_DAYS` (14) after it goes at 10:00 the next working day (today, before 10:00 on a
      working day), so it never waits a month; one made later is for the next billing day. A late run is not a billing
      day: nobody is chased on it.
    - **The report on the 25th** (`gblBillReport_`, `gblReportRows_`; `gblMondayReport_` is kept as its old name for a
      GroupClients.gs pasted earlier): at 13:00 (`REPORT_HOUR`) on the 25th, or the last working day before it when the
      25th is not one (`gblReportDayOf_`: Friday 23 October 2026, Thursday 24 December), while the staff are still in (the
      first goes home at 2), from the hourly refresh, once (`GCM_BILL_REPORT_LAST`). Every billed group by the staff member
      who looks after it: each line where it stands (nothing uploaded, to fix, not reconciled, reconciled not approved,
      approved for which day, held, sent), who worked it (uploaded by and when, reconciled by, approved by; "nobody yet"
      in red), and what is left before 10:00. Tiles: ready, with work left, not started. To the branch manager, the staff
      copied; internal, sent in test mode too. Editor: `gblBillReportTest` (to him alone, marked TEST, recording
      nothing), `gblBillReportNow`.
    - **A browser can tell which version is live**: `?action=gcm.ping` carries `bills` (the next billing day, the report,
      live or test, the Drive folder linked). A GroupBilling.gs older than the 26th answers no `report`; with no
      GroupBilling.gs at all, `bills` is 0.
    - **Approve** (`gblApprove_`, act `approve`): a reconciled line (fixes closed, or the branch forces), the group with
      a contact we may write to. The PDFs read in the session travel with the approval and wait in the Drive folder's
      "Bills to send" (`gblKeepQueued_`, under `GCM_FORMS_FOLDER`), named by month, group and line; the row carries
      Approved at, by, e-mail, for and the file ids (new Group Bills columns, added to an older tab by name). With a PDF
      and no Drive folder the approval is refused and says to set the property. `unapprove`
      trashes the waiting PDF and leaves the bill reconciled. The reply names the day it goes; Send now stays for a bill
      that cannot wait. The steps strip gains *Approve* before *Send*.
    - **Send now: only on an approved bill, and a reason after the cut-off** (25 October 2026: "staff has to keep send
      now but has to have the approval and reasons why it was not done at the specified cut off time"; `GBL_LATE`):
      - **Approval first.** `gblSend_` refuses a bill with no Approved at (`needApproval`), for everyone. A bill already
        sent goes again with no question. On the page, Send now shows only once the line is approved (`blSendBtn`).
        With no PDF read in the session, Send now takes the one kept in Drive at the approval (`gblKeptBlobs_`).
      - **The cut-off** is 10:00 on the billing day the bill was meant for (`gblCutoffOf_`). That is the billing day before
        its month, since Head Office bills a month ahead and November's bill goes on 26 October. A bill uploaded more
        than `LATE_DAYS` after that day is treated as billed in its own month, so its month's billing day.
      - **Missed** (`gblMissed_`) means 10:00 that day has passed and the bill was approved for a later run, not
        approved at all, or held at the run. A bill approved for that run, which the run has not reached yet, has not
        missed it.
      - **The reason.** After the cut-off, Approve and Send now both ask why it was not done by then (`needReason`, a
        box on the page with one-tap starts). Staff and the deputy must answer, at least 15 characters with no [blank]
        left in. The branch manager may leave it out. A reason given at a late approval is offered again at Send now.
      - **Where the reason goes:**
        - the bill's **Late reason** column ("<reason> · given by <name>, <when>"), beside a new **Sent by**;
        - Group Changes (`approved` detail, then Kind `late send` with the reason in Note);
        - the billing task's Chatter;
        - the run's summary and the branch manager's daily summary ("Sent after the 10:00 cut-off", `gblLateSends_`);
        - the 25th report;
        - an e-mail to the branch manager at once (`gblLateMail_`; never for his own send).
      - **The 10:30 task.** Live, the send answers that cycle's GROUP BILL NOT SENT task with the reason and closes it
        (`gblLateTask_`, from the `GCM_BILL_TASKS` property). The run does the same for a late-approved bill.
      - **No double counting.** Group Sends marks a late send `late (cut-off yyyy-MM-dd)` in Via, and the next cycle's
        chase never counts it as that cycle's bill (`gblLateBefore_`).
      - **Tests.** `gblTestClock_` sets the tests' clock (`gblNow_`); nothing in use sets it. `billing/billing-test.js`
        (285, 39 of them this rule), `billing/door-test.js` (87) and `billing/page-test.js` (46) in the scratchpad.
    - **The run** (`gblDayRun_`): from the hourly refresh (`gcmRefreshTick`, `auto`, silent when nothing is due) and
      first in the 10:30 group day; every approved bill whose day has come, one e-mail a group and month with the PDFs
      read back from Drive (`gblBillMail_`), to the contact with sales support in Cc, logged on Group Sends as `bill
      sent` (Via "support@, billing run"), the row `sent`, the PDF moved to "Sent bills", a note on the billing task's
      Chatter. **Test mode is the bills' own**: until `gblGoLive` the run sends each bill to its approver and the branch
      marked TEST, logs `bill test`, marks the row `tested` and nothing sent; approve again once live. A bill the run
      cannot send is `held: <why>` on its row (no contact, Microsoft refused, the PDF gone from Drive) and stays
      approved; one internal e-mail a run (`gblDayTell_`) tells the branch manager and whoever approved a held bill.
      `gblDayNow` and `gblDayRehearse` (every approved bill as a TEST to its approver, nothing marked) from the editor.
    - **Who is billed** (`gblExpected_`): a line with a Salesforce billing record (`TRANSACTIONS__c`) for the cycle's
      month or the one after, one query over every account kept an hour, plus any bill stored for those months; without
      Salesforce, the lines with a bill stored in the last 70 days. The cycle runs from the previous month's billing day
      to this one (`gblCycle_`).
    - **At 10:30 on the billing day** (`gblDay_` inside `gcmDay_`): each staff member whose billed group had no bill
      (sent or test copy) this cycle is asked why (`gblChaseList_`, `gblChaseMail_`: where each line stands, nothing
      uploaded / to fix / not reconciled / not approved / held / approved after the run, what to do today, the four
      training lines in `GBL_DAY.TRAIN`), reply by noon to the branch manager, and a Salesforce task opens per group,
      `RR/<NAME> - GROUP BILL NOT SENT - <group> - <Month yyyy> bills: reason needed`, Lic/Staffing/SA/HR, High, owned
      by the staff member's standard user, once a cycle (`gcmChaseTasks_` generalised with `o.tag`, `o.prop`, `o.label`,
      `o.train`, `o.why`; property `GCM_BILL_TASKS`). **While the bills are in test mode nobody is asked and no task
      opens** (25 October 2026, the evening before the first billing day, when the rehearsal found nothing approved and
      the 10:30 would have asked every staff member why): `gblDay_` runs the chase only once `gblGoLive` has been run;
      the summary still lists each billed group with no bill and says its task "would open after gblGoLive". The manager's daily summary gains "Group bills: the 26th"
      (`gblDayHtml_`): on the day, how many billed groups had their bill, who missed with the task, what the run sent and
      held; on other days, the next billing day and how many are sent or approved. `gblDayTest` rehearses the whole day
      to the branch manager; `gcmGroupDayTest` includes it.
    - **The pages**: the review's strip under the title (`blDayStrip`: the day, days to go, test mode, the Drive folder
      not linked), *Approve for 26 Oct* on a reconciled line (disabled with the reason while the folder is not linked),
      the approval shown with who and when and *Cancel the approval*, *Send now* beside it; the account chip counts
      approved and held; the Team dashboard's meter "bills approved or sent for 26 Oct" and its note (`billingDay` on the
      board answer); the group's page says when its next bill comes (`nextBill` in `gblClientBlock_`).
    - Tests: `billing/billing-test.js` (165) and `billing/page-test.js` (107) in the scratchpad; the harness's Drive
      mock gained stable file ids, `getFileById`, `moveTo` and `setTrashed`.
  - **The Billings door: its own page, eight steps, the AI asks, last month's tasks, the people, the statement** (25
    October 2026: "upload the November 2026 group health, life and pension billing and the claims experience, also build
    in intelligence from AI to ask the questions and run the analysis, as we need to also produce Guardian Life billings
    as well, read the old invoices that are owed. Tasks opened for last month in October billing: an analysis, deep
    insight, history is done as well, to post on Chatter for an update, as well any terminations etc. Make much more
    simple and interactive, a site that will pop and not confuse the weekly query and task update", then "the analysis
    for all persons re dependants and persons coming of age to convert"). `groupclientmanagement/billing.html` with
    `billing-door.js`: the staff page's Billing buttons open it (`billing.html?g=<key>&m=<month>`), the same sign-in (the
    two localStorage keys), and the weekly letters stay on `index.html`, which no longer loads the review. The look is
    `gcm.css`, pulled out of `index.html` so the two pages read one sheet; `billing-ui.js` runs unchanged under the door
    (the pieces of a line, the findings, the task panel, the forms, the payment box, approve and send), the door
    replacing `openBilling` and `drawBilling`. One group, one month, a list of groups first (mine, billing to do,
    everyone; the billing day and test mode in the hero), then the steps as a strip with a count on each (done, to do,
    amber for checks) and one panel at a time, a progress bar over them (a step is done only when it is: a test send is
    not a send, a check still open is not done):
    1. *Upload the bills*: the three lines, the claims experience under health.
    2. *What was found*: the AI read runs by itself (`gcm.billAi`, cached by the facts), then the findings by line.
    3. *Answer the questions* (`gblQuestions_`, `gcm.billAsk`): every open finding becomes a question with taps
       (`gblQuestionOf_`: who it is for, the names for staff, options with `resolve`, a `post` for Chatter, and a
       `next`: upload again, the Salesforce fix, the payment box, the task panel with the kind and member filled, the
       EB0010 termination forms for the members who left), always with "Not sure yet"; the AI adds up to four of its own
       from the figures (`gblAiQuestions_`, names never sent, cached six hours). An answer (`gblAnswer_`, act `answer`)
       goes on the bill row's **Answers** column, on Group Changes as Kind `answer` keyed to the question, and onto the
       line's billing task's Chatter under the staff member's name; a resolving answer resolves the finding. An AI
       question's answer travels back with its words, so no second call.
    4. *Last month's tasks* (`gblTaskUpdates_`, `gcm.billTaskUpdates`): every open billing task read against this
       month's bills and Salesforce (on the bill, off the bill, a credit or back-charge, the month's record and payment,
       an amount in the subject keyed as a payment), a verdict (settled, still open, worse), and an update written by the
       AI from the task's history in one call (`gblTaskUpdatesAi_`, names scrubbed) or from the record. Post it
       (`gblTaskUpdate_`, act `taskUpdate`): `gblNoteTask_` with the owner mentioned and e-mailed, the task closed in
       Salesforce when ticked (a PATCH to Completed), every update on Group Changes as `taskupdate` or `taskclosed` so the
       door shows which were dealt with this month. The review's own comment box, prompts and "post for the group" sit
       under each. The group's e-mails about money are on the step.
    5. *Terminations and changes*: the counts from the bills, Record a change and the three Guardian forms.
    6. *The people* (`gblPeopleStep_`, `gcm.billPeople`): everyone on the health and life bills matched to
       `gblMembers_` by employee id, certificate or name, with the dependants from the Relationship Group: turning 65
       within six months (`convert`, the group cover ends; `GCM_LIFE.CONVERT_AGE`), a dependant reaching `GCM_DEP_AGE`
       (`depage`), retiring on the company pension (`retire`, from the Group Milestones tab), over the age and still
       billed, a family tier with nobody on record, a single tier with dependants, no date of birth, no Salesforce
       record. Per flag: a letter to the member (`gblMemberLetter_`, act `memberLetter`: previewed as the member reads
       it, facts and the offer of a licensed agent's call, never advice; sent from support@, in test mode to the staff
       member marked TEST, logged on Group Changes as `letter` and Group Sends as `member letter test|sent`), or a task
       (`BL_TASKS` gained `convert`, `depage` and `data`; `GBL_TASK.KINDS` too), or GIO001 for the member with no
       record. The group's page gets counts only (`forGroup`).
    7. *The statement* (`gblStatementData_`, `gblStatementHtml_`, `gblStatementPdf_`, `gcm.billStatement`): this
       month's lines, the earlier invoices Salesforce still shows unpaid (14 months back, billed less payments), Head
       Office's own arrears figure when the two differ, the total to bring the account up to date, what changed as
       counts, what is attached; the PDF to download. **Arrears are compared line by line** (`arrearsDiff`): a health
       invoice's outstanding balances against what Salesforce shows owed on health alone, and only a health invoice,
       since a life bill or a list bill prints none (25 October 2026: the first examples set health's TT$2,822 against
       every line's TT$4,022 and said the two differed when health matched). **"Changes on this billing"** and the cover
       note's names come from one place, `gblBillChanges_`: the month's own bills (findings, credits, a life
       statement's adjustments) for the lines being sent, never Group Changes, which keeps no month (the same examples
       named a joiner and a leaver in the e-mail and said "no one joined or left" under it, and a November statement
       would have counted October's joiner again). It goes inline in the bill e-mail (`gblBillMail_`) and as a PDF
       beside the bills on Send now and in the billing-day run (`gblStatementBlob_`), and the group's page carries the
       latest sent one (`gblClientBlock_` `statement`).
    8. *Approve and send*: the day strip, reconcile, approve for the day, send now, a payment.
    **The group's page is in two tabs** (`client.html`: `ctabsHtml`, `CT`): *Your service items* (the weekly items,
    the record, the rating, the progress bar) and *Your billing* (the statement of account first, `statementHtml`, then
    the lines as before). It opens on the items; `?tab=billing` opens on the billing, for the bill e-mail's link. The
    bill and the weekly letter never share a screen, which was the ask.
    Tests in the scratchpad: `billing/billing-test.js` (214: the November bill, the questions and their answers, the
    AI's, the updates with a Task PATCH, the people with a member moved to 65 and `GCM_DEP_AGE` 14, the letter, the
    statement), `billing/door-test.js` (81, Playwright: the staff page's button into the door, every step, the group's
    page in its tabs, a phone) and `billing/page-test.js` (46). The harness (`wow/setup.js`) now serves `.css` as
    `text/css`: until then a stylesheet linked from a page was refused by the browser and the screenshots were bare.
  - **Never a member's name** in the AI's facts, in the group's billing block, or in the Chatter the group reads. A
    Salesforce write happens only on a signed-in person's press and is logged on Group Changes with who pressed.
  - Tests in the scratchpad: `billing/billing-test.js` (57 checks, Node, the made-up branch with made-up billing
    records) and `billing/page-test.js` (52, Playwright: the review driven with the real October PDFs through pdf.js,
    the made-up bill stored, the fixes, reconcile, the test send, a comment to Chatter, the claims upload; the
    group's page on a phone and a desk). `billing/world.js` holds the made-up Salesforce.

- **Your people: who is on the plans, who came off this year, who is pending, and a box on each** (25 October 2026: "a
  drop down to see the members that are active and members who have come off this year and members who are pending,
  who they have an application in … very easy for the customer to just look at what is pending, who is having it, and
  the ability to comment … driven by task. Remember, when they post a comment, it goes on to the respective chatter and
  task. If there's nothing on it, … the ability to post something … Remember, we upload the billing and the Salesforce
  data.").
  - **A third tab on the group's page**, *Your people* (`client.html`: `PEO`, `peopleHtml`, `personHtml`,
    `composeHtml`, `sendPost`; `?tab=people` opens on it; the tab says how many are pending). A drop-down picks
    *Pending applications*, *Active members*, *Came off in <year>* or *Everyone*, each with its count, opening on the
    pending when there are any; a search finds a name. On a phone the tabs read Items, Billing, People. The pending
    panel on the service items links to it.
  - **The list** (`gblRoster_` in GroupBilling.gs, `gcm.clientPeople`) is built from both sources: the group's Group
    Health and Group Life records in Salesforce (`gblMembers_`: live, or off with a status change this year) and the
    latest bill uploaded on each line (its members, with their tier), with this year's bills for who they took off.
    A person is active on a line when the latest bill carries them, or Salesforce has them live and no termination
    this year after they joined. Group Changes adds a leaver the group or our team reported (shown as leaving, with
    the date) and a joiner being enrolled (pending until a bill or Salesforce has them).
  - **What is open on each person**: the applications and increases still pending, from `gcmPending_` in its own
    words (a medical requirement reads "An underwriting requirement: the details stay between the person insured and
    us"), and any other open item about them the group is shown (`gcmShown_`, never a private one, matched by the
    task's contact or both names in its subject: a termination task, say). Each says who on our team has it, who it is
    liaising with, its status, its target date and the last contact, with the notes our team shared for the group.
    **Never the rest of the Chatter**, replies under the group's own post included: staff write Chatter as the team's
    own, and only a note shared for the group is the group's to read.
  - **A message** (`gblClientPost_`, `gcm.clientPost`, a name required, a role optional): on an item, it goes onto
    that task's Chatter through Connect with the task's owner mentioned (`gblClientFeed_`), headed "From <group> on
    their service page (<name>, <role>), about <person>, on "<item>":"; with nothing open on the person, it opens a
    task for the account owner (`Member query – <person> – <group> – the group asks`, or *Pending application* or
    *Member who came off*; Servicing, due in two days, on the group's account and the person's contact, so it shows on
    the page within the hour) with the words on its Chatter too. The person who has it is e-mailed from support@ with
    sales support copied (`gblPostMail_`). It is filed on Group Changes as Kind `post`, Source `client`, and the card
    shows the group what it wrote. The same words about the same person within ten minutes are taken once; forty a
    day is the most one group sends.
  - **What the group reads**: names, the plans, the tier on the bill, the dates. Never a date of birth, an e-mail, a
    phone, a beneficiary, a Salesforce id, a claim or a health detail; the `_sf` ids the post route needs are taken
    off before the page reads the list.
  - Tests in the scratchpad: `people/people-test.js` (30, Node, the made-up branch with an invented application, a
    medical requirement, a leaver and a private claim item) and `people/page-test.js` (29, Playwright, a desk and a
    phone, with screenshots).

## The branch's own forms — no client link opens a JotForm

`quote/`, `enrol/oas/`, `apply/xpress-life/`, the shared `forms/form.css`
and `forms/form.js`, and `apps-script/Quotes.gs`. Asked for on 22 October
2026: *"never closed by our online resources. So you need to ensure that
every link is not opening up a Jot form as well."*

**What was wrong.** Six of the homepage's busiest links went out to JotForm:
Motor, Property, Critical Illness, Key Person, OAS enrolment and the Xpress
Life application. A JotForm submission never reached the Service
Questionnaire sheet, never got a reference, and never landed in anybody's
day. A client filled one in and heard nothing unless somebody happened to
check an inbox. That is the loop that was never closed — not the look of the
form.

**What they are now.** Six branch pages, each posting `q.quote` to the same
Service Questionnaire `/exec` the other six front ends hold. Every
submission files one row on the **Quote Requests** tab (it makes itself),
e-mails sales support with every answer, and e-mails the client a
confirmation carrying the reference. The reference is on screen before the
client leaves the page.

| page | reference | what it asks |
|---|---|---|
| `/quote/property/` | `QP-yyMMdd-nnn` | the property, what to cover, claims history |
| `/quote/critical-illness/` | `QC-` | who it is for, the cover |
| `/quote/key-person/` | `QK-` | the business, the key person, what the money does |
| `/enrol/oas/` | `QO-` | you, your employer, your contribution |
| `/apply/xpress-life/` | `QX-` | who it is for, the cover, how to finish |

`/quote/` lists all six lines, Motor included, but **Motor is not built here**
— its card opens `/motor-quote/`. The branch app carries a **Quote & apply**
tile to the index, and its "where did it go" line names the old JotForms.

**Motor was built twice, and main's is the one that lives.** On 21 October the
motor JotForm (223376649264061) was replaced by `/motor-quote/` — its own page,
its own Apps Script project, its own sheet, and much more than a quote request:
the client signs in with a code to their inbox, Salesforce fills in their
Contact, motor policies and vehicles, the permit is photographed on the phone,
the quote goes to CRMSQuotes with the documents attached, a Salesforce task
opens, and signing in again shows the client the status and the premium when it
comes back. On 22 October this branch replaced the same JotForm with a plain
`/quote/motor/` of its own, not knowing. Two motor doors with two references and
two backends is exactly the fault the mark rule warns about, so on merging,
**`/quote/motor/` was deleted, `motor` came out of `QUOTE.FORMS` in `Quotes.gs`
so no `QM-` row can ever be filed, and the homepage's two motor links and the
`/quote/` card point at `/motor-quote/`** — which is what main had already done
to the old page. `forms.json`'s motor entry now carries only `elsewhere`, so
`build-forms.py` lists it on the index and builds no page for it; `qa/quotes.js`
fails if a line marked `elsewhere` ever appears in the backend. Five forms are
the branch's own here; the sixth is main's, and better.

**Two lines of copy had to move with it**, because a promise made in one place
has to be kept in the other. The index's lede said "a licensed agent calls you
at the time you choose", which is the five's own done screen and is not what
`/motor-quote/` does — it signs the client in and sends the price back on their
page — so it now reads "a licensed agent takes it from there", true of all six.
And the Motor card says what that page actually is: "Sign in and your vehicle
fills in from your record", so nobody meets the sign-in by surprise.

- **Edit `tools/forms/forms.json` and run `tools/forms/build-forms.py`,
  never a generated page.** One run rewrites all seven. The spec is the
  single source of the fields, the conditional rules, the reference prefixes
  and the words; the generator writes real HTML, so every field is in the
  markup and the form reads and fills with `form.js` blocked.
- **Never collected, on any of them:** a national ID or driver's permit
  number, a policy card number, bank or card details, and any health
  declaration. A web page is the wrong place for all of them; they are taken
  by a person, on the call or on the signed form. That is why the critical
  illness, key person and Xpress Life pages say in a panel that they ask
  nothing about health — the five Xpress Life health questions are on the
  Xpress Life application itself, which is where cover is actually issued.
  Date of birth and smoker status are asked, because they are rating factors
  and change the price. (`/motor-quote/` takes the driver's permit by photograph,
  because a motor quote cannot be rated without it; that page is main's and has
  its own rules.)
- **Two of the six hand over rather than pretend.** `/apply/xpress-life/`
  opens the file, gives the reference and then offers
  **xpresslifett.com** to finish the instant-issue application; `/enrol/oas/`
  starts the enrolment and says the signed form and the payment authority
  come from the branch. Neither invents an underwriting question or a
  deduction authority nobody can stand behind.
- **The client's confirmation is not held** by the hold on automatic client
  e-mail, for the reason the questionnaire's confirmation is not: they
  pressed send ten seconds ago and the reference has to reach them. It goes
  through `clientMail_`, so from support@ with the confidentiality footer
  when the Microsoft 365 properties are set. Its masthead is the hosted
  **gold** `logo-mark.png`, never an SVG and never a data URI.
- **The pages carry `site-mark.svg`**, the light-ground mark, because they
  are the homepage's own family in the homepage's palette. Gold on `#faf9f2`
  measures 1.68:1 and can never be an icon that reads as a shape — the
  arithmetic in the homepage section above. Gold shield in e-mail, teal
  shield on these pages.
- **A reference is read off the tab, never from a stored counter**, so a row
  that failed to write cannot take a number with it, and a reference from
  another day cannot move today's count.
- **A second tap gives back the first reference.** The same form from the
  same address inside `DEDUPE_MIN` (12 minutes) returns the reference it
  already has rather than making a second row and a second pair of e-mails.
- **Nothing is lost to a bad minute of signal.** If the backend does not
  answer inside 12 seconds, the page still shows a reference, says plainly
  that it could not reach us, and opens the client's mail app with every
  answer in it — the road `service/index.html` already takes. The done
  screen is painted *before* the mail app opens, so whatever the handler
  does to the tab, the reference is already in front of them.
- **The POST is `text/plain`**, which is what stops the browser asking Apps
  Script for a CORS preflight it cannot answer.
- **Motion runs on load, never on scroll.** `animation-timeline: view()` is
  right on an editorial page and wrong on a form: it holds every field below
  the fold at opacity 0 until somebody scrolls to it, and prints the page
  blank. A full-page screenshot caught it; the audit, which only tested with
  motion off, did not. Everything finishes inside half a second, and
  `@media print` forces the finished state.
- **A conditional field is hidden from everything**: out of the layout *and*
  `disabled`, so a stale answer can never travel with the form.
- **A radio group's label is its `<legend class="q">`**, and it has to be
  looked for before `label`: `querySelector('label')` inside a radio block
  finds the first option's own label, which would name the field after one
  of its answers.
- **Paste `Quotes.gs` and `Service.gs`, put `TEAM_CODE` back, then Manage
  deployments → pencil → New version.** `?action=q.ping` answers
  `quotes: 1` from a browser once the live deployment carries them, and the
  main `ping` carries `quotes` too.
- `agent.html` and `staff.html` are redirect stubs to `/app` now — the
  Agent and Staff Portals are retired and every tool they held is in the
  branch app. A redirect stub carries no view beacon, as ever.
- **The 19 JotForms left in the branch app's Forms group are staff admin
  forms** (petty cash, the gas log, licence renewals, the visitors log),
  already standing "each until it moves into the app". No link a *client*
  can reach opens a JotForm.
### The motion, added the same day

Asked for as *"so review again enhance and more motion"*. What went in is
motion that tells the client something, not decoration:

- **The stage.** Beside the headline, the branch's own shield with **this
  form's own sections circling it** — one chip a section, in that order. It
  is a diagram of what the form asks. A chip **lights green when its section
  is finished**, so the drawing fills in as the client works down the page.
  Behind it a dot field (masked to a circle, so it has no square edge), a
  dashed orbit that drifts, three pings leaving the shield, a sweep across
  the shield and the check stroking itself on.
- **The ring animates the `rotate` property while each chip holds a static
  `transform`** — separate properties, so they compose instead of one
  overwriting the other — and the icon inside counter-spins at the same
  duration, which is what keeps it upright. Same trick as the homepage hero.
- **The rail.** Under the lede, sticky: a bar and "<b>7</b> of 25 answered",
  moving on input, never on scroll. It turns green when the form is complete.
  A conditional field opening raises the total asked, so the count is honest.
- **Every answered field gets a tick beside its label**, and every finished
  section turns its number into a tick. One pass computes the field ticks,
  the section ticks, the chips and the rail, so they can never disagree.
- **The headline lands word by word** (never letter by letter — the dated
  form, and it wrecks the screen-reader read). The whole sentence goes on as
  an `aria-label` first and the split only happens when motion is allowed.
- **A conditional field opens** rather than appearing: `display` is in the
  transition with `allow-discrete` and `@starting-style`, so it still leaves
  the layout and the accessibility tree completely.
- **The chosen option fills from the control that was tapped** (a `clip-path`
  circle growing from the radio), and the radio pops. `.opt > *` has to carry
  `z-index: 1`, or the fill paints over the option's own words — which it did,
  and a screenshot caught it with "WhatsApp" gone from the chosen card.
- **The send button** carries a sheen on hover and runs it on a loop while it
  is sending, so the wait has a pulse.
- **The done screen is drawn, not shown**: the tick strokes itself on, a ring
  of light leaves it twice, the reference lands character by character (with
  the whole string on `aria-label` and `title`, so it is still one thing to
  read and to copy), and the three steps arrive in turn.
- **The loops park by a class added on exit, never removed on entry.**
  `body.rest` pauses the stage when it leaves the screen. The other polarity
  freezes every `backwards`-filled entrance at its invisible first frame on
  any browser where the script does not run.

Measured after: **16.7 ms a frame over three passes with the ring spinning**,
cumulative layout shift 0 on three pages, nothing animating and nothing
invisible with `prefers-reduced-motion: reduce`, and the mark exactly **46%
of the stage at every width from 320 to 1920**.

**Two sizing traps, both the same shape, both caught by measuring:**

- **A rule that overrides another has to come after it.** Twice a rule meant
  to size the stage sat *before* the rule it overrides and silently did
  nothing: the phone `max-width`, and then the `@supports
  (container-type: size)` block — `.stage .ring` is (0,2,0) in both places,
  so source order decides, and `--r` stayed at its `5.7rem` fallback on a
  146px stage, throwing the outer chips 32px past `overflow: clip`.
- **`min(15rem, 100%, …)` inside an `auto` grid track is circular**: the
  percentage resolves against a track sized by its own content, so the whole
  stage collapsed to **0×0** and nothing rendered. The track needs a definite
  size (`clamp(9rem, 19vw, 15rem)`) and the stage then takes `width: 100%`.
  The same family as the homepage hero's invisible rings.

**No two sections on one stage may share an icon** — a repeated glyph reads as
a repeated question. `build-forms.py` refuses to write a page where two do,
and that guard immediately caught the OAS form carrying two sections both
named "About you" (the second is "Your details" now).

### The refinements the review pass found, the same day

Asked for as *"aNY FURTHER refinements"*. Six, and the first three were
silent faults nobody would have reported:

- **The rail was invisible exactly when it was wanted.** Both bars stick, and
  with `top: 0` the rail parked behind the topbar — 69px of overlap, its whole
  height — so the progress vanished the moment the client scrolled into the
  form. Its top is now `var(--bar)`, which `form.js` sets from the topbar's
  **measured** height on load and on resize, so a longer brand name or a
  bigger font can never put it back.
- **The backend's bot guard was dead code twice over.** `quoteSubmit_` checked
  `core.website`, and no page emitted a honeypot at all; once one was added,
  it still never travelled, because `payload()` only walks `.f` blocks and the
  honeypot sits outside them. The forms harness caught the second half by
  accident, flagging a filled field that did not reach the payload. The
  honeypot is off screen (never `display: none` — some bots skip those), out
  of the tab order, `aria-hidden`, read explicitly into `core.website`, and
  excluded from the progress count and the draft.
- **A restored draft said nothing.** Answers reappearing with no explanation
  read as somebody else's form. It now says *"We kept what you had started 20
  minutes ago. 2 answers are filled in below"* with **Start again, empty**, and
  a draft over **14 days** old is dropped rather than put back in front of
  them. Only answered fields are saved: `FormData` hands back every empty box
  too, and the first cut claimed 17 answers for 2.
- **Enter no longer sends.** The browser's default is to submit from any
  single-line input; on a form of twenty-five answers a stray Enter halfway
  down is a submission nobody meant. Enter moves to the next box, and only the
  Send button sends.
- **The index carries the stage too**, circling the **six lines** as each
  form's own circles its sections: the same drawing, one level up. `form.js`
  used to return early on any page with no form, so `/quote/` got neither the
  measured bar nor the kinetic headline; the page-wide motion now runs before
  that guard.
- **Two surfaces went opaque.** The rail was frosted at 92% and a form field
  ghosted through it under the topbar, reading as a rendering fault; it is
  solid now, which also keeps `backdrop-filter` to one surface on these pages.
  The topbar sits at 94% rather than the homepage's 88%, because frost reads
  as craft on an editorial page and as a fault over the field somebody is
  filling.
- Smaller: the rail is a real `role="progressbar"` whose `aria-valuenow`
  tracks the count (the visible text is `aria-hidden`, so it is not read
  twice), and a radio group's legend no longer inherits the flex gap meant
  for a section number — it was pushing the required asterisk a full space
  away from the question.

- Tests in the session scratchpad: `qa/forms.js` (24 checks, Playwright: the
  pages, sideways scroll at seven widths, iOS input zoom, touch targets,
  contrast composited through translucency, the validation summary, the
  conditional rules, a real send on all six, a dead backend, reduced motion,
  the form with JS off, and no JotForm on any client-facing page; the canonical
  page throughout is `/quote/property/`, since motor is not ours) and
  `qa/quotes.js` (24, Node with Sheets and MailApp made of nothing: the tab,
  the numbering, the duplicate guard, the honeypot, the row, both e-mails,
  and that the page and the e-mail promise the same three things word for
  word), and `qa/motion.js` (14: the rail against what is answered, a
  conditional field raising the total, a section ticking and lighting its
  chip, the split headline both ways, nothing running or invisible with
  motion off, the frame cost with the ring spinning, the loops parking off
  screen, no chip crossing the clip at 6 stages × 10 widths, the mark as a
  constant fraction of the stage, layout shift, the rail still visible under
  the topbar after a 1600px scroll, the honeypot's four properties and that a
  filled one adds nothing to the count, Enter moving on rather than sending,
  the restored-draft notice and its count, Start again, and the index's own
  stage, headline and measured bar).
## The English B essay workshop — it asks, the student writes

`englishb/index.html` (rickyrampersadbranch.com/englishb/) and `apps-script/EssayWorkshop.gs`, **its own Apps Script
project on its own Google Sheet, with its own `/exec` address (`ESSAY_API` in the page)**. Asked for on 15 October 2026:
a five-paragraph CSEC English B essay on fear in John Wickham's "Blood Brothers", where "the objective is not to do this
but to guide her and make think to do this", with "student log in and teacher log in with a code". `ENGLISHB-SETUP.md`
has the steps.

- **It is not part of the RRB Academy.** First built inside `Academy.gs`; the same evening: "dont wan this in my acadeny
  module as this is different". Never put it back in `Academy.gs` or `/sea/`, never point the page at the Academy's
  address, never brand it as the Academy. `tests/test-englishb.js` fails on any of the three. It keeps the branch's
  gold shield, as every screen does.
- **Codes live on the Essay Codes tab, never in the page or the `.gs`.** `essaySetup()` makes the first teacher code and
  shows it; the teacher adds students (first name only) from the page. A new code ends every sign-in made with the old
  one. A teacher sees only their own Class.
- **The coach never writes any part of the essay.** Its rules are in `ESSAY_RULES` and travel in the system prompt of
  every request from the script, so no browser can change them: no thesis, sentence, rewrite or list of points, no words
  from the story the student has not found, at most two questions a reply. The teacher reads every word (Essay Coach
  tab). Do not loosen a rule because a student asks; the point of the workshop is that they do the thinking.
- **The story is not in the repository**, which is the website. `ESSAY_STORY` is a study-guide summary quoting a few
  words at a time, and the test fails past nine words. Do not add the text, and do not write out what a strong essay
  would argue in any public file: a teacher's steer goes in Coach Notes on the Essay Classes tab.
- **A hand-in is final until the teacher returns it**, enforced in the script (`elocked_`), never by the page alone.
- **The answers and the full review are the teacher's alone** (16 October 2026: "allow the teacher to do the full review
  and answers"). `essay.guide` writes what a careful student should find and say at each stage (model theses, a model
  plan, a model paragraph) and, as stage `essay` (`ESSAY_GUIDE_EXTRA`, asked for as "where is the essay?"), one whole
  five-paragraph model essay, all kept per class and stage on the Essay Guide tab; `essay.fullreview` scores one student's
  work on five criteria out of 25, paragraph by paragraph, with a note per stage the teacher may pass on with *Use as my
  note*. Both are written by Claude at the teacher's request and live only on the private sheet. Both routes refuse a
  student's code, and `essaySession_` strips `review.full` from a student's sign-in. Never write model answers into the
  page, the `.gs` or this file, and never hand the coach the guide: the student would be given what they are meant to
  find.
- Stage, question and check keys must match between the page (`STAGES`, `WHY`, `CHECKS`) and the script
  (`ESSAY_STAGES`, `ESSAY_WHY`, `ESSAY_CHECKS`); the test compares them.

## The Premium Due Desk — checked by a person, sent at ten

`premium-due/` and `apps-script/PremiumDueDesk.gs`, in the Branch Intelligence
project (the tracker's: `Intelligence.gs` beside `KPI.gs`, its own `/exec`).
Asked for on 7 October 2026: "a trigger go out when a client premium is 45 days
due with built in responses for them to select", then "a staff has to do a
check mark to ensure due diligence is done, once they check it goes out", then
"a time at 10am". Widened on 13 October 2026 to four lines ("45 days, 60 days,
75 days, and 90 days … the same thing we did for groups, whereby you have the
tabs and you have filters and you have the agents"), in **test mode**, because
the branch trains the group letters and the premium letters together; and
"build a lot of intelligence around the data we have, as there was a lot of
servicing work".

- **A tick is a check, recorded on the spot** on the **Premium Due Checks** tab:
  who, when, the client's address and agent as checked, and any flag on the row
  they ticked through. The box is enabled only once that client's letter has
  been opened on the desk; there is no send button and no "tick all". "Do not
  send" takes a reason and is recorded too. Staff and the branch manager tick;
  an agent or a unit manager reads the letters and never ticks, because the
  letter asks the client to rate their agent.
- **The letters go at ten, Monday to Friday.** Ticked before 10:00, that
  morning; after, at ten on the next working day. The send runs inside
  `intelPendingRefresh`, the hourly trigger, from the ten o'clock hour
  (`pddRun_`): the project is one trigger short of its twenty, so no new
  trigger. A firing missed at ten is caught up the next hour.
- **Four lines: 45 to 51, 60 to 66, 75 to 81 and 90 to 96 days**
  (`PDD.STAGES`, `iSurveyPool_([45, 60, 75, 90], 6)`, read in one pass of the
  extract; every other caller passes one stage and nothing for `late`, and
  keeps the stage to the day), so a Saturday's clients and a tick made after
  ten still go. A client written to on a line in the episode stays off that
  line, so no one gets two of one letter. A check belongs to its line
  (`pddStageOf_`, from the check's own Days due, so the tab has no new column):
  a 45-day letter sent last week is no tick on the 60-day line, and a client
  ticked on one line who reaches the next before ten is "not sent: it moved to
  the 60-day line", to be checked again there.
- **Each line has its own letter** (`ISURVEY_STAGES`, `iSurveySubject_`):
  45 thanks them for their years and asks the 1–5 rating once; 60 follows up
  ("Following up on our note about your premium", or "A note about the
  premium on your policy" when no 45-day letter went, which then asks the
  rating); 75 names the date the cover stops (from the dues extract's
  Projected Lapse Date) with the ways to pay and "Ask <agent> to call me",
  and states no amount, because the extract does not say how often a premium
  is paid; 90 sets out the options. Each later letter says which note it is
  and what came before (`iSurveyHistoryLine_`, under the approval too: until
  13 October a client who tapped "talk about my options" read "we did not
  hear back"). Every letter carries "What we have done for you",
  the requests the branch team handled in twelve months and the policies
  held, left out when there is nothing to count. The five taps are the same
  on every letter. **The wording changed on 13 October, so `iSurveyHash_`
  (which now renders a probe letter for each line) voids the old approval:**
  live sends stop until `intelSurveyApprove("<reviewer>")` is run again. Test
  copies still go.
- **What the desk knows about a client** (`pddIntel_`, beside each letter and
  as tags on the row): every policy they hold from the in-force book (plan, a
  year's premium, paid to), their other policies behind or lapsed on the dues
  extract, every letter this episode and what came back, and from Salesforce
  the requests the branch team handled in twelve months and what is open now
  (`pddSfService_`: the policy record by `POLICY__c`, then tasks on it or on
  its `Contact__c`; logged e-mails and the birthday flow never count, the
  rule `GCM_LOGGED` keeps for the groups; kept six hours in the cache). Notes
  in words, most pressing first, facts only. An agent or a unit manager sees
  that a client answered, never the rating or what they asked for: one of the
  taps is a private note to the branch manager about the agent. Each source
  is optional; without Salesforce the rest still shows.
- **The AI read** (13 October 2026: "is there also any intelligence on the premium due tab that staff can actually
  see and AI driven, like what we did for the groups?"). Beside each letter, "Read <name> with AI" sends the facts
  the desk holds on that client to the Claude API (`pddAi_`, `claude-opus-5-5`, structured output) and shows where
  things stand, what most likely stopped the premium, what to check first, an opener for the call and what to be
  careful of. For the branch and staff, "Read today's lines" (`pddAiDay_`) reads the four lines in counts only and
  says what stands out and where to start. No client's name, e-mail, policy or client number is sent; an agent's read
  leaves out what the client told the branch, as the desk does. It is for staff, never a client, and never touches a
  letter, whose wording is approved. Staff are not licensed, so it never advises on cover: options are the agent's
  conversation. Each read is kept six hours (the day's half an hour). The key is the `ANTHROPIC_API_KEY` Script
  property of this project (the tracker's, not the Service Questionnaire's); without it the page offers nothing.
- **The page**: a tab per line with how many are to check and ticked, and
  filters for the agent, the unit, how they pay, when the cover stops, to
  check / ticked / not sending, flagged, answered us before, holds other
  policies, and a search by name, policy or client number, kept on the device
  (`rrb-pdd-view`). The branch and the staff also get **After the letters**
  (`pddOutcomes_`): every letter that really went in 120 days, by line, read
  against today's dues extract: back in good standing, paid some, still
  behind, lapsed, off the extract. Test copies are never on Intel Surveys, so
  test mode counts none of them.
- **At ten the send reads the line afresh** and sends only a client still on
  it, with the address and agent that were checked; otherwise "not sent", with
  the reason, on the desk and in one internal summary to the manager. Live only
  with client mail live and the wording approved; in test mode each letter goes
  to the test inbox, its banner naming the line, and the client is not marked
  as written to; held, ticks wait and a client past the end of their line
  drops off. It logs on Intel Surveys before it sends
  and takes the log back if the mail fails. It stays inside the day's mail
  allowance (a consumer Google account: about 100 recipients a day, and each
  letter copies the agent, every staff member on the access list and the unit
  manager), oldest first; the rest wait. Every write is conditional on the
  check still reading what the send saw, under the script lock the tracker's
  submissions use, held for a write and no longer.
- **The taps need the web app's `/exec` address**, which a time trigger is
  not reliably given; the desk notes it from any request (`PDD_EXEC_URL`), and
  `INTEL_EXEC_URL` wins. Without one the live send holds and the desk names the
  property to set.
- **The branch workbook reached Google's ten-million-cell ceiling on 21
  September 2026** (the nightly build has reported it since; `intel.ping`
  shows `lastError`). The checks tab goes there when it can and to the
  tracker's own workbook when a new tab is refused.
- Install: paste `Intelligence.gs` and `PremiumDueDesk.gs` (all over), then a
  New version, then `intelSurveyApprove("<reviewer>")` once the four letters
  are read. `intel.ping` answers `version` and `desk`. Editor: `pddStatus()`,
  `pddToday()` (each line's count, and whether the in-force book and
  Salesforce joined), `pddSendNow()`. `pdd3/` in the session scratchpad holds
  the harness on a made-up branch (`test.js`, 87 checks; `page-test.js`, 40,
  Playwright; `world.js`, the fake workbook and Salesforce).

## The motor quote — the client signs in, Salesforce fills in, the desk quotes

`motor-quote/index.html` (short address `/motorquote`) and `apps-script/MotorQuote.gs`, **its own Apps Script project on its
own Google Sheet** (own `doGet`/`doPost`: never beside `Claims.gs` or `Service.gs`). Built 21 October 2026, replacing the
" Motor Quotation" JotForm (id 223376649264061, 41 questions, 2 submissions ever): "a client logs in, the data read from
Salesforce if he is an existing client by his email, if not a contact is created, then asks data that will generate a motor
quote as this goes to CRMSQuotes@guardianonline.onmicrosoft.com". `MOTOR-QUOTE-SETUP.md` has the steps.

- **It carries the blue shield, not the gold** (21 October 2026, shown the page: "i dont like the log with the gold and
  black its not scales and look"): `orphan-transition/board-mark.png` at 46 px on a `#13408F` tile in the header, as the
  favicon, and as `MQ.LOGO` on both e-mails, as the Delivery Book does. The page is light (a soft blue-white ground, white cards) in a **softer ocean blue** (`#3A7BD5` into `#4C94E6`,
  deep `#2C5FA8`, sky `#EAF3FD`, teal `#1FA8A0` for the start button), not the corporate blue: a first cut on a midnight
  ground was turned down ("dont lie the blacks and make more easy on the eyes"), then the corporate blue ("this one is
  hard on the eyes, research and she what color for clients"). What the research supports (21 October 2026): blue as the
  dominant colour draws the most trust and black the least (an MWAIS 2007 pilot; a 2021 web-store experiment found
  the effect stronger in risk-averse markets); text at 4.5:1 contrast and nothing said by colour alone (so the required
  star has the words "starred answers are needed" beside it); three to five colours; drop-downs for make and model;
  one column on a phone. White on `#3A7BD5` is about 4.6:1. No study compares colours on insurance quote forms. Long answers are drop-downs (make, year, engine, body,
  seats, years driving, no-claim discount, insurer, financial institution, each with Other and a box to type); yes or no
  answers stay as taps.
- **The project is owned by the support@rickyrampersadbranch.com Workspace account** (21 October 2026: "remember i d
  have a workspace"), never the personal Gmail: `mqMail_` then sends from support@ through MailApp by itself, under the
  Workspace's allowance, and the `MS_*` Graph properties are not needed. A sheet made under the personal Gmail on 21
  October ("Motor Quotes", in that Drive) is not the one to use. **The sheet must be owned by support@, not shared with it**: an editor can run the script but Deploy refuses with "You do not have permission to perform this action" (21 October 2026). The fix was File → Make a copy while signed in as support@ alone, then the Script properties entered again (a copy does not carry them). Deployed the same day; its `/exec` address is `CONFIG.API_URL` in the page.
- **Sign-in is the claims portal's**: e-mail, six-digit code to that inbox, no password. Anyone may sign in; the answer never
  says who is a client. The signed-in e-mail is the client's e-mail whatever the form sends (`mqRead_`).
- **What Salesforce holds is filled in** (`mqLookup_`, by e-mail): the Contact (name, mobile, Title as occupation,
  Birthdate), motor policies (`CLIENT_PORTFOLIO__c`, MOTOR record type) and vehicles (`Risk_Details__c`, by `Insured__c` or
  `Email__c`; two years of one vehicle merge, newest first, a blank never erasing: the claims portal's rule). A client picks a
  vehicle to quote again, or adds one. Every read is in its own try: Salesforce down still signs the client in.
- **Every question the JotForm asked is still asked**, in six steps; `tests/test-motor-quote.js` checks the list. The permit
  and the certified copy are photographed on the phone, resized to a 1600 px JPEG on the device, PDFs under 6 MB as they are.
- **Send**: a row on **Motor Quotes** (`MQ-yyMMdd-nnn`), the documents into Drive (Motor Quotes / year / ref), one e-mail
  to the quotes desk from support@ through Graph (`mqMail_`, the Log Book's pattern; this Google account with support@ as
  reply-to when the `MS_*` properties are not set) with sales support and support@ in visible Cc, the agent too when the
  client names one, and the documents attached; a receipt to the client with the reference; a Salesforce task on the Contact
  due two working days on. **A client not in Salesforce becomes a Contact at the send**, when a name is held, never on the
  sign-in alone (`mqEnsureContact_`, `Contact_Type__c` Prospect; the same e-mail on file is the same client).
- **Test mode is the default** (`MQ_MODE` unset): every e-mail to `MQ_TEST_INBOX` with a banner naming who it was for, and
  Salesforce read but never written. `mqGoLive()` when the manager says so. The quotes desk never hears from a test.
- **Signing in again shows the client their requests and where each stands**: the tab's Status, Quoted on and Quoted
  premium columns, kept by staff by hand.
- **Three doors, the renewal first** (21 October 2026: "when a person wants a quote they normally have the invoice …
  upload the invoice and all key fields presented … If they don't, just minimum to quote … a person log in to renew and
  have the renewal at the forefront with renewal history and intelligence").
  - *The invoice*: `readInvoice` sends the photo or PDF to Claude (`ANTHROPIC_API_KEY`, `MQ_AI_MODEL`, default
    `claude-sonnet-5-5`, structured output, 15 a day per e-mail). The document is data: the system prompt says so,
    and `mqInvClean_` drops whatever is not a year or an amount. The page fills the quick quote, marks each field
    "from your document", and never lets the buyer on the document replace the signed-in client's name or mobile.
    The document travels to the desk; what was read is on the **Invoice read** column.
  - *The quick quote* (`flow` quick): `MQ_REQUIRED_BY.quick`, no permit; "New vehicle, not registered yet" is allowed.
  - *The renewal* (`flow` renew): `mqRenewal_` gives each vehicle its terms (one per policy and end date), the renewal
    date (the day after the cover ends, or `Next_Renewal_Date__c` within three days of it), the days to it and the
    facts off the record, never advice. Due within `RENEW_AHEAD` (60) or lapsed within `RENEW_BACK` (45) comes first
    on the home screen. `mqRenewFromRecord_` reads the vehicle again at the send, so the date, premium and terms come
    from Salesforce. It goes to `MQ_RENEW_TO`, else the quotes desk.
  - New columns go on the end of the Motor Quotes tab, added by name (`mqQuotesSheet_`), and a row is placed by the
    tab's own headers.
  - Tests: `tests/test-motor-quote.js` (170 checks) and `tests/e2e-motor-quote.js` (120, every door on a phone).
- **Taking the quote fills Guardian's own PDFs** (21 October 2026: "once they agree on the quote … upload the certified
  copy … extract all the details on the vehicles … fill out the proposal form very fast", then "it has to be exactly on
  the Guardian PDF and know your [policy], ensuring that they can answer it").
  - The forms are `motor-quote/forms/gg-private-motor-proposal.pdf` (GG-MOT-APV-PRO-02/2025v2, four US Legal pages,
    no fields) and `gg-know-your-policy-private-motor.pdf` (45 fields), with their file properties and XMP cleared,
    because a staff member's name was in them and the site is public.
  - `motor-quote/forms.js` (browser and Node) prints each answer at the position of its own blank, measured off the
    PDF's characters: the YES____NO____ underscore runs, the blanks, the two tables' cells. It ticks the KYP's own
    boxes by field name, with pdf-lib's check mark, because the form's "on" glyph renders garbled in some viewers.
  - pdf-lib 1.17.1 is kept in `motor-quote/vendor/` (MIT), never loaded from outside.
  - `readDoc` reads `quote`, `certified` and `permit` (the certified copy: only the current owner, never an earlier
    one). Every declaration is the client's own tap, never pre-ticked. A fact off a document (registered in your
    name, anti-theft from the quote's discount, the benefits on the quote) is filled and marked.
  - `propose` checks every yes/no, every detail a Yes asks for, all 17 KYP points and both signed PDFs, then e-mails
    the desk (`MQ_BIND_TO`, else the quotes desk) with the five documents. A Yes an underwriter must see and a KYP No
    go first. The client gets their own signed forms. The row goes on **Motor Proposals**, and the quote request is
    marked taken only when it is the signed-in client's.
  - The signature pad is in a div, never a label: a click in a label also clicks its first button, which was Clear.
  - The answers print in bold at 10.5 pt (table cells 9 pt, wrapping at full size, so a chassis number takes two
    lines rather than shrinking), and the KYP's fields at 11.5 pt bold (21 October 2026: "fonts more bold and scaled
    properly"). The signature is cut to its ink (`trimSig`) before it goes on page 4 of the proposal and the KYP's
    signature line, so it fills the line.
  - When Guardian revises either form, replace the PDF and re-measure the positions in `forms.js`.
- **Every quote request carries Guardian's own Motor Quotation Request form, filled in** (21 October 2026: "see guardian
  motor request form so the data collected should be proper on this form as it will be attached").
  - The form is `motor-quote/forms/gg-motor-quotation-request.pdf`: Guardian's fillable one-page US Legal form, taken
    from the e-mail it came in, with its file properties and XMP cleared.
  - It is filled on the phone by field name (`fillRequest`, `requestValues` in `forms.js`), so nothing is measured.
    Dates are written out ("12 Apr 1988"), the registration and chassis in capitals, and the value as "TT$ 212,645".
    The boxes and yes/no buttons are the form's own, ticked with pdf-lib's mark.
  - **The page asks every question the form asks.**
    - The full door asks: marital status, occupation and employer, home number, address, a first-time Guardian client,
      other business with Guardian, the chassis, new, foreign used or second hand (and an accident if second hand),
      the use, anti-theft, the windscreen limit, the no-claim percentage.
    - "Your history" asks accidents and young drivers. On the full door each Yes opens a table of up to three rows.
    - The quick quote asks the use and the history. The rest of the form sits in a fold, "Guardian's request form asks
      a little more" (optional). The fold opens by itself when any of it is already known.
  - The client can preview the filled form on the review step. It travels to the desk as `motor-quotation-request.pdf`,
    still fillable, with a green note saying so.
  - A renewal never carries it. Nor does a request form that is not a PDF, which the script drops. A form that cannot be
    filled never stops the request.
  - The answers are on new columns at the end of **Motor Quotes**, ending with "Request form" (attached).
  - When Guardian revises the form, replace the PDF and check its field names against `REQUEST` in `forms.js`.
- **Existing or new, an Opportunity for every new quote, and the permit on the Contact** (26 October 2026: "should it
  ask if they are an existing client or if not it creates a salesforce contact and places this as an opportunity on the
  opps objects … if an existing client pull in all their data … in the contact the drivers permit number issue and
  expiry what we have and what they can update").
  - **The e-mail decides.** A client found sees "We found your record" (`meCard`): name, mobile, date of birth,
    occupation and the permit as the Contact holds it, `DP__c`, `Drivers_Permit_Issue_Date__c`,
    `Driver_s_Permit_Expiry__c` (`mqPermitOnFile_`), with a word for where it stands (`mqPermitState_`: valid, expiring
    within `PERMIT_SOON_DAYS` (60), expired, nothing on file). The forms open with those values. On 26 October 2026 the
    org's CLIENT contacts held a number on 781 of 12,656, an expiry on 458 and an issue date on 42, so most clients
    are filling blanks.
  - **Anyone else is asked once**, "Are you already a Guardian client?" (`clientStatus`, `clientRef` in the draft). New:
    a Contact at the send, with the permit. Yes: matched by a policy or client number **and** the surname
    (`mqMatchExisting_`), never by the number alone, so a number typed by someone else never reaches another client's
    record; unmatched, no Contact is made and the Opportunity says to link it by hand. Nothing found that way reaches
    the page.
  - **The Opportunity** (`mqOpp_`): every new quote, never a renewal, the way the branch writes them by hand (read off
    its own on 26 October): GENERAL INSURANCE, "OPP Motor - <client> (<vehicle> <reg>)", Proposal/Price Quote, close
    in `OPP_CLOSE_DAYS` (30), `Contact__c` (not the standard ContactId), the Contact's account, `Vehicle__c`, New
    Business, lead source Existing Client or Web, owner `MQ_SF_OWNER` (the BMA owns the branch's), producer
    `MQ_SF_PRODUCER` (a Contact id: the branch manager's agent record on the branch's own). A field the org refuses
    is dropped and the rest tried again. The task sits on it (`WhatId`). `mqPropose_` moves the quote's Opportunity to
    Negotiation/Review (`mqOppTaken_`), or makes one there for a known client who takes a quote with no request of
    ours behind it.
  - **The permit's rules** (`mqPermitPlan_`), so a slip of the finger never spoils a good record: a blank is filled;
    a later expiry replaces the old one, with its issue date when that is later too; an earlier expiry is never
    written; a different permit number is never written and nothing else changes with it: staff confirm it (the row,
    the task, and from the home screen a task "Confirm driver's permit"). The client updates it from the home screen
    too (`action=permit`, `mqPermitSave_`), a found client only. Test mode writes nothing and says what it would have.
  - New columns on Motor Quotes: Client status, Client says, SF opportunity, Permit on file, Permit update; on Motor
    Proposals: SF opportunity. The desk e-mail says "An existing client of ours" or "New to us".
- **The producer is whoever placed the quote, from the branch's own agents** (26 October 2026: "dependant on who places
  the quotes … i do have agents as contacts and record type agent so it searches the contacts", then "it should be
  limited to our Branch not the entire guardian life").
  - **The branch's agents** (`mqAgents_`): Contacts of record type AGENT, Employment Status Active, Units__c one of
    the branch's units (`MQ.AGENT_UNITS`: Ricky_Rampersad and Akaash_Kalladeen; the `MQ_AGENT_UNITS` Script property,
    comma-separated, replaces them when a unit is added). Never a resigned, terminated or not-active agent, never
    another branch's. Read at most every six hours. On 26 October: 16 active in one unit, 7 in the other.
  - **An agent signs in with their own e-mail** and the page knows them (`me.agent`): nothing of their own record is
    read. They get the new quote alone (quick or full): a renewal and taking a quote stay the client's own, and the
    server refuses both, and the permit update, for an agent. The form asks the client's e-mail (never the agent's
    own), whether the client is with Guardian (with an optional number), and the client's name and mobile. The client
    is found or created by their own e-mail, never the agent's session (`mqEnsureContact_` with the client's e-mail).
    The receipt goes to the client, the agent copied, saying the agent asked and will call; the desk reads "requested
    by our agent … for their client", the agent copied. The row: Placed by (the agent's e-mail), Producer, Producer
    Id. The agent's home lists the requests they placed, with each client's name; the client sees theirs when they sign
    in. When the client takes that quote, the agent is copied on the proposal.
  - **A client names their agent** in a search box (`action=agents`, `mqAgentSearch_`: names only, never an e-mail,
    two letters at least, every word starting a word of the name). The producer (`mqProducer_`), in order: the agent
    who placed it; the agent picked from the list; an active agent whose e-mail the client typed; a full name only one
    active agent carries; else `MQ_SF_PRODUCER`, the row saying why ("not one of our active agents"). A matched agent's
    e-mail on record is the one copied on the desk e-mail.
  - The Opportunity's `Producer__c` is that agent; its description says who placed it. The owner stays `MQ_SF_OWNER`.
  - Tests: `tests/test-motor-quote.js` (199 checks) and `tests/e2e-motor-quote.js` (134).
- **Three paths, never mixed** (21 October 2026: "do not confuse invoice … a quote and a renewal … on a mobile … a proper
  layout, professional … motion and graphics and charts … infographic"). The home screen opens on three choices, each with
  its own colour, icon, section and numbered steps (`PATH`, `.t-renew` teal, `.t-quote` blue, `.t-take` violet):
  **Renew** (a vehicle we already insure; hidden when the client has none), **New quote** (a vehicle we don't insure yet;
  the only place the word invoice appears, always "the dealer's invoice"), **Accept a quote** (the quote we e-mailed; called
  "your Guardian quote", never a quotation or an invoice). Every form carries a tag naming its path (`flowTag`), and the
  stepper, choices and main button take the path's colour. Charts: the renewal's premium by term as bars with the change
  on the year before (`premChart`), each other vehicle's cover year as a bar with "Renew early", every request as a
  four-stage tracker in its path's words (`reqStage`: a renewal is never offered as a quote to accept), and the done page
  as a tracker with Sent ticked. Checked at 360, 390, 820 and 1366 px wide.
- **Motion that pops** (26 October 2026: "can you add more motion and graphics to pop"). All of it is CSS and a little
  script, and all of it stops under reduced motion.
  - **The blue bands** (sign-in and home) end in three soft waves drifting at three speeds, the front one the card's
    own white, with a light gliding across the blue (`SCENE`, put into every `.band` by the script). A road with a
    cartoon car and clouds was tried first and turned down the same day ("I hate the car it's looking like a kid did
    this … more professional"): keep the bands abstract, never a drawing. The sign-in band's icon is an outline shield
    with a tick that draws itself, in a frosted tile.
  - **Line icons, no emoji** (the same day). Every icon in a tile (the three paths, section headers, the documents, the
    notes) is an inline SVG line icon (`svg.i`, stroke `currentColor`, 24-unit grid), white on a coloured tile or in the
    path's colour on a light one. Only the ✓ and ✕ marks remain as text. A new icon is drawn the same way.
  - **Numbers count up** (`cu(n)`): a CSS counter animates on screen while the real figure stays in the text, so a test,
    a screen reader and a copy all read the number. Used on the renewal ring, the band's figures and the request summary.
    The ring fills from empty (`@property --p`).
  - **A dot travels along each path's numbered steps**, behind the numbers.
  - **Taps**: a ripple where the finger lands; a light sweeps the main buttons; icons pop in and wiggle on hover; the
    Renew path's icon pulses while a vehicle is due.
  - **Sections below the first screen wait and rise in when scrolled to** (`reveal`, class `sr`; never `.rv`, which a
    request card already uses), so their bars and rings play when they are seen. Printing shows everything.
  - **Done**: the tick draws itself, the reference stamps in, and confetti in the three paths' colours bursts from the
    tick and clears itself in under three seconds.
- The home page's Motor tile and the profiler's "My vehicle" open `/motor-quote/`. The JotForm is still enabled at Jotform
  until the page is live and wired; disable it then, so an old link does not take a client back to it.

## RR Operations and the Delivery Book — one sign-in, the client told the same day

`rroperations/` and `apps-script/DeliveryBook.gs` (its own Apps Script project,
**RR Operations**, bound to the Delivery Book sheet). Asked for on 15 October
2026, replacing the Jotform delivery book whose "Client's Email" column was
empty on every row. `RROPERATIONS-SETUP.md` is the runbook.

- **One door.** `/rroperations/` is the launcher: one access code, and the tiles
  the Access tab's `Apps` column allows (blank = every app). Apps read the
  backend address from `rroperations/ops-config.js` and the sign-in from
  `rrb-ops-session`. The Gas Receipt Tracker and Petty Cash Tracker are in
  `OPS_APPS` as `soon`; they are built into the same project and flipped to
  `live`, and every app's actions are gated by `opsCanUse_` on the server.
- **The branch app is the door** (18 October 2026: "an app where a person log in ricky rampersad branch and they see log
  book etc", then "they wil only see theirs and their manager sees his team"). `/rroperations/` (short address `/app`)
  signs everyone in with their agent number and fact find password (`lb.login`, the same session the Log Book keeps), and
  shows tiles by role: agents and unit managers the Log Book, the clients board, the fact find and the training; staff
  and the branch manager the Log Book, the Delivery Book, the clients board, group clients, the Premium Due Desk and the
  training; the branch manager also the dashboard, the stream and the groups wall. The scoping lives in each tool, not
  the tiles: an agent sees their own clients and papers, a unit manager his team's. A staff sign-in by agent number now
  carries the Delivery Book too (`lbLoginApps_`). The access-code sign-in is gone from the page; `login` still answers.
  `manifest.webmanifest` makes Add to Home Screen open it full screen. `tests/e2e-deliverybook.js` covers the roles.
- **One sign-in opens every tool, and the app says what each person's day is** (18 October 2026: "when they log in they
  should not have to log back into all the apps and have a proper layout so the agents and staff understand"). The app
  opens on "Your day" (numbered steps for the role, each with its tool), then the tiles under Every day, Each week, When
  you need it, The branch, Learn and Coming soon. `rroperations/sso.js`, loaded first in the head of the clients board,
  its test, the dashboard, wall, stream, responses, the group client pages and the Premium Due Desk, writes the app's
  session into those pages' own keys as `OPS:<token>` with the agent number; a code typed into a tool is left alone, and
  signing out of the app clears what it wrote. The tool's backend asks RR Operations `lb.whoami` who the token is (server
  to server, kept ten minutes; never a password): `tWhoOps_` in Transition.gs finds the person on the Agent Skill Bank by
  number, else name, with every lock `tWho_` keeps (former agents, inactive); `tCodeOk_` opens the walls and dashboard to
  the branch manager's token only. The Premium Due Desk asks `intel.ssoin` (`iActSsoIn_` in Intelligence.gs), which finds
  the person on its access list and issues its own session. So a person must be on the Agent Skill Bank (board, groups)
  and the Intelligence access list (desk) under the same agent number; otherwise that tool shows its own sign-in.
  `RROPS_URL` overrides the RR Operations address in either project. `tests/test-sso.js` covers it.
- **A sign-in by agent number must carry the Delivery Book's lists** (20 October 2026: "staff is not seeing the ability
  to give a cheque or a contract"). `lb.login` returned no `docTypes`, `relationships` or `methods`, so the Delivery
  Book's document list (Cheque, Policy Contract …) came up empty for anyone who signed in through the branch app; and
  until LogBook.gs is pasted, a staff agent-number session does not carry the Delivery Book at all. The page now fills
  the lists from the public `ping` when a session lacks them, `lb.login` returns them, and both the app and the
  Delivery Book take a staff access code again (`login`, the Access tab) as the way in until the paste.
  `tests/e2e-deliverybook.js` signs staff in as the deployed script answers.
- **No agent number: a name and the Branch Portfolio's code** (21 October 2026: Pawan, the driver, "trying to log in as
  Pawan and not allowing … see pawan from the access link", the Branch Portfolio workbook). `lbLogin_` takes a name or an
  e-mail in the number box: a name only one person on the agent lists carries (`lbFindByName_`), then the Branch
  Portfolio's access tabs (`lbIntelPerson_`: any small tab with a name and an Access Code, Access Number or Password column, `LB_INTEL_CODE_COLS`; `lbCheckSignIn("Pawan")` in the editor says which tabs it reads and whether the person is on one, never a code;
  `LB_INTEL_SHEET_ID` overrides `LB_INTEL_ID`), matched by name, first name, e-mail or agent number with that row's own
  code. A Driver role (`lbIsDriverRole_`) gets the Delivery Book alone. The app's box reads "Agent number or name".
  `tests/test-logbook.js` covers it.
- **Who staff may log for: the sign-in lists and Salesforce's active agents** (23 October 2026, from Liz at the counter:
  "Aleema nor Javid name is not listed on the contract delivery or yours Ricky Rampersad"). The "Choose the agent" list
  (`lb.agents`, `lbPickAgents_`) was the fact find's sign-in list less every staff role, so the Branch Manager was
  dropped and agents who do not use the fact find were missing. It is now everyone active on the sign-in lists except
  pure staff (the Branch Manager stays), plus every agent Salesforce marks Active, numbered from the AgentName__c of a
  policy they wrote (`lbSfActiveAgents_`, one small read per agent, kept six hours: a single read of every recent policy
  came back one page, 2,000 of 5,886, and missed Aleema). Someone with no agent record and no policies under their name
  in Salesforce (on 23 October, Mala Balkaran) is added on the RR Operations Agents tab. Anyone the lists mark inactive is never
  added back from Salesforce. `lbValidate_` accepts any agent on that list. Signing in is unchanged.
  **The staff are on it too, by name** (the same morning: "use her name alone as she is a sales support, also ensure
  all my staff is also added"): every active staff row on the sign-in lists, every active row of the RR Operations
  Access tab, and `LB_PICK_EXTRA` (Mala Balkaran; the `LB_PICK_EXTRA` Script property adds more, comma-separated). A
  person with no agent number goes in under their name and shows as "Name · Role"; drivers stay off.
  **One person is listed once** (the same afternoon: "there is now a duplication for RRB support staff"): the two
  sign-in lists write a person differently ("SASHA LALLA" on one, "Sasha Lalla-Jagassar" on the other, "Liz" for
  Elizabeth), so `lbPickHas_` takes the same first name with every other part of the shorter name inside the longer as
  the same person, across every source; a first name alone matches nobody.
- **The Delivery Book film** (20 October 2026: "a small video on the revised delivery process as it also looks up the
  client etc and the client gets an email confirming delivery"). *The Delivery Book, for staff* (`dbstaff`, 1:45):
  `rroperations/delivery-book/deliverybook-staff.mp4`, poster `film.jpg`, page `/deliverybook-film/` (Open Graph for
  WhatsApp), the app's Learn tile (staff and the branch manager) and "▶ Film" in the Delivery Book's header. Drawn by
  `build-boardfilm.py dbstaff` (`s_db*` scenes, `DB_CSS`) from `dbstaff-lines.json`, voiced like the Log Book films
  (Andrew -4% on the tts-run runner) over the Music_Motivation bed; clients and figures made up, Sasha Lalla the staff
  member. Short addresses `/deliverybook`, `/delivery-book`, `/delivery`, `/deliveries` forward to the Delivery Book.
- **Test copies go to sales support and support@ too** (18 October 2026). In test mode every Log Book e-mail and the
  Delivery Book confirmation go to `DB_TEST_INBOX`, copied to rickyrampersadsalessupport@myguardiangroup.com and
  support@rickyrampersadbranch.com (`dbTestCc_`; the `DB_TEST_CC` property replaces the two).
- **The client is picked, never typed.** By policy (spacing-blind: the org
  stores `TT FCP 0100001` and `TTFHO0100002` side by side) or by name; then
  every policy they hold, grouped by record type, to tick ("allow the user …
  access to the different record types and policy numbers the client has").
  A contact is created only on an explicit "Not in Salesforce".
- **Refused whole or recorded whole:** collector's full name, relationship,
  signature, GPS or a reason, a photo for a cheque. Rows are written before
  Salesforce or mail is touched.
- **GPS is ours.** Pin, address and distance from the address on file go on the
  row and the Salesforce task, never in the client's e-mail.
- **Stars** ("an experience star rating … when the client gets the email"):
  five signed links in the e-mail, one rating per delivery, a comment page
  after the tap. Comments are for managers; test-mode ratings never count.
- **Test mode is the default** (`DB_MODE` unset): mail to `DB_TEST_INBOX`, no
  Salesforce writes. Tests: `tests/test-deliverybook.js`, `tests/e2e-deliverybook.js`.

## The Log Book — documents in, routed, signed for, sent the same day

`rroperations/logbook/` (short address `/logbook`) and `apps-script/LogBook.gs`, a second file in the RR Operations
project beside `DeliveryBook.gs`, which hands it every `lb.*` action and the `?lbr=` reason link. Asked for on 15
October 2026, replacing the Log Book Digital Jotform: "the agent puts their agent number and code, the staff signs …
when staff collect the documents the transmittal is built so it's for them to just print and send off … if the
document is received and not sent an email is triggered to the staff and copying sales support and the agent asking
for a reason". Then: "1 day or same day turnaround as the time and date stamped". `RROPERATIONS-SETUP.md` has the steps.

- **The old book, measured** (BU and MAIL PREP tabs, November 2025 to October 2026, 3,634 lines): 41% sent the day
  logged, 72% within one working day, 12% six or more; 13% with no date sent; about 25 departments typed some 90 ways
  and some 70 documents 237 ways; 6.5% with no policy number. So the department and the document are picked, never
  typed, and `LB_DEPTS` / `LB_DOCS` carry the history: each document's usual department with its share, what travels
  with it, and the alias patterns that fold the old spellings. Counts and form names only. `lbRouting_` adds every
  line sent since, so a department staff correct at receipt teaches the suggestion.
- **Four stamps a line:** Logged (agent, or staff for an agent), Received (staff sign; the date collected), Sent (the
  transmittal; the date sent), and the reason when the last two are not the same working day. Returned and Cancelled
  are the other ends. A contract collected to deliver is "With agent" for 20 days (s.155(6)), chased at days 15 and
  18, the manager told at 20, and closed by a Policy Contract delivery on that policy in the Delivery Book.
- **Late** is received on an earlier working day, or today after `LB_CUTOFF_HOUR` (16). The hourly `lbHourly` asks the
  receiver why, sales support and the agent copied, once a working day per line; a reason covers the rest of its day
  and the next. A transmittal will not take a late line without a reason, which prints beside the two dates.
- **Everyone signs in with their agent number and the password they use for the fact find, both** (asked for the same
  night: "it should use the code that are on the fact find sheet"): the Access tab of the Confidential Fact Find Form
  workbook (`LB.FACTFIND_ID`, overridden by `LB_AGENTS_SHEET_ID`), after the Agents tab here. Its Role decides the
  side: only Staff and the Branch Manager get the staff side (receiving, transmittals, insights: "only staff and the
  branch manager can access this"); Agent, Unit Manager and Assistant Branch Manager log documents;
  "Not Active" is refused. A refusal never says which half was wrong. An agent session carries only the `logbook` app,
  so it never reaches the Delivery Book or a staff action.
- **Who sees what** (17 October 2026: "agents only see their information, the branch manager can see all, the unit
  manager can see his team"). An agent: their own clients and their own papers. A **Unit Manager** signs in with that role, logs their own clients like an agent, and gets **My team**: their own papers,
  the whole team's, or one agent's (`lbTeam_`: every active agent whose Unit on the Access tab is the manager's name).
  They see who logged each line, withdraw only their own, and never get the staff side. The branch has no
  assistant branch manager: a row with that role signs in as an agent. Staff and the Branch Manager see
  every line. `lbMine_` refuses an agent outside the team, whoever asks.
- **RR Operations is blue, not gold** (17 October 2026: "my logo i said i dont like the gold", then "my logo colors
  need to change as i have the gold"). The blue shield `orphan-transition/board-mark.png` on a `#13408F` tile on the
  launcher, the Delivery Book and the Log Book, as their favicon and on the printed transmittal; `DB.LOGO` points at the
  hosted copy, so the Delivery Book's client e-mails and every Log Book e-mail carry it. The gold accents went too:
  midnight `#070F26`, accent `#6FA8FF` (`--gold` keeps its name in the CSS), buttons `#2A6DE0` into `#13408F` with white
  type, the e-mail rule `#2A6DE0` into `#00CFEA`. Rating stars stay gold, as stars are. The rest of the site keeps the
  gold shield until asked.
- **An agent sees only their own clients** (16 October 2026: "you don't want persons pulling up other agents'
  clients"): lookup, policies and submit keep to policies whose `AgentName__c` starts with the agent's number
  (`lbAgentScope_`, `lbSfAgentNo_` pads to `A00427`). A client found only through another agent's policy is never
  shown, and a submit naming one is refused on the server. Staff and the branch manager see everyone. A typed client
  (not found) is allowed and flagged.
- **The document is chosen first and the department is routed for it**; the routing can be changed, and the line says
  so.
- **Three working days after a transmittal** (`LB.CONFIRM_DAYS`) the department is asked, from support@ (Graph when
  `MS_TENANT`, `MS_CLIENT`, `MS_SECRET` are copied into this project, else this account with support@ as reply-to),
  to the Departments tab's Email (sales support when blank), copied to sales support, the agents and each agent's
  manager (the person their Unit names, else the branch manager): two buttons, Yes and No (`?lbc=`, signed, routed by
  `lbGet_` so DeliveryBook.gs needs no change for new links). Yes is recorded on the transmittal. No asks what is
  missing, then goes to sales support for a response with everyone copied, and opens a Salesforce task (High, due the
  next working day) for each staff member who collected, owned by their Salesforce user (Access tab, else the active
  user of that name). Test mode: test inbox, no task.
- **What usually travels together is asked about** (16 October 2026, "build more of the additional insights"): a
  document whose companion comes with it `LB.COMPANION_PCT` (70%) of the time or more in the history (ACH and the bank
  statement, a surrender and the Proof of ID) is asked about before logging, with a one-tap Add; logged anyway, the
  line is flagged "Usually comes with …: not included".
- **The client's Salesforce record gets the documents sent** (`lbSfSentTasks_`): one completed Servicing task per
  client per transmittal, on their policy, owned by the sender, listing each document, when it was collected and any
  reason. The line's Salesforce Task column holds the id. Test mode: skipped.
- **The 5:00 pm digest** (`lbDigestRun_`, `LB.DIGEST_HOUR`, once a working day; `lbDigestNow` from the editor) goes to
  the branch manager, sales support copied: the day in tiles, then late lines with no reason, departments that said No
  or have not answered in two working days, contracts at day 15 or more, and papers logged and not handed in.
- **Insights add** the department scorecard (asked, Yes, No, no answer, days to answer) and, per agent, re-routed
  lines, papers never handed in (`LB.NEVER_IN_DAYS`) and a quality score out of 100.
- **The e-mails** (16 October 2026: "ensure the email templates pop"): `lbMailHtml_` draws every one the same way, in
  tables and inline styles only: a navy masthead with the hosted blue shield, a blue-to-cyan rule, a status band whose colour
  and word agree (`LB_TONES`), the headline, figure tiles that wrap three to a row, and the lines as a striped table up
  to three columns or as cards beyond that, so nothing runs off a phone; `lbBtn_` makes buttons Outlook keeps.
  Checked by rendering at 760 and 390 px.
- **The films** (17 October 2026: "the vid to send off", then "two films: agents and staff"). `rroperations/logbook/films.html`
  (short address `/logbook-films`) plays *The Log Book, for agents* (`logbook-agents.mp4`, poster `film-agents.jpg`) and *The Log
  Book, for staff* (`logbook-staff.mp4`, `film-staff.jpg`); the Log Book's "▶ Film" button opens each person's own. They are
  each also has a page of its own to post, `/logbookdemoagent/` and `/logbookdemostaff/` (17 October 2026: "Logbook demo agent, logbook demo staff"; `/logbook-demo-agent/` and `/logbook-demo-staff/` forward to them), with Open Graph tags so a WhatsApp link previews with the poster. They are drawn by `tools/film/build-boardfilm.py lbagent|lbstaff` (the board films' machinery and midnight-blue look; the Log Book's
  scenes are the `s_lb*` visuals and `LB_CSS`) from `lbagent-lines.json` / `lbstaff-lines.json`, then `sfx.py`, `usetrack.py
  audio/inspired-kevin-macleod.mp3 lbagent lbstaff`, `render.js`, `mixany.py`. Every name and number on screen is made up.
  **The voice is Andrew** (`en-US-AndrewNeural`, **-4%**, not the films' usual -12%: the same evening the manager heard
  -12% as "robotic"; his uploaded sample was proved to be that exact voice and setting, so the pace was the cause, and he
  chose -4% over the Multilingual voice), re-cut on 17 October 2026 ("I need Andrew's voice … use actual agents
  as demo and the actual staff names"). Microsoft's speech service is refused by the session's network, so the narration
  is made on a GitHub Actions runner: the `tts-run` branch (never merged, never on Pages) holds `.github/workflows/tts.yml`;
  pushing a `tts/job.json` (`{"voice", "rate", "films": {key: [line, …]}}`) voices every line with edge-tts and commits
  `tts/out/<key>/NN.mp3` and `NN.words.json` (each word's start, from WordBoundary) back to the branch in about a minute.
  The scratchpad's `importvox.py` turns those into `tools/film/vo<key>/NN.wav` and `NN.vtt`, the timing file and
  `durs`. Agents, staff and the unit manager on screen are the branch's own (Neil Ramnanan signs in; Sasha Lalla receives;
  Akaash Kalladeen's unit); clients are made up, and a screen that puts figures beside a real name says "sample figures".
  The agents' film has the bag (`lbbag`), why it matters (`lbhistory`, the old book by the hour: 57% logged after 12 noon)
  and the 11:00 e-mail (`lbnudge`); the staff film has the bag day (`lbbagday`), the weekly rota (`lbrota`), the noon
  e-mail (`lbprep`) and bag in and out (`lbbaglog`). The Kokoro voice of the first cut is retired.
  **The music is the branch's own "Music_Motivation" track** (sent in the chat on 17 October 2026 with an Andrew sample),
  only 28 seconds long, so it is chained eight times with 3-second equal-power crossfades into one 3:25 bed first
  (`motivation-long.wav` in the scratchpad), so the repeat is not heard, then given to `usetrack.py` for `lbagent` and `lbstaff`; it is kept outside the repository, so the Kevin MacLeod credit is not on
  the films page.
- **The bag: in by 12 noon, down at 1 pm** (17 October 2026: "the bags actually come in once a day and leave once a day …
  around 1pm bags come in … rotated by 1 staff member weekly … once it comes in before 12 … it should be able to catch the bag …
  agents should be aware if it will catch the bag"). `LB.BAG` (`LB_BAG_CUTOFF` 12, `LB_BAG_HOUR` 13): papers in the branch's
  hands before 12:00 on a working day go on that day's bag (`lbBagDay_`), anything later on the next working day's.
  A received line is late once its bag has gone (`lbIsLate_`), and a sent line made its bag when its transmittal was done
  by 2 pm that day (`lbOnBag_`, `GRACE_MIN`; an imported line, which has only a date, by the day). The hourly run: at 11:00
  agents with papers logged and not handed in are told there is an hour (`lbNudgeAgents_`); at 12:00 whoever has the bag gets
  what to prepare by department (`lbBagPrep_`, once a day); from 1:00 every line that missed its bag is asked about, the
  receiver and the person on the bag both written to, while everyone is in (the staff leave from 2 pm). Who has the bag: the **Bag Rota** tab (Staff, Order, Leaves At, Active) if it has rows, else `LB.BAG.ROTA`. **The rota is Azariah, Elizabeth (Liz) and Sasha, a week each, Azariah from Monday 19 October 2026**, so the week of 12 October was Sasha's. These three are the ones who do transmittals; **Kamla does not do transmittals and is never on the bag** (the manager, 17 October 2026). **Sasha leaves at 2 pm, Liz at 3 pm and Azariah at 4 pm**, so the bag is done by 1 pm while all three are in. Each first name is read as the full name on the sign-in list, so the 12:00 e-mail finds them (`lbRota_`, `lbDuty_`). Staff press Bag in (cleared, the mail given out) and Bag out (sealed, with what went and
  what missed it) on the **Bag Log** tab (`lb.bag`). The page shows everyone the bag bar: a countdown to 12:00, the day's
  track with the cut-off, the exchange and when the team goes home, who has the bag; the log form and the "Logged" card say
  whether the papers catch today's bag; every line carries its bag; Insights shows the share that made its bag, by the hour
  received. Measured on the old book (3,605 lines, Aug 2024 to Oct 2026): 57% were logged after 12 noon; of those before,
  56% went that day; the 12:00 hour (504) is busier than any morning hour, and 2 pm and 3 pm are the busiest of all.
- **The training: the manual and a scored test, by role** (17 October 2026: "a training manual for both the agent and
  staff so they can log in and do the questions and get scores", at "rickyrampersadbranch/logbook training").
  `rroperations/logbook/training.html`, short addresses `/logbook/training` and `/logbooktraining`. It signs in as the Log
  Book does (agent number and fact find password, or a staff access code; the same `rrb-ops-session`, so a phone signed in
  to the Log Book is signed in here). Agents and unit managers get the agent manual (the three rules and seven sections) and
  the agent questions; staff and the branch manager the staff manual (the rules and seven) and the staff questions. Each
  section is ticked as read (kept on the device). After an attempt every answer shows, right or wrong, with the reason:
  the test teaches. A pass is `LB_TRAIN.PASS` (80) per cent with every critical question (the three rules) right; retakes
  are open. Results: an agent their own attempts, a unit manager their team's and who has not taken it, staff and the
  branch manager everyone's and the questions most answered wrongly. `lb.train`, `lb.trainSubmit`, `lb.trainView` in
  LogBook.gs. **The questions live on the private "Log Book Questions" tab of the RR Operations sheet** (or the sheet
  `LB_TRAIN_SHEET_ID` names): Id, Roles (agent, staff, all), Section, Question, A–D, Answer, Why, Points, Critical. They
  reach the page without their answers, and never enter the repository: the bank is built in the scratchpad
  (`lbtrain/bank.py`, 29 questions: 3 rules, 14 agent, 12 staff; the right answer never the longest option, spread A to
  D). Every attempt is a row on **Log Book Training** and an e-mail to the person, the branch manager copied (follows
  `DB_MODE`). `tests/e2e-logbook-training.js` covers it with a made-up bank (31 checks).
- **Every RR Operations e-mail goes from support@rickyrampersadbranch.com** (18 October 2026: "would like this coming
  from rickyrampersadbranch.com … any other emails with communications"). `lbGraphSend_` in LogBook.gs sends through
  Microsoft Graph as support@ (Sent Items kept) when `MS_TENANT`, `MS_CLIENT` and `MS_SECRET` are in this project's
  Script properties; `lbMail_`, `lbSupportMail_` and the Delivery Book's `dbSendConfirmation_` all try it first and
  fall back to Gmail when it is not set or Microsoft refuses. The fallback (`lbAppMail_`, `lbGmailFrom_`) sends from support@ too when the script runs under the support@ Google account, or when the owning Gmail has support@ as a verified "Send mail as" address (`GmailApp.getAliases()`); otherwise it sends from the owner's Gmail with support@ as the reply address. Test mode still sends only to the test inbox.
  `tests/test-rrops-mail.js` covers it.
- **LogBook.gs carries its own test-copy Cc** (`lbTestCc_`, 23 October 2026). The live project's DeliveryBook file
  (`Delivery.gs`) is older than the repository's and has no `dbTestCc_`, so every Log It in test mode failed with
  "dbTestCc_ is not defined". LogBook.gs must not call a `db*` function the live `Delivery.gs` lacks; check the live
  file before relying on a new one.
- **Every Log Book e-mail is internal** and follows `DB_MODE`. Imported history is never chased or sent.
- Tests: `tests/test-logbook.js`, `tests/e2e-logbook.js` (the page against the real script in the harness;
  `GS_PATH` now takes several files, comma-separated).

## The strategic meeting page — the two days, the record under each session, and what the branch will say

`strategic-meeting/index.html` (short address `/strategicmeeting`) and `apps-script/StrategicMeeting.gs`, a fourth
file in the Service Questionnaire project, routed by two lines in `Service.gs` (`sm.*`), the way `GroupClients.gs`
is. Asked for on 20 October 2026, two days before the Joint Sales Managers' Strategic Meeting (Hyatt Regency, 22 and
23 October): "build a framework with all you have under rickyrampersadbranch/strategic meeting so you can have the
days and topics and make a contribution, you and Akaash can log in to contribute items and business intelligence can
guide you. In your session review notes on the step back in place from all memory."

- **The page** holds the agenda as the company issued it (every session, its time, its facilitator, its brief and
  its guiding question), and under each session three things written from the house notes: what the branch's own
  record says (counts and dates, never a client), a position the branch could take, and questions to put to the
  room. Then the contributions logged for that session, the add form, and the AI guide. Tabs: Day 1, Day 2,
  Step-Back notes, Logistics (the memo of 16 October), and a printable brief for the room. The branch manager's own
  slot (Friday 11:25 to 12:00, Recruitment & Retention, with Gregg Mannette) opens by itself and is marked. The
  agenda is company-internal, so the whole page sits behind the sign-in.
- **Sign-in is the assignment board's** (`tWho_`: the branch code, or an agent number and the password from the
  Agent Skill Bank; the same two localStorage keys, so a phone signed in to the board is signed in here). **The
  branch manager and a unit manager write; staff and agents read** (`smCanWrite_`). A contribution is a kind (fact,
  position, question, recommendation, definition, note), the point, the evidence it rests on and what it asks of the
  room; it is a row on the **Strategic Meeting** tab of the Service Questionnaire sheet. Taking one back marks the
  row removed and by whom; the row stays. A unit manager takes back only his own; the branch anyone's.
- **The live counts beside the notes** (`smFacts_`, kept ten minutes) are the campaign stream's own answer (households
  answered, letters, reminders, answers after the reminder, outcomes on the board in seven days: counts, no names),
  the TT$200 claims found, submitted and paid, and the team on the Agent Skill Bank by role and unit. Each source is
  read inside its own try, so a tab that is not there leaves a gap, never an error.
- **The AI guide** ("Guide me: three points from the facts", `smGuide_`, through `gcmClaude_` and the same
  `ANTHROPIC_API_KEY`) is sent the session, the page's notes for it, the live counts, every definition logged, and
  the contributions so far, and answers three points as JSON, each with its evidence and its ask, plus one caution on
  what the material cannot support. It is told to invent nothing, add no number not given, and never name a client
  or a former agent. One read per session and set of contributions, kept half an hour. "Use this" fills the form; a
  person edits and logs it. Without the key the button is off and says what to set.
- **The industry evidence sits beside the record, with its source on every line** (asked for the same day: "research
  the web and build in intelligence so you could contribute meaningfully towards each topic … we need to have our
  objective and make our voice heard"). `EVIDENCE` in the page is one block per session, each line a finding with a
  key into `SRC` (name and https link, 20 sources on 20 October 2026: LIMRA's 2025 conference deck with the FP
  Production & Retention curve, the 2019 Career Profile study and the 2022 LIMRA/FINSECA retention study; DDI's
  Global Leadership Forecast 2025; Gallup on managers and on recognition; Capgemini and LIMRA's World Life Insurance
  Report 2027; J.D. Power 2025; the NAIC, the IAIS and ACFE 2024 on fraud; the Central Bank's 28 July 2023 market
  conduct circular; the Broker Protocol study in the Journal of Financial Economics). A vendor's claim (Atidot on
  orphan lapses) and a second-hand figure (the J.D. Power 63%) are marked as such in the line itself, so the room
  hears the caveat with the number. `SAY` is a sixty-second template for each key session: the branch's record
  first, the evidence, the position, the ask, with the live numbers in brackets to read off the tiles. `OBJECTIVE`
  is the branch's own five-line objective for the two days, a draft the branch manager edits by logging a position
  against the session key `objective`. The brief prints all three and ends with the sources. The guide is sent the
  evidence and the sixty seconds with the notes.
- **The Step-Back notes say plainly what the record does not hold.** Nothing on the branch's record defines the
  Step-Back Approach as a recruitment or career-path method; the only "step back" on file is the motor No Claim
  Discount rule. The tab gives what bears on the agenda's question (how the tracker counts recruitment, the licence
  tenure bands, what September's departures did to the roll, the measure and the position the branch can put on the
  table) and asks for the definition in the company's words, logged with the kind "definition", which the guide then
  reads for every session. Do not write a definition into the page from memory: it has to come from the company.
- **Until the paste** (Service.gs and StrategicMeeting.gs, then a New version), the backend answers "Unknown action":
  a sign-in opens on the device (the code cannot be checked yet) with a notice saying so, contributions are kept on the
  device (`rrb-sm-local`) and offered to the sheet once the backend is linked.
- Tests: `tests/test-strategic-meeting.js` (65 checks, the script under the fake Sheets with the sign-in, the stream
  and Claude stubbed, then the page and Service.gs against it) and `tests/e2e-strategic-meeting.js` (28, Playwright,
  a laptop as the branch, a phone as the unit manager, and the unlinked backend).

## Standing rules

- **Client data never enters the repository.** `Orphan-Register.xlsx` and
  `Manager-Insights.html` are local-only.
- **Guardian-only scope** stays in `Service.gs`: if a policy was not issued by
  Guardian Life of the Caribbean, the file is closed and the client is pointed
  to their own insurer.
- **Branch:** develop and push to `claude/service-questioner-automation-6ihjzn`.
  No pull request unless asked for one.
- **Two marks, two products, on purpose.** The branch site
  (rickyrampersadbranch.com) carries the gold shield in `logo-mark.png` — the
  house rule above. donthaveanagent.com carries **The Knot** in Ink & Coral,
  because it is presented as a Ricky Rampersad project that stands on its own.
  Do not "correct" one into the other.
- **This is a Ricky Rampersad project**, not a Guardian Life one. The brand is
  Ink & Coral — `#0F1A2B` ink, `#1B2A44` surface, `#FF5C4D` coral, `#FFE9E5`
  tint, `#FFF6F4` paper, `#6B7C96` muted — with The Knot as the mark. Guardian
  is named only where it is a matter of fact: the insurer, the form, the
  customer-service desk.
- **The tracker has no time blocks** (Ricky, 17 October 2026). Every desk's
  day in `KPI.gs` `SCHEDULE` is one plan, block `KPI1` labelled "Your day",
  spanning the desk's own hours: plan by e-mail and the morning check, progress
  before lunch (the Unit Manager at 11, agents at 12), close-out half an hour
  before finishing, the week on Friday. No morning check reads as absent and
  the work is shared out. Hours: Branch Manager 5am–3pm, BMA 8am–5pm, Sales
  Support 7–2, 7–3 and 8–4, Unit Manager and agents 6am–6pm. The other block
  columns stay on the log so history reads; do not schedule into them again
  unless the branch splits the day.
- **"Not getting attention" (the command centre)** closes things, not only
  moves them (18 October 2026). Each row has a status from the record's own
  list (Salesforce's `TaskStatus`; the letter sheet's own values), its history
  (Chatter posts and replies; a letter's e-mail trail, escalation, response and
  BM comments; a query's comments) and a suggestion read from that history.
  Closing needs a note and the note is posted before the close; a task where
  the client asked for an agent cannot be closed. A letter closed here also
  resolves its open escalation and writes `BM Comments` and `Audit Log` in the
  Productive Performance Management workbook. Query Pal queries are closed in
  Query Pal, so the client is told. Pinned in `tests/test-cmd.js`.
- **The e-mail answer pages are built for a phone** (18 October 2026). Boxes
  are 16px and 44px tall (an iPhone zooms in on anything smaller; the old
  `font:14px/1.4 inherit` was invalid CSS and fell back to 13px). The command
  centre folds each row to one line (age, title, who, why, a badge for what the
  system found), filters with sticky chips (what it found, source, desk), has
  a one-tap "Close it" that fills the status and a closing note, and counts
  the changes on the send button.
- **Query Pal deep dive** (`f=qp`, `qpDivePage_`): read only, from the Query
  Pal workbook's Queries and Comments tabs. Each query is judged against its
  own Turnaround; sentences first, then the evidence. Linked from the command
  centre and the 5am e-mail.
- **Fact-find chase** (`ffChaseTick_`, `f=agff`): Monday 7:00 asks every
  agent with no fact find in 14 days (Salesforce Fact Finding Interviews, and
  nothing this week on FactFind360) for a response; Wednesday reminds the
  silent, manager copied; Friday sends the managers the week. Answers go to the
  Fact Find Responses tab; help asked for becomes a Salesforce task for the
  manager. The link is good for the week. Script Property `FF_CHASE`
  (`live`/`preview`/`off`, unset follows `AGENT_DAY`). Every send checks the
  daily e-mail quota first. Pinned in `tests/test-qpff.js`.
- **Risk score and the client in one view** on the command centre (18 October
  2026, `cmdRisk_`, `cmdClientIndex_`). Each item's client is looked up across
  the open Salesforce book (the task's What name), Query Pal, the log book, and
  Branch Intelligence's cache (premiums overdue, pending business, last night's
  lapses); names match on all their words in any order, titles dropped, or on
  two words of four letters or more. The score (0–100) weighs the payoff order
  (new business, orphan, retention), age, a client waiting or unhappy, money at
  risk, the client open elsewhere and the advice tag; reads-as-done drops 20.
  The page runs highest risk first, opens with "Do these first", and lists
  clients open in more than one place.
- **The command centre is in tabs under a brief** (18 October 2026): Act,
  People, Agents, Clients, Query Pal. The brief is five or six sentences built
  from every tab (`cmdBrief_`). People (`peopleNormal_`): each desk's closures
  a day over the last 5 working days against their own median over the 15
  before, absent days left out; slipping under 70%, ahead over 130%; late and
  absent of the last 10 days; overdue and untouched; notes answered. One
  aggregate SOQL (`DAY_ONLY(convertTimezone(CompletedDateTime))`), cached 10
  minutes. Agents (`agentFunnel_`): FactFind360 month fact finds and apps
  against Salesforce interviews; flags no applications, converting, none.
- **Claude reads the notes when `ANTHROPIC_API_KEY` is set** (`cmdClaudeRead_`):
  one call per opening for items whose newest note has not been read, cached
  6 hours per item and note (a "no read" is cached too). States: done,
  waiting_department, waiting_client, client_unhappy, in_progress, blocked,
  unclear. Done and unhappy override the rule's advice and move the risk.
  `ANTHROPIC_MODEL` defaults to claude-haiku-5-5. No key, no call.
- **My day** (`f=me`, `mePage_`, 18 October 2026): the Branch Manager's page
  on ONE link that works every day (signed `replySig_(sid,'always','me')`, no
  date), for the phone's home screen. Plan first if the day is not planned;
  next up (notes asking him, his tasks due by payoff, his instructions with no
  note) with reply and close-with-note; capture as a task for him, for a desk,
  or done already (a completed task, so it counts); the account against the
  plan saved as the day goes (`MGRDAY` kind `eve`, the same record the 3pm
  close reads). Check-in e-mails at 7:00, 9:00 and 1:00 (`BM_NUDGES`), plan
  first then the next three. `showMyDayLink()` logs the link. Pinned in
  `tests/test-me.js`.
- **Accountable** (`bmSelf_`, 18 October 2026): the Branch Manager's own day
  on the same record as the desks'. Planned or not and when (`mgr_planat_`);
  each check-in answered (anything logged after it, within two hours or before
  the next: My day, the plan, the account, the `bm`/`cmd` reply pages, logged
  in `me_log_`) or missed; each planned number against the account; accounted
  or not; closed with his own note. The 11am and 3pm reports lead with "You
  against your plan" (3pm adds the Mon–Fri week; the subject says "not
  planned" / "day not accounted"), the check-ins name a missed one, My day
  shows it with the week, the 5am review opens with yesterday's line. The
  day's line is kept in `bm_self_` on every page view, check-in and report;
  `acctPrune_` keeps 14 days of logs and 120 of lines. Pinned in
  `tests/test-me.js`.
- **Ricky's own mails go to him alone** (`ownMail_`, 18 October 2026: "Don't
  copy anyone on mine"): the 5am review, the 11am progress, the 3pm close-out
  and the check-ins carry no Cc. Every other desk's mail, and outbound client
  drafts, still copy sales support.
- **`closeOpenPerformanceLetters()`** (19 October 2026, run from the editor):
  Ricky asked for every open performance letter to be closed. Each open row on
  the PPM Letters tab goes to `Completed` through `ppmSetStatus_` (escalation
  resolved, his note on BM Comments, audit log). Returns what closed and what
  did not.
- **A desk with no Salesforce login** (`noSfLogin_`, 19 October 2026: Akaash
  is not a registered Salesforce user). His task links go to his own comment
  page (`f=um#i<id>`), never Salesforce; the page shows the latest two notes on
  each task with the whole history a tap away, invites him to speak his comment
  (the keyboard microphone), and posts it to Chatter headed "Unit Manager · <name>";
  `um_posts_` counts them. The morning opens with "Your agents · goals and
  activity" (`teamFFCard_`) and "What you are doing" (`umSelfCard_`: plan,
  numbers, account, comments). `unitAgents_` lists each agent once.
- **No Salesforce links for anyone without a login** (19 October 2026: "they
  are only allowed to post where the task is open, view the history, and they
  can speak, but don't allow them to open in Salesforce"). Unit Managers with no
  login (`noSfLogin_`) and every agent: task links in their morning, 5:30pm and
  agent mails go to their own comment page (`f=um`, `f=umeve`, `f=ag`, anchored
  `#i<id>`); those pages show `chatterNotes_` (latest two, the whole history a
  tap away) and the `SPEAK_PH` box; the command centre drops "Open in
  Salesforce" for them. Ricky and the staff keep their Salesforce links.
- **Day items in pieces** (`bigPut_`/`bigGet_`): the unit, agent, plan and
  fact-find lists were cut at 8,900 characters, and cut JSON read back as
  nothing. They are kept in 8,000-character pieces now.
- **The mailbag leaves at 12 noon** (`mailbagLeaves_`, Script Property
  `MAILBAG_AT`): documents to the router by 11:45; the 11:15 call
  (`sendMailbagCall_`) goes to the router and everyone holding documents; the
  morning cards and the before-you-leave check say the 12 noon bag; anything
  collected after it goes in tomorrow's bag. Pinned in `tests/test-unit.js`.
- **My unit** (`unitPage_`/`unitSave_`, f=`unit`, 19 October 2026): the Unit
  Manager's one page, on one link that works every day (`unitSig_`, signed with
  'always' like My day; `showUnitLink()` logs it). A brief (API pace as at today,
  pendings, agents planned, his plan) and "Do these first" (`unitPriorities_`:
  plan not set, a staff note asking him by name, an absent agent, an overdue
  pending with who holds it, an agent asking for help, behind API pace, an open
  performance letter, no goal plan, no fact find this week, a task untouched 14+
  days), each with its reason and a jump to its place. Tabs: Today (plan and
  done side by side for every UM_CHECKS number, his agents today, a task for a
  desk), Unit work (who holds the unit's work, by desk; every open task with the
  history and a type-or-speak box), Agents (the unit against its FY27 goals,
  then each agent), You (his own goal, manager numbers this week, coaching notes,
  his week). One Save posts comments as his, keeps plan/done via `mgrWrite_`,
  makes desk tasks, signs him in. Nothing links to Salesforce. First button in
  his 6am, 11am and 5:30pm mails. Ricky's 11am/3pm mail links a read-only view
  (f=`unitv`, `unitViewSig_`, a disabled fieldset, no form). Pinned in
  `tests/test-hub.js`.
- **The scoreboard** (`scoreboard_`, `sbBars_`/`sbMeter_`/`sbSplit_`/`sbDots_`,
  19 October 2026): every role's page opens with up to four numbers, each with
  a little inline-SVG chart drawn to scale and each a link (data-go, `sbJs_`) to
  the detail behind it. My day (`meScore_`: branch closed, waiting on you, plan
  met, you closed), My unit, Your day (`agScore_`, with "Your year"), Your plan
  (`ssScore_`), Your errands (`errScore_`), Before you leave (`hkScore_`). The
  five-day bars read closed tasks per desk per day once (`deskClosedOn_`, kept
  as `dk_<day>` for three weeks). Pages only: Outlook does not draw SVG.
- **The register at both ends** (`NOCLOSE`, 19 October 2026): Before you leave
  is the sign-out (sign-out ticked by default); each planned task not done needs
  a reason and a new date (`commitRow_`/`commitTasks_`: the date patched on the
  task, the reason on its Chatter). No automatic sign-out at the finish any more:
  a reminder at the finish (`notClosedReminder_`), and at finish + 30
  `markNotClosed_` writes "Did not close the day" on the register (Status
  unchanged; Script Property NO_CLOSE_MARK=absent marks absent instead), mails
  the person cc Ricky and sales support, flags two in a week. The next morning's
  plan opens with yesterday first (`yesterdayOpen_`, inputs yr_/yd_) and does not
  save until it is accounted for (`ncdone_`). Pinned in `tests/test-score.js`.
- **The BMA's page** (`bmaScore_`, 19 October 2026): Kamla's plan page opens on
  her job: her desks today (a dot each: in, planned, absent), Mr Rampersad's
  instructions with no note yet (hers and her desks'), the desks' work gone
  quiet (bars by desk, hers as "You"), Query Pal by age; each opens a card below
  the plan. `planTally_` counts the day's plan live until the block closes, so
  Before you leave and the 4pm report no longer read "no plan" before the close.
- **The agent's projection and the balance** (`AGENT_METRICS` p/d/s, `agBalance_`,
  19 October 2026): Ricky, "you can't say calls made. It's projected calls to be
  made ... they balance off at the end of the day." The morning mail and page ask
  what is to be done (`p`: Calls to make, Appointments to set ...), never what was
  done; the 5:30 page asks what was done (`d`) with "you projected N" beside each
  line and the balance as it is typed (`.agbal`, `data-proj`; filled server-side
  when reopened). The saved close shows the day balanced (`agBalanceCard_`); the
  copy to the manager and support carries projected, done, balance and the total
  in its subject; the managers' table reads "Projected · done · balance". Sheet
  columns stay Planned/Done. Statuses: projection in / no projection yet / absent
  (no projection). Pinned in `tests/test-balance.js`.

- **A close-off with no address is not sent (19 Oct 2026, 2026-10-19j).** `hkSend_` reports whether the close-off really went; with no e-mail on the Acess tab the day stays open (scheduled run counts it as a failed try; `sendHousekeepingNow` logs "NOT sent, no e-mail address on the Acess tab"). `resendCloseOffNow()` (editor) sends today's close-off again even where the day is marked. Pinned by `tests/test-closeoff-address.js`.

- **Unit Manager links open his page, with the task's history and a box (19 Oct 2026, 2026-10-19k).** `noSfLogin_` is true for every `UM_DESKS` member (and for an inactive Salesforce user): Akaash's 5:30 mail had sent "open →" to Salesforce because a user record carries his e-mail, and there he could not see Darryl's history or post. Comment links carry `&i=<taskId>`; `umReplyPage_`/`umEveReplyPage_` open with "The task you opened" (whole history, its own box, **Post my comment**). `umEveReplySave_` posts comments first: `only=1` posts them alone, and an account with blanks keeps the comments posted and the numbers typed. Pinned by `tests/test-um-comment.js`.

- **My unit: filters, and his agents' queries beside the pendings (19 Oct 2026, 2026-10-19m).** Unit work opens with a sticky filter bar (`unitFilterBar_`), kept plain after Ricky called the first version cluttered: two drop-downs (an agent; what to show: Everything, Pendings, Client queries, New business, Retention, Other, Overdue, Quiet 7+ days, No notes yet, each counted) and a search box (client, policy number, any word). "Who holds your unit's work" sits below the lists, and each item's line is short (who has it, due, notes) with status and untouched inside. Items carry `data-ag/kind/late/quiet/nonote/q` (`unitFilterAttrs_`); `UNIT_FILTER_JS` does the rest in the page; in Ricky's read-only view the bar is moved out of the disabled fieldset so it still works. `unitModel_` adds `m.queries` (open Query Pal queries for the unit's agents) and `m.qpc` (their trails); a query opens to reference, policy, turnaround, days open, follow-ups, description and the whole trail. A note on a query (`q_<i>`) goes on Query Pal's Comments tab through `qpNote_`, role staff, marked **internal** in the unheaded sixth column, so the client never sees it. Each agent card counts his queries and has "<name>'s pendings and queries →", which opens Unit work filtered to him. "Quiet" ignores Query Pal's own System progress mails. Pinned by `tests/test-unit-filters.js`.
- **Pick an agent on My unit: his day, and a note with no task (19 Oct 2026, same version).** Ricky: "if there are no tasks he should know, and an area to place comments on if he does not see anything". Every agent is in the agent drop-down, even with nothing open. Picking him shows `unitAgentDayCards_`: status, what he projected, done and balance after the close, API pace and fact finds this week, "Nothing open for <name>: no pendings, no client queries" when so, his last notes, and a box `an_<name key>`. A note goes to the tracker's **Manager Notes** tab (`MGRNOTE`: Date, Agent, From, Note, At, Sent) and into the agent's next morning e-mail under "From your manager" (`umNotesUnsent_`, last 7 days); it is marked Sent only when the mail really goes to the agent (AGENT_DAY live), never on a preview. The page keeps its agent list (`unit_ags_`) for the save.

- **Branch Intelligence asks why on quiet and re-dated tasks (19 Oct 2026, 2026-10-19n).** Ricky: "use AI intelligence: if there are no Chatter notes on a task, especially over 3 days, post a note asking why, especially when tasks are being moved forward." Once each weekday at 9:15 (`housekeepingTick_`, key `chase_<day>`), `chaseQuiet_` reads the desks' open tasks due within 7 days or overdue (`chaseTasks_`, owners = `DAY_MAIL_DESKS` with a Salesforce user), keeps a daily snapshot of due dates (`due_snap`) and logs every forward move on the **Due Moves** tab (`DUEMOVES`, Noted yes/no). It posts one Chatter note headed `Branch Intelligence · <date>` on a task moved with no note (first) or with no note from a person in `CHASE.QUIET_DAYS` (3) days, never twice in `CHASE.EVERY_DAYS` (3), at most `CHASE.MAX` (30) a day. `chaseWrite_` has Claude write each note from the task and its notes when `ANTHROPIC_API_KEY` is set (model `ANTHROPIC_MODEL` or `CLAUDE_READ.MODEL`), a plain question otherwise or on any failure. Mr Rampersad gets the list (`chaseReport_`). `CHASE_QUIET = off` stops it; `chaseQuietPreview()` shows what would be asked, posting nothing; `chaseQuietNow()` runs it. The history under a task (My unit, the command centre) shows its date moves (`dueMovesByTask_`, `dueMovesLine_`), opened date and client. Pinned by `tests/test-chase.js`.
- **My branch for Mr Rampersad (same version).** "And me?": `unitUrl_('ricky')` opens the My unit page for the whole branch: `unitAgents_('ricky')` → `branchAgents_()` (every active Skill Bank agent, by unit), the agent drop-down grouped by unit (`<optgroup>`), posts signed `Branch Manager` (`unitRole_`). A **My branch** button is in his 5am mail; `showBranchLink()` logs the link.
- **My tasks on My branch (20 Oct 2026, same version).** Ricky: "my opened task by type I am not seeing, and a tick for me to close off, or move the date forward". For `ricky` the page has a **My tasks** tab (`myTasks_`, `myTasksSec_`): his open Salesforce tasks grouped by type (most overdue first), each with its status, client, opened date, date moves and history, a **Done: close it** tick (`done_<id>`), a **move to a new date** box (`mv_<id>`) and a note (`c_<id>`). A move needs a note saying why (refused otherwise); the note goes on the task; the move is logged on Due Moves as noted. Every close and move is kept with before and after on a **Task Changes** tab (`TASKCHG`, `taskChangeLog_`) for undo. His own tasks show only on My tasks, not again under Branch work. `DUEMOVES.must` includes `Noted` so it is never mistaken for Workload Moves (same four other headers); `dueMovesByTask_` also reads Workload Moves (the tracker's own re-dates, with their reason).

- **The agents, ready to go live (20 Oct 2026, 2026-10-20a).** Ricky: "remove from the agents the underperformance letters … just as Akaash, have the task open on the agent's pendings, the ability to post an update in a text field that will send it directly to Chatter … I would like to activate this morning." The agent's morning mail no longer carries `agLetter_`. Each task link says "open & comment" and carries `&i=<taskId>`; `agReplyPage_` opens with "The task you opened" (who has it, due, date moves, the whole history, its box, **Post my update**), the rest listed with a box each and **Post my updates**. `agReplySave_` posts updates first: `only=1` posts them alone; a projection or close-off with blanks keeps the updates posted and the numbers typed. Previews use `agp_` marks, so this morning's previews never stop an agent's own mail once `AGENT_DAY` is live (the morning window runs to 10:00, eight agents a run). Pinned by `tests/test-agent-ready.js`.

- **Renewals and premiums owed on My branch (20 Oct 2026, 2026-10-20b).** Ricky: "built into my module … the renewals that are coming for the week, tomorrow, and for the month, and year-to-date analytics, as well as the open tasks associated with renewals, the ability to move forward the task, comment on the task, and premiums that are owed for the month and year-to-date, and what is happening with it." For `ricky` My branch has a **Renewals** tab (`rnModel_`, `renewSec_`), between My tasks and Branch work. General insurance: `rnRisks_` reads Risk_Details__c (one query, terms ending this year and successors to March two years on); a term renews the day after its cover ends (`Next_Renewal_Date__c` when it is within 3 days of `To__c`, else `To__c` + 1); duplicate rows (policy, vehicle, end date) count once; renewed = a later term (60+ days on) on file for the same policy and vehicle, or the same vehicle under a new number. Tiles: tomorrow, next 7 days, the month, renewed so far this year (count and premium due, never "owed"); lists for today, tomorrow, the rest of the week, the rest of the month and "due earlier this month, no renewal on file", each showing the renewal on file, or its task and last note, or that nothing is on it; month-by-month bars (`rnMonthsSvg_`) and table; the year's no-renewal list, largest first. Open tasks (`rnTasks_`): the `Renewa/PDl/Bill` type, any open task on a risk renewing this month (WhatId), any open task naming a policy under premiums owed; his own stay on My tasks; each has a note (`rc_<id>`) and a new date (`rmv_<id>`, needs a note, not in the past), logged on Task Changes and Due Moves; renewal tasks no longer repeat under Branch work. Life premiums owed (`rnLife_`, from `iLoadCache_().dues`, a digest kept 20 minutes in CacheService as `rn_life_<day>`): owed now, fell due in the last 30 days (0–30 band), since 1 January (chase list paid-to ≥ 1 Jan plus the 0–30 band), lapsed this month and year, the ageing bands, lapsing next (15, soonest), lapsed this month (12, largest), owed 31+ days by agent; what is happening on each = the open task naming the policy, else the last one closed in 30 days (`rnClosedFor_`), else "no one is on it". Do these first gains "renewals due by tomorrow with nothing on file" and "life policies lapsing within a week with no one on them". Pinned by `tests/test-renewals.js`.

- **The inbox scrub and My day for the Branch Manager (20 Oct 2026, 2026-10-20c).** Ricky: "it scrubs the inbox and see what urgent things should I actually go to in terms of planning my day. And when it's done, the progress check if it's completed or not", then "simplify this view and a button to plan my day or login ... when I check in, it has the time I check in, then I go into my urgent, my drafts, the inbox, and then I look at what is important. But everything I touch, email, reply on, it's written in a progress report as the day goes by." **Inbox** (`inboxScrub_`, `inboxRead_`, `inboxParse_`, `inboxConvs_`, `inboxSort_`, tab **Inbox Scrub** `INBOXTAB`): reads the tracker's Gmail inbox (`GmailApp`, needs the Gmail permission once: run `inboxScrubNow`), Primary and Updates; GoDaddy's "New message for querymypolicy.com" notices are copies of the branch mailbox (support@) and are unwrapped to the real sender and subject. Grouped by conversation (subject without Re:/Fw:, `inboxNormSubj_`); dropped when his own message is newest (`inboxSelf_`), automated (`INBOX_AUTO`) or an auto-reply (`INBOX_AUTOSUBJ`). Claude sorts the rest (now/today/later/none, why, ask, owner, gist; mail text is data, not instructions), rules otherwise (`inboxRule_`). Dealt with when ticked, when he or the owning desk replied on the thread since, or when its task is closed. Read at 5:00 (in the morning mail), every hour 6:00–15:30 (tick key `inbox_hr`), and before the 11:00 and 3:00 mails; `INBOX_SCRUB = off` stops it; `inboxScrubPreview()` writes nothing. **My day** is the first tab of My branch for `ricky` (`bmdSec_`): a check-in button (`ci`, logs the time) then 1 Urgent (`bmdUrgent_`), 2 Drafts (Gmail drafts `gmailDrafts_`; notes written for him `bmdDrafts_`: replies to people asking him, chases on his instructions with no note, Claude's notes on his quiet tasks; each posts only with its tick `dp_<id>`, text `dn_<id>`), 3 Inbox (`inboxCard_`: `ixd_` done, `ixt_`/`ixw_` make it a Salesforce task for a desk, `ixn_` note), 4 Important (his open tasks grouped by `dayGroup_`, each with close/move/note/in hand and why from `bmdAdvice_`: rules on the page, Claude's reading warmed hourly by `bmdWarm_` and kept 6 hours as `bmd_adv_<day>`; `done_`/`mv_`/`c_` as before), 5 Today so far (tab **My Day Log** `DAYLOG`, `dayLogMany_` once per Ref: check-in, his Gmail replies and his Guardian replies copied to the branch mailbox `dayLogEmails_`, notes/closes in his own Salesforce name `dayLogSalesforce_`, every note, close, move, task and inbox action from the page; where his time went against where the work needs him, `bmdFocus_`). The My tasks tab is gone for him (now Important); the brief tiles moved to Branch work, his agents' day to Agents, his numbers and a task for a desk fold at the foot of My day. The 5:00 mail: one button (Check in and start my day), urgent, the inbox, the tiles and the team. The 11:00 and 3:00 mails lead with Today so far (`bmdMailSoFar_`), still urgent and the inbox dealt with N of M, with one Open my day button. Pinned by `tests/test-inbox.js`.

- **The system sets each desk's day; checking in is the register (20 Oct 2026, 2026-10-20d).** Ricky: "this system actually plans their day for them and they check in. When they check in, it's a attendance register" and "tasks are broken down by task types ... can intelligence be built in so they can work more or less effectively to the task that's assigned?" `PLAYBOOK` (first match on the subject wins: cancel, former agent, call me, premium owed or not showing, what the policy pays, what it has built, new agent, wrote in, contact details, contract, application, medical, form, underwriting, change of beneficiary, SQ, renewal, collect, group, claim, change), then `PLAYBOOK_BY_TYPE`; `playbookFor_` adds the last note, days quiet, what it waits on and the next step. With `SYSTEM_DAY` not `off`, every desk but Pawan gets `sdPage_` for `f=plan`/`f=in`: check in (`sdCheckin_` = `signInFromPage_` + the day written as the KPI1 plan, "Set by the system at check-in"), yesterday first, the work list (moved first, then the plan, else the model's suggestions, else the open book: `sdList_`) each with its playbook and close (needs a note) / move (needs a reason and a later date) / note, logged on Task Changes and Due Moves; Query Pal notes (`q_i`), the scrub, take the next (`t_take`). `intelTarget_` for the system day: due today + overdue/5, never under the desk's median. The morning mail's one button: "Check in and start my day". `sdPrune_` drops working copies older than 21 days. Pinned by `tests/test-sday.js`.

- **Absence and cover: two clocks (20 Oct 2026, 2026-10-20e).** Ricky: "I would like the absent rule to be applied 5 minutes after sign-in ... unless she goes back and she can change it. The same applies to everybody", "the staff who is absent, the task will have to be automatically reassigned as staff gets their day, so the day will have to now be readjusted", then "cater for all of these things ... agents as well, managers, BMA, everyone who operates in the operation." **Register:** `ABSENT_AFTER_MIN = 5`, `ATT_GRACE_MIN = 5` (in after start + 5 is late); `autoAbsentTick_` covers `DAY_MAIL_DESKS` and `UM_DESKS` (Akaash). `recordAttendance_` turns any absence with no sign-in (the clock's or a manager's) into in, late by the minute, and calls `coverReturn_`. **Cover** (`coverTick_`): the work moves at start + `COVER.AFTER_MIN` (30), at the start when the absence was marked ahead by a person (MarkedBy not `tracker`); a second pass (`cover2_<sid>_<day>`) at max(8:15, first + 15) reaches the eight o'clock desks; ACTION REQUIRED posts on the first pass only. Each receiver takes no more than `coverCap_` (their pace, 5 to `PER_RECEIVER`) in a day across every absence (`cover_got_<day>`). `COVER.KEEP.kamla` (staffing and licensing, training, RR operations, innovation) stays with the BMA (`plan.own`, a tile in the mail to Mr Rampersad). `coverAbsorb_`: moved tasks go to the top of a checked-in receiver's KPI1 plan and as many of their own lowest open items go to "when your list is done", so the day keeps its size. `coverReturn_`: checking in before `RETURN_UNTIL` (noon) moves back each of today's OK moves still open and in the receiver's name that the receiver has neither noted nor changed (script posts MOVED/ACTION/BACK do not count), with a BACK note, out of the receiver's plan and count. `BRANCH_CLOSED` (Script Property, dates) marks and covers nobody. Pawan and Akaash are on the register and nothing of theirs moves; Mr Rampersad is on neither. Pinned by `tests/test-cover.js`; `tests/test-attendance.js` has the five-minute grace.

- **The game for the staff desks (20 Oct 2026, 2026-10-20f).** Ricky: "can we gamify this a lot more so the staff will not feel overwhelmed? ... really have everybody in it and not make it mundane", then "build this first for staff, then agents afterwards." `GAME.DESKS` (sasha, elizabeth, azariah, kamla); agents next. **Scoring** (`gameRange_` = `gameCloses_` + `gameCtx_` + `gameScoreDay_`): a close counts only with a proper note (`gameProperNote_`: 25+ characters, five words, not MOVED/ACTION REQUIRED/BACK/IDEA ACCEPTED/Branch Intelligence) in the person's name (CreatedById, or the day page's header line "· Full Name ·", `gameNoteHead_`) within 7 days before the close; a copied note (`gameNoteKey_`, digits ignored) counts once. 1 a close, +2 high-payoff (`payoffOf_` rank 1–3), +1 a month overdue, +1 a task moved to them (Workload Moves, 14 days); Query Pal closed inside its turnaround 1 (`Assigned To` via `gameWho_`, Liz alias); on time 1; signed out 1; each quest +2; par +3 (every KPI1 plan item closed with a note or moved with a reason on Task Changes, two in three closed); each idea accepted +3. `work` = closes + Query Pal, the figure weeks are compared on. **Kept**: tab **Game Days** (`GAMETAB`), `gameSave_` hourly 6:00–18:30 from `gameTick_` (the first run of a day re-reads the last five working days so a reopened task drops out; the first run ever reads the last 20, `gameBackfillNow`), today live in CacheService `game_all_<day>` for 5 minutes (`gameForget_` on every Save). **Quests** (`gameQuests_`, `game_q_<sid>_<day>`, chosen once): save the client who wants to cancel / former agent / call me, else the top high-payoff; the two oldest overdue; the Query Pal past turnaround, else the work moved to them; else par an hour before the end. **Streak** (`gameStreak_`): on-time check-ins from the Attendance tab, today once in; leave marked ahead by a manager is neutral, a closed branch is skipped, the first miss of a month is forgiven. **Skills** (`gameSkills_`, `GAME_SKILL` by playbook kind, levels at 5/15/30/60/100). **The week** (`gameGain_`): work points Monday to today against the same days of their own last four weeks; best day yet. **The branch's bar** (`gameGoal_`, `game_goal_<monday>`): overdue across the desks at the week's first read, goal 25% under it (`GAME_GOAL_CUT`). **Page**: `gameCard_` above the work (ring `gameRing_`, points, week, streak, quests, thanks received, what earned nothing and why, the bar, skills, how points work); the work card shows the next three and folds the rest (`GAME.NEXT`); `gameThanksForm_` after an absence (`cover_back_`, Workload Moves less BACK) and `gameIdeaForm_` (an Innovation & Creativity task due the next Wednesday branch meeting, `gameMeetingDay_`; Friday until 2026-10-21h; not on today's list), saved by `gameSaveForm_` into tab **Game Log** (`GAMELOG`). **Morning mail** (system day): `gameMailCard_` replaces the overdue / due today / planned tiles. **Mr Rampersad**: My day card 6 `gameBmSec_` (the bar, each person's ring and line, ideas to accept `gia_<taskId>` → Game Log + an IDEA ACCEPTED Chatter post, `gameBmSave_`; the week's awards with the WhatsApp text in a copy box); Wednesday 7:00 `gameAwardsMail_` to him alone (Friday 13:00 until 2026-10-21h, see below). **Awards** (`gameAwards_`): Client Saver (cancel + former kinds + retention closes), Clean Sweep (a month old), Team Player (cover + 2 × thanks), Quest Master, Most Improved (gain, usual ≥ 5), Best Note (`gameBestNote_`: Claude picks once a day, else the longest), Idea of the Week (accepted this week); `gameAwardsText_` single-asterisk bold, no emojis, no client. **Wall**: `case 'wall'` returns `game: gameWall_()` (first names, par, quests, streaks, gains, thanks, award titles; no points, task, client or note); `wall/index.html` slide 13 `sGame` appears only when it is there. `GAME = off` hides everything. Pinned by `tests/test-game.js`.

- **The wins on a Wednesday (21 Oct 2026, 2026-10-21h).** Ricky: "awards day cannot be a Friday. It's the weekly wins celebrated on a Wednesday in the meeting, during our meeting ... awarding the wins from agents, the staff, everyone gets acknowledged". The branch meets Wednesday 9:00 to 10:30; he chose Wednesday to Tuesday, ready at 7:00. **Window:** `gameAwardsWeek_(day)` = on the Wednesday (`GAME.AWARDS_DOW` 3) the seven days ending the night before, `final`; any other day, the last Wednesday to today, so far; working days only (`gameWeekday_`). `gameAwards_` uses it for every award (closes, thank-yous, accepted ideas, Best Note's once-a-day pick keyed `game_bn_<from>`, Service Star's `rateStats_(from, to)`, Most Improved through `gameGain_(…, from)`), never today's live read on the Wednesday, and returns `week` and per-desk `week/usual/gain` in `totals`. **Mail:** `gameTick_` sends `gameAwardsMail_` on the Wednesday from `GAME.AWARDS_AT` (7:00) until `GAME.MEETING_AT` (9:00), once, through `timedSend_` (`game_aw_<day>`; a failed send is retried by the next run); subject "This week's wins · for the 9:00 meeting · Wed 21 Oct", shell "This week's wins" / "For the Wednesday branch meeting · Wednesday 14 to Tuesday 20 October"; everyone's week and the quests tile are the window's. **WhatsApp** (`gameAwardsText_`): "*This week's wins* · Wednesday 14 to Tuesday 20 October" ("so far" before the Wednesday, `gameAwardsSpan_`). **Unchanged:** the backlog goal (`gameGoal_`, overdue on Monday, goal by Friday), the cards' week, the Friday weekly summary, the fact-find chase. **Staff strings** say Wednesday: Team Player (thanks form), Service Star (how points work), the idea box and its task (due `gameMeetingDay_`), IDEA ACCEPTED, the innovation lines; the **innovation board** (`sendInnovationBoard_`) moved to Wednesday 7:30 (`INNOVATION.BOARD_DOW`), with the last Thursday's hour. **Wall:** `gameBoard_` adds `awardsWeek` and `awardTotals`; `gameWall_` and `wallIntel_` add `awardsWeek` {from 'Wed 14 Oct', to 'Tue 20 Oct', fromDay, toDay, final, label}; `awards` is as before. `wall/index.html` still says "Friday at 1 pm" / "FRIDAY'S AWARDS" (front end not changed here). Tests: `tests/test-game.js`, `tests/test-tick-order.js`, `tests/test-wall2.js` (the harness's `formatDate` now knows `u`).
- **5:00: Claude's writing in the Branch Manager's morning mail (22 Oct 2026, 2026-10-22a).** Ricky, 6:22am: "I am not seeing any AI writing my tasks in the morning report to me at 5??". The 5:00 run already had Claude read his tasks and who waits on him: `unitModel_('ricky', day, { ai: true })` calls `bmdAdvice_`, kept for the day in `bmd_adv_<day>`. But the mail, simplified on 20 October, showed none of it; Claude's words were only on My day, the respond page and the 3:00/3:45 mails. `bmMorningAi_(mm)` now puts a section "Claude has written these for you (n)" after Urgent, before the inbox:
  - **People waiting on your word** (`BM_AI.ASK` 6): what they said, then "Claude's reply" with its question and the reply.
  - **Your own tasks** (`BM_AI.MINE` 8, most overdue first): "Claude: Close it / Move it / Write a note", why, and the note. Tasks marked keep are left out.
  - **The button** "Post Claude's replies" opens the respond page, where `bmDraftsFor_` reads the same cache. Nothing posts by itself.
  - **The subject** ends "· Claude has written n".
  - **No answer from Claude at 5:00:** the mail says so and points to My day after the 6:00 refresh.
  - **No `ANTHROPIC_API_KEY`:** no section.

  Pinned by `tests/test-bm-morning-ai.js`.
- **His items at full depth: the whole Chatter, the record, the inbox (22 Oct 2026, 2026-10-22b).** Ricky, 6:48am: "did it build in all the intelligence and all the chatter, including the inbox scrub and anything at all on it that will help build an intelligent response? So I can post on chatter. And am I using the intelligence properly". It had not. The 5:00 read (`bmdAdvice_`) gave the quick model (`ANTHROPIC_MODEL`, else Haiku) the last four notes. Draft with Claude on his respond page gave the last six. The full read was only on the Unit Manager's and BMA's pages, and no draft looked at his inbox.
  - **`bmDeepDraft_(day, items, said)`**, on the drafting model (`claudeDraftModel_`), `BM_DEEP.BATCH` 3 a call. Each item carries the same full read as `umDraft_`:
    - the whole Chatter, 25 notes, oldest first;
    - `umTaskContext_`: the record (description, account, contact, owner) and the other open tasks on it;
    - `playbookFor_`;
    - `bmDeepMail_`: up to 3 of the inbox scrub's rows from 30 days that were made into this task, or name the same policy number, or the client by full name.

    It returns `{read, reply, next, add[], action, mail}`.
  - **`bmDeepWarm_(day, budget)`**:
    - runs at 4:40 from `housekeepingTick_`, before the 5:00 guard, once (`bmdeep_<day>`);
    - runs hourly with the inbox scrub;
    - drafts only items that are new or have a new note;
    - keeps them in `bm_deep_<day>` (`bigPut_`, pruned).
  - **Who reads them:**
    - the 5:00 mail (`bmMorningAi_`: Where it stands, Claude's reply, Next, Check first, "Read with n e-mails from your inbox", plus his instructions with no note);
    - `bmDraftsFor_` (the respond page, 3:00, 3:45);
    - `bmdDrafts_` (My day);
    - `bmDraftOne_`, which tries the full read first with his words as `he_said`, falling back to `claudeDrafts_`.
  - **The ping:** `has.claude` and `claude: {draftModel, readModel, fullDepthToday}`, never the key.

  Pinned by `tests/test-bm-morning-ai.js` and `tests/test-ask-claude.js`.
- **Claude gets its own run (22 Oct 2026, 2026-10-22c).** Ricky, 9:01am, after deploying 22b: "not seeing any ai intelligence that scrubs and guides me". His My day showed "Notes to post (24)" with every box empty, and every task's advice was the plain rule (`bmdRule_`). Two causes:
  - **No room left in the run.** `bmdWarm_` (and the new `bmDeepWarm_`) ran at the tail of the hourly inbox scrub's run, and a long scrub takes a run to Apps Script's six minutes before Claude is asked.
  - **The asks got no places.** `bmdAdvice_` took the first 30 items, his own tasks first: on 22 Oct his 41 own tasks took every place and the 24 asks got none.

  Now:
  - **Its own run:** both warm-ups run at :20 or later in each hour (`BM_DEEP.SLOT_MIN`), once an hour (`bmai_hr`), 6:20 to 4:00, with what is left of the run's budget.
  - **Asks first, in chunks:** `bmdAdvice_` puts the asks first and reads up to `MYDAY.ADVICE` 75 items in chunks of `MYDAY.CHUNK` 25 (`bmdAdviceChunk_`), so one long answer is never cut off.
  - **The deep pass is wider:** `BM_DEEP` is now BATCH 4, ASK 20, MINE 10, IGNORED 6, `MAX_TOKENS` 3200, a 280-second budget at 4:40, and 150 seconds each hour.
  - **`draftMyRepliesNow()`**, from the editor, runs both reads at once and logs the count.
  - **"Today so far"** printed "Sat Dec 30 1899 07:08:00 GMT-0358" when the sheet had turned "07:08" into a time value. `dayLogRows_` now reads At through `timeStr_`.
- **Claude's answer, read even when untidy or cut short (22 Oct 2026, 2026-10-22d).** Ricky, 9:07am, on My branch: "Draft my reply" said "Branch Intelligence came back empty. Try again." Every Claude reader needed a perfect JSON answer: one raw line break inside the reply, a word or a fence around the braces, or an answer cut off at its limit, and the whole answer was thrown away.
  - **`claudeJsonParse_(txt)`** is now used by every reader: the batch drafts, the advice chunks, the deep pass, Draft my reply, the brief, the note drafts and the Best Note pick. It tries the answer as it is; then with raw line breaks inside strings escaped (`claudeJsonFix_`); then keeps each complete top-level entry (`claudeJsonEnd_`) and drops only an unfinished one. A reply that was itself cut off is never kept.
  - **`claudeText_`** skips thinking blocks.
  - **`claudeStop_`** gives the stop reason. When Draft my reply has no reply, the page says why ("it ran out of room", "it declined this one", "nothing in the answer"), and the run log gets the stop reason and the first 200 characters.
  - **`UMAI.MAX_TOKENS`** is now 1600 (was 900).

  Pinned by `tests/test-claude-json.js` and `tests/test-um-draft.js`.

- **Elizabeth on 8 to 4 (23 Oct 2026, 2026-10-23a).** Kamla to the agents' WhatsApp, Fri 6:22am, shared by Ricky: "Elizabeth will now be operating from 8:00 AM to 4:00 PM" (was 7 to 3). `SCHEDULE.elizabeth` is `8am – 4pm` (lunch 12 to 1 unchanged), so everything that reads her hours moves with it: the morning e-mail at 7:30 (start − 30), absent at 8:05 (`ABSENT_AFTER_MIN`), her work to colleagues at 8:30 (`COVER.AFTER_MIN`), the finish at 4. `CLOSEOUT.AT.elizabeth` is 3:15 (was 2:15, the same 45 minutes before the finish as the others). `LB.BAG.ROTA` has her going home at 4:00 pm; a **Bag Rota** tab, if the sheet has one, overrides it and needs her Leaves At changed there. **A past day is judged against the hours kept that day:** `SCHEDULE_WAS` (`elizabeth: [{ until: '2026-10-22', hours: '7am – 3pm' }]`) and `hoursOn_(sid, day)`; `startFor_(sid, day)` and `lateBy_(sid, at, day)` take the day, and the month's lates on the attendance report, the game's on-time point and streak (`gameScoreDay_`, `gameStreak_`) and `attOut_` pass it, so her 7:20 on the 12th stays late. Today's clocks always read `SCHEDULE`. The 21 Oct morning-retry and 20 Oct close-out tests pin her old hours (the incidents were on them). Tests: `tests/test-attendance.js`, `tests/test-closeout-times.js`, `tests/test-logbook.js`.
- **Claude reviews every inbox item, and the deep drafts go a wave at a time (23 Oct 2026, 2026-10-23b).** Ricky, Fri 8:53am, on My day's inbox: "i am not seeing any intelligence built in to post after analyzing ... all ai claude codes are in and must be intelligent"; 8:56: "also reviewing the inbox scrub if a task should be open for a person to follow up and what was done". The scrub sorted each mail and left the note box empty.
  - **The review (`ixDeepWarm_`, kept as `ix_deep_<day>`, keyed by the inbox Key).** For each open item (up to `IX_DEEP.MAX` 24), on the drafting model: the Gmail conversation from the item's Link, last `IX_DEEP.THREAD` messages, replies included (`ixThread_` via `inboxParse_`); the task it is about (`ixTaskFor_`: the one made from it, else the newest open task whose Subject has the same 7–13 digit policy number, else the client named in capitals in the mail's subject), with `umTaskContext_`, its whole Chatter (`cmdChatter_`, `IX_DEEP.NOTES`), the playbook, and `bmDeepMail_` for other mail about the client. Claude returns `done` (what has been done, by whom, when), `read`, `to` (a desk from `cmdTargets_`; anything else falls back to the task's holder, the scrub's owner, then ricky), `task` / `task_subject` / `due` (0–5 working days), `post` (the Chatter note in his voice), `check`, `action` (post, task, call, reply, decide, close, wait). Redrafted only when the item's Received, TaskId or Status changes. `INBOX_STAFF` is the staff line both inbox prompts share.
  - **When.** 4:40 the deep drafts alone; the next run (4:50) `inboxScrub_(day, 'pre')` then the review (`ixdeep_<day>`), ready for 5:00; then every hour at `IX_DEEP.SLOT_MIN` (:35, `ixai_hr`), never in the run that did the :20 drafts (`aiRan`). From the editor, `reviewMyInboxNow()`; `draftMyRepliesNow()` now does the inbox too when there is time left.
  - **Several calls at once.** `claudeFetchAll_(key, [{ model, max_tokens, prompt }])` sends a wave through `UrlFetchApp.fetchAll` (one at a time when that is missing or throws). `bmDeepDraft_` is now `bmDeepPrompt_` + `bmDeepRead_`, and `bmDeepWarm_` sends `BM_DEEP.PARALLEL` (5) batches per wave, so the 4:40 run covers all of his items instead of sixteen.
  - **My day (`inboxCard_`).** A line over the list (`ixSummary_`: reviewed n of m, how many need a task opened, a note on the open task, already dealt with); each reviewed item shows Claude's advice in its collapsed line, then Done so far, Where it stands, Follow-up (`ixFollow_`), Check first, a tick "Post Claude's note to [desk]" with Claude's desk chosen and the note in the box (`ixp_`, `ixpw_`, `ixpt_`); "make it a task" gives way to it. Not yet reviewed (with the key set): says when it will be.
  - **Save (`inboxSave_`).** Ticked: on the open task when the desk chosen holds it (`ixOpensTask_`; `mgrPost_` with the page head, so the holder is mentioned and e-mailed); otherwise a new task for that desk (Claude's subject, due `ixDueDay_` working days, RR Operations, the mail, the note, what was done and the task it follows in the Description) with the note on its Chatter when it is not his own. The inbox row takes the TaskId, Status task, Owner and the note. Unticked, nothing posts.
  - **The mails.** `inboxView_` carries `deep`; `inboxMailSection_` puts Claude's note, what was done and the follow-up under each open item (`ixMailNote_`); the 5:00 subject's "Claude has written n" counts them. Ping: `claude.inboxReviewedToday`. Prune: `ix_deep_`, `ixdeep_`. Test: `tests/test-inbox-review.js`.
- **My workday: one fast page for everyone, on the branch's site (23 Oct 2026, 2026-10-23c).** Ricky, 8:59am: "make my day easy to use ... through a link ... rickyrampersadbranch/myworkday ... open faster and stream motion, charts and graphics"; 9:03: "this will apply to all persons"; 9:06: "the top of the page should have a progress bar for effectiveness ... so the check in will show what was achieved".
  - **The page: `myworkday/index.html`** (static, on GitHub Pages; `noindex`, no referrer). The link is `rickyrampersadbranch.com/myworkday/?p=<sid>&k=<workSig_>`; the phone keeps the last link and the last copy of today in localStorage, so it opens at once and from the home screen, then asks the tracker. Across the top, sticky: the percentage (counts up), the bar (green on or ahead of the day, amber behind, red more than 25 points behind), a navy marker for the share of the working day gone, the pace and the last Salesforce entry; chips for closed with and without a note, overdue, due today, the morning's plan. Then: check in (POST) or the time you did, on time or late, or marked absent; what was achieved today (each close, "add your note" where there is none; for him his notes, e-mails and tasks from the day log); next up (overdue oldest first, then due today, each linked to its task); the last five working days as bars; for him and Kamla every desk's bar today; one button to the full day page (My day, My unit, or the staff day page). Refreshes every five minutes while open. Light and dark; reduced motion respected. `?api=` points it at another tracker for a test.
  - **The tracker.** `doGet` answers `wd=<sid>&k=` with JSON before any page route (`workdayGet_` → `workdayModel_`); `doPost` with `wd=` and `act=checkin` checks in on the same register as the day page (`sdCheckin_` for a desk, `signInFromPage_` and the day log for him and a Unit Manager) and sends the day back. `workdayProgress_` counts as `sendMidday_` does (`sfkDayFor_` closes against the stored `intel_target_`, else `intelTarget_`; `workedMins_` for the day gone). `workdayBars_`: one query, closes per local day. `workdayTeam_`: `DAY_MAIL_DESKS`, cached five minutes (`wd_team_<day>`, cleared at a check-in). `workSig_(sid)` = `replySig_(sid, 'always', 'work')`. The morning e-mails (each desk's, and his 5:00) carry `workdayMailLine_`; `showWorkdayLinks()` in the editor lists everyone's link. Tests: `tests/test-workday.js`, `tests/e2e-workday.js`.
- **His leadership day, who wrote what in his name, posting from My workday, and closing off for lunch (23 Oct 2026, 2026-10-23d).** Ricky, 11:11, on his My workday at 0%: "i chattered a lot so how can this be framed?"; 11:14: "task has to be moved as staff waiting to be told what to do? so lets ensure we push a lot and advanced use of AI to guide and update, send also a trigger to close off to have lunch at 5 minutes before lunch".
  - **Who wrote it (`postWho_`, `postWhoAll_`).** The tracker signs in as him, so on 23 Oct 114 posts carried his name by 11am and none was his: the tracker's own (`SYS_POST_RE`: Branch Intelligence, ACTION REQUIRED, MOVED, SERVICE RATING, FOLLOW-UP, NOTE —, Moved from, From the assignment board, AGENT NAMED, Orphan transition, "X, this one is yours"), the desks' notes from their day pages (`NOTE_HEAD_RE` head "Sales Support · Sasha Lalla · …" → `sidByName_` by first name), and the 7:00 chase in his voice (`POST_BURST`: 4 or more of his own words within 3 minutes → 'chase'). His own words (plain, or headed Branch Manager from his page) are 'ricky'. `postSysKinds_` counts what the system did for him by kind.
  - **`bmWaiting_` reads it.** A desk asking him on her day page now reaches his list (from her); only his own words answer a question (the tracker's notes and the chase no longer make it look answered); a desk's day-page note on his instruction counts as her note (not "ignored").
  - **The day log** (`dayLogSalesforce_`) keeps only his own notes and takes today's rows that were not his off (`dayLogDrop_`), so the 11:00 and 3:00 "Today so far" are his.
  - **His bar (`leadProgress_`, `workdayLeadModel_`).** Today's number is everything that waited on him (`leadItems_`, kept in `lead_<day>` so it never shrinks, new ones join): the staff asking him, his inbox to act on now or today, his tasks due today and a fifth of his overdue (`LEAD.OVERDUE_SHARE`). Cleared = no longer waiting: by him (solid), or by the team (lighter: an inbox item a desk replied to or closed). Chips: staff waiting on his word, inbox to act on, his tasks for today, notes by him; a line "Done for you by the system today". His bars are his own notes per day (`workdayNoteBars_`).
  - **Waiting on you, posted with one tap (`leadWaiting_`, `workdayPostNote_`, POST `act=post`).** Each with Claude's words: a question's deep draft (`bmDeepGet_`), or the inbox review's note with its desk (`ixDeepGet_`, `ixFollow_`). A question's answer goes on its task, headed "Branch Manager · Ricky Rampersad · …" through `mgrPost_` (the holder is mentioned and e-mailed); an inbox note through `ixPostOne_` (now shared with `inboxSave_`). Only on what is in `lead_<day>`, only from his link, never an empty box; each goes on his day log.
  - **Lunch close-off (`sendLunchOff_`, `lunchoff_<sid>_<day>`).** `LUNCHOFF.LEAD_MIN` (5) before each person's lunch, the desks in today and him: the desks get the morning's number, closes with no note flagged, what is still open with the playbook's "What to do", and the button to My workday (to them, sales support copied as every day mail); he gets what is cleared, who still waits with Claude's words, and the button. Tests: `tests/test-leadership.js`, `tests/e2e-workday.js`.
- **The tracker's storage, kept from filling (26 Oct 2026, 2026-10-26a).** Ricky, 7:57am: "please see kamla message - Not seeing my day's email to check in"; 8:02, Azariah the same. showRunLog: every desk "not sent", nothing failed, nothing logged. Google gives a script about 500 KB of Script Properties in all; once full, every NEW value fails to save. The morning e-mail saves its "being built" mark first, that save threw, and the run's try/catch swallowed it: no e-mail, no log, and no absence (the clock waits for the e-mail). What filled it: the AI inbox review and drafts (`bm_deep_`, `ix_deep_`, 23 Oct), whole Claude answers in 8,000-character pieces every hour, kept 21 days by `sdPrune_` with the small marks. Friday's lunch close-off most likely went the same way. The morning of the 26th was cleared by hand with a one-off `fixMorningNow`.
  - `STORE` (KPI.gs, by `bigPut_`): the AI reviews go after their own day (`SAME_DAY`), the big day caches (`ag_items_`, `unit_*`, `intel_model_`, `sd_list_`/`sd_qids_`, `um_items_` incl. `_eve_ai`, `lead_`, `game_ideas_`, `co_ask_`/`co_un_`) after `SHORT_DAYS` (3), the small marks after `LONG_DAYS` (21). `storeRelief_(day, hard)` does it; `sdPrune_` calls it first.
  - `propSet_(props, key, val)`: a save that hits the limit clears the old copies and tries again (soft, then all but today). Used by `bigPut_`, the morning marks in `sendDayStart_`, and `timedSend_` (whose mark used to throw after the e-mail had gone, out of the run, so the next run sent it again).
  - `storeTick_`: hourly, before anything is sent, clears past `RELIEF_KB` (380) and tells Mr Rampersad once a day if it is still past `WARN_KB` (430). Its marks are in CacheService, which a full store cannot block. `trackerAlert_` sends him a plain note.
  - `morningWatch_`: a desk with no morning e-mail `WATCH_AFTER` (10) minutes after its start (and not marked absent) — he is told once, with the last reason in the run log and the storage size. The morning loop now logs any failure it catches by desk; a desk with no e-mail address says so.
  - showRunLog says "Storage: N KB of about 500". Tests: `tests/test-storage-full.js`.
- **Pawan's check-in, and a browser signed in to two Google accounts (26 Oct 2026, 2026-10-26b).** Ricky, 4:39pm, Pawan's "Close my day" link open in his own Chrome: Google Drive's "Sorry, unable to open the file at this time". The ping opened in the same window. A page the tracker draws (HtmlService) will not open in a browser signed in to more than one Google account; a JSON answer (the ping, My workday's `wd=` calls) will. Pawan had the same error every morning since 19 Oct, which is why the register missed him on days Salesforce shows him working. `workdayMailLine_` now also says what to do when the button will not open (My workday, or a private window), and `sendPawanDay_` carries it: his was the one morning e-mail without his My workday link. Test: `tests/test-pawan-workday.js`.
- **Wall Intelligence, the new wall (20 Oct 2026, 2026-10-20g).** Ricky: "the wall needs to be redesigned with a lot of animation and motions and graphics ... what the managers do, what the agents do, and what staff actually does ... streamed outside as well as inside", then "I would like sound ... Andrew's voice, this song ... streams outside without client's name so the agents can see what is being actioned, who is doing what, who is out today ... and the gamification." **`/wall/` is now Wall Intelligence** (`wall/index.html`); the block wall moved to **`/wall/classic/`** (`tests/e2e-wall.js` and `tests/test-substance.js` read it there). **Feed** (`wallIntel_(day, outside)`, cached 5 minutes as `wall2_in_<day>` / `wall2_out_<day>`): `wallStaff_` (who is in, out today or later; cover from Workload Moves; tasks closed with a proper note by hour 7–17 and by kind `wallKind_`: new, orphan, retention, claims, other; par, quests, streaks, gain from the game), `wallAgents_` (`agentPeople_`, `agentFunnel_`, `ff360Agent_`, `goalFor_`, `agentDaySummary_` and Agent Day `At` times; the year as % of goal against % of the year gone), `wallManagers_` (My Day Log groups against `myTasks_` by `dayGroup_`, Akaash's unit, cover, Query Pal answered this week), and a running feed newest first. **Never on the wall, inside or out:** a client, a policy number, a note, a task subject, why someone is out. **Outside** also drops arrival times, lateness, points, dollars, agents with nothing yet, agent projection times, the inbox, Query Pal past turnaround, and gains below someone's usual. **Access:** `handle_` action `wall2` (signed in: the Branch Manager gets inside, anyone else outside) and `wallout` (no sign-in, `WALL_OUTSIDE_KEY`; run `wallOutsideLink()` in the editor for the link `https://rickyrampersadbranch.com/wall/?k=…`; a new key changes it). **Page:** an ident, then Staff (who is in / cover flow; hour by hour; the kind of work; the team game), Agents (the field today; review to cover and FY27), Managers, Live; heavy motion (rings, bars, donut, heat grid, flows, counters), warm graphite ground (no saturated blue), the branch bar and a ticker always along the bottom, captions. **Sound:** the branch Motivation track (`/rr-branch-theme.mp3`) under Andrew; recorded lines `wall/audio/v2/n0..n8.mp3` (made with `wall/audio/v2/build-voice.sh` on Ricky's computer, en-US-AndrewNeural at −12%, since the speech service is blocked from the sandbox) play on any screen, else Microsoft Edge's built-in plain Andrew voice reads the live lines with today's numbers, else captions only; `?voice=recorded|live|off`. `?demo=1` (and `&view=outside`) shows a marked sample. Pinned by `tests/test-wall2.js` and `tests/e2e-wall2.js`.

- **The wall on a phone, more motion, and the Branch Manager's day (20 Oct 2026, 2026-10-20h).** Ricky: "viewing on mobile and it's not scaled ... more graphics and more animations and motions for a max impact", then "Can we also build the managers? I am doing a lot right now as the branch manager" and "remember my day starts at 5am". **Phones** (`sizeUp`: width under 900 or height under 560) get `body.mob`: a stacked layout that scrolls, a sticky header, the caption and the branch bar pinned at the foot, two-up tiles, one column of panels (game cards two-up), every row rebuilt for a narrow screen through `mq(tv, mob)`; a phone on its side adds `short`: smaller type, two columns, four-up tiles, a slim bar without the ticker, and Andrew's line only while he speaks. **Motion:** a channel bumper (a band of the channel's colour sweeps across with its name) on every change of channel, titles that land word by word, floating motes, an equaliser by LIVE (gold and faster with the sound on), shines on the tiles, counters that pop when they land, a ripple on the newest event. **Managers** is two scenes: the Branch Manager's day (`wallManagers_().bm`: My Day Log by the hour from `WALL2.BM_FROM_H` = 5am to 6pm, notes, closes, e-mails, moves, tasks, inbox, the busiest hour, his latest actions as kind and group only via `wallBmWhat_`, never the subject; his Salesforce notes and closes are read fresh with `dayLogSalesforce_` on each wall read; inside also his check-in time; his actions join the running feed as Mr Rampersad), then the unit and the desks. Andrew's recorded line for it is `n9`.
- **Service ratings (20 Oct 2026, 2026-10-20i).** Ricky: "when a task is closed for an agent, a star rating and a summary ... the agent gets to rate the support who had closed that task", and for a client "ask the client for the patience, looking at how long it took, and ask for a rating". `rateTick_` (from `housekeepingTick_`, every `RATE.EVERY_MIN` = 5 minutes from 7am) reads the tasks `RATE.DESKS` closed since the watermark `RATE_SINCE` (default the start of today), up to ten minutes ago (`LAG_MIN`, so the note is there and a close undone at once is never rated). A close asks for a rating only with a proper note by whoever closed it (`gameProperNote_`; the newest is the closing note); `SKIP_TYPES` (HR, training, RR Operations, ideas) and `SKIP_SUBJ` (Email:, birthdays, the tracker's own) never ask. **Agent:** `Task.Agent__c`, a Contact of record type AGENT with an e-mail that is an active agent in `agentPeople_()`, never the Branch Manager (by e-mail or name), a department or a former agent; at most `AGENT_MAX_PER_DAY` = 6 a day each; `rateAgentMail_`: what was closed, the kind, opened, closed, days, a two-sentence summary of the closing note (`rateReads_`, formerly `rateSummaries_`: Claude Haiku once a run, the note itself otherwise) and five star links (`?sr=token&r=n`). **Client:** `Task.WhoId`, a Contact of record type CLIENT with an e-mail; `rateClientMail_` (its own frame `rateClientShell_`, nothing internal): "We have now taken care of" a phrase from `RATE_CLIENT_WHAT` by the playbook kind (never the subject or the notes), the policy's last four, thanks for their patience at `PATIENT_DAYS` = 3 or more, five stars and a link to stop (`&out=1`, `OptOut` on every row for that e-mail); never for a claim, once per `CLIENT_COOL_DAYS` = 14 (sent or test rows only). **Held** (Status `held`, never sent later) until `rateClientBlocked_()` is '': `RATE_CLIENT_APPROVED_HASH` must equal `rateHash_()` (the wording and every phrase), with `RATE_CLIENT_APPROVED_BY` and `RATE_CLIENTS` = 'send to clients'; `rateClientPreview()` mails him both e-mails and the phrase list, `rateClientApprove("name")` approves and switches on. `RATE_AGENTS` = off stops agent mail; `RATE_TEST_TO` sends every rating mail there, subject marked. Sheet `Service Ratings` (`RATETAB`). **The tap** (`rateClick_` from doGet `sr`): records the rating, posts `SERVICE RATING · n of 5 from ...` on the task's Chatter (not a note for the game, and kept out of his day log), 1 or 2 stars (`RATE.LOW`) goes to `managerEmails_()` alone at once with a link to the task (`rateAlert_`, once); a page with a comment box (`ratePost_` from doPost `sr`, the comment on Chatter and, when low, to him). **Fed into:** `rateStats_(from, to)`; each person's card ("Service rating this week", one decimal via `rateAvg_`, the latest kind comment), his My day game card (every desk, the latest ratings with comments), Friday's **Service Star** award (best average with `STAR_MIN` = 3 ratings), and the wall: `wallStaff_().svc` (the branch as one, four and five stars by first name, never a low rating by name, a comment or a client) for a new scene `n10` STAFF · HOW WE SERVED and the running feed. The wall's `go()` now clears every scene still on the stage and a bumper's pending mount, so quick taps no longer leave one scene under the next.
- **The staff's timed mail before the heavy work (20 Oct 2026, 2026-10-20i).** Ricky, 2:40pm: "Elizabeth is saying she did not get her mail at 2:30". Nor her 11:30 progress check; on 19 Oct the close-outs only went by hand at 6:07pm. In `housekeepingTick_` the progress check, the close-out (`hkv2_`) and the at-the-finish reminder / did-not-close mark sat at the end of the run, after the inbox, the game, the agents and the cover; a run that ran out of time (Apps Script stops at six minutes) never reached them, while the morning mail at the top always went. They now run straight after the Branch Manager's progress, before `sdPrune_`, the hourly inbox, `gameTick_` and `rateTick_`. `HK_BUDGET_MS` = 4 minutes: past it, the inbox refresh, the game and the ratings are left to the next run. Each run records `tick_last` and the day's longest (`tick_long_<day>`); `showRunLog()` now prints them and today's `FAIL_` keys. To send a missed close-out by hand: `sendHousekeepingNow()` (skips anyone already sent, absent or not yet due). Test: `tests/test-tick-order.js`.
- **Mail from support@, through the relay (20 Oct 2026, 2026-10-20i).** Ricky, 3:26pm: "So am I not using the rickyrampersadbranch account as you did have a workspace set up". The tracker runs under the personal Gmail (about 100 recipients a day; each staff e-mail counts three) and ran out after 1pm on 19 and 20 Oct, so the progress checks, close-outs and his 3pm close-out never went. Every send in KPI.gs is now `mailSend_(o)` (never `MailApp.sendEmail` directly): `mailViaRelay_` posts the message, signed (HMAC of message|time with `MAIL_RELAY_KEY`), to `MAIL_RELAY_URL`, the **Mail Relay** (`apps-script/MailRelay.gs`), its own small project under support@rickyrampersadbranch.com (Google Workspace, about 1,500 a day; `RELAY.MAX_PER_DAY` 1,400), deployed as a web app (Execute as: Me, Anyone); it sends only a request signed with its `RELAY_KEY`, under ten minutes old, once. Not set, refused or unreachable: Gmail as before, the reason in `MAIL_RELAY_LAST`, the relay skipped for fifteen minutes (`mail_relay_down`). The tracker's data access, triggers, inbox reading and web-app links do not move. `mailRouteTest()` sends him one test and says which way it went; `mailQuotaLeft()` shows Gmail's allowance and the relay's count; ping `has.mailRelay`; `ffQuotaOk_` is true with the relay. Setup is in the header of MailRelay.gs (`relayMakeKey`). Test: `tests/test-mailrelay.js`.
- **The close-out at a set time, the sign-off check, and Claude's replies for the managers (20 Oct 2026, 2026-10-20j).** Ricky: "Sasha is 1:15pm, Liz is 2:15pm and Azariah is 3:15pm ... when they do sign off the email trigger goes out at 2pm for Sasha and references the 1:15 email with items not actioned ... build intelligence around this to ensure they respond"; Kamla 4:15 (his choice of the two), his own close-out 3:00 as before, Akaash's account of the day 3:00 (`UM_EVENING_AT`, his day still ends at 6), each checked at 3:45. `CLOSEOUT.AT` sets the notice per desk (`closeoutAt_`; others, Pawan included, finish minus `HK_LEAD_MIN`). The notice records what it asked (`closeoutAskSave_` → `co_ask_<sid>_<day>`: tasks set for the day still open, and the end-of-day checks not done). At the finish (the `ncrem_` slot in the tick) or on signing out after the notice (`closeoutAtSignOut_`, from `signOutDay_` and `autoSignOut_`), `closeoutCheck_` sends what is still unanswered, once a day (`co_chk_`), headed with the notice's own time: answered means closed, moved to a later date, or a reason on the close-out page (`progAnswers_` 'leave'); a check, Done or Not done with a reason. Salesforce not answering sends nothing (the plain reminder at the finish instead); everything answered and still signed in gets the plain reminder. The record is `co_un_<sid>_<day>`. `closeoutRuns_` counts close-outs running per task: the second copies Kamla (`CLOSEOUT.BMA`, never on her own) and marks the subject; the third is in his 5am by name (`closeoutYesterdayHtml_`, after `bmYesterdayLine_`, every desk's yesterday). Next morning `yesterdayOpen_` also returns those still open (`why: 'unanswered'`, cached ten minutes), so they lead the day page and plan page ("Yesterday first · N left from your 1:15pm close-out", the day does not save until each has a reason and a date) and the morning e-mail (`closeoutMorningCard_`). The game's day-closed point is now a clean close. **Claude's replies** (Ricky, 5:01pm: "with Akaash and me intelligence is at the max ... AI guided responses ... to post the Chatter"): `claudeDrafts_` (model `ANTHROPIC_DRAFT_MODEL`, default `claude-sonnet-5-5`; needs `ANTHROPIC_API_KEY`) writes a reply per item from the task and its notes. His 3pm puts Claude's reply under each note waiting on him and records the asks (`co_ask_ricky_`); `bmCloseoutCheck_` at 3:45 sends those still waiting, each with its reply; the respond page (`bmReplyPage_`, cache only via `bmDraftsFor_(…, true)`) shows `draftBox_` with "Use Claude's reply" (fills the box, `DRAFT_JS`; nothing posts by itself). Akaash's 3pm (`umDraftsMake_` → `um_items_<sid>_<day>_eve_ai`) and his page (`umItemHtml_` sixth argument) the same; `umCloseoutCheck_` at 3:45 if his account is not in. `sdPrune_` now also drops `co_`, `bmchk_`, `um_chk_`, `FAIL_` and `ag_` day keys after three weeks. Test: `tests/test-closeout-times.js`.
- **Ask Claude, and managers' posts that @mention the holder (20 Oct 2026, 2026-10-20k).** Ricky, 5:49pm: "if there is something can I ask to draft an intelligent response and send?" Under every item on his respond page (`bmReplyPage_`): a box to tell Claude what to say (`ai_<id>`, typed or spoken) and **Draft with Claude** (`name=draft`, `bmDraftOne_`): `claudeDrafts_` with his `instruction` (the only field that comes from him) and the task's Chatter; the reply comes back in that item's box, everything he typed kept (`opt.keep`, `opt.fill`, `opt.focus` scrolls to it); nothing is posted until Send. Enter in a box drafts that item (`ASK_JS`). At the foot, **Ask Claude for anything else** (`ai_free`, `claudeFree_`): written to copy, WhatsApp house rules. Then 5:51pm: "it needs to @ the assignee of the task as they will not get this, same applies to Akaash and Kamla as they are managers": `mgrPost_(obj, sid)` replaces `sfkInsert_('FeedItem', …)` on the managers' pages (`bmReplySave_`, `inboxSave_`, `unitSave_`, `umReplySave_`, `umEveReplySave_`, `cmdReplySave_`, `meSave_`): for `MGR_POSTERS` (ricky, akaash, kamla) the post goes through Connect (`/chatter/feed-elements`, segments Text head, Mention owner, Text rest) so Salesforce notifies the holder, and `mgrPostMail_` e-mails the holder from support@ with the text and the task link. Their own tasks: plain post, no mail; a refused mention: plain post, mail still goes. Test: `tests/test-ask-claude.js`.
- **Celebrations on the wall, and the work mode film (20 Oct 2026, 2026-10-20l).** Ricky, 6:40pm: "and want celebrations added". **Wall (`wall/index.html`):** `wins()` lists today's wins from the feed (`S().celebrate` if ever sent, otherwise worked out): par (`parMet`), best day (`bestDay`), a level reached today (`levelUps`), a streak on every fifth day (`streak % 5`), thank-yous (`thanks`), and five stars today (`svc.recent` with a clock time). `CELE` queues the new ones on every read (on a fresh start the latest three, six in the sample); `celeAfterMount` plays one every third scene, 2.6 s after it lands (never on the ident or the Shout-outs), as a card in `#cele` (icon, kicker, name, line, dim backdrop) with confetti on `#party` (a canvas above everything) and a WebAudio chime when the sound is on; 4.3 s, then gone. In the team game: a burst from a ring at par (`data-burst`), a flickering flame by a streak of five or more, and the top skill and level as a chip. New scene **n11 "STAFF · SHOUT-OUTS", "Today's wins"** after How we served, every win as a card, with a big burst. Reduced motion: the cards, no confetti. **Feed (`wallStaff_`):** for each person in the game `topSkill` ({name, lvl}, `gameSkills_`), `levelUps` (a skill whose level today is above its level from the saved days alone, `gameSkills_(…, { kinds: {} })`) and `thanks` (today's only, from `gameThanksTo_`), and running-feed lines for a level-up and a thank-you; inside and out alike (wins only). Recorded line `wall/audio/v2/n11.mp3` in `build-voice.sh`. Tests: `tests/test-wall-cele.js`, `tests/e2e-wall2.js` (twelve scenes, the shout-outs, a card and confetti, reduced motion, the card on a phone). **Film page `/workmodevideodemo/`:** the sample wall recorded (Playwright, 1600x900, every scene about 6.4 s, the celebrations in it) over the branch Motivation track (`/rr-branch-theme.mp3`, 0.55, fades), `work-mode.mp4` (1:15) and `poster.jpg` (the Shout-outs), graphite like the wall, `/orphan-video/player.js` with `data-scenes`/`data-chapters`; no Salesforce, no client, sample figures. Andrew's recorded voice to be mixed in once Ricky runs the lines on his computer.
- **The wall for laptops and phones, Akaash, the branch's agents, more motion, and Andrew (20 Oct 2026, wall + KPI 2026-10-20m).** Ricky, 6:39pm: "where is andrew voice. and where is akaash i need the agent names as well !! also scale more proper for mobile and laptop ok, also more animations and motion that pops!!! and scale proper make use of space its jumbled!!!". **Akaash:** `WALL2.EXTRA` is `['pawan', 'akaash']`; the staff feed gives him `role: 'Unit manager'` (out of the game), so he is on Who is in with the desks; `wallManagers_` sends `unit.agents` (his agents by first name, fact finds and applications this month, projection in; outside only those with something to show) and the Managers scene opens his unit with his card (`umCard`, in at …, leading n agents) and his agents by name (`umAgents`). **The sample** (`?demo=1`) uses the branch's own agents by first name (from the FY27 fact-find e-mails in Salesforce: Fawwaz, Stephanie, Malcolm, Darryl, Randolph, Neil, Narissa, Daniel) beside sample figures, and Akaash in at 6:02. **Laptops** (`body.lap`, under 1700 x 950): a slimmer header, caption and footer and `1rem = min(vw/114, vh/63.4)`, so the same scene is drawn larger. **Fitting** (`fitScene`, on mount and again at 700 ms): on a TV or laptop a panel that does not fit gives up the last rows of a `.feed` or `[data-trim]` list (never the desks) and is then drawn smaller (zoom on its parts, to 76%); the day's chart takes the panel's height. On a phone the scene's parts are zoomed to the screen (to 80%), and a scene still taller rolls itself during its dwell (`roll`; a finger stops it); swipe left or right for the next or last scene; the top bar stays put (`overflow-x: clip` on the body, not hidden, which made the body its own scroll box). Phones: desks two by two, shout-outs two by two (six), agents' projections as a dot. **Motion:** scenes rise and un-blur in and lift away, the kicker draws a bar, headline words pop with a tilt, tiles flip up with their accent bar growing, panels land in turn with a light sweeping their top edge, big numbers glow and float, heat cells and desk cards bounce in; all off under reduced motion. **Andrew:** the twelve lines (`wall/audio/v2/n0…n11.mp3`, en-US-AndrewNeural at −12%, n7 now "Akaash's unit in the field") were made on the GitHub runner (`tts-run`, `tts/job.json` key `wall`), as the Log Book films were; no Terminal on his Mac. **The film page** `/workmodevideodemo/` has two cuts, both 1:50 with Andrew over the Motivation track ducked under him: `work-mode.mp4` (1600 x 900, the laptop frame) and `work-mode-phone.mp4` (1080 x 1920, the phone layout), recorded frame by frame with true timestamps (CDP screencast; `?voice=film` captions Andrew's own words and `window.__dwell` holds each scene to its line), the phone cut first on a phone held upright, a button to swap. Tests: `tests/test-wall2.js` (Akaash, 5 of 6, his agents), `tests/e2e-wall2.js` (laptop frame, no panel cut, Akaash and the agents' names, all six desks on a phone, the bar stays put).
- **Andrew natural, more motion, and the link to post (20 Oct 2026, 8:35pm).** Ricky: "Andrew is sounding robotic, you need to have him natural!!! More motion as well ok", "Also want to post the link ok", "Rickyrampersadbranch don't wanna video" (and, asked, chose the live wall over the film page). **Andrew** is re-voiced at **−4%** (the pace he chose for the Log Book films; −12% reads as robotic to him) in spoken wording with contractions ("Here's how the day's going …", "Shout-outs! …"); the wall's `rec` captions and `wall/audio/v2/build-voice.sh` carry the same words; made on the `tts-run` runner. **The link** `/workmode/` (Open Graph tags for the WhatsApp preview, the Shout-outs poster) opens the sample wall as the outside screen shows it, `/wall/?demo=1&view=outside`: no video, the wall itself, Andrew when they tap Start with sound. **More motion:** two lights in the channel's colour drift across the room (`--chg`, `#gch`), the channel bumper's name lands letter by letter over a double band, every bar carries a travelling sheen, rings glow, the current hour pulses, the scene's grid drifts slowly larger while it is on (TV and laptop), tile numbers float, the ticker's times and the feed's dots pulse, the kicker bar shimmers; all off under reduced motion. The film page's two cuts are re-recorded with the natural Andrew (1:47).
- **The task cards: reminder templates, Claude, and closing on the fly (20 Oct 2026, 2026-10-20n).** Ricky, 7:02pm: "I want the reminder templates cards closing on the fly posting to chatter and integration of AI that speeds up our productivity!!". On the staff day page (`sdPage_`) each task card (`tcardHtml_`) has **templates**: three or four one-tap notes for its kind (`tcardKind_` from the playbook kind, the payoff and the type: premium, renewal, pend, claim, svc, newbiz, orphan, query, call, other; `TCARD_TPL`), each tagged closes / moves / note; a tap fills the note box, ticks Done or opens the date, and selects the first [blank]. Query Pal cards get note templates (`TCARD_QP`). **Draft with Claude** (`tcardDraft_`): their few words (typed or spoken through the keyboard mic), the task, the playbook's what-to-do and when-to-close and the last four Chatter notes go to Claude (`tcardModel_`: `ANTHROPIC_CARD_MODEL`, `draft` for the drafting model, Haiku `CLAUDE_READ.MODEL` by default); it answers `{note, action, warn}` by the branch standard (what was done, who, the outcome, the next step), never inventing amounts, dates, numbers or names ([blanks] instead); a client who wants an agent (`tcardWantsAgent_`) is never closed (a close becomes a move with a warn). **Close now / Move now / Post note** go through `google.script.run` to the public `cardAct(o)` (the page's own signature `replySig_(sid, day, 'card')` as `CARDK`; the task must be on that person's `sd_list_` for today): the FeedItem with Save's head line, `sfkPatchTask_`, `taskChangeLog_` and Due Moves exactly as `sdSave_`; refused: a thin note (`tcardThin_`, under 20 characters or "done"), any [blank] left, a move without a date after today, a close while the client waits for an agent unless the note says one is assigned (`tcardAgentGiven_`). The card updates in place (green tick, "Closed 7:14pm · note on Chatter"). What each card did is kept as `tcard_<sid>_<day>` (pruned by `sdPrune_`), so a later Save skips a card already closed and a note already posted. Save works as before. Test: `tests/test-task-cards.js`.
- **Pages open at once, and the five stars worded right (21 Oct 2026, 2026-10-21a).** Ricky, 6:21am: "when I click my day to start my day ... It's not opening ... it's opening the script, but it's taking very long. Can anything be done on this?" Every page behind an e-mail button (`FAST.KINDS`: unit, me, plan, in, prog, bm, cmd, um, umeve, hk, ag, agc, nudge, qp, agff, errand, undo) now answers at once: `doGet` returns `fastShell_` (Opening your day…, a moving bar, the seconds), which calls `openPage(params)` through google.script.run; `openPage` runs `replyClick_` with `full=1` (the same checks and builder as before) and the shell draws the HTML in place (`document.write`). No script support: the shell reloads with `full=1`. **His day built ahead:** `keepWarm` → `fastPrebuildTick_` builds his My branch page (`unitPage_`) between 5:00 and 8:30 on a working morning, every 40 minutes until he opens it (`fastpg_built_ricky_<day>`, `fastpg_opened_ricky_<day>`), kept in the script cache in 45,000-character pieces for 4 hours (`fastCachePut_`); his first tap takes it once (`fastCacheTake_`) with "Prepared at 6:15 · Bring it up to date" (`fastBanner_`, `fresh=1` builds live); every later open is live. **Check in without a reload:** his check-in button (`bmdCheckin_`) and the staff day page's check-in form call `checkInNow` (his: `signInFromPage_` plus the day's log; staff: `sdCheckin_`), checked against `unitSig_` / `replySig_(sid, day, 'in')`, and the card turns green in place; without script support the form posts as before. Saves still rebuild their page. Then 6:25am: "Liz is not an agent. She is staff. So why is it celebrating Liz?" The five-star win read as if Liz were an agent: the running feed now says "Elizabeth served an agent, who rated the service 5 stars", the shout-out is "FIVE-STAR SERVICE · Staff · served an agent, rated five stars". Tests: `tests/test-fast-open.js`; `tests/test-ask-claude.js` opens its page with `full=1`; the harness cache has `putAll`/`getAll`.
- **The morning e-mail tries again, and the absence clock waits for it (21 Oct 2026, 2026-10-21b).** Ricky, 7:06am: "liz is asking as she has not seen her day, did it go out", then "ensure this does not happen to any other staff" and "ensure the attendance rule is built in for task reassignment". The record said "elizabeth: marked sent at 06:32" and nothing had gone: `sendDayStart_` wrote the once-mark (the time) **before** building the e-mail, the 6:32 run was stopped by Google's six-minute limit part-way through hers, and nothing tried again or logged it (Sasha's went from the next run, 6:42). Then the clock marked her absent at 7:05 with no check-in link in her hands, and her work was due to move at 7:30. Now, for every desk: the mark reads `try <ms>` (`DS_TRY`) while the e-mail is built (`dayStartBuildSend_`, the old body) and becomes the time only after it has gone; a throw clears it and logs `morning <sid> FAILED …`; a `try` older than eight minutes (`DS_TRY_MS`, a run that was stopped) is taken up by the next run and logged as "did not finish"; `dsMarkHolds_` (sent, or being built) and `dsSent_` (gone) replace the bare property checks in `housekeepingTick_`, `hkNow_` and `sendMorningNow`. Past the run's budget (`late()`) a second morning build waits ten minutes for the next run. Every morning send is in the run log, and `showRunLog` ends with **Morning e-mail today**, desk by desk (`morningMailStatus_`; `morningMailStatus()` from the editor). **Resend by hand:** `resendMorningSasha / Liz / Azariah / Kamla / Pawan` (`resendMorning_`) send it again whatever the record says and say which way it went (support@ or Gmail). **The attendance rule and the reassignment:** absent at start + 5 and the work moving at start + 30 stand, but `absentDueAt_` holds the clock for a desk the morning e-mail goes to until that e-mail has gone, and then at least `ABSENT_GRACE_MIN` (15) after it; the register's reason gives the real deadline; `coverTick_` moves the work no sooner than 25 minutes after a late clock mark (`autoabs_<sid>_<day>`). The redeploy page's WANT is brought up to the script's version. Tests: `tests/test-morning-retry.js`; `tests/test-cover.js` gives Sasha her 6:30 e-mail and checks that without it she is not marked.
- **The desk app: every branch tool in one place (21 Oct 2026).** Ricky, 6:54am: "on the Ricky Rampersad branch.com site, I would like to have a desk app ... it is a lot of sites to remember ... this replaces the JotForm app ... queries, which links the Query Pal ... transmittals". The launcher (`/app` → `rroperations/index.html`) is regrouped by what each tool is for, the same order for every role: **Every day** (Log Book, Transmittal → `logbook/#trans`, My clients board, Delivery Book, Premium Due Desk), **Clients and queries** (Fact Find, Query Pal, Leads, Group clients), **Goals and reports** (FY27 Flight Plan, Fact Find insights, Clients dashboard, KPI reports), **Walls** (Wall Intelligence, Fact Find wall, Intelligence wall, Stream, Groups wall), **Meetings** (Branch meetings; Strategic meeting until 23 Oct, `until`), **Forms** (the JotForms the old Agent and Staff portals held, `FORMS`, each until it moves into the app; the Log Book and Delivery Book JotForms are gone, replaced) and **Learn** (How we work, Our workday film, the tests and films). **Find a tool** searches names, blurbs and the words people use (`tags`: orphan, digital log, transmittal, query, petty cash, licence…); the **moved** line shows old names and where they went (`MOVED`). Each tile says how it signs you in (`si`: Signed in = this app through `sso.js`; Fact find sign-in, Tracker sign-in, Meeting code, No sign-in, JotForm). "Your day" now opens with the morning e-mail check-in for staff and the Branch Manager. `?demo=a|l|s|m` shows a role's home without signing in (for the film and previews). The strategic meeting page loads `sso.js`. The homepage's Agent and Staff Portal tiles are one **Branch App** tile (`/app`), as is the "Agent & staff sign in" row; `agent.html` and `staff.html` carry a banner to the app. Not yet in the app: My day / My unit (per-person e-mail links), Branch Intelligence (its nightly rebuild has failed since the 21 Sep cell limit), the prospect board and the old snapshot walls. Test: `tests/e2e-deliverybook.js` (Forms, Find a tool, the moved line).
- **Branch Intelligence writes his replies; the history shows his notes' words (21 Oct 2026, 2026-10-21c).** Ricky, 9:14am, on his My branch comment page (`f=um`, `umReplyPage_`): "how do you build the Intelligence response from me instead of me typing to send in chatter, as this is supposed to analyze for a response, and you are to guide and advise what can be added to make responding for me easy using all the tools and resources I have". Under every task: **Draft my reply** (`umAiButton_`), and at the top **Draft replies for all** (`umAiIntro_`, one task after another). The page calls the public `umDraft(o)` through google.script.run, checked against `replySig_(sid, day, 'um')` and the page's own items (`um_items_`); `umDraft_` reads the whole Chatter oldest first (`cmdChatter_`, up to `UMAI.NOTES`), the task's record and the other open tasks on it (`umTaskContext_`, SELECT only), the playbook, and the branch's tools (`UMAI.TOOLS`: Log Book, Delivery Book, Premium Due Desk, Query Pal, clients board, FactFind360, Branch Intelligence, the KPI tracker, Salesforce), and Claude (`claudeDraftModel_()`) answers `{read, reply, next, add[≤3], action}`: where it stands, the reply in his voice (the person who must act by first name, what is needed by a date, what happens if not; never inventing amounts, dates, numbers or names: [blanks]), the next step, what to check or add first and in which tool, and chase / escalate / reassign / call / close / wait. **Use this reply** puts it in the box; **Firmer / Shorter / Kinder / Again** write it again (`tone`); words he typed or spoke first are the reply's substance (`said`). Nothing posts until he saves. Akaash's page has the same. **The blank notes:** `cmdChatter_` joins a note's lines, so a tracker note's words followed its head on one line and `chatterNotes_` showed "Unit Manager · Ricky Rampersad · Tue 20 Oct:" and nothing else; `noteParts_` (`NOTE_HEAD_RE`) now splits the head from the words either way. Test: `tests/test-um-draft.js`.
- **The BMA has Draft my reply too (21 Oct 2026, 2026-10-21d).** Ricky, 9:30am: "also make for the BMA as she is a manager as well and she needs to have these capabilities". On Kamla's day page (`sdPage_`) every task card has **Draft my reply** under its history, and the page has **Draft replies for all** (`umAiIntro_(open, 'card')`); **Use this reply** fills the card's note box (`n_<id>`) and ticks Done when the action is close, ready for Close now, Move now or Post note. `umDraft` takes `via: 'card'`: checked against `replySig_(sid, day, 'card')`, the desk must be a manager's (`intelReplyDesk_`: `INTEL_REPLY_DESKS` = kamla; Script Property `INTEL_REPLY_DESKS` overrides), and the task must be on her list for the day (`sd_list_`). Her voice: "the Branch Manager's Assistant (BMA), a manager who oversees the support staff" (`intelVoice_`); when she is the one who must act, the reply is her own note (what was done, the outcome, the next step and its date). Staff desks do not get it. Test: `tests/test-um-draft.js`.
- **Staff get Brief me; his comments read Branch Manager; Akaash's evening page works (21 Oct 2026, 2026-10-21e).** Ricky, 9:39am: "ok will go with you" (the staff version: a brief, not a written note) "and have noticed with My Comments i am seeing me as Unit Manager, Akaash is the unit manager and he needs to make his comments on AI guided with intelligence". **Staff:** every card on a staff day page has **Brief me** (`umAiButton_(id, 'brief')`) and the page **Brief me on all**; `umDraft` with `via: 'card'` for a desk that is not `intelReplyDesk_` goes to `umBrief_`: where it stands, what to do next and by when, up to three things to check first and in which tool, and the action (chase / call / close / wait). It writes a note only when the next step is to chase someone else (underwriting, Claims, a department, head office, an agent): a request with a date that says nothing was done ("A chase you can post", Use this chase, never ticks Done). A reply that reads as a report of work done (`BRIEF_DONE_RE`) is dropped: a staff note is the record of what they did and closures are judged in their appraisals. Draft with Claude stays for their own note. **His label:** comments from his page were headed "Unit Manager · Ricky Rampersad"; both posts now use `unitRole_(sid)` (Branch Manager for him, Unit Manager for Akaash), and his page is titled My branch. **Akaash:** his morning page already had Draft my reply; his evening page (`umEveReplyPage_`) showed the buttons without their script, so they did nothing: it now loads `umAiScript_(sid, day, 'umeve')` and `umDraft` reads the `_eve` items, checked against `replySig_(sid, day, 'umeve')`. His morning e-mail says Draft my reply is there. Test: `tests/test-um-draft.js`.
- **Channel 5 on the wall: FY27, our new way of work (21 Oct 2026).** Ricky, 9:52am: "this is a big achievement, so should we not update our video wall to show how we operate now!! lots of animation and motion and make it impactful with a pop to drive some serious insights and a wow, and also gamification so all know their roles and what's done daily, weekly, and celebrate our new work mode for our new financial year". `wall/index.html` gets a fifth channel, `newway` (green, header chip FY27, bumper "FY27 · CHANNEL 5 · OUR NEW WAY OF WORK"), seven scenes: **w1** We changed the way we work (six before/now cards: the old way struck through, the new one lands with a tick); **w2** Every tool, in one place (a phone that signs in, types "orphans" in Find a tool and opens My clients board; what is inside; 1 sign-in, 29 tools, 18 forms; rickyrampersadbranch.com/app); **w3** Every role has its rhythm (Branch Manager, Unit Manager, Staff, BMA, Agents on a 5am–6pm chart with the tracker's own times, a NOW needle sweeping across and the passed moments lighting up; on a phone, a card per role); **w4** Every week has its beat (the daily four, Monday to Saturday with today marked, and FY27 so far: the week, the share of the year's goal against the share of the year gone); **w5** Branch Intelligence (an example task with no client details, scanned, "where it stands" and the reply typed out, ESCALATE; who gets Draft my reply and who gets Brief me; today's closes with a note); **w6** The game (how you score, today's quests and streaks, the team goal against the backlog, Friday's awards); **w7** One branch, a new way of work (every desk and agent by first name, confetti). On the office wall the channel plays every other time round (`LOOPN`, the first time included); always in the sample; `?newway=off` / `?newway=always`; `?film=newway` is the film's own cut (`NW_FILM`: n0, w1–w6, n11, w7). Celebrations stay off the channel's scenes. A scene may have `onMount`. Andrew's lines are `wall/audio/v2/w1..w7.mp3` (runner key `fy27`).
  Then (10:16am) "all persons roles must be mentioned: the Branch Manager, Unit Manager, BMA, Sales Support and Agents", and (10:18am) "transmittals, reassignments, the wall, the shared work distribution, the fact find insights, what each manager sees and comments ... building a high-performance environment, our walls live in the branch". The day chart's lanes are Branch Manager, Unit Manager, BMA, Sales Support and Agents (the agents' count from the feed); Andrew names all five in w3, w5 and w7, and the close shows the five roles above the names. Five more scenes: **w8** The papers, end to end (Agent → Sales Support signs for it → by 12 noon → Transmittal → Department, documents moving along the line; the Delivery Book, the 5 pm digest, nothing lost); **w9** Shared work (the attendance rule in order, today's shared tasks, who is out and who covers them); **w11** What each manager sees (Branch Manager, Unit Manager, BMA: their morning page, what is on it, one live count each); **w10** Fact find insights (this month's fact finds, applications and conversion as a funnel, by agent); **w12** Our walls, live in the branch (the four walls as screens; "Everyone sees the score"). The channel's order: w1 w2 w3 w4 w8 w9 w5 w11 w10 w6 w12, then the four channels, then w7; `NW_FILM` follows it. The theme line, "Building a high-performance branch", is in w1, w12 and the close.
  Then (10:33am) "not hearing any music, and the ability to pause as well": the branch track under Andrew is at 34% (`BED_VOL`), ducked to 13% while he speaks (`BED_DUCK`); at 12% nobody heard it. **Pause** (the footer button, Space, or the card) now holds everything: the scene stays, the music and Andrew pause, every animation on the stage and the ticker freeze (`body.paused`), the progress bar stops where it is, and a **Paused · Tap to play** card sits over the wall; play picks up exactly there (`setPaused`).
- **The film: Our new way of work, at /howweworkvid/ (21 Oct 2026).** Ricky, 10:13am: "where is the full video ... what we do daily and how each starts their day and how our environment operates, our new way ... everyone and role is on the video", then 10:42am: "want to run on the site rickyrampersadbranch/howweworkvid". `howweworkvid/index.html` (from the work mode film page) plays the whole wall in the sample: the ident, FY27's eleven, every staff, agent, Branch Manager, manager and live scene, and the close, 4:14, with Andrew on every scene and the branch track ducked under him; `new-way-of-work.mp4` (1600x900) and `new-way-of-work-phone.mp4` (1080x1920, the phone layout), chapters from the recorder's marks (`data-scenes`, `data-chapters`). The staff are the branch's own; the agents' names and every figure are the sample; no client is shown. The old work mode film stays at /workmodevideodemo/.
- **FY27: our meetings, inside the meeting, and the client (21 Oct 2026).** Ricky, 10:51am: "the way we work regarding our new meeting builder that will be launched when we meet ... show the log in with built-in agendas and contribution for all ... all voices are heard and with a structure ... the ability to build the agenda and minutes ... show the meetings screen ... anything I forget that will make an impact". Three scenes on channel 5. `w13` "Every voice heard, with a structure": a phone signs in (agent number and password; signing in is the register), shows the agent's item and the carried-forward actions, then "What are you presenting?" added to the agenda; the Friday 2:00 to 3:30 agenda as a timeline that builds item by item with an owner on each (Branch Manager, Sales Support, Unit Manager, BMA, an agent, everyone), a ring for the 75 of 90 minutes the team holds (the chair 15), and the four steps from the daily check to the meeting. The meeting is Friday 2:00 to 3:30 (moved from Wednesday; the builder's README still says Wednesday morning). `w15` "Everyone signs in. Nothing is lost.": the Meeting Builder's own screens in a laptop and a phone frame, cycling in step with five lit steps (the chair builds it, the agenda, the register and who carries the meeting, the actions, the minutes). The screens are `wall/img/meet/*-lap.jpg` (1440x900) and `*-ph.jpg` (from 390x844), captured from `meetings/index.html` with its API mocked: sample people (the branch's staff, sample agents), no client anywhere; re-shoot them if the app's screens change. `w14` "The work shows up for the client": the service average (one decimal), ratings this week, five-star share, queries answered on time, how a handover, a Query Pal question and a closed task reach the client, and the latest ratings from `svc.recent`. Andrew: `wall/audio/v2/w13.mp3`, `w14.mp3`, `w15.mp3` (build-voice.sh). The film cut (`NW_FILM`) and the full film carry all three. Two Salesforce mentions came off the FY27 scenes (the film is public): "The system sets each day for every desk", "A comment under any task, without leaving the page". The film's music now loops under the whole film (`-stream_loop -1`); the branch track is two minutes long.
- **FY27, the rest of Ricky's list (21 Oct 2026, afternoon).** From 12:26 to 12:37: "Andrew is sound robotic", "branch meeting is on a Wednesday", "boast about the revised transmittal", "show the branch intelligence draft how it's done with a sample", "some slides hard to read as it's dark ... not seeing reminders on fact finds ... the slide number and more graphics", "where is the production wall and the goals are aligned", "hour by hour what's being actioned, the task type should be in a colour inside the green, as well who does the bag". New channel 5 scenes: `w17` the transmittal, built for you (the old book, measured; the printed transmittal with the reason beside a late line, stamped SENT; papers in by 11:45, the bag at 12 noon, the department asked after three working days, the 5 pm digest); `w16` Branch Intelligence, step by step (a sample task; the tracker's own labels: Draft my reply, Reading the whole history and the record, Where it stands, Your reply, Next step, To make it stronger, Use this reply, Firmer, Shorter, Kinder, Again; the page drawn light, as staff see it); `w18` nothing slips: the system asks (the week of reminders: Monday 7:00 no fact find in 14 days, Monday 8:14 started and never sent, every day 9:24 "Did this close?", Wednesday the reminder with the Unit Manager copied, Friday the answers to the managers; the agent's card, one tap on Picked up moves pipeline to production); `w20` our goals, aligned (one agent's FY27 Flight Plan from income need to contacts a week; each agent's % of API pace; the unit; the branch against the year gone; no plan, no fact find); `w19` the production wall (the week, the month, the year to date, written and waiting by age, month by month, who is carrying the year; sample figures). The production wall joins our walls in `w12`. Every scene has its number top right (`#sno`, `slideNo()`). Hour by hour (`n2`) colours each green hour by the kinds of task inside it (`hourKinds` from the feed) and rings the bag's hour in gold (`bag`); the hour-now cell no longer loops its entrance. The meeting is Wednesday 9:00 to 10:30 again on `w4` and `w13`; `w15`'s screens (`wall/img/meet/`) were re-shot for that meeting, cropped and lifted for a TV. Andrew is now "Andrew Expressive" (`en-US-AndrewMultilingualNeural`, +0%) on every scene, in conversational wording, each clip transcribed on the runner and checked as English (see the voice rule near the top). Staff wins pop up on the staff channel only and never for anyone out today (#241).
- **FY27, the deep dive: the client's journey, the fact find, the Log Book, the Wednesday wins (21 Oct 2026, evening).** Ricky, 5:41pm and 5:53pm: "drill into the fact find and agents ... clients get the draft, they get the approval ... what the agent gets, the reminders, what the managers see", "no lapses on these fact finds since we officially launched it in August 2026" ("find a strategy way to mention"), "the transmittal, how it's tracked with the time that goes by during the day ... how we leverage the clean data", "awards day cannot be a Friday: the weekly wins celebrated on a Wednesday in the meeting ... Starbucks ... MovieTowne ... everyone acknowledged", "templates visible, processes shown with motion and graphics", "for our client it's a journey at every touch point ... fully compliant according to the Insurance Act, market conduct". New channel 5 scenes:
  - `w22`: the client's journey, six stops; each shows THE CLIENT, a real screen from `wall/img/jr/`, and BEHIND THE AGENT.
  - `w24`: the digital fact find end to end. Its payoff is the counter to 0 "lapses since the digital fact find launched, August 2026"; the date is Ricky's, though FactFind360's index.html says 1 July.
  - `w25`: the fact find's own e-mails and pages, `wall/img/ff/`, rendered from fact-find-analyzer with sample data, four at a time, each scrolling by `object-position`.
  - `w23`: compliance, clause by clause against the CBTT Market Conduct Guideline (July 2023, under the Insurance Act, 2018): 5.2, 5.2.2, 5.3.1, 5.4.2, 5.4.3, 5.6, 5.7.
  - `w26`: the Log Book in the agent's hand. Eight phone screens in `wall/img/lb/`, captured from `rroperations/logbook/` with the API mocked and sample clients, lit in step with eight timed steps. Beside them, the clean data: six spellings of GLOC CS RSC - CHAGUANAS taken from `LB_DEPTS`' alias pattern fold into one; 90 into 25 departments, 237 into 70 documents, 3,634 lines.
  - `w21`: every Wednesday, the week's wins (Wednesday to Tuesday, ready at 7:00): staff awards and agents' wins, Starbucks and MovieTowne tickets, everyone acknowledged, confetti. Friday's awards came off `w4`, `w6` and `n4`; KPI.gs 21h moves the awards e-mail to Wednesday (#248).

  The wall's order puts the fact find together (w24 w25 w10 w18 w23) and w26 between w8 and w17. `NW_FILM` is now the tight story, about five minutes, and `list()` plays it in NW_FILM's own order: n0 w1 w22 w24 w25 w18 w23 w3 w26 w17 w11 w16 w13 w15 w20 w21 w14 w19 w12 w7. /howweworkvid/ was rewritten for that cut. The Log Book still holds whole hours (in by 12, the bag at 13), so it cannot say 11:45; the wall and the film use 11:45 and 12:00, Ricky's times.
- **Service ratings, task by task (21 Oct 2026, 2026-10-21f).** Ricky, 12:37pm: "I am seeing the Ratings coming in but a lot more data is needed: the timelines, the chats, the intelligence etc, the client, the department, how, so I can see this, the type etc, build more intel". **At send time** `rateRun_` keeps eight more columns, appended to the end of `RATETAB.head` so older rows still line up (`rateCols_` adds them to an existing tab): `Agent`, `Client` (the task's Who when a CLIENT), `Department` (the Who, or the Agent__c, when a BUSINESS CONTACT; otherwise the first department the notes name, newest first, then the subject, `RATE_DEPTS`; otherwise where the playbook routes the kind, `RATE_DEPT_BY_KIND`), `Opened` and `Closed` (branch time, "2026-10-14 08:00"), `Notes` (Chatter text notes), `Timeline` (JSON `[{a, k, b, x}]`: open with the subject and due date; every note, who and when, 140 characters, the page's head line removed; replies; workload moves from Workload Moves; date moves from Task Changes and Due Moves, the same move once; close with the closing note, 300 characters; at most `RATEPG.TL_MAX` = 40 steps) and `Intel`. `rateFacts_` builds it from what the run already read plus two Salesforce reads a run, only when there is something to send: FeedComment (the replies) and User (names not on the register); the Task query gained `CreatedById, ActivityDate`. `rateReads_` makes ONE Claude call a run for every task (`ANTHROPIC_MODEL` or `CLAUDE_READ.MODEL`), answering `{summary, intel}` per id: the agent's two-sentence summary as before, and two or three sentences on how it went (how long it sat, the follow-ups, where the wait was, how it was worked, whether the closing note says what was done). Without a key, on a failure or a missing answer: the note, and `rateIntelPlain_` (the same points from the record: days, notes before the close, replies, moves, phone/e-mail/WhatsApp from the notes `RATE_HOW`, the longest wait between two steps and what the notes say it waited on `PLAYBOOK_WAIT_RE`, and `RATE_DONE_RE` on the closing note). **His page** `?rs=ricky&f=rate&k=` (`rateIntelUrl_`, signed `replySig_(sid, 'always', 'rate')`, one link for every day, not in `FAST.KINDS`: it reads the tab only): the week (ratings, the average, five-star share, answered of asked, the days, notes and department most involved, by who closed it, by type, the three lowest as links), then a card per rating, newest first (latest `RATEPG.MAX` = 200): stars and comment or "Waiting for a rating" / "Not sent", who closed it for whom, client, department, agent, type and kind, opened to closed, days and notes, the intelligence, the timeline as a vertical list; filters by closer, agent or client, type and stars, client-side. Rows from before show "—". `&i=<token>` opens that card: the 1 or 2 star e-mail (`rateAlert_`) now carries "See the whole task" and the read. The link: his morning mail and his 11:00 / 3:00 mails ("Also:"), My day's links, and under the ratings on his day page (`gameBmSec_`). For him alone; Script Property `RATE_PAGE_ALSO` (e.g. `kamla, akaash`) opens it to the BMA or a Unit Manager, `showRatingsLink("kamla")` gives the link; never a desk. Never on the wall: `rateStats_`, which `wallStaff_` reads, carries none of it. Test: `tests/test-rate-intel.js`.
- **The wall knows the kinds in each hour, and who has the bag (21 Oct 2026, 2026-10-21f).** Ricky: "hour by hour what's being actioned, the task type should be in a colour inside the green, as well who does the bag as well built in". `wallStaff_` now sends each person's `hourKinds` (per hour, the closes with a note by `wallKind_`: new, orphan, retention, claims, other) and `bag` ({who, at, h, cutoff, covering}) from `mailbagRouter_` (the weekly rota, the next one in when the router is out) and `mailbagLeaves_` (12 noon unless `MAILBAG_AT`), papers in a quarter of an hour before. The wall colours each green hour by kind and rings the bag's hour in gold. Tests: `tests/test-wall2.js`.
- **Sample ratings for the Branch Manager (21 Oct 2026, 2026-10-21g).** Ricky, 1:55pm: "send some samples to see the revised and let me click". `rateSamples(n)` in the editor, or **Send me sample ratings** on his Ratings page (a signed POST `rs=ricky&f=rate&k=…&act=samples` through `replyPost_`, him alone, not `RATE_PAGE_ALSO`; a second press within `RATE.SAMPLE_GAP_MIN` = 2 minutes sends nothing), sends up to `RATE.SAMPLES` = 3 agent rating e-mails in the real format (`rateAgentMail_`, subject `[Sample] …`) to `managerEmails_()` only, each from one of the latest real agent rows (its subject from the timeline's open step, kind, days, closer, the closing note as what was done, and the record's columns), or from `RATE_SAMPLE_MADE` (no client) when there are none; then one e-mail with every sample's five stars, its card and his page. Each sample is a row of its own (Kind and Status `sample`, Email his), so the stars, the thank-you page, a comment and the 1–2 star alert (`[Sample] Low rating …`, with See the whole task) all work. `rateIsSample_`: no Chatter post from `rateClick_` or `ratePost_`, `&out=1` changes nothing, and `rateStats_` (the week, the game's cards and board, the Service Star, his day page, the wall's `svc` and ticker) and `rateRun_`'s cap, cool-down and opt-outs skip it. His page marks sample cards (dashed, Sample), has Hide samples, and never counts them in the week. Agent e-mails only: client mail stays held. Test: `tests/test-rate-samples.js`.

## Web fonts — non-blocking, with a fallback that does not move the page

A plain `<link rel="stylesheet">` to `fonts.googleapis.com` holds up first
paint. It was on **140 pages**. Measured on a phone viewport with Google
answering in 600 ms, first contentful paint sat at 650–1470 ms; with the host
unreachable the page showed nothing at all until the request timed out. All of
that is a blank screen for somebody opening a WhatsApp link on mobile data.

Every served page now loads fonts like this:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="<css2 url>" rel="stylesheet" media="print"
      onload="this.media='all';this.onload=null">
<noscript><link href="<css2 url>" rel="stylesheet"></noscript>
```

`media="print"` makes the fetch non-blocking; `onload` promotes it to `all`.
Keep the `noscript` copy, or a visitor without JS is left in the fallback.

**Non-blocking alone made things worse, and this is the part to remember.**
Paint got fast, then the webfont swapped in and the text reflowed: cumulative
layout shift went from 0 to **0.205** on the homepage, 0.174 on
donthaveanagent and 0.119 on /quote/, all failing Core Web Vitals. Speed was
bought with a page that jumps while it is being read.

So every page also carries **metric-matched fallback faces**, and the stack
names them:

```css
--display: 'Inter Tight', 'Inter Tight Fallback', 'Inter Tight Fallback R', system-ui, sans-serif;
```

A fallback the stack never names is a fallback nobody uses. Four things about
them, each learned by getting it wrong first:

- **`local()` matches a font's real installed name, never a fontconfig alias.**
  Probed in Chrome: `local('Arial')` does not resolve on Linux even though
  `font-family: Arial` does. Android has no Arial at all. So face one lists
  `Arial, Helvetica, Liberation Sans, Arimo` and face two (`… Fallback R`)
  lists `Roboto`, which is what an Android phone actually ships. Without the
  second face a large share of Trinidad visitors match nothing.
- **Two weight buckets, `100 500` and `600 900`.** A size-adjust taken from
  the regular weight does not fit an 800-weight heading; that single mistake
  pushed /service/ from 0.085 to **0.289**. Montserrat needs 112.94% at 400
  and 110.34% at 700.
- **Never compute the ratio from `OS/2.xAvgCharWidth`.** Modern Google faces
  compute it across their whole glyph set while Arial's is a legacy lowercase
  figure; mixing the two definitions gave Inter 146% instead of its true
  ~107%. Measure the average advance width from `cmap` + `hmtx` over the same
  English-frequency-weighted character set for both fonts.
- **Never inject a font stack inside `<script>`.** `/prospecting/` builds
  markup in a JS string — `'font:16px/1.6 Inter, …'` — and a single-quoted
  fallback dropped in there closes the string and throws `SyntaxError`. Mask
  script bodies before touching font stacks.

Result across the 135 converted pages: first paint median **108 ms** (p90
152 ms), CLS median **0.0023**, nothing above 0.1, no JS errors, no sideways
overflow.

**Five pages keep the blocking link on purpose** — they shifted when made
async and are internal, where a blank moment costs nothing and a jumping
layout costs attention: `manual/`, `gs/`, `orphan-servicing/`,
`quote/key-person/` and `orphan-transition/board-films.html`.

**Film sources keep it too.** A page carrying `data-d` scene markup is
recorded frame by frame, and a recorder must have the real face on frame one
or the swap shows as a font pop in the MP4. Same for
`tools/letters/film-card.html`, which is rendered to a JPEG. `apps-script/`
templates are not web pages and never had one.
