const { chromium } = require('playwright');
const fs = require('fs');
const S = '/tmp/claude-0/-home-user-RickyRampersadTermLIfe/203562d4-c614-5eed-b728-644df21311be/scratchpad/';

// scene id -> narration text (for the caption bar) and recording length (s)
const LINES = {};
['vid/lines.txt','vid/newlines.txt','vid/newlines2.txt','vid/newlines3.txt','vid/newlines4.txt','vid/newlines5.txt','vid/newlines6.txt','vid/newlines7.txt','vid/narration_final.txt'].forEach(f =>
  fs.readFileSync(S + f, 'utf8').trim().split('\n').forEach(l => {
    const [id, text] = l.split('|'); LINES[id] = text; }));
const DUR = { S00: 15.3, S01: 3.1, S1A: 18.9, S02: 8.8, S2B: 8.8, S2C: 14.7, S2F: 13.6, S2I: 14.2, S2G: 9.6, S2H: 9.9, S2D: 10.4, S2E: 8.4, S2P: 21.0, S12B: 8.4, S13B: 9.6, S16: 19.4, S03: 9.6, S04: 7, S05: 2.8, S06: 7.4, S07: 9.1, S18: 9.3, S19: 14.6, S20: 9.6, S08: 6, S09: 3, S10: 6.2, S11: 7.1, S12: 14.6, S13: 6.4, S14: 5, S15: 12.9, S0W: 15.6, S0R: 15.4, S21: 14.6 };

// the page is recorded 96px short of 720 so the finished frame can carry a
// caption bar underneath it — subtitles used to sit on top of the dashboard
// and cover the very numbers they were describing
const VP = { width: 1280, height: 624 };

// mock book for the insights queue (compact version of the test harness)
let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const agents = [['Felicia Rampersad','Ricky Rampersad'],['Rajiv Soodoo','Akaash Kalladeen'],
  ['Varun Seegolam','Kerwyn Ramroach'],['Kamla Persad','Gary Sookdeo'],['Eaton Boodoo','Akaash Kalladeen']];
const prods = ['Flexi Term \u2014 to age 65 (convertible)', 'Econolife 65 (Whole Life)',
  'Rejuvenator (Critical Illness)', 'Reliance Plan \u2014 20 Year (Family Income Protection)',
  'Liberator \u2014 Life Evolution (Universal Life)'];
const clients = ['Alice Mohammed','Devon Charles','Sarah Ali','Nigel Baptiste','Priya Maharaj','Kevin Joseph','Anita Ramlogan','Terrence Gopaul'];
const rows = [];
for (let i = 0; i < 40; i++) {
  const a = agents[i % agents.length];
  const back = 2 + Math.floor(rnd() * 20);
  const sub = new Date(Date.now() - back * 864e5);
  const pend = i < 12;
  const r = { submissionId: 'v' + i, advisorName: a[0], agentCode: 'A1' + (1000 + i),
    reviewerName: a[1], submittedAt: sub.toISOString(),
    status: pend ? 'pending_review' : (rnd() < 0.8 ? 'approved' : 'changes_requested'),
    approvedAt: pend ? '' : sub.toISOString(), appType: 'full',
    insuranceNeed_calc: 400000 + Math.floor(rnd() * 1600000), cashSurplus_calc: 900 + Math.floor(rnd() * 3000),
    clientName: clients[i % clients.length], monthlyIncomeTotal: 6000 + Math.floor(rnd() * 12000),
    monthlyExpenses: 3000 + Math.floor(rnd() * 6000), dob: new Date(1980, 3, 12).toISOString(),
    idNumber: rnd() < 0.7 ? '19' + Math.floor(rnd() * 9e8) : '', maritalStatus: 'Married', smoker: 'No',
    occupation: 'Teacher', employer: 'Ministry of Education', empStatus: 'Permanent', tenure: 9,
    caseHoldAt: '', caseHoldBy: '', caseHoldNote: '' };
  const n = 1 + Math.floor(rnd() * 2);
  for (let k = 1; k <= n; k++) {
    r['rec' + k + 'Rec'] = prods[Math.floor(rnd() * prods.length)];
    r['rec' + k + 'Amt'] = 300000 + Math.floor(rnd() * 500000);
    r['rec' + k + 'Prem'] = 150 + Math.floor(rnd() * 700);
    r['rec' + k + 'Mode'] = rnd() < 0.6 ? 'Monthly' : '';
    r['rec' + k + 'Reason'] = rnd() < 0.5 ? 'Protection matched to the need' : '';
    if (rnd() < 0.6) { r['dec' + k + 'Go'] = 'Yes'; r['dec' + k + 'Prem'] = r['rec' + k + 'Prem']; r['dec' + k + 'Amt'] = r['rec' + k + 'Amt']; }
  }
  if (pend) r._checks = { adviceOnly: false,
    bio: [{ k: 'Client', v: r.clientName, missing: false }],
    concerns: r.idNumber ? [] : [{ sev: 'bad', t: 'ID / DP / PP number is missing', why: 'Underwriting will bounce it.' }],
    clientEmail: 'c@x.tt' };
  rows.push(r);
}
const FEED = JSON.parse(fs.readFileSync(S + 'chk_feed2.json', 'utf8'));

const CURSOR = `
  if(!window.__cur){
    const c=document.createElement('div'); c.id='__cur';
    c.style.cssText='position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;'+
      'border-radius:50%;border:3px solid #2DD4BF;background:rgba(255,255,255,.92);'+
      'box-shadow:0 4px 18px rgba(0,0,0,.45),0 0 0 2px rgba(10,17,32,.35);z-index:2147483647;'+
      'pointer-events:none;transform:translate(640px,400px)';
    document.documentElement.appendChild(c);
    window.__curXY=[640,400];
    window.__curTo=(x,y,ms)=>new Promise(res=>{const [fx,fy]=window.__curXY;const t0=performance.now();
      (function st(t){const k=Math.min(1,(t-t0)/ms),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
        const cx=fx+(x-fx)*e, cy=fy+(y-fy)*e;
        c.style.transform='translate('+cx+'px,'+cy+'px)';
        if(k<1)requestAnimationFrame(st);else{window.__curXY=[x,y];res();}})(t0);});
    window.__curFx=()=>{const r=document.createElement('div');const [x,y]=window.__curXY;
      r.style.cssText='position:fixed;left:'+x+'px;top:'+y+'px;width:14px;height:14px;margin:-7px 0 0 -7px;'+
        'border-radius:50%;border:3px solid #F5B935;z-index:2147483646;pointer-events:none;'+
        'transition:all .45s ease-out;opacity:.95';
      document.documentElement.appendChild(r);
      requestAnimationFrame(()=>{r.style.width='58px';r.style.height='58px';r.style.margin='-29px 0 0 -29px';r.style.opacity='0';});
      setTimeout(()=>r.remove(),500);};
  }`;
