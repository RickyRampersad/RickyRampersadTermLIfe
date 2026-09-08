#!/usr/bin/env python3
"""Assemble wall-film.html from the proven client-film shell.

The shell carries eight embedded woff2 faces and the scene runner, both of
which the recorder depends on, so it is cloned byte-for-byte and only the
scenes between the chrome and the tap zones are replaced.
"""
import json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent      # tools/film
ROOT = HERE.parent.parent                            # the repository
SITE = ROOT / 'donthaveanagent'
SRC = SITE / 'client-film.html'                      # the shell that is cloned
OUT = SITE / 'wall-film.html'
# scene lengths, measured from the narration — see CLAUDE.md
TIMING = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / 'wall-timing.json'
D = json.load(open(TIMING))['durs']
ms = [int(round(d * 1000)) for d in D]

s = SRC.read_text()

# ── the wall's own look, appended last so it wins ──────────────────────
CSS = r"""
/* ══ wall film ═════════════════════════════════════════════════════ */
.wf{--wc:#FF5C4D;--wok:#3DD68C;--ww:#F5B935}
.scene.wf{background:radial-gradient(1000px 560px at 10% -12%,rgba(255,92,77,.17),transparent 62%),
  radial-gradient(760px 460px at 95% 106%,rgba(61,214,140,.09),transparent 64%),#0A121F}
.scene.wf .inner{color:#F2F6FC}
.scene.wf h1,.scene.wf h2{color:#fff}
.scene.wf .eyebrow{color:var(--wc)}
.scene.wf .big-sub{color:#8598B4}

/* the screen the wall lives on */
.screen{max-width:700px;margin:10px auto 0;background:#111C2F;border:1px solid #22324D;
  border-radius:14px;padding:14px 17px 13px;text-align:left;box-shadow:0 26px 60px rgba(0,0,0,.45)}
.screen .shead{display:flex;align-items:center;gap:9px;margin-bottom:10px}
.screen .shead b{font:800 10px var(--head);letter-spacing:.24em;text-transform:uppercase;color:var(--wc)}
.screen .shead i{margin-left:auto;font:700 10px var(--head);letter-spacing:.16em;
  text-transform:uppercase;color:#8598B4;font-style:normal}

/* ── the opening number, inside a sweeping ring ── */
.ringwrap{display:flex;align-items:center;gap:22px}
.ring{width:132px;height:132px;flex:none;position:relative}
.ring svg{width:100%;height:100%;transform:rotate(-90deg);overflow:visible}
.ring .trk{fill:none;stroke:#1B2942;stroke-width:11}
.ring .arc{fill:none;stroke:var(--wc);stroke-width:11;stroke-linecap:round;
  stroke-dasharray:352;stroke-dashoffset:352;filter:drop-shadow(0 0 12px rgba(255,92,77,.55))}
.scene.on .ring .arc{animation:sweep 1.5s .35s cubic-bezier(.25,.9,.3,1) forwards}
@keyframes sweep{to{stroke-dashoffset:var(--to,88)}}
.ring b{position:absolute;inset:0;display:grid;place-items:center;white-space:nowrap;
  font:900 46px var(--head);color:#fff;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.ring.g .arc{stroke:var(--wok);filter:drop-shadow(0 0 12px rgba(61,214,140,.5))}
.wsay{font:800 clamp(17px,3.2vw,25px)/1.14 var(--head);color:#fff;letter-spacing:-.02em}
.wsub{font:400 13px var(--body);color:#8598B4;margin-top:7px}

/* ── tiles, with a sparkline under each ── */
.wt{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
.wt>div{background:#0D1728;border:1px solid #22324D;border-radius:11px;padding:11px 12px}
.wt b{display:block;font:900 clamp(24px,4.4vw,36px)/.9 var(--head);letter-spacing:-.03em;
  color:#fff;font-variant-numeric:tabular-nums}
.wt span{display:block;font:700 8px var(--head);letter-spacing:.15em;text-transform:uppercase;
  color:#8598B4;margin-top:6px}
.wt>div.h{border-color:rgba(255,92,77,.5);background:linear-gradient(180deg,rgba(255,92,77,.13),transparent 70%),#0D1728}
.wt>div.h b{color:var(--wc)} .wt>div.g b{color:var(--wok)} .wt>div.w b{color:var(--ww)}
.spk{display:flex;align-items:flex-end;gap:2px;height:20px;margin-top:8px}
.spk i{flex:1;border-radius:2px 2px 0 0;background:#22324D;transform-origin:bottom;transform:scaleY(0)}
.wt>div.h .spk i{background:rgba(255,92,77,.55)} .wt>div.g .spk i{background:rgba(61,214,140,.5)}
.scene.on .spk i{animation:barup .45s cubic-bezier(.2,1.1,.4,1) forwards}

/* ── leaderboard, with a bar behind every name ── */
.wrow{display:flex;align-items:center;gap:11px;padding:7px 0;border-bottom:1px solid rgba(34,50,77,.7);
  position:relative}
.wrow:last-child{border-bottom:none}
.wrk{width:22px;height:22px;border-radius:7px;background:#0A121F;border:1px solid #22324D;
  display:grid;place-items:center;font:800 10px var(--head);color:#8598B4;flex:none;z-index:1}
.wrow.lead .wrk{background:var(--wc);border-color:var(--wc);color:#180A08}
.wrow.lead .wnm{color:var(--wc)}
.wnm{font:700 14.5px var(--head);color:#fff;width:88px;flex:none;letter-spacing:-.01em;z-index:1}
.perf{flex:1;height:14px;background:#0D1728;border-radius:7px;overflow:hidden;position:relative}
.perf i{position:absolute;inset:0 auto 0 0;width:0;border-radius:7px;
  background:linear-gradient(90deg,rgba(255,92,77,.55),var(--wc))}
.wrow.lead .perf i{background:linear-gradient(90deg,rgba(255,92,77,.7),#FF8A7E);
  box-shadow:0 0 16px rgba(255,92,77,.45)}
.scene.on .perf i{animation:fillbar .95s .5s cubic-bezier(.25,.9,.3,1) forwards}
@keyframes fillbar{to{width:var(--w,50%)}}
.wnum{font:800 14.5px var(--head);color:#fff;font-variant-numeric:tabular-nums;
  width:34px;text-align:right;flex:none;z-index:1}
.wnum.z{color:#3E4E67} .wnum.g{color:var(--wok)}
.whd{display:flex;gap:11px;padding-bottom:6px;border-bottom:1px solid #22324D;margin-bottom:2px}
.whd .a{width:121px;flex:none;font:700 8px var(--head);letter-spacing:.08em;
  text-transform:uppercase;color:#8598B4}
.whd .b{flex:1;font:700 8px var(--head);letter-spacing:.08em;text-transform:uppercase;color:#8598B4}
.whd .c{width:34px;flex:none;text-align:right;font:700 8px var(--head);letter-spacing:.06em;
  text-transform:uppercase;color:#8598B4}

/* ── the queue ── */
.wq{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(34,50,77,.7)}
.wq:last-child{border-bottom:none}
.wpill{font:800 8px var(--head);letter-spacing:.13em;text-transform:uppercase;padding:4px 7px;
  border-radius:6px;border:1px solid;flex:none;width:60px;text-align:center}
.wpill.u{color:#180A08;background:var(--wc);border-color:var(--wc)}
.wpill.h{color:var(--wc);background:rgba(255,92,77,.13);border-color:rgba(255,92,77,.5)}
.wpill.n{color:#8598B4;border-color:#22324D}
.wqw{flex:1;min-width:0}
.wqw b{display:block;font:700 14px var(--head);color:#fff;letter-spacing:-.01em}
.wqw span{font:400 10.5px var(--body);color:#8598B4}
.wage{font:800 13px var(--head);color:#8598B4;font-variant-numeric:tabular-nums;flex:none}
.wage.late{color:#FF7A6B}
.scene.on .wq.flash{animation:redflash 1.6s .8s ease-in-out infinite}
@keyframes redflash{50%{background:rgba(255,92,77,.10)}}

/* ── thirty days: bars plus a line that only climbs ── */
.chart{position:relative;height:132px;margin-top:2px}
.wbars{display:flex;align-items:flex-end;gap:3px;height:132px}
.wbars i{flex:1;background:linear-gradient(180deg,#FF5C4D,rgba(255,92,77,.32));
  border-radius:3px 3px 0 0;min-height:3px;transform-origin:bottom;transform:scaleY(0)}
.wbars i.z{background:#1B2942}
.wbars i.pk{background:linear-gradient(180deg,#fff,#FF5C4D);box-shadow:0 0 22px rgba(255,92,77,.55)}
.scene.on .wbars i{animation:barup .5s cubic-bezier(.2,1.1,.4,1) forwards}
@keyframes barup{to{transform:scaleY(1)}}
.cum{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.cum path{fill:none;stroke:#3DD68C;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;
  filter:drop-shadow(0 0 8px rgba(61,214,140,.55));stroke-dasharray:640;stroke-dashoffset:640}
.scene.on .cum path{animation:drawit 1.9s .55s ease forwards}
.cum circle{fill:#3DD68C;opacity:0;filter:drop-shadow(0 0 8px rgba(61,214,140,.7))}
.scene.on .cum circle{animation:fadein .4s 2.2s ease forwards}

/* ── the feed ── */
.wev{display:flex;align-items:center;gap:10px;background:#0D1728;border:1px solid #22324D;
  border-radius:10px;padding:8px 11px;margin-bottom:6px;opacity:0;transform:translateX(-22px)}
.wev:last-child{margin-bottom:0}
.scene.on .wev{animation:slidein .55s cubic-bezier(.25,1.05,.35,1) forwards}
@keyframes slidein{to{opacity:1;transform:none}}
.wic{width:24px;height:24px;border-radius:8px;display:grid;place-items:center;flex:none;
  font:800 10px var(--head)}
.wic.n{background:rgba(255,92,77,.18);color:var(--wc)}
.wic.o{background:rgba(245,185,53,.18);color:var(--ww)}
.wic.s{background:rgba(61,214,140,.18);color:var(--wok)}
.wic.c{background:rgba(255,122,107,.2);color:#FF7A6B}
.wev .wt2{flex:1;min-width:0}
.wev .wt2 b{display:block;font:700 13.5px var(--head);color:#fff}
.wev .wt2 span{display:block;font:400 10.5px var(--body);color:#8598B4}
.wev .wtm{font:400 10px var(--body);color:#8598B4;flex:none}

/* ── the ten-minutes-to-one-glance contrast ── */
.vs{display:flex;align-items:flex-end;justify-content:center;gap:clamp(18px,4vw,52px);margin-top:18px}
.vsb{text-align:center}
.vsb .bar{width:clamp(90px,15vw,150px);border-radius:10px;margin:0 auto 11px;transform-origin:bottom;
  transform:scaleY(0)}
.vsb.a .bar{height:132px;background:linear-gradient(180deg,#3E4E67,#22324D)}
.vsb.b .bar{height:15px;background:linear-gradient(180deg,#fff,var(--wc));
  box-shadow:0 0 30px rgba(255,92,77,.6)}
.scene.on .vsb.a .bar{animation:barup .55s .35s cubic-bezier(.2,1.1,.4,1) forwards}
.scene.on .vsb.b .bar{animation:barup .55s 1.15s cubic-bezier(.2,1.5,.4,1) forwards}
.vsb b{display:block;font:900 clamp(24px,4vw,38px)/1 var(--head);letter-spacing:-.03em;color:#fff}
.vsb.b b{color:var(--wc)}
.vsb span{display:block;font:700 9px var(--head);letter-spacing:.17em;text-transform:uppercase;
  color:#8598B4;margin-top:7px}
.arrw{font:900 30px var(--head);color:#3E4E67;opacity:0;align-self:center;margin-bottom:26px}
.scene.on .arrw{animation:fadein .5s .95s ease forwards}

/* ── seven slides fanning out ── */
.fan{display:flex;gap:8px;justify-content:center;margin-top:18px}
.fan i{display:block;width:58px;height:38px;border-radius:7px;background:#111C2F;
  border:1px solid #22324D;position:relative;overflow:hidden;opacity:0;transform:translateY(-30px) rotate(-6deg)}
.fan i::after{content:"";position:absolute;left:7px;right:7px;top:9px;height:5px;border-radius:3px;
  background:#22324D}
.fan i.a{border-color:rgba(255,92,77,.6)} .fan i.a::after{background:var(--wc)}
.scene.on .fan i{animation:fanin .5s cubic-bezier(.22,1.3,.36,1) forwards}
@keyframes fanin{to{opacity:1;transform:none}}

/* ── the spreadsheet nobody opened ── */
.sheet{max-width:520px;margin:14px auto 0;border:1px solid rgba(255,246,244,.16);border-radius:10px;
  overflow:hidden;opacity:.42}
.sheet div{display:flex;border-bottom:1px solid rgba(255,246,244,.11)}
.sheet div:last-child{border-bottom:none}
.sheet span{flex:1;height:17px;border-right:1px solid rgba(255,246,244,.11)}
.sheet span:last-child{border-right:none}
.sheet div:first-child span{background:rgba(255,246,244,.14);height:19px}
.dust{position:relative}
.dust i{position:absolute;left:0;right:0;top:47%;height:6px;border-radius:3px;background:#FF5C4D;
  transform:scaleX(0);transform-origin:left;box-shadow:0 0 22px rgba(255,92,77,.5)}
.scene.on .dust i{animation:strikedraw .55s 1.5s cubic-bezier(.25,.9,.3,1) forwards}

/* the promise: two rings side by side */
.rings{display:flex;justify-content:center;gap:clamp(20px,5vw,60px);margin-top:6px}
.rings .ringwrap{flex-direction:column;gap:11px;text-align:center}
.rings .ring{width:118px;height:118px}
.rings .ring b{font-size:33px}
.rings .lab{font:700 9px var(--head);letter-spacing:.17em;text-transform:uppercase;color:#8598B4}

@media (prefers-reduced-motion:reduce){
  .scene.on .wbars i,.scene.on .spk i,.scene.on .vsb .bar{animation:none;transform:none}
  .scene.on .dust i{animation:none;transform:scaleX(1)}
  .scene.on .perf i{animation:none;width:var(--w,50%)}
  .scene.on .ring .arc{animation:none;stroke-dashoffset:var(--to,88)}
  .scene.on .cum path{animation:none;stroke-dashoffset:0}
  .scene.on .wev,.scene.on .fan i,.scene.on .cum circle,.scene.on .arrw{animation:none;opacity:1;transform:none}}
"""

