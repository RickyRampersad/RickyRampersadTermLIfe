// "Your branch list" leaves off the agents Ricky named, Javid and Aleema, and everyone who left (19 Nov 2026).
process.env.GS_PATH = process.env.GS_PATH || [__dirname + '/../apps-script/KPI.gs', __dirname + '/../apps-script/Intelligence.gs'].join(',');
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l); if (!c) fails++; };
const env = makeEnv();
const off = env.iDigestOffList_();
['Faizal Mohammed', 'Petra Chadee', 'Stephanie Rajkumar', 'Richard Ramdwar', 'Javid Ali', 'Aleema Mohammed-Ali', 'Tricia Baksh', 'Aidan Eugene', 'Naila Samuel']
  .forEach(n => ok(n + ' is off', env.iDigestOff_(n, off)));
['Neil Ramnanan', 'Felicia Rampersad', 'Fawwaz Mohamed', 'Narissa Mohammed'].forEach(n => ok(n + ' still gets it', !env.iDigestOff_(n, off)));
console.log(fails ? fails + ' FAILED' : 'all green'); process.exit(fails ? 1 : 0);
