// My day saves in place, and fills Claude's reviews in place (28 October 2026), in a real browser.
//
// The page's two scripts (UNIT_SAVE_JS, IX_WAIT_JS) on a page shaped like My branch, with google.script.run stood in for:
// Save sends the form to unitSaveNow and keeps the page: the result shows above the button, what saved is cleared, what did
// not keeps its words, an inbox item dealt with folds; a failed call falls back to posting the form. An item Claude has not
// reviewed asks for its review at once and gets it in place, with the boxes Save reads.
const { chromium } = require('playwright');
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const page = (stub) => '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
  '<script>window.__calls=[];window.__posted=0;' + stub + '</script>' +
  '<form method="post" action="/never" target="_top" id="ufm"><input type="hidden" name="rs" value="ricky"><input type="hidden" name="f" value="unit"><input type="hidden" name="k" value="SIG">' +
  '<textarea name="c_00T1">Called the client</textarea><textarea name="c_00T2">Second note</textarea>' +
  '<details class="it" id="xkA" open><summary>Kamla · Subject kA</summary><input type="checkbox" name="ixd_kA" value="1" checked>' +
  '<div class="br2 ixwait" data-k="kA">Claude is reviewing this one now</div></details>' +
  '<div id="usaved"></div><button type="submit" id="usave">Save</button></form>' +
  env.UNIT_SAVE_JS + env.IX_WAIT_JS + '</body></html>';
// google.script.run, stood in for: each call records what it was sent and answers after a moment.
const STUB = (answers) => 'window.google={script:{run:(function(){function R(){this.s=null;this.f=null;}' +
  'R.prototype.withSuccessHandler=function(f){this.s=f;return this;};R.prototype.withFailureHandler=function(f){this.f=f;return this;};' +
  ['unitSaveNow', 'ixReviewNow'].map(n => 'R.prototype.' + n + '=function(o){var me=this;window.__calls.push({fn:"' + n + '",o:o});var a=(' + JSON.stringify(answers) + ')["' + n + '"];' +
    'setTimeout(function(){if(a==="FAIL")me.f&&me.f(new Error("x"));else me.s&&me.s(a);},150);};').join('') +
  'return new Proxy({},{get:function(t,p){var r=new R();return r[p]?r[p].bind(r):undefined;}});})()}};' +
  'HTMLFormElement.prototype.submit=function(){window.__posted++;};';

(async () => {
  const b = await chromium.launch();
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.setContent(page(STUB({
      ixReviewNow: { ok: true, left: 0, html: { kA: '<div>Claude reviewed it</div><input type="checkbox" name="ixp_kA" value="1"><textarea name="ixpt_kA">Kamla, please call today.</textarea>' } },
      unitSaveNow: { ok: true, html: '<b>2 of 3 saved</b><div class="ln">&#9888; Joy · Agent task two · <b>NOT SAVED: Salesforce said no</b></div>', fields: ['c_00T1', 'ixd_kA'], inbox: [{ k: 'kA', res: 'dealt with' }] }
    })));
    await p.waitForTimeout(600);
    const calls = await p.evaluate(() => window.__calls);
    ok('on open, the page asks for the review of what is waiting, with its keys', calls.length >= 1 && calls[0].fn === 'ixReviewNow' && calls[0].o.keys.join() === 'kA' && calls[0].o.k === 'SIG', JSON.stringify(calls[0]));
    ok('the review goes in place, with the boxes Save reads', !(await p.$('.ixwait')) && !!(await p.$('textarea[name="ixpt_kA"]')) && /Claude reviewed it/.test(await p.textContent('#xkA')));
    await p.click('#usave');
    ok('Save says it is saving and does not post the page', (await p.textContent('#usave')) === 'Saving…' && (await p.evaluate(() => window.__posted)) === 0);
    await p.waitForTimeout(500);
    const sent = (await p.evaluate(() => window.__calls)).filter(c => c.fn === 'unitSaveNow')[0];
    ok('the form goes to unitSaveNow, every field', sent && sent.o.rs === 'ricky' && sent.o.f === 'unit' && sent.o.k === 'SIG' && sent.o.c_00T1 === 'Called the client' && sent.o.ixd_kA === '1' && sent.o.ixpt_kA === 'Kamla, please call today.', JSON.stringify(sent && sent.o));
    ok('the result shows above the button', /2 of 3 saved/.test(await p.textContent('#usaved')) && /NOT SAVED: Salesforce said no/.test(await p.textContent('#usaved')));
    ok('what saved is cleared; what did not keeps its words', (await p.inputValue('textarea[name="c_00T1"]')) === '' && (await p.inputValue('textarea[name="c_00T2"]')) === 'Second note');
    ok('the inbox item dealt with folds, saying so', /✓ dealt with/.test(await p.textContent('#xkA')) && !(await p.$('#xkA input[name="ixd_kA"]')));
    ok('the button is back for the next one', (await p.textContent('#usave')) === 'Save' && !(await p.isDisabled('#usave')));
    ok('no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    await p.setContent(page(STUB({ ixReviewNow: { ok: true, left: 1, busy: true, html: {} }, unitSaveNow: 'FAIL' })));
    await p.waitForTimeout(400);
    await p.click('#usave'); await p.waitForTimeout(500);
    ok('when the call fails, the form posts the old way', (await p.evaluate(() => window.__posted)) === 1);
    ok('a review still waiting keeps its line, to be asked again', !!(await p.$('.ixwait')));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