async function curClick(p, sel, ms = 850) {
  const h = await p.$(sel); if (!h) return;
  await h.scrollIntoViewIfNeeded().catch(()=>{});
  await p.waitForTimeout(120);
  const bb = await h.boundingBox(); if (!bb) return;
  const x = bb.x + Math.min(bb.width / 2, 220), y = bb.y + bb.height / 2;
  await p.evaluate(([x, y, ms]) => window.__curTo(x, y, ms), [x, y, ms]);
  await p.evaluate(() => window.__curFx());
  await p.mouse.click(x, y);
  await p.waitForTimeout(180);
}
// A line of text has to be read from its first word, so this pins the LEFT of
// the element rather than its middle — scaling about the centre pushed the
// opening words off the frame.
async function centreZoom(p, sel, scale, ms) {
  await p.evaluate(sel => { const e = document.querySelector(sel);
    if (e) e.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, sel);
  await p.waitForTimeout(650);
  await p.evaluate(([sel, scale, ms]) => {
    const el = document.querySelector(sel); if (!el) return;
    const r = el.getBoundingClientRect();
    const ox = r.left + window.scrollX + 12;
    const oy = r.top + r.height / 2 + window.scrollY;
    const b = document.body;
    b.style.transition = 'transform ' + ms + 'ms cubic-bezier(.35,.75,.3,1)';
    b.style.transformOrigin = ox + 'px ' + oy + 'px';
    b.style.transform = 'scale(' + scale + ')';
  }, [sel, scale, ms]);
  await p.waitForTimeout(ms + 120);
}
async function zoomTo(p, sel, scale, ms) {
  await p.evaluate(([sel, scale, ms]) => {
    const el = document.querySelector(sel); if (!el) return;
    const r = el.getBoundingClientRect();
    const ox = r.left + r.width / 2 + window.scrollX;
    const oy = r.top + r.height / 2 + window.scrollY;
    const b = document.body;
    b.style.transition = 'transform ' + ms + 'ms cubic-bezier(.35,.75,.3,1)';
    b.style.transformOrigin = ox + 'px ' + oy + 'px';
    b.style.transform = 'scale(' + scale + ')';
  }, [sel, scale, ms]);
  await p.waitForTimeout(ms + 120);
}
// The moment the need lands is the point of the whole exercise — a number a
// family would actually have to find. It gets a burst and a callout, not a
// quiet cell update.
async function celebrate(p, sel, label) {
  await p.evaluate(([sel, label]) => {
    const el = document.querySelector(sel); if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const host = document.documentElement;

    const box = el.closest('div') || el;
    box.style.transition = 'box-shadow .45s, transform .45s';
    box.style.boxShadow = '0 0 0 5px rgba(45,212,191,.9)';
    box.style.transform = 'scale(1.03)';
    setTimeout(() => { box.style.transform = 'none'; }, 900);

    if (label) {
      const tag = document.createElement('div');
      tag.style.cssText = 'position:fixed;left:' + cx + 'px;top:' + (cy - 66) + 'px;' +
        'transform:translate(-50%,6px);z-index:2147483646;background:#2DD4BF;color:#04211D;' +
        'font:850 17px/1 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;' +
        'padding:10px 18px;border-radius:24px;box-shadow:0 10px 30px rgba(0,0,0,.4);' +
        'opacity:0;transition:all .5s cubic-bezier(.2,.9,.3,1);letter-spacing:.01em;white-space:nowrap';
      tag.textContent = label;
      host.appendChild(tag);
      requestAnimationFrame(() => { tag.style.opacity = '1'; tag.style.transform = 'translate(-50%,0)'; });
      setTimeout(() => { tag.style.opacity = '0'; }, 3400);
      setTimeout(() => tag.remove(), 4000);
    }

    const cols = ['#2DD4BF', '#F5B935', '#A78BFA', '#34D399', '#60A5FA', '#FFFFFF'];
    for (let i = 0; i < 90; i++) {
      const d = document.createElement('div');
      const w = 6 + Math.floor(Math.abs(Math.sin(i * 2.7)) * 7);
      d.style.cssText = 'position:fixed;left:' + cx + 'px;top:' + cy + 'px;width:' + w + 'px;' +
        'height:' + (w * (i % 3 ? 1.6 : 0.7)) + 'px;background:' + cols[i % cols.length] + ';' +
        'z-index:2147483645;pointer-events:none;border-radius:' + (i % 4 ? '2px' : '50%') + ';' +
        'opacity:1;will-change:transform,opacity';
      host.appendChild(d);
      const a = (i / 90) * Math.PI * 2;
      const v = 190 + (i % 11) * 34;
      const dx = Math.cos(a) * v, dy = Math.sin(a) * v * 0.62 - 130;
      const spin = (i % 2 ? 1 : -1) * (360 + i * 9);
      d.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + dx * 0.72 + 'px,' + dy + 'px) rotate(' + spin * 0.6 + 'deg)', opacity: 1, offset: 0.55 },
        { transform: 'translate(' + dx + 'px,' + (dy + 330) + 'px) rotate(' + spin + 'deg)', opacity: 0 }
      ], { duration: 1900 + (i % 7) * 190, easing: 'cubic-bezier(.15,.6,.35,1)', fill: 'forwards' });
      setTimeout(() => d.remove(), 2700);
    }
  }, [sel, label]);
}

