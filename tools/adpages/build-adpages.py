#!/usr/bin/env python3
"""Write the three recruiting ad pages — the page you post, one per ad.

    python3 tools/adpages/build-adpages.py

Edit `adpages.json`, never a generated page: three near-identical pages drift
apart the moment one of them is hand-edited, and the thing that drifts first is
the Open Graph block, which is the only part a WhatsApp or Facebook preview
reads.

Each page carries the three cuts — upright for Reels, TikTok and Status, 4:5
for the feed, 16:9 for YouTube and LinkedIn — and opens on the upright one on a
phone held upright, which is where most of these will be opened.

The ads' own landing pages (/buildwithus/, /joinourbranch/, /underwriter/) are
hand-written and are not touched by this.
"""
import json, os, pathlib, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SPEC = json.loads((HERE / 'adpages.json').read_text(encoding='utf-8'))
C = SPEC['common']
SITE = 'https://rickyrampersadbranch.com'

CSS = """:root{--d0:#0d1f33;--d1:#14314f;--d2:#1b4268;--dT:#f3f6fa;--dT2:#b9cadd;--dT3:#b1c3d5;
  --a:#00728d;--aD:#005a70;--aL:#00CFEA;--r:1.1rem}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{background:var(--d0);color:var(--dT2);min-height:100vh;
  font:400 clamp(1rem,.95rem + .3vw,1.125rem)/1.6 Inter,system-ui,-apple-system,'Segoe UI',sans-serif;
  display:flex;flex-direction:column;overflow-x:clip}
.wrap{width:100%;max-width:62rem;margin-inline:auto;padding:1.25rem}
header{display:flex;align-items:center;gap:.6rem;padding-block:1rem}
header img{width:2.2rem;height:2.2rem;display:block}
header b{font:600 .95rem/1.2 Inter,sans-serif;color:#fff}
main{flex:1}
h1{font:700 clamp(1.6rem,1.2rem + 2.2vw,2.9rem)/1.08 Inter,system-ui,sans-serif;
  letter-spacing:-.03em;color:#fff;margin-bottom:.6rem}
h1 em{font-style:normal;color:var(--aL);display:block}
p{margin-bottom:1rem;max-width:52ch}
.vwrap{position:relative;border-radius:var(--r);overflow:hidden;background:#07131f;
  box-shadow:0 20px 60px rgba(2,8,16,.6);margin-block:1.25rem}
video{width:100%;height:auto;display:block;background:#07131f}
.tabs{display:flex;gap:.5rem;margin-bottom:.9rem;flex-wrap:wrap}
.tab{appearance:none;border:1.5px solid var(--d2);background:transparent;color:#fff;
  border-radius:999px;padding:.6rem 1rem;cursor:pointer;min-height:44px;
  font:600 max(16px,.9rem)/1 Inter,sans-serif}
.tab[aria-selected=true]{background:var(--a);border-color:var(--a)}
.ctas{display:flex;flex-wrap:wrap;gap:.7rem;margin-top:1.4rem}
.btn{display:inline-flex;align-items:center;gap:.5rem;padding:.85rem 1.3rem;border-radius:999px;
  text-decoration:none;font:600 .95rem/1.1 Inter,sans-serif;border:1.5px solid transparent;
  min-height:44px}
.b1{background:linear-gradient(135deg,#007a95,var(--aD));color:#fff}
.b2{border-color:var(--d2);color:#fff}
.b2:hover{border-color:var(--aL)}
.small{font-size:.875rem;color:var(--dT3);max-width:58ch}
footer{border-top:1px solid var(--d2);padding-block:1.1rem;font-size:.875rem;color:var(--dT3)}
footer a{color:var(--dT2)}
.dl{display:flex;flex-wrap:wrap;gap:.5rem 1.2rem;font-size:.875rem;margin-top:.8rem}
.dl a{color:var(--aL)}"""

JS = """(function(){
  var v=document.getElementById('fv'), s=document.getElementById('fs'), vw=document.getElementById('vw'),
      tabs=[].slice.call(document.querySelectorAll('.tab')), P='/%(page)s/film-';
  var WIDE={v:'26rem',f:'34rem',w:''};
  function pick(k){
    tabs.forEach(function(t){t.setAttribute('aria-selected', t.dataset.k===k?'true':'false')});
    v.pause(); s.src=P+k+'.mp4'; v.poster=P+k+'.jpg';
    vw.style.maxWidth=WIDE[k]; vw.style.marginInline=WIDE[k]?'auto':'';
    v.load();
  }
  tabs.forEach(function(t){t.addEventListener('click',function(){pick(t.dataset.k)})});
  /* a phone held upright opens on the upright cut, which is what it is for */
  if (matchMedia('(max-width: 34rem) and (orientation: portrait)').matches) pick('v');
})();"""