# ── thirty days: bars, plus the cumulative line over them ──────────────
BARH = [0, 0, 12, 26, 18, 0, 0, 34, 41, 29, 47, 33, 0, 0, 52, 38, 61, 44, 56, 0, 0,
        67, 49, 74, 58, 71, 0, 0, 83, 96]
bars = "".join(
    '<i class="%s" style="animation-delay:%.2fs;height:%d%%"></i>'
    % ("z" if h == 0 else ("pk" if h >= 96 else ""), 0.30 + i * 0.020, max(5, h))
    for i, h in enumerate(BARH))
# the line climbs on cumulative total, scaled into the top 78% of the box
cum, run = [], 0
for h in BARH:
    run += h
    cum.append(run)
pts = " ".join("%.1f,%.1f" % (i * (100 / (len(cum) - 1)), 100 - 4 - (c / cum[-1]) * 78)
               for i, c in enumerate(cum))
cumpath = ('<svg class="cum" viewBox="0 0 100 100" preserveAspectRatio="none">'
           '<polyline points="' + pts + '" style="fill:none;stroke:#3DD68C;stroke-width:2.6;'
           'stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;'
           'filter:drop-shadow(0 0 8px rgba(61,214,140,.55));stroke-dasharray:640;stroke-dashoffset:640">'
           '<animate attributeName="stroke-dashoffset" from="640" to="0" dur="1.9s" begin="0.55s" fill="freeze"/>'
           '</polyline></svg>')

