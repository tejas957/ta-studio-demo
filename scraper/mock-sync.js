'use strict';
/* Runs the scraper against the fake legacy site (fake data only).
     node scraper/mock-sync.js           -> samples/mock-payload.json    (the first scrape)
     node scraper/mock-sync.js --update  -> samples/mock-payload-2.json  (a later scrape: 1 new applicant,
                                            2 students turn blue, 1 assigned student turns red (declined),
                                            1 commitment student gets placed) */
const fs = require('fs');
const { start } = require('../mock-legacy/server');
const { sync } = require('./sync');
(async () => {
  const s = await start();
  const update = process.argv.includes('--update');
  if (update) {
    s.addLateApplicant();
    const plain = s.db.ta.filter(t => !t.cls && !t.assignments.length);
    plain.slice(0, 2).forEach(t => { t.cls = 'other_support'; });
    const assignedPlain = s.db.ta.find(t => !t.cls && t.assignments.length);
    if (assignedPlain) assignedPlain.cls = 'declined';
    const c = s.db.ta.find(t => t.cls === 'commitment' && !t.assignments.length), slot = s.db.classes.find(x => x.assigned < x.needed);
    if (c && slot) { c.assignments.push({ sid: slot.id, pct: 1, agree: 'Sent:10-11-26 9:00am' }); slot.assigned += 1; }
  }
  const p = await sync({ base: s.url + '/taproc/index.php', peopleBase: s.url, cookie: s.cookie, delayMs: 0, now: update ? '2026-10-12T09:00:00' : '2026-10-10T09:00:00' });
  const out = update ? 'samples/mock-payload-2.json' : 'samples/mock-payload.json';
  fs.mkdirSync('samples', { recursive: true });
  fs.writeFileSync(out, JSON.stringify(p));
  console.log('Wrote ' + out, JSON.stringify(p.meta.counts), 'non-GET requests:', s.stats.nonGet.length);
  await s.close();
})();