async function glow(p, sel) {
  await p.evaluate(sel => { const e = document.querySelector(sel); if (e) {
    e.style.transition = 'box-shadow .5s'; e.style.boxShadow = '0 0 0 4px rgba(245,185,53,.75)';
    e.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, sel);
}

// A whole fictitious household, so the film shows a fact find with a life in
// it rather than two numbers in an empty form. Nothing here belongs to anyone:
// the email domain is the reserved example.com, the ID is a run of zeroes, and
// every scene that shows this data carries the SAMPLE stamp below.
const demoWithout = (...keys) => {
  const o = {}; Object.keys(DEMO).forEach(k => { if (!keys.includes(k)) o[k] = DEMO[k]; }); return o;
};
const DEMO = {
  clientName: 'Marcus Alleyne', fullName: 'Marcus Alleyne',
  dob: '1981-06-14', idNumber: '00000000000',
  maritalStatus: 'Married', occupation: 'Secondary School Teacher',
  employer: 'Sample Employer Ltd', empStatus: 'Permanent', tenure: '18',
  address: '14 Sample Street', addressArea: 'Chaguanas',
  phone: '000-0000', email: 'sample.client@example.com',
  interviewDate: '2026-08-04',
  spouseName: 'Denise Alleyne', spouseOccupation: 'Registered Nurse',
  spouseEmployer: 'Sample Health Ltd', spouseEmpStatus: 'Full-time',
  spouseMonthlyIncome: '9200', spouseTenure: '14', spouseGender: 'F',
  child1Name: 'Kai Alleyne', child1Dob: '2015-03-02', child1Gender: 'M', child1Occ: 'Student',
  child2Name: 'Amara Alleyne', child2Dob: '2019-09-18', child2Gender: 'F', child2Occ: 'Student',
  dep1Name: 'Yvonne Alleyne', dep1Rel: 'Parent', dep1Age: '74', dep1Income: '0', dep1Gender: 'Female',
  monthlyIncome: '14000', monthlyExpenses: '9500',
  ins1Co: 'Guardian Life', ins1Type: 'Whole Life', ins1Sum: '250000',
  ins1Prem: '310', ins1Mode: 'Monthly', ins1Year: '2016',
  ins1Owner: 'Client', ins1Status: 'Active',
  needIncome: '900000', needEducation: '250000', needLastExpenses: '60000',
  retPctIncome: '70', retYears: '20', retRoi: '4', retNis: '3000', retBasis: 'perpetuity',
  // the plan names come from the form's own catalogue, not from imagination —
  // an invented product on screen is the fastest way to lose a room
  rec1Rec: 'Flexi Term \u2014 to age 65 (convertible)',
  rec1Need: 'Income Replacement (Breadwinner) \u2014 Life',
  rec1Amt: '749000', rec1Prem: '419', rec1Mode: 'Monthly', rec1Who: 'Client',
  rec1Reason: 'Covers the income replacement gap to the youngest child\u2019s majority, at a premium the surplus carries.',
  rec2Rec: 'Rejuvenator (Critical Illness)', rec2Need: 'Critical Illness',
  rec2Amt: '250000', rec2Prem: '138', rec2Mode: 'Monthly', rec2Who: 'Client',
  rec2Reason: 'Family history noted at interview; protects the household income if he survives but cannot work.',
};

// Every frame that shows client data says so, in the corner, the whole time.
const STAMP = `
  if(!document.getElementById('__stamp')){
    const d=document.createElement('div'); d.id='__stamp';
    d.style.cssText='position:fixed;top:12px;right:14px;z-index:2147483644;display:flex;'+
      'align-items:center;gap:8px;background:rgba(245,185,53,.14);border:1.5px solid rgba(245,185,53,.6);'+
      'color:#F5B935;font:800 11px/1 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;'+
      'letter-spacing:.13em;text-transform:uppercase;padding:8px 13px;border-radius:20px;'+
      'backdrop-filter:blur(6px);pointer-events:none';
    d.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:#F5B935;'+
      'display:inline-block"></span>Sample data &middot; not a real client';
    document.documentElement.appendChild(d);
  }`;

const SEED = async (p, extra, base) => {
  await p.evaluate(([extra, base]) => {
    document.querySelectorAll('.section-header').forEach(h => {
      if (getComputedStyle(h.nextElementSibling).display === 'none') h.click(); });
    const set = (f, v) => { const e = document.querySelector('[data-field="' + f + '"]');
      if (!e) return;
      if (e.tagName === 'SELECT') {
        const hit = [...e.options].find(o => o.value === v ||
          (o.textContent || '').trim().toLowerCase() === String(v).toLowerCase());
        if (!hit) return;
        e.value = hit.value;
      } else { e.value = v; }
      e.dispatchEvent(new Event('input', { bubbles: true }));
      e.dispatchEvent(new Event('change', { bubbles: true })); };
    Object.entries(base || {}).forEach(([f, v]) => set(f, v));
    Object.entries(extra || {}).forEach(([f, v]) => set(f, v));
    // the focus is the arithmetic, not the assistant: hide RAI prompts
    [...document.querySelectorAll('button,div,span,a')].forEach(e => {
      if (e.children.length <= 1 && /^\s*RAI\b|RAI\s*[—:-]/.test(e.textContent || '') &&
          (e.textContent || '').length < 220) e.style.display = 'none'; });
    // and every assistant panel with them. The story here is the arithmetic and
    // the advisor doing the work, so nothing on screen should read as the
    // machine having the opinion.
    [...document.querySelectorAll('*')].forEach(e => {
      if (e.children.length !== 0) return;
      const t = (e.textContent || '').trim();
      if (!/^RAI\b/i.test(t) && !/RAI\s*[—:-]/.test(t) &&
          !/Full RAI reasoning/i.test(t)) return;
      // climb to the card the label sits in, then hide the whole card
      let w = e, best = e;
      for (let i = 0; i < 6 && w.parentElement; i++) {
        w = w.parentElement;
        const h = w.getBoundingClientRect().height;
        const st = getComputedStyle(w);
        if (h > 34 && h < 460 &&
            (st.borderLeftWidth !== '0px' || st.borderWidth !== '0px' ||
             st.borderRadius !== '0px' || st.backgroundColor !== 'rgba(0, 0, 0, 0)')) {
          best = w;
        }
      }
      best.style.display = 'none';
    });
  }, [extra, base === undefined ? DEMO : base]);
  await p.waitForTimeout(400);
};
async function typeField(p, f, v, per = 70) {
  const sel = '[data-field="' + f + '"]';
  await curClick(p, sel, 620);
  // clear first — typing into a pre-filled field appends, which turned a 70%
  // retirement assumption into 7070% and a nonsense fund gap
  await p.fill(sel, '');
  await p.waitForTimeout(120);
  await p.type(sel, v, { delay: per });
  await p.waitForTimeout(250);
}
async function smoothScroll(page, to, ms) {
  await page.evaluate(([to, ms]) => new Promise(res => {
    const from = window.scrollY, t0 = performance.now();
    (function step(t) {
      const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      window.scrollTo(0, from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step); else res();
    })(t0);
  }), [to, ms]);
}

const scenes = [
  { id: 'S00', url: 'vid/card00.html' },
  { id: 'S0W', url: 'vid/card_why.html' },
  { id: 'S0R', url: 'vid/card_ricky.html' },
  { id: 'S01', url: 'vid/card01.html' },
  // A continuous scroll down the whole form, filled in, so what is on screen is
  // Guardian's own V3 section by section — not just its masthead.
  { id: 'S1A', url: 'factfind360-site/FFPROJECT.html',
    run: async p => {
      await SEED(p);
      await p.evaluate(() => {
        document.querySelectorAll('.section-header').forEach(h => {
          h.style.transition = 'box-shadow .35s, background .35s'; });
        window.scrollTo(0, 0);
      });
      await p.waitForTimeout(500);

      // light each heading as the page passes it, without stopping the travel
      await p.evaluate(() => {
        const hs = [...document.querySelectorAll('.section-header')];
        window.__io = new IntersectionObserver(es => es.forEach(e => {
          if (!e.isIntersecting) return;
          const h = e.target;
          h.style.boxShadow = '0 0 0 3px rgba(245,185,53,.9)';
          h.style.background = 'rgba(245,185,53,.07)';
          setTimeout(() => { h.style.boxShadow = 'none'; h.style.background = ''; }, 1500);
        }), { rootMargin: '-38% 0px -46% 0px' });
        hs.forEach(h => window.__io.observe(h));
      });

      const bottom = await p.evaluate(() =>
        document.documentElement.scrollHeight - window.innerHeight);
      await smoothScroll(p, Math.round(bottom * 0.92), 13500);
      await p.waitForTimeout(400);
    } },
  { id: 'S02', url: 'factfind360-site/FFPROJECT.html', cursor: true,
    run: async p => {
      await SEED(p);
      await p.evaluate(() => { const h = document.querySelectorAll('.section-header')[1];
        if (h) h.setAttribute('data-demo', '1'); });
      await curClick(p, '.section-header[data-demo]', 1100);
      await p.waitForTimeout(500);
      await smoothScroll(p, await p.evaluate(() => window.scrollY + 620), DUR.S02 * 1000 - 3600);
    } },
  { id: 'S2B', url: 'factfind360-site/FFPROJECT.html', cursor: true,
    run: async p => {
      await SEED(p, null, demoWithout('monthlyIncome', 'monthlyExpenses'));
      await p.evaluate(() => { const b = document.getElementById('secbody-2');
        if (b && getComputedStyle(b).display === 'none') b.previousElementSibling.click(); });
      await p.waitForTimeout(300);
      await curClick(p, '[data-field="monthlyIncome"]', 800);
      await p.type('[data-field="monthlyIncome"]', '14000', { delay: 80 });
      await p.evaluate(() => { const b = document.getElementById('secbody-5');
        if (b && getComputedStyle(b).display === 'none') b.previousElementSibling.click(); });
      await p.waitForTimeout(250);
      await curClick(p, '[data-field="monthlyExpenses"]', 900);
      await p.type('[data-field="monthlyExpenses"]', '9500', { delay: 80 });
      await p.waitForTimeout(300);
      await p.evaluate(() => { const els = [...document.querySelectorAll('*')].filter(e =>
        e.children.length <= 3 && /Surplus/i.test(e.textContent) && e.textContent.length < 70 &&
        e.getBoundingClientRect().height > 0);
        const t = els[0]; if (t) { const w = t.closest('div') || t;
          w.style.transition = 'box-shadow .5s'; w.style.boxShadow = '0 0 0 4px rgba(45,212,191,.8)';
          w.scrollIntoView({ block: 'center', behavior: 'smooth' }); } });
    } },
  { id: 'S2C', url: 'factfind360-site/FFPROJECT.html', cursor: true,
    run: async p => {
      await SEED(p, null, demoWithout('needIncome', 'needEducation', 'needLastExpenses'));
      await p.evaluate(() => { const b = document.getElementById('secbody-7');
        if (b) b.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
      await p.waitForTimeout(400);
      await typeField(p, 'needIncome', '900000');
      await typeField(p, 'needEducation', '250000');
      await typeField(p, 'needLastExpenses', '60000');
      await p.waitForTimeout(450);
      await p.evaluate(() => { const e = document.getElementById('insuranceNeed');
        if (e) (e.closest('div') || e).scrollIntoView({ block: 'center', behavior: 'smooth' }); });
      await p.waitForTimeout(700);
      await celebrate(p, '#insuranceNeed', 'The need, uncovered');
      await p.waitForTimeout(1500);
    } },
  { id: 'S2H', url: 'factfind360-site/FFPROJECT.html',
    run: async p => {
      await SEED(p, { needIncome: '900000', needEducation: '250000', needLastExpenses: '60000' });
      await p.evaluate(() => {
        const el = [...document.querySelectorAll('*')].find(e => e.children.length === 0 &&
          /died last night/i.test(e.textContent || ''));
        const box = el ? (el.closest('div') || el) : document.getElementById('secbody-7');
        box.scrollIntoView({ block: 'center' });
        box.style.transition = 'box-shadow .6s';
        box.style.boxShadow = '0 0 0 4px rgba(45,212,191,.85)';
        box.setAttribute('data-punch', '1');
      });
      await p.waitForTimeout(900);
      await zoomTo(p, '[data-punch]', 1.5, 1700);
    } },
  { id: 'S2F', url: 'factfind360-site/FFPROJECT.html', cursor: true,
    run: async p => {
      await SEED(p, null, demoWithout('retPctIncome', 'retYears', 'retRoi', 'retNis'));
      await p.evaluate(() => { const b = document.getElementById('secbody-8');
        if (b) b.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
      await p.waitForTimeout(400);
      await typeField(p, 'retPctIncome', '70', 110);
      await typeField(p, 'retYears', '20', 110);
      await typeField(p, 'retRoi', '4', 110);
      await typeField(p, 'retNis', '3000', 80);
      await p.waitForTimeout(600);
      await p.evaluate(() => { const b = document.getElementById('secbody-8');
        const el = [...b.querySelectorAll('*')].find(e => e.children.length === 0 &&
          /Retirement Fund Gap/i.test(e.textContent));
        const box = el ? (el.closest('div') || el) : b;
        box.scrollIntoView({ block: 'center' });
        box.style.transition = 'box-shadow .6s';
        box.style.boxShadow = '0 0 0 4px rgba(245,185,53,.9)';
        box.setAttribute('data-gap', '1'); });
      await p.waitForTimeout(700);
      await zoomTo(p, '[data-gap]', 1.12, 1500);
    } },
  // The inflation rate is not a number an agent guesses at — it is the Central
  // Bank's own figure, carried into a factor and applied to every year to
  // retirement. Worth showing, because it is the part nobody would do by hand.
  { id: 'S2I', url: 'factfind360-site/FFPROJECT.html',
    run: async p => {
      await SEED(p, { retPctIncome: '70', retYears: '20', retRoi: '4', retNis: '3000' });
      await p.evaluate(() => { const b = document.getElementById('secbody-8');
        if (b) b.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
      await p.waitForTimeout(500);
      await p.evaluate(() => {
        [['[data-field="retInflRate"]', 'rgba(45,212,191,.9)'],
         ['#retInflFactor', 'rgba(245,185,53,.95)']].forEach(function (x, i) {
          const e = document.querySelector(x[0]); if (!e) return;
          setTimeout(() => { e.style.transition = 'box-shadow .5s, transform .5s';
            e.style.boxShadow = '0 0 0 4px ' + x[1]; e.style.transform = 'scale(1.02)'; }, i * 900);
        });
        const src = [...document.querySelectorAll('*')].find(e => e.children.length === 0 &&
          /Central Bank/i.test(e.textContent || ''));
        if (src) { const w = src.closest('div') || src;
          w.setAttribute('data-src', '1');
          setTimeout(() => { w.style.transition = 'box-shadow .5s';
            w.style.boxShadow = '0 0 0 3px rgba(167,139,250,.75)'; }, 1900); }
      });
      await p.waitForTimeout(3000);
      await zoomTo(p, '#retInflFactor', 1.9, 1700);
      await p.waitForTimeout(1400);
      await p.evaluate(() => { const b = document.body;
        b.style.transition = 'transform 1100ms cubic-bezier(.35,.75,.3,1)';
        b.style.transform = 'scale(1)'; });
      await p.waitForTimeout(1200);
      await p.evaluate(() => { const e = document.getElementById('retLumpsum');
        if (e) { const w = e.closest('div') || e;
          w.scrollIntoView({ block: 'center', behavior: 'smooth' });
          w.style.transition = 'box-shadow .5s'; w.style.boxShadow = '0 0 0 4px rgba(45,212,191,.85)'; } });
      await p.waitForTimeout(1200);
    } },
  { id: 'S2G', url: 'factfind360-site/FFPROJECT.html', cursor: true,
    run: async p => {
      await SEED(p, { clientName: 'Alice Mohammed', needIncome: '900000',
        needEducation: '250000', needLastExpenses: '60000' });
      // park the form on the needs analysis so the left half shows the figures
      await p.evaluate(() => { const b = document.getElementById('secbody-7');
        if (b) b.scrollIntoView({ block: 'start' }); window.scrollBy(0, -60); });
      await p.waitForTimeout(400);
      await p.evaluate(() => openPreview());
      await p.waitForTimeout(1800);
      // split the screen: form left, the client's printed copy right
      await p.evaluate(() => {
        const bd = document.getElementById('previewBackdrop');
        bd.style.inset = '0 0 0 50%'; bd.style.left = '50%'; bd.style.right = '0';
        bd.style.width = 'auto'; bd.style.background = '#0B1220';
        bd.style.borderLeft = '3px solid #2DD4BF';
        const app = document.getElementById('appContainer');
        if (app) { app.style.transformOrigin = 'top left'; app.style.transform = 'scale(.62)'; }
        const b7 = document.getElementById('secbody-7');
        if (b7) { b7.style.boxShadow = '0 0 0 4px rgba(45,212,191,.8)';
          b7.scrollIntoView({ block: 'start' }); window.scrollBy(0, -60); }
        const tag = document.createElement('div');
        tag.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:9999;' +
          'background:#2DD4BF;color:#04211D;font:800 13px/1 system-ui;padding:7px 14px;border-radius:20px';
        tag.textContent = 'THE CLIENT\u2019S COPY — FILLING ITSELF IN';
        document.documentElement.appendChild(tag);
      });
      await p.waitForTimeout(1500);
      await p.evaluate(() => { const bd = document.getElementById('previewBackdrop');
        const sc = [...bd.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 40);
        if (sc) sc.scrollBy({ top: 700, behavior: 'smooth' }); });
      await p.waitForTimeout(2200);
      await p.evaluate(() => { const bd = document.getElementById('previewBackdrop');
        const sc = [...bd.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 40);
        if (sc) sc.scrollBy({ top: 700, behavior: 'smooth' }); });
    } },
  { id: 'S2D', url: 'factfind360-site/FFPROJECT.html', cursor: true,
    run: async p => {
      await SEED(p);
      await p.evaluate(() => { const h = [...document.querySelectorAll('.section-header')]
        .find(x => /Recommendations/i.test(x.textContent));
        if (h) { h.setAttribute('data-demo', '1');
          if (getComputedStyle(h.nextElementSibling).display === 'none') h.click(); } });
      await p.waitForTimeout(700);
      await p.evaluate(() => { const b = document.getElementById('secbody-10');
        if (b) b.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); });
      await p.waitForTimeout(500);
      // the three-step wizard buttons
      const steps = await p.$$('#secbody-10 button');
      for (let i = 0; i < Math.min(3, steps.length); i++) {
        await curClick(p, '#secbody-10 button:nth-of-type(' + (i + 1) + ')', 620);
        await p.waitForTimeout(430);
      }
      await p.evaluate(() => { const sel = document.querySelector('#secbody-10 select');
        if (sel) { sel.style.transition = 'box-shadow .4s';
          sel.style.boxShadow = '0 0 0 4px rgba(45,212,191,.8)';
          sel.scrollIntoView({ block: 'center', behavior: 'smooth' }); } });
      await p.waitForTimeout(600);
      await zoomTo(p, '#secbody-10 select', 1.35, 1400);
    } },
  // The printed form, turned page by page. This is the compliance artefact —
  // Guardian's own seven pages, the Insurance Act notice, the market conduct
  // standards, the analysis and the signatures — filled from what was captured.
  { id: 'S2P', url: 'factfind360-site/FFPROJECT.html',
    run: async p => {
      await SEED(p);
      await p.evaluate(() => openPreview());
      await p.waitForTimeout(2000);

      const n = await p.evaluate(() => {
        const bd = document.getElementById('previewBackdrop');
        const pages = [...bd.querySelectorAll('.pf-page')];
        // shrink a 1006px page so a whole one fits the frame — this should read
        // as turning pages, not scrolling through a wall of paper
        pages.forEach(pg => { pg.style.transform = 'scale(.575)';
          pg.style.transformOrigin = 'top center';
          pg.style.marginBottom = '-' + Math.round(1006 * 0.425 - 26) + 'px'; });
        const tag = document.createElement('div');
        tag.id = '__pg';
        tag.style.cssText = 'position:fixed;left:22px;bottom:20px;z-index:2147483643;' +
          'background:#0E1A2E;color:#F5B935;border:1.5px solid rgba(245,185,53,.5);' +
          'font:850 12px/1 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;' +
          'letter-spacing:.16em;text-transform:uppercase;padding:9px 15px;border-radius:20px';
        document.documentElement.appendChild(tag);
        return pages.length;
      });

      const shown = Math.min(n, 6);
      for (let i = 0; i < shown; i++) {
        await p.evaluate(([i, n]) => {
          const pages = [...document.querySelectorAll('#previewBackdrop .pf-page')];
          const pg = pages[i];
          pg.scrollIntoView({ block: 'center', behavior: 'smooth' });
          document.getElementById('__pg').textContent = 'Page ' + (i + 1) + ' of ' + n;
          pg.style.boxShadow = '0 0 0 3px rgba(45,212,191,.75)';
          setTimeout(() => { pg.style.boxShadow = ''; }, 1500);
        }, [i, n]);
        // page one carries the Insurance Act notice — hold on it and mark it
        if (i === 0) {
          await p.waitForTimeout(700);
          await p.evaluate(() => {
            const el = [...document.querySelectorAll('#previewBackdrop *')].find(e =>
              e.children.length === 0 && /Important Notice to Clients/i.test(e.textContent || ''));
            if (!el) return;
            const w = el.closest('div') || el;
            w.style.transition = 'box-shadow .5s';
            w.style.boxShadow = '0 0 0 4px rgba(245,185,53,.9)';
          });
          await p.waitForTimeout(2100);
        } else {
          await p.waitForTimeout(2000);
        }
      }
      await p.waitForTimeout(500);
    } },
  { id: 'S2E', url: 'factfind360-site/FFPROJECT.html', cursor: true,
    run: async p => {
      await SEED(p);
      await p.evaluate(() => { const b = [...document.querySelectorAll('button')]
        .find(x => /^Preview$/i.test(x.textContent.trim())); if (b) b.setAttribute('data-demo', '1'); });
      await curClick(p, 'button[data-demo]', 900);
      await p.waitForTimeout(2000);
      await p.evaluate(() => { const bd = document.getElementById('previewBackdrop');
        if (bd) { const sc = bd.querySelector('*'); if (sc) sc.scrollTop = 0; } });
      await p.waitForTimeout(700);
      await p.evaluate(() => { const bd = document.getElementById('previewBackdrop');
        const s = bd && bd.querySelector('[style*=overflow], .preview-scroll, div');
        if (s) s.scrollBy({ top: 260, behavior: 'smooth' }); });
    } },
  { id: 'S03', url: 'factfind360-site/FFPROJECT.html',
    run: async p => {
      // two real gaps left in on purpose, so the checks have something to find
      await SEED(p, null, demoWithout('idNumber', 'rec2Reason'));
      await p.waitForTimeout(300);
      await p.evaluate(() => { const el = document.getElementById('rrbReady'); if (el) el.scrollIntoView({ block: 'start' }); });
      await p.waitForTimeout(700);
      await smoothScroll(p, await p.evaluate(() => window.scrollY + 500), DUR.S03 * 1000 - 2400);
    } },
  { id: 'S04', url: 'factfind360-site/FFPROJECT.html',
    run: async p => {
      await SEED(p);
      await p.evaluate(() => {
        const b = document.getElementById('submitBtn');
        if (b) { b.scrollIntoView({ block: 'center' });
          b.style.transition = 'box-shadow .6s';
          setInterval(() => { b.style.boxShadow = b.style.boxShadow ? '' : '0 0 0 9px rgba(45,212,191,.35)'; }, 750); }
      });
    } },
  { id: 'S05', url: 'vid/card05.html' },
  { id: 'S06', url: 'vd_draft.html',
    run: async p => { await p.waitForTimeout(700);
      await p.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => /correct/i.test(x.textContent)); if (a) a.scrollIntoView({ block: 'center', behavior: 'instant' }); window.scrollBy(0, -160); });
      await p.waitForTimeout(300);
      await p.evaluate(() => window.scrollTo(0, 0));
      await smoothScroll(p, await p.evaluate(() => document.body.scrollHeight - window.innerHeight), DUR.S06 * 1000 - 1600); } },
  { id: 'S07', url: 'vd_progress.html',
    run: async p => {
      await p.waitForTimeout(500);
      await smoothScroll(p, 300, 1400);
      await p.evaluate(() => { const el = [...document.querySelectorAll('*')].find(e =>
        /WHERE YOUR PLAN IS/i.test(e.textContent || '') && e.children.length < 12);
        if (el) { el.setAttribute('data-stages', '1');
          el.style.transition = 'box-shadow .5s';
          el.style.boxShadow = '0 0 0 4px rgba(45,212,191,.75)'; } });
      await p.waitForTimeout(700);
      await zoomTo(p, '[data-stages]', 1.45, 1600);
    } },
  { id: 'S18', url: 'vd_agentmail.html',
    run: async p => { await p.waitForTimeout(700);
      await smoothScroll(p, await p.evaluate(() => document.body.scrollHeight - window.innerHeight), DUR.S18 * 1000 - 1900); } },
  { id: 'S19', url: 'vid/stats.html' },
  { id: 'S20', url: 'INSIGHTS', run: async p => {
      await p.evaluate(() => { const a = document.getElementById('agents');
        if (a) a.closest('.card').scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
      await p.waitForTimeout(600);
      await curClick(p, '#agents tbody tr:nth-child(2)', 900);
      await p.waitForTimeout(1500);
      await p.evaluate(() => { const f = document.getElementById('filters');
        if (f) { f.style.transition = 'box-shadow .5s';
          f.style.boxShadow = '0 0 0 4px rgba(245,185,53,.85)';
          f.scrollIntoView({ block: 'center', behavior: 'smooth' }); } });
      await p.waitForTimeout(1200);
    } },
  { id: 'S08', url: 'vd_approved.html',
    run: async p => { await p.waitForTimeout(500);
      await smoothScroll(p, await p.evaluate(() => document.body.scrollHeight - window.innerHeight), DUR.S08 * 1000 - 1300); } },
  { id: 'S09', url: 'vid/card09.html' },
  { id: 'S10', url: 'digest_new.html',
    run: async p => { await p.waitForTimeout(600); await smoothScroll(p, 520, DUR.S10 * 1000 - 1400); } },
  { id: 'S11', url: 'INSIGHTS', run: async p => {
      await smoothScroll(p, await p.evaluate(() => {
        const q = document.querySelector('#queue'); return q ? q.closest('.card').offsetTop - 70 : 0; }), 900);
      await p.waitForTimeout(400);
      await smoothScroll(p, await p.evaluate(() => window.scrollY + 460), DUR.S11 * 1000 - 2600);
    } },
  { id: 'S12', url: 'INSIGHTS', run: async p => {
      await p.evaluate(() => { const q = document.querySelector('#queue');
        if (q) q.closest('.card').scrollIntoView({ block: 'start' }); window.scrollBy(0, -8); });
      await p.waitForTimeout(400);
      await curClick(p, '#queue .qc:first-child .qb.ok', 750);
      await p.waitForTimeout(700);
      // the four attestations tick where the manager can see them tick
      for (let i = 1; i <= 4; i++)
        await curClick(p, '#queue .qc:first-child .qsatt label:nth-child(' + i + ') input', 460);
      await p.waitForTimeout(400);
      // and then the signature itself, drawn on the pad
      const bb = await p.evaluate(() => {
        const c = document.querySelector('#queue .qc:first-child .qpad');
        c.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return null;
      });
      await p.waitForTimeout(600);
      const pad = await (await p.$('#queue .qc:first-child .qpad')).boundingBox();
      const y0 = pad.y + pad.height * 0.66, x0 = pad.x + pad.width * 0.30;
      await p.evaluate(([x, y]) => window.__curTo(x, y, 620), [x0, y0]);
      await p.mouse.move(x0, y0);
      await p.mouse.down();
      for (let i = 0; i <= 46; i++) {
        const t = i / 46;
        const x = x0 + t * pad.width * 0.42;
        const y = y0 - Math.sin(t * Math.PI * 2.3) * pad.height * 0.24 - t * pad.height * 0.06;
        await p.mouse.move(x, y);
        await p.evaluate(([x, y]) => { window.__curXY = [x, y];
          document.getElementById('__cur').style.transform = 'translate(' + x + 'px,' + y + 'px)'; }, [x, y]);
        // slow enough to read as a hand signing, not a machine drawing
        await p.waitForTimeout(42);
      }
      await p.mouse.up();
      await p.waitForTimeout(600);
      // Recording only: the queue redraws itself 1.6s after a decision lands,
      // which wipes the confirmation before anyone can read it. Hold the redraw
      // so the sentence stays on screen — the product still redraws in real use.
      await p.evaluate(() => {
        const orig = window.setTimeout;
        window.setTimeout = function (fn, ms) {
          if (ms === 1600 || ms === 1400) return 0;
          return orig.apply(window, arguments);
        };
      });
      await curClick(p, '#queue .qc:first-child .qsgo', 700);
      await p.waitForTimeout(1400);
      await centreZoom(p, '#queue .qc:first-child .qmsg', 1.3, 1300);
    } },
  { id: 'S13', url: 'INSIGHTS', run: async p => {
      await p.evaluate(() => { const cs = document.querySelectorAll('#queue .qc'); if (cs[1]) cs[1].scrollIntoView({ block: 'center' }); });
      await p.waitForTimeout(500);
      await curClick(p, '#queue .qc:nth-child(2) .qb.back', 800); await p.waitForTimeout(700);
      const chips = await p.$$('#queue .qc:nth-child(2) .qp');
      if (chips[0]) { await curClick(p, '#queue .qc:nth-child(2) .qp:nth-of-type(1)', 700); await p.waitForTimeout(450); }
      if (chips[1]) { await curClick(p, '#queue .qc:nth-child(2) .qp:nth-of-type(2)', 600); await p.waitForTimeout(450); }
    } },
  { id: 'S12B', url: 'INSIGHTS', run: async p => {
      await p.evaluate(() => { const q = document.querySelector('#queue');
        if (q) q.closest('.card').scrollIntoView({ block: 'start' }); window.scrollBy(0, -8); });
      await p.waitForTimeout(350);
      await curClick(p, '#queue .qc:first-child .qb.ok', 600);
      await p.waitForTimeout(450);
      await p.evaluate(() => {
        document.querySelectorAll('#queue .qc:first-child .qsatt input')
          .forEach(function (x) { x.checked = true; });
      });
      await curClick(p, '#queue .qc:first-child .qstype', 600);
      await p.waitForTimeout(700);
      await p.evaluate(() => { const o = window.setTimeout;
        window.setTimeout = function (f, m) { return (m === 1600 || m === 1400) ? 0 : o.apply(window, arguments); }; });
      await curClick(p, '#queue .qc:first-child .qsgo', 600);
      await p.waitForTimeout(1400);
      await centreZoom(p, '#queue .qc:first-child .qmsg', 1.3, 1300);
    } },
  { id: 'S13B', url: 'INSIGHTS', run: async p => {
      await p.evaluate(() => { const cs = document.querySelectorAll('#queue .qc');
        if (cs[1]) cs[1].scrollIntoView({ block: 'center' }); });
      await p.waitForTimeout(400);
      await curClick(p, '#queue .qc:nth-child(2) .qb.back', 700); await p.waitForTimeout(500);
      await curClick(p, '#queue .qc:nth-child(2) .qp:nth-of-type(1)', 550); await p.waitForTimeout(350);
      await curClick(p, '#queue .qc:nth-child(2) .qb.back', 550); await p.waitForTimeout(700);
      await p.evaluate(() => { const o = window.setTimeout;
        window.setTimeout = function (f, m) { return (m === 1600 || m === 1400) ? 0 : o.apply(window, arguments); }; });
      await curClick(p, '#queue .qc:nth-child(2) .qsgo', 600); await p.waitForTimeout(1400);
      await centreZoom(p, '#queue .qc:nth-child(2) .qmsg', 1.3, 1300);
    } },
  { id: 'S16', url: 'vid/timeline.html' },
  { id: 'S14', url: 'factfind360-site/wall.html', feed: true,
    run: async p => { await p.waitForTimeout(2300); await p.evaluate(() => { try { rotate(); } catch (e) {} }); } },
  // the boast: the manager's dashboards, one after another, all of them live
  { id: 'S21', url: 'INSIGHTS', noCursor: true, run: async p => {
      const halo = sel => p.evaluate(sel => { const e = document.querySelector(sel);
        if (!e) return; const c = e.closest('.card') || e;
        c.style.transition = 'box-shadow .55s, transform .55s';
        c.style.boxShadow = '0 0 0 4px rgba(45,212,191,.85)'; c.style.transform = 'scale(1.012)';
        setTimeout(() => { c.style.boxShadow = 'none'; c.style.transform = 'none'; }, 1900); }, sel);
      await smoothScroll(p, 0, 500);
      await p.waitForTimeout(350);
      for (const k of ['#k_sub', '#k_app', '#k_cyc', '#k_prem']) { await halo(k); await p.waitForTimeout(430); }
      await p.waitForTimeout(500);
      await p.evaluate(() => { const c = document.querySelector('#agents').closest('.card');
        c.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
      await p.waitForTimeout(900); await halo('#agents');
      await p.waitForTimeout(1500);
      await p.evaluate(() => { const c = document.querySelector('#prodBoard').closest('.card');
        c.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
      await p.waitForTimeout(900); await halo('#prodBoard');
      await p.waitForTimeout(1500);
      await p.evaluate(() => { const c = document.querySelector('#attention').closest('.card');
        c.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
      await p.waitForTimeout(900); await halo('#attention');
      await p.waitForTimeout(1200);
    } },
  { id: 'S15', url: 'vid/card15.html' },
];

(async () => {
  const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
  const b = await chromium.launch();
  for (const sc of scenes.filter(x => !ONLY.length || ONLY.includes(x.id))) {
    const ctx = await b.newContext({ viewport: VP,
      recordVideo: { dir: S + 'vid/rec', size: VP } });
    const p = await ctx.newPage();
    if (sc.url === 'INSIGHTS' || sc.feed) {
      await p.route('**/exec*', r => {
        const req = r.request(), u = req.url();
        // the queue posts its decision now, so the signature can ride in a body
        if (req.method() === 'POST') {
          let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {}
          return r.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify({ ok: true, id: b.id,
              status: b.v === 'approve' ? 'approved' : b.v === 'hold' ? 'held' : 'changes_requested' }) });
        }
        if (u.includes('action=login')) return r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ ok: true, name: 'Ricky Rampersad', role: 'Branch Manager', token: 'demo' }) });
        if (u.includes('action=wall')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FEED) });
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, rows }) });
      });
    }
    if (sc.url === 'INSIGHTS') {
      await p.goto('file://' + S + 'factfind360-site/insights.html');
      await p.fill('#gEmail', 'A10099'); await p.fill('#gPass', 'demo');
      await p.click('#gate button'); await p.waitForTimeout(1600);
    } else {
      await p.goto('file://' + S + sc.url);
    }
    if ((sc.cursor || sc.url === 'INSIGHTS') && !sc.noCursor) await p.evaluate(new Function(CURSOR));
    // anything showing a client carries the sample stamp for its whole run
    if (!sc.url.startsWith('vid/')) await p.evaluate(new Function(STAMP));
    const t0 = Date.now();
    if (sc.run) { try { await sc.run(p); } catch (e) { console.log(sc.id, 'action warn:', e.message.slice(0, 80)); } }
    const left = DUR[sc.id] * 1000 - (Date.now() - t0);
    if (left > 0) await p.waitForTimeout(left);
    await ctx.close();
    const v = await p.video().path();
    fs.renameSync(v, S + 'vid/rec/' + sc.id + '.webm');
    console.log(sc.id, 'recorded', DUR[sc.id] + 's');
  }
  await b.close();
  console.log('ALL SCENES DONE');
})();