spark = lambda vals, d0: "".join(
    '<i style="height:%d%%;animation-delay:%.2fs"></i>' % (max(8, v), d0 + k * 0.05)
    for k, v in enumerate(vals))

# a ring: 352 is the circumference, so offset = 352 * (1 - fraction)
ring = lambda frac, val, cls="": (
    '<div class="ring %s"><svg viewBox="0 0 120 120">'
    '<circle class="trk" cx="60" cy="60" r="56"/>'
    '<circle class="arc" cx="60" cy="60" r="56" style="--to:%.0f"/></svg>'
    '<b>%s</b></div>' % (cls, 352 * (1 - frac), val))

SCENES = f"""
<!-- 1 · the question -->
<div class="cardart"></div>
<div class="grain"></div>
<section class="scene wf dark" data-d="{ms[0]}">
  <div class="inner">
    <div class="eyebrow st d1">Every morning</div>
    <h1 class="st drop d2">Where do we<br><em>actually</em> stand?</h1>
    <p class="big-sub st d3">Nobody could answer it in under ten minutes.</p>
  </div>
</section>

<!-- 2 · the spreadsheet nobody opened -->
<section class="scene wf dark" data-d="{ms[1]}">
  <div class="inner">
    <div class="eyebrow st d1">Until now</div>
    <h2 class="st drop d2">The answer lived in a spreadsheet.</h2>
    <div class="sheet dust st d3">
      <div><span></span><span></span><span></span><span></span><span></span></div>
      <div><span></span><span></span><span></span><span></span><span></span></div>
      <div><span></span><span></span><span></span><span></span><span></span></div>
      <div><span></span><span></span><span></span><span></span><span></span></div>
      <div><span></span><span></span><span></span><span></span><span></span></div>
      <i></i>
    </div>
    <p class="big-sub st d4">Somebody had to open it. Most mornings, nobody did.</p>
  </div>
</section>

<!-- 3 · ten minutes → one glance -->
<section class="scene wf dark" data-d="{ms[2]}">
  <div class="inner">
    <div class="eyebrow st d1">The difference</div>
    <h2 class="st drop d2">Ten minutes, or one glance.</h2>
    <div class="vs">
      <div class="vsb a"><div class="bar"></div><b>10 min</b><span>Working it out</span></div>
      <div class="arrw">&rarr;</div>
      <div class="vsb b"><div class="bar"></div><b>3 sec</b><span>Looking up</span></div>
    </div>
  </div>
</section>

<!-- 4 · the reveal -->
<section class="scene wf dark" data-d="{ms[3]}">
  <div class="inner">
    <div class="eyebrow st d1">So we built it</div>
    <h1 class="st drop d2">The Wall.</h1>
    <p class="big-sub st d3">One screen. Seven slides. Running by itself.</p>
    <div class="fan">
      <i class="a" style="animation-delay:.55s"></i><i style="animation-delay:.70s"></i>
      <i style="animation-delay:.85s"></i><i style="animation-delay:1.00s"></i>
      <i style="animation-delay:1.15s"></i><i style="animation-delay:1.30s"></i>
      <i style="animation-delay:1.45s"></i>
    </div>
  </div>
</section>

<!-- 5 · who is waiting -->
<section class="scene wf dark" data-d="{ms[4]}">
  <div class="inner">
    <div class="eyebrow st d1">Slide one</div>
    <div class="screen st drop d2">
      <div class="shead"><b>Right now</b><i>Live</i></div>
      <div class="ringwrap">
        {ring(0.75, '<span class="count" data-count="9">0</span>')}
        <div>
          <div class="wsay">people are waiting<br>to hear from us</div>
          <div class="wsub">Every one was promised a person, not an auto-reply.</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- 6 · the day -->
<section class="scene wf dark" data-d="{ms[5]}">
  <div class="inner">
    <div class="eyebrow st d1">Slide two</div>
    <div class="screen st drop d2">
      <div class="shead"><b>The day so far</b><i>Updated a moment ago</i></div>
      <div class="wt">
        <div class="h"><b class="count" data-count="4">0</b><span>Filed today</span>
          <div class="spk">{spark([20,45,30,70,55,90,100], 0.55)}</div></div>
        <div><b class="count" data-count="23">0</b><span>This month</span>
          <div class="spk">{spark([30,40,35,60,70,80,95], 0.62)}</div></div>
        <div class="g"><b class="count" data-count="16">0</b><span>Completed</span>
          <div class="spk">{spark([15,30,50,45,70,85,100], 0.69)}</div></div>
        <div><b class="count" data-count="61">0</b><span>All time</span>
          <div class="spk">{spark([10,25,40,55,70,85,100], 0.76)}</div></div>
      </div>
    </div>
  </div>
</section>

<!-- 7 · the team -->
<section class="scene wf dark" data-d="{ms[6]}">
  <div class="inner">
    <div class="eyebrow st d1">Slide three</div>
    <div class="screen st drop d2">
      <div class="shead"><b>Who is doing the work</b><i>Ranked by finished</i></div>
      <div class="whd"><span class="a">Agent</span><span class="b">Closed</span>
        <span class="c">Own</span><span class="c">Open</span><span class="c">Done</span></div>
      <div class="wrow lead"><span class="wrk">1</span><span class="wnm">Fawaaz</span>
        <span class="perf"><i style="--w:100%;animation-delay:.55s"></i></span>
        <span class="wnum">3</span><span class="wnum z">1</span><span class="wnum g">6</span></div>
      <div class="wrow"><span class="wrk">2</span><span class="wnm">Renee</span>
        <span class="perf"><i style="--w:50%;animation-delay:.70s"></i></span>
        <span class="wnum">2</span><span class="wnum">2</span><span class="wnum g">3</span></div>
      <div class="wrow"><span class="wrk">3</span><span class="wnm">Dinesh</span>
        <span class="perf"><i style="--w:17%;animation-delay:.85s"></i></span>
        <span class="wnum z">0</span><span class="wnum">1</span><span class="wnum g">1</span></div>
    </div>
    <p class="big-sub st d3">Assigned and self-introduced. Both counted, never mixed together.</p>
  </div>
</section>

<!-- 8 · waiting on us -->
<section class="scene wf dark" data-d="{ms[7]}">
  <div class="inner">
    <div class="eyebrow st d1">Slide four</div>
    <div class="screen st drop d2">
      <div class="shead"><b>Waiting on us</b><i>Oldest first</i></div>
      <div class="wq flash"><span class="wpill u">Urgent</span>
        <div class="wqw"><b>A claim nobody closed</b><span>not assigned</span></div>
        <span class="wage late">4d</span></div>
      <div class="wq"><span class="wpill h">High</span>
        <div class="wqw"><b>Beneficiary out of date</b><span>Renee</span></div>
        <span class="wage">1d</span></div>
      <div class="wq"><span class="wpill n">Normal</span>
        <div class="wqw"><b>Address correction</b><span>Fawaaz</span></div>
        <span class="wage">today</span></div>
    </div>
    <p class="big-sub st d3">Past the day we promised, it turns red — and stays red.</p>
  </div>
</section>

<!-- 9 · thirty days -->
<section class="scene wf dark" data-d="{ms[8]}">
  <div class="inner">
    <div class="eyebrow st d1">Slide five</div>
    <div class="screen st drop d2">
      <div class="shead"><b>Thirty days</b><i>Filed per day &middot; total climbing</i></div>
      <div class="chart"><div class="wbars">{bars}</div>{cumpath}</div>
    </div>
    <p class="big-sub st d3">The quiet weeks show as clearly as the busy ones — and the line only climbs.</p>
  </div>
</section>

<!-- 10 · live -->
<section class="scene wf dark" data-d="{ms[9]}">
  <div class="inner">
    <div class="eyebrow st d1">Slide six</div>
    <div class="screen st drop d2">
      <div class="shead"><b>As it happens</b><i>Live</i></div>
      <div class="wev" style="animation-delay:.50s"><span class="wic n">NEW</span>
        <div class="wt2"><b>A review just landed</b><span>filed a review</span></div><span class="wtm">now</span></div>
      <div class="wev" style="animation-delay:.75s"><span class="wic o">&#128065;</span>
        <div class="wt2"><b>Renee</b><span>her link was opened</span></div><span class="wtm">2m</span></div>
      <div class="wev" style="animation-delay:1.00s"><span class="wic s">&#9654;</span>
        <div class="wt2"><b>Fawaaz</b><span>somebody started a review</span></div><span class="wtm">6m</span></div>
      <div class="wev" style="animation-delay:1.25s"><span class="wic c">&#9742;</span>
        <div class="wt2"><b>A call-back request</b><span>asked to be called</span></div><span class="wtm">11m</span></div>
    </div>
  </div>
</section>

<!-- 11 · the promise -->
<section class="scene wf dark" data-d="{ms[10]}">
  <div class="inner">
    <div class="eyebrow st d1">Slide seven</div>
    <div class="screen st drop d2">
      <div class="shead"><b>The promise</b><i>Kept, and not kept</i></div>
      <div class="rings">
        <div class="ringwrap">{ring(0.96, '<span class="count" data-count="96">0</span>%', 'g')}
          <div class="lab">Kept on time</div></div>
        <div class="ringwrap">{ring(0.04, '<span class="count" data-count="1">0</span>')}
          <div class="lab">Past the promise</div></div>
      </div>
    </div>
    <p class="big-sub st d3">If anything is late, the wall says so — in front of everybody.</p>
  </div>
</section>

<!-- 12 · finale -->
<section class="scene wf dark" data-d="99999" id="finale">
  <div class="inner">
    <div class="eyebrow st d1">It runs itself</div>
    <h1 class="st drop d2">Put it on a screen<br>and <em>leave it there</em>.</h1>
    <p class="big-sub st d3">donthaveanagent.com/wall — your branch code opens it.</p>
    <div class="w3 st d4" style="margin-top:20px">
      <a class="btn btn-wa" id="waBtn" href="#" target="_blank" rel="noopener">&#128172; Share this</a>
      <button class="btn btn-line" onclick="location.reload()">&#8635; Play again</button>
    </div>
  </div>
</section>
"""

