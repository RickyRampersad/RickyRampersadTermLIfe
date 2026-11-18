/* Xpress Life leads from WhatsApp: help868.xllead files the lead, finds or creates the Salesforce Contact, opens one task, never twice a day. */
const fs = require('fs'), vm = require('vm');
let fails = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fails++; };
function world(opts) {
  opts = opts || {};
  const props = Object.assign({ XL_LEAD_KEY: 'k'.repeat(20) }, opts.props || {}), cache = {}, rows = [], sent = [], searches = [];
  const sheet = { getLastRow: () => rows.length + 1, appendRow: r => rows.push(r), getRange: (r, c, n, w) => ({ getValues: () => rows.slice(r - 2, r - 2 + n) }) };
  const ctx = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: () => {} }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    Utilities: { formatDate: (d, tz, f) => f === 'yyyy-MM-dd' ? '2026-11-18' : '2026-11-18 10:30' },
    UrlFetchApp: { fetch: (url) => { searches.push(decodeURIComponent(url)); return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ searchRecords: opts.found ? [opts.found] : [] }) }; } },
    SVCSF: { API: 'v60.0' }, svcSfToken_: () => ({ instance_url: 'https://x', access_token: 't' }),
    tSfOn_: () => !opts.noSf, tSfQuery_: () => [{ Id: '012PROSPECT' }],
    tSfSend_: (m, path, body) => { sent.push({ path, body }); return { id: path.indexOf('Contact') > -1 ? '003NEW' : '00TNEW' }; },
    ss_: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }), log_: () => {}, console
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + '/../apps-script/Help868.gs', 'utf8'), ctx);
  return { ctx, rows, sent, searches };
}
const lead = { action: 'help868.xllead', key: 'k'.repeat(20), phone: '+1 868 555 0142', name: 'Ann Sample', age: '40', gender: 'Female', cover: '300K', result: 'eligible', rcontact: '123' };

let w = world();
let r = w.ctx.help868Route_(Object.assign({}, lead, { key: 'wrong' }));
ok(!r.ok && w.sent.length === 0 && w.rows.length === 0, 'a wrong key does nothing');
r = w.ctx.help868Route_(lead);
ok(r.ok && r.salesforce === 'created' && r.contactId === '003NEW', 'a new number becomes a Contact');
const c = w.sent.find(x => x.path === '/sobjects/Contact');
ok(c && c.body.RecordTypeId === '012PROSPECT' && c.body.FirstName === 'Ann' && c.body.LastName === 'Sample', 'record type PROSPECT, name split');
ok(c && c.body.MobilePhone === '(868) 555-0142', 'mobile written as (868) 555-0142');
ok(c && !/health|question|yes/i.test(c.body.Description) && /Next step: apply online/.test(c.body.Description), 'no health answer, only the next step');
const t = w.sent.find(x => x.path === '/sobjects/Task');
ok(t && t.body.WhoId === '003NEW' && /Xpress Life lead/.test(t.body.Subject), 'one task on the Contact');
ok(w.rows.length === 1 && w.rows[0][2] === '0142' && w.rows[0][5] === 'TT$300,000', 'the lead is on the tab, number ending only');
r = w.ctx.help868Route_(lead);
ok(r.repeat && w.sent.length === 2 && w.rows.length === 1, 'the same lead twice in a day writes nothing more');

w = world({ found: { Id: '003OLD', MobilePhone: '868-555-0142' } });
r = w.ctx.help868Route_(Object.assign({}, lead, { result: 'refer' }));
ok(r.salesforce === 'existing' && !w.sent.some(x => x.path === '/sobjects/Contact'), 'a known number is not created again');
ok(/another Guardian plan/.test(w.sent[0].body.Subject) && w.sent[0].body.WhoId === '003OLD', 'the task sits on the existing Contact and says what to do');

w = world({ props: { XL_LEAD_SF: 'off' } });
r = w.ctx.help868Route_(lead);
ok(r.ok && r.salesforce === 'off' && w.sent.length === 0 && w.rows.length === 1, 'XL_LEAD_SF = off keeps Salesforce out, the tab still fills');
w = world();
r = w.ctx.help868Route_(Object.assign({}, lead, { phone: '' }));
ok(!r.ok, 'no number, no lead');
console.log(fails ? '\n' + fails + ' failed' : '\nall passed'); process.exit(fails ? 1 : 0);
