// His day opens after a dropped connection (27 October 2026).
//
// Ricky, 5:24am on his phone, the 5:00 e-mail's button: "Opening your day…" then, at 110 s, "It did not open this time
// (NetworkError: Connection failure due to HTTP 0)". The phone let go of a long build; the tracker went on and finished it.
// Pinned here:
//   - the light page tries again by itself on a dropped connection (twice) and when the page is looked at again
//   - a page openPage builds is kept; the retry (retry=1) gets it at once, saying when it was put together, not built again
//   - a retry while the first build is still going waits for it, then hands it over
//   - a retry with nothing kept and nothing building builds it; an ordinary second open is still live
//   - the light page's script runs (no syntax slip in the string)
const { makeEnv } = require('./harness');
const vm = require('vm');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-27';
const env = makeEnv();
env.todayISO_ = () => DAY;
let NOW = '05:22';
env.hhmm_ = () => NOW;
env.nothingToReport_ = () => false;
const built = [];
env.unitPage_ = (person, day) => { built.push(person.staffId); return env.HtmlService.createHtmlOutput('<!doctype html><div class="w"><h1>My branch</h1><p>built ' + built.length + '</p></div>'); };
env.replyPerson_ = (sid) => ({ staffId: sid, name: sid });
env.systemDayOn_ = () => true;
env.runlog_ = () => {};
const P = env.PropertiesService.getScriptProperties();
P.setProperty('fastpg_opened_ricky_' + DAY, '05:00');   // nothing built ahead: the 5:24 case
const K = env.unitSig_('ricky');

const shell = env.doGet({ parameter: { rs: 'ricky', f: 'unit', k: K } }).getContent();
ok('the light page tries again by itself on a dropped connection', /tries<3/.test(shell) && /http 0/.test(shell) && /q\.retry="1"/.test(shell) && /Trying again by itself/.test(shell));
ok('and when the page is looked at again', /visibilitychange/.test(shell) && /go\(true\)/.test(shell));
// Run the light page's script with a pretend browser: a dropped connection, then the retry succeeds.
const script = shell.match(/<script>([\s\S]*)<\/script>/)[1];
let calls = [], timers = [], written = '', vis = null;
const doc = { getElementById: () => ({ set textContent(v) { this._t = v; }, set innerHTML(v) { this._h = v; } }), open() {}, write(h) { written = h; }, close() {},
  addEventListener: (ev, fn) => { if (ev === 'visibilitychange') vis = fn; }, visibilityState: 'visible' };
const run = { _ok: null, _bad: null, withSuccessHandler(f) { this._ok = f; return this; }, withFailureHandler(f) { this._bad = f; return this; },
  openPage(q) { calls.push(q); const ok2 = this._ok, bad = this._bad; if (calls.length === 1) bad(new Error('NetworkError: Connection failure due to HTTP 0')); else ok2('<p>the page</p>'); } };
try {
  vm.runInNewContext(script, { document: doc, location: { href: 'x', replace() {} }, setInterval: () => 0, setTimeout: (f) => { timers.push(f); return 0; },
    window: { google: { script: { run } } }, google: { script: { run } }, Date, Object, String });
  timers.forEach(f => f());
} catch (e) { ok('the light page script runs', false, e.message); }
ok('the light page script runs: first try dropped, the retry asks with retry=1 and draws the page', calls.length === 2 && !calls[0].retry && calls[1].retry === '1' && written === '<p>the page</p>', JSON.stringify(calls));

// openPage: built once, kept, handed to the retry.
NOW = '05:22';
const first = env.openPage({ rs: 'ricky', f: 'unit', k: K });
ok('the first open builds his day', /built 1/.test(first) && built.length === 1);
NOW = '05:24';
const again = env.openPage({ rs: 'ricky', f: 'unit', k: K, retry: '1' });
ok('the retry gets the page the first try built, at once', /built 1/.test(again) && built.length === 1, again.slice(0, 140));
ok('saying when it was put together, with a way to bring it up to date', /Put together at 5:22/.test(again) && /Bring it up to date/.test(again));
const live = env.openPage({ rs: 'ricky', f: 'unit', k: K });
ok('an ordinary open after that is live', /built 2/.test(live) && built.length === 2);

// A retry while the first build is still going: it waits, then hands it over.
const rk = env.fastRescueKey_({ rs: 'ricky', f: 'unit', k: K }, DAY);
env.fastCacheTake_(rk);   // the copy from the live open, out of the way
const cache = env.CacheService.getScriptCache();
cache.put(rk + '_busy', '1', 300);
let slept = 0;
env.Utilities.sleep = () => { slept++; if (slept === 2) { env.fastCachePut_(rk, '<div class="w">built by the first try</div>', 1200); cache.remove(rk + '_busy'); } };
const waited = env.openPage({ rs: 'ricky', f: 'unit', k: K, retry: '1' });
ok('a retry while the first try is still building waits for it', /built by the first try/.test(waited) && slept === 2 && built.length === 2, String(slept));

// Nothing kept, nothing building: the retry builds it.
const fresh = env.openPage({ rs: 'ricky', f: 'unit', k: K, retry: '1' });
ok('nothing kept and nothing building: the retry builds it', /built 3/.test(fresh) && built.length === 3);
ok('a wrong key is still refused on a retry', /That link is not right/.test(env.openPage({ rs: 'ricky', f: 'unit', k: 'nope', retry: '1' })));
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
