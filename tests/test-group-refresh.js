// When the group side reads Salesforce: at the set hours only, a missed slot caught by the next run.
// Run: node tests/test-group-refresh.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'GroupClients.gs'), 'utf8');

function fn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing ' + name);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  throw new Error('unbalanced ' + name);
}

let props = {};
const TZ = 'America/Puerto_Rico';
const part = (d, tz, f) => {
  const o = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' })
    .formatToParts(d).reduce((a, p) => (a[p.type] = p.value, a), {});
  return String(Number({ H: o.hour, m: o.minute, s: o.second }[f]));
};
const num = re => Number(re.exec(src)[1]);
let triggers = [];
const ctx = {
  GCM: { REFRESH_AT: (/REFRESH_AT:\s*\[([^\]]*)\]/.exec(src)[1]).split(',').map(Number),
         SEND_DAY: num(/SEND_DAY:\s*(\d+)/), SEND_HOUR: num(/SEND_HOUR:\s*(\d+)/), SEND_MIN: num(/SEND_MIN:\s*(\d+)/) },
  tTz_: () => TZ,
  Utilities: {
    formatDate: (d, tz, f) => f === 'yyyy-MM-dd' ? new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d) : part(d, tz, f),
    parseDate: (s, tz, f) => { const m = /^(\d{4}-\d{2}-\d{2}) (\d{1,2}):(\d{2})$/.exec(s); return new Date(m[1] + 'T' + m[2].padStart(2, '0') + ':' + m[3] + ':00-04:00'); },
  },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = String(v); } }) },
  ScriptApp: {
    getProjectTriggers: () => triggers.slice(),
    deleteTrigger: t => { triggers = triggers.filter(x => x !== t); },
    newTrigger: fnName => { const b = { kind: '', at: null, timeBased: () => b, at: d => { b.when = d; b.kind = 'at'; return b; },
      onWeekDay: () => { b.kind = 'weekly'; return b; }, atHour: () => b, nearMinute: () => b, inTimezone: () => b,
      create: () => { const t = { fn: fnName, kind: b.kind, when: b.when, getHandlerFunction: () => fnName }; triggers.push(t); return t; } }; return b; },
  },
};
ctx.Date = Date;   // the script's own `instanceof Date` must see the dates this test makes
vm.createContext(ctx);
['gcmRefreshAt_', 'gcmRefreshDue_', 'gcmYmd_', 'gcmDow_', 'gcmAddDays_', 'gcmSendMins_', 'gcmSendClock_', 'gcmMinsNow_',
 'gcmNextSend_', 'gcmApproveFor_', 'gcmNextSendMs_', 'gcmHasMondayTrigger_', 'gcmMondayTrigger_'].forEach(n => vm.runInContext(fn(n), ctx));

let pass = 0, fail = 0;
function ok(cond, what) { if (cond) { pass++; console.log('  PASS ', what); } else { fail++; console.log('  FAIL ', what); } }
// Puerto Rico is UTC-4 all year
const at = (hm, day = '2026-11-27') => new Date(day + 'T' + hm + ':00-04:00').getTime();
const due = (now, last) => ctx.gcmRefreshDue_(new Date(at(now)), last);