# ── splice ────────────────────────────────────────────────────────────
chrome_end = s.index('</div>', s.index('<div id="chrome">')) + len('</div>')
tap = s.index('<div class="tapzone" id="zL"')
out = s[:chrome_end] + "\n" + SCENES.strip() + "\n\n" + s[tap:]

last_style_close = out.rindex('</style>')
out = out[:last_style_close] + CSS + out[last_style_close:]

out = re.sub(r'<title>.*?</title>', '<title>The Wall — Ricky Rampersad Branch</title>',
             out, count=1, flags=re.S)
out = re.sub(r'<h1>The launch of<br>donthaveanagent<em>\.com</em></h1>',
             '<h1>The branch wall<br>is <em>live</em></h1>', out, count=1)
out = re.sub(r'<div class="eyebrow" style="margin-top:16px">[^<]*</div>',
             '<div class="eyebrow" style="margin-top:16px">A Ricky Rampersad Branch first</div>',
             out, count=1)
out = re.sub(r'🔊 \d+ seconds, with music — tap to begin\.',
             '🔊 110 seconds, with music — tap to begin.', out, count=1)

MSG = ('const MSG = "The branch wall is live.\\n\\n" +\n'
       '  "One screen for the whole branch: who is waiting, what is late, and who is closing it. '
       'Seven slides, running by themselves.\\n\\n" +\n'
       '  "▶ Watch it: https://donthaveanagent.com/wall-film\\n" +\n'
       '  "▶ Open the wall: https://donthaveanagent.com/wall";')
# lambda, not a plain string: re.sub processes backslash escapes in a string
# replacement, which would turn every \n into a real newline and split the
# JavaScript string literals across lines.
out = re.sub(r'const MSG = ".*?";', lambda m: MSG, out, count=1, flags=re.S)

OUT.write_text(out)
print("wrote", OUT, len(out), "bytes")
print("scenes:", out.count('class="scene'))
print("durations ms:", ms, "→", round(sum(D), 1), "s")
