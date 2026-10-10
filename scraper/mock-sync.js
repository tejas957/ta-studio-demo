'use strict';
/* Runs the scraper against the fake legacy site and writes samples/mock-payload.json (fake data only).
   Load that file in Setup > Data source to see the app in live mode without touching the real app. */
const fs = require('fs');
const { start } = require('../mock-legacy/server');
const { sync } = require('./sync');
(async () => {
  const s = await start();
  const p = await sync({ base: s.url + '/taproc/index.php', peopleBase: s.url, cookie: s.cookie, delayMs: 0, now: '2026-10-10T09:00:00' });
  fs.mkdirSync('samples', { recursive: true });
  fs.writeFileSync('samples/mock-payload.json', JSON.stringify(p));
  console.log('Wrote samples/mock-payload.json', JSON.stringify(p.meta.counts), 'non-GET requests:', s.stats.nonGet.length);
  await s.close();
})();