ok(JSON.stringify(ctx.gcmRefreshAt_()) === '[6,10,12,15]', 'the hours are 6, 10, 12 and 3');
ok(due('06:07', at('15:20', '2026-11-26')) === true, '6:07, last read yesterday afternoon: read');
ok(due('07:07', at('06:09')) === false, '7:07, read at 6:09: wait');
ok(due('09:07', at('06:09')) === false, '9:07: still wait');
ok(due('10:07', at('06:09')) === true, '10:07: read');
ok(due('10:07', at('10:01')) === false, '10:07, the Monday letters read at 10:01: no second read');
ok(due('11:07', at('10:09')) === false, '11:07: wait');
ok(due('12:07', at('10:09')) === true, '12:07: read');
ok(due('13:07', at('12:09')) === false, '1:07: wait');
ok(due('15:07', at('12:09')) === true, '3:07: read');
ok(due('16:07', at('15:09')) === false, '4:07: wait');
ok(due('18:07', at('15:09')) === false, '6:07pm: wait');
ok(due('07:07', at('15:20', '2026-11-26')) === true, 'the 6:00 run never came: 7:07 catches it');
ok(due('11:07', at('09:50')) === true, 'a person pressed Refresh at 9:50: the 10:00 slot is still read at 11:07');
ok(due('12:10', at('12:00')) === false, 'read ten minutes ago: never within fifteen minutes');
ok(due('05:30', at('15:20', '2026-11-26')) === false, 'before 6:00: nothing');
props.GCM_REFRESH_AT = '7, 13';
ok(JSON.stringify(ctx.gcmRefreshAt_()) === '[7,13]', 'the GCM_REFRESH_AT Script property replaces the hours');
ok(due('06:30', at('15:20', '2026-11-26')) === false && due('07:05', at('15:20', '2026-11-26')) === true, 'and is followed');
props.GCM_REFRESH_AT = 'morning';
ok(JSON.stringify(ctx.gcmRefreshAt_()) === '[6,10,12,15]', 'a property that is not hours falls back to the set hours');
props = {};
// the Monday letters at 10:30
const D = (ymd, hm) => new Date(at(hm, ymd));
ok(ctx.gcmSendClock_() === '10:30', 'the letters go at 10:30');
ok(ctx.gcmNextSend_(D('2026-11-30', '10:29')) === '2026-11-30', 'Monday 10:29: the letters still go today');
ok(ctx.gcmNextSend_(D('2026-11-30', '10:30')) === '2026-12-07', 'Monday 10:30: an approval now is for the next Monday');
ok(ctx.gcmNextSend_(D('2026-11-27', '16:00')) === '2026-11-30', 'Friday afternoon: next Monday');
const g = { sends: [] };
ok(ctx.gcmApproveFor_(g, D('2026-11-30', '10:15')) === '2026-11-30', 'approved Monday 10:15: goes at 10:30 today');
ok(ctx.gcmApproveFor_(g, D('2026-11-30', '10:45')) === '2026-11-30', 'approved Monday 10:45, nothing sent today: still goes today');
ok(ctx.gcmApproveFor_({ sends: [{ when: '2026-11-30', status: 'sent' }] }, D('2026-11-30', '10:45')) === '2026-12-07', 'a letter already went today: next Monday');
triggers = [{ fn: 'gcmMondaySend', kind: 'weekly', getHandlerFunction: () => 'gcmMondaySend' }];
const nowAt = ms => { const RD = Date; ctx.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } }; };
nowAt(at('21:00', '2026-11-26'));
vm.runInContext('gcmMondayTrigger_()', ctx);
ok(triggers.length === 1 && triggers[0].kind === 'at', 'the old weekly 10:00 timer is replaced by one exact timer');
ok(triggers[0].when && triggers[0].when.getTime() === at('10:30', '2026-11-30'), 'set for Monday 30 November at 10:30');
vm.runInContext('gcmMondayTrigger_()', ctx);
ok(triggers.length === 1, 'an hourly run that finds it right leaves it alone');
nowAt(at('10:31', '2026-11-30'));
vm.runInContext('gcmMondayTrigger_()', ctx);
ok(triggers.length === 1 && triggers[0].when.getTime() === at('10:30', '2026-12-07'), 'after the send, the next one is set for the Monday after');
ok(/function gcmMondaySend\(\) \{[\s\S]{0,120}gcmMondayTrigger_\(\)/.test(src), 'the send sets the next week\'s timer itself');
ok(/mins >= gcmSendMins_\(\) - 2/.test(src), 'a timer that wakes a minute early still sends');

ok(/if \(gcmRefreshDue_\(now, gcmRefreshedMs_\(\)\)\) gcmRefreshLocked_\(\);/.test(src), 'the hourly run reads Salesforce only when due');
ok(/refreshAt: gcmRefreshAt_\(\)/.test(src), 'gcm.ping says the hours, so a browser can tell the paste is live');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