BEACON = """<!-- rrb-views -->
<script>
(function(){var u='RRB_VIEWS_URL';if(u.indexOf('http')!==0)return;try{
(new Image()).src=u+'?p='+encodeURIComponent(location.pathname)+'&r='+encodeURIComponent((document.referrer||'').slice(0,200))+'&z='+Date.now();
}catch(e){}})();
</script>"""


def page(ad):
    url = f'{SITE}/{ad["dir"]}/'
    # the share card is the WIDE poster: every platform crops a 16:9 card itself,
    # and an upright one is letterboxed into a grey band in a WhatsApp preview
    img = f'{SITE}/{ad["page"]}/film-w.jpg'
    vid = f'{SITE}/{ad["page"]}/film-w.mp4'
    tabs = '\n'.join(
        f'      <button class="tab" data-k="{s["k"]}" role="tab" '
        f'aria-selected="{"true" if s["k"] == "w" else "false"}" aria-controls="fv">{s["label"]}</button>'
        for s in C['shapes'])
    ctas = '\n'.join(
        f'      <a class="btn {"b1" if c.get("primary") else "b2"}" href="{c["href"]}">{c["text"]}</a>'
        for c in ad['ctas'])
    dls = '\n      &middot; '.join(
        f'<a href="/{ad["page"]}/film-{s["k"]}.mp4" download>{s["download"]}</a>'
        for s in C['shapes'])
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>{ad['title']} &mdash; {C['site']}</title>
<meta name="description" content="{ad['metaDesc']}">
<link rel="canonical" href="{url}">
<link rel="icon" type="image/svg+xml" href="/site-icon.svg">
<meta name="theme-color" content="#0d1f33">

<meta property="og:type" content="video.other">
<meta property="og:site_name" content="{C['site']}">
<meta property="og:title" content="{ad['h1']} {ad['h1em']}">
<meta property="og:description" content="{ad['desc']}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{img}">
<meta property="og:image:width" content="1920">
<meta property="og:image:height" content="1080">
<meta property="og:video" content="{vid}">
<meta property="og:video:type" content="video/mp4">
<meta property="og:video:width" content="1920">
<meta property="og:video:height" content="1080">
<meta name="twitter:card" content="player">
<meta name="twitter:title" content="{ad['h1']}">
<meta name="twitter:description" content="{ad['desc']}">
<meta name="twitter:image" content="{img}">

<style>
{CSS}
</style>
</head>
<body>
<div class="wrap">
  <header><img src="/site-mark.svg" alt=""><b>{C['site']}</b></header>
  <main>
    <h1>{ad['h1']} <em>{ad['h1em']}</em></h1>
    <p>{ad['lede']}</p>

    <div class="tabs" role="tablist" aria-label="Pick a cut">
{tabs}
    </div>

    <div class="vwrap" id="vw">
      <video id="fv" controls playsinline preload="metadata" poster="/{ad['page']}/film-w.jpg">
        <source id="fs" src="/{ad['page']}/film-w.mp4" type="video/mp4">
      </video>
    </div>
    <p class="small">{C['note']}</p>

    <div class="ctas">
{ctas}
    </div>
    <p class="dl">To post it: {dls}</p>
  </main>
  <footer>
    {C['footer']} &middot; <a href="tel:{C['tel']}">{C['telText']}</a>
  </footer>
</div>

<script>
{JS % {'page': ad['page']}}
</script>

{BEACON}
</body>
</html>
"""


def main():
    for ad in SPEC['ads']:
        d = ROOT / ad['dir']
        d.mkdir(parents=True, exist_ok=True)
        out = d / 'index.html'
        html = page(ad)
        if '{' in html.split('<style>')[1].split('</style>')[0] and '--d0' not in html:
            sys.exit('the stylesheet did not survive the format')
        out.write_text(html, encoding='utf-8')
        print(f'{ad["dir"]}/index.html  ({len(html):,} bytes)')
        missing = [f'{ad["page"]}/film-{s["k"]}.{e}'
                   for s in C['shapes'] for e in ('mp4', 'jpg')
                   if not (ROOT / ad['page'] / f'film-{s["k"]}.{e}').exists()]
        if missing:
            print('   still to render: ' + ', '.join(missing))


if __name__ == '__main__':
    main()
