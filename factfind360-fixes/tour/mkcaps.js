// One caption image per spoken sentence, timed from edge-tts's own word
// boundaries. These are composited into a bar UNDER the page, never over it —
// the old overlay sat on top of the very figures it was describing.
//
// Money, percentages and counts are pulled out in teal; decision words in
// gold, so the eye lands on the number while the narrator says it.
const { chromium } = require('playwright');
const fs = require('fs');
const S = '/tmp/claude-0/-home-user-RickyRampersadTermLIfe/203562d4-c614-5eed-b728-644df21311be/scratchpad/';
const BAR_W = 1280, BAR_H = 96;

const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const MONEY = '(?:TT\\$[\\d.,]+(?:\\s?(?:million|thousand))?)';
const SPELLED = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|seventy|hundred)'
  + '(?:[ -](?:one|two|three|four|five|six|seven|eight|nine|ten|and|point|five|eight))*'
  + '\\s(?:million|thousand|percent|dollars|years|sections|stages|steps|days)';
const colourise = t => esc(t)
  .replace(new RegExp(MONEY, 'gi'), '<b class="fig">$&</b>')
  .replace(new RegExp('\\b' + SPELLED + '\\b', 'gi'), '<b class="fig">$&</b>')
  .replace(/\b\d[\d.,]*\s?(?:%|percent|million|thousand|days?|steps?|stages?|seconds?|sections?|years?)\b/gi,
    '<b class="fig">$&</b>')
  .replace(/\b(?:approved|declined|sent back|picked up|instantly|in one second|live|real time|automatically)\b/gi,
    '<b class="hl">$&</b>')
  // never nest a highlight inside a figure
  .replace(/<b class="fig">([^<]*)<b class="(?:fig|hl)">([^<]*)<\/b>/g, '<b class="fig">$1$2');

// VTT / SRT-ish cue parser — edge-tts emits sentence cues with ms precision
function cues(id) {
  const raw = fs.readFileSync(S + 'vid/nvoice/' + id + '.vtt', 'utf8');
  const out = [];
  const re = /(\d\d):(\d\d):(\d\d)[.,](\d\d\d)\s*-->\s*(\d\d):(\d\d):(\d\d)[.,](\d\d\d)\s*\n([\s\S]*?)(?=\n\s*\n|\n\d+\s*\n|$)/g;
  let m;
  const sec = (h, mi, s, ms) => +h * 3600 + +mi * 60 + +s + +ms / 1000;
  while ((m = re.exec(raw))) {
    const text = m[9].replace(/\s+/g, ' ').trim();
    if (text) out.push({ a: sec(m[1], m[2], m[3], m[4]), b: sec(m[5], m[6], m[7], m[8]), text });
  }
  return out;
}

// a cue too wide for one line is halved at its own punctuation, and the time
// split in proportion — two short lines read faster than one wrapped one
function splitLong(c, limit) {
  if (c.text.length <= limit) return [c];
  const marks = [];
  const re = /[,;:—–-]\s|\.\s/g; let m;
  while ((m = re.exec(c.text))) marks.push(m.index + m[0].length);
  const mid = c.text.length / 2;
  let cut = marks.sort((x, y) => Math.abs(x - mid) - Math.abs(y - mid))[0];
  if (!cut) {                                   // no punctuation: break on a space
    const sp = [...c.text.matchAll(/ /g)].map(x => x.index + 1);
    cut = sp.sort((x, y) => Math.abs(x - mid) - Math.abs(y - mid))[0];
  }
  if (!cut) return [c];
  const l = c.text.slice(0, cut).trim(), r = c.text.slice(cut).trim();
  const k = c.a + (c.b - c.a) * (l.length / (l.length + r.length));
  return [...splitLong({ a: c.a, b: k, text: l }, limit),
          ...splitLong({ a: k, b: c.b, text: r }, limit)];
}

(async () => {
  const ids = fs.readdirSync(S + 'vid/nvoice').filter(f => f.endsWith('.vtt')).map(f => f.slice(0, -4));
  fs.rmSync(S + 'vid/caps', { recursive: true, force: true });
  fs.mkdirSync(S + 'vid/caps', { recursive: true });

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: BAR_W, height: BAR_H }, deviceScaleFactor: 2 });
  const index = {};
  let n = 0;

  for (const id of ids) {
    const list = cues(id).flatMap(c => splitLong(c, 96));
    index[id] = [];
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const file = id + '_' + String(i).padStart(2, '0') + '.png';
      await p.setContent(`<meta charset="utf-8"><style>
        *{margin:0;box-sizing:border-box}
        html,body{width:${BAR_W}px;height:${BAR_H}px;overflow:hidden}
        body{background:linear-gradient(180deg,#0A1120,#0E1A2E 70%,#0B1424);
          display:flex;align-items:center;gap:18px;padding:0 34px;
          font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
          border-top:3px solid #2DD4BF}
        .t{font-size:27px;line-height:1.24;font-weight:700;color:#EDF3FB;letter-spacing:.004em;
          text-wrap:balance}
        .fig{color:#2DD4BF;font-weight:850}
        .hl{color:#F5B935;font-weight:800}
        .dot{width:12px;height:12px;border-radius:50%;background:#2DD4BF;flex:none;
          box-shadow:0 0 0 6px rgba(45,212,191,.16)}
      </style><body><div class="dot"></div><div class="t" id="t">${colourise(c.text)}</div></body>`);
      // shrink until it fits the bar without clipping
      await p.evaluate(() => {
        const t = document.getElementById('t');
        for (let s = 27; s >= 17; s--) {
          t.style.fontSize = s + 'px';
          if (t.getBoundingClientRect().height <= 76) break;
        }
      });
      await p.waitForTimeout(35);
      await p.screenshot({ path: S + 'vid/caps/' + file });
      index[id].push({ f: file, a: +c.a.toFixed(3), b: +c.b.toFixed(3) });
      n++;
    }
  }
  await b.close();
  fs.writeFileSync(S + 'vid/caps/cues.json', JSON.stringify(index, null, 1));
  console.log('caption frames:', n, 'across', ids.length, 'scenes');
})();
