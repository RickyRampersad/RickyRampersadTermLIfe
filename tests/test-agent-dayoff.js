// Agents taken off the platform (12 Nov 2026): no daily mail, no My workday page, everyone else unchanged.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAIL  ') + m); if (!c) fails++; };
const P = env.PropertiesService.getScriptProperties();
const g = env;
const off = n => g.agentDayOff_({ name: n, agentName: n });
ok(off('Darryl Manick') && off('Felicia Rampersad') && off('Varun Seegolam'), 'the seven are off by default');
ok(!off('Neil Ramnanan') && !off('Joy Sama'), 'agents who use it stay on');
ok(!g.agentLiveFor_({ name: 'Faizal Mohammed', agentName: 'Faizal Mohammed' }), 'an agent off the platform is never live');
P.setProperty('AGENT_DAY_OFF', 'A12397, Joy Sama');
ok(g.agentDayOff_({ name: 'Fawwaz Mohamed', code: 'A12397' }) && off('Joy Sama') && !off('Darryl Manick'), 'the property replaces the list, by number or name');
P.setProperty('AGENT_DAY_OFF', 'none');
ok(!off('Darryl Manick'), '"none" clears it');
console.log(fails ? fails + ' FAILED' : 'All passed'); process.exit(fails ? 1 : 0);
