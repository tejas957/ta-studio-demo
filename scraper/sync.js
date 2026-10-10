'use strict';
/* Read-only sync. Reads the legacy app and the CS people directory, writes one payload file for the app.
   It sends GET requests only. It never submits a form (Update, Notify applicants, Remove from pool).
     LEGACY_COOKIE='ci_session=...' node scraper/sync.js --out sync/payload.json
   The payload holds real student data when pointed at the real app: keep it out of git (sync/ is ignored). */
const fs = require('fs');
const path = require('path');
const routes = require('./routes');
const { client, AuthError } = require('./http');
const parse = require('./parse');
const { match, parseLegacy } = require('./faculty');
const { buildPayload } = require('./build');

async function sync(opt = {}) {
  const base = opt.base || routes.base, peopleBase = opt.peopleBase || routes.peopleBase;
  const c = client({ base, peopleBase, cookie: opt.cookie || process.env.LEGACY_COOKIE || '', delayMs: opt.delayMs == null ? 250 : opt.delayMs, log: opt.log || (() => {}) });
  const L = p => c.legacy(p);
  const prog = opt.progress || (() => {});
  const warnings = [];
  const first = async paths => { let last; for (const p of paths) { try { return await c.get(L(p)); } catch (e) { if (e instanceof AuthError) throw e; last = e; } } throw last; };

  prog('classes');
  const classes = parse.classes(await first(routes.classes));
  if (!classes.ta.length) warnings.push('No TA classes found. Check the path in scraper/routes.js.');
  prog('applicants');
  const applicants = parse.applicants(await first(routes.applicants));
  warnings.push(...applicants.warnings);

  const taDetails = {}, ugcaDetails = {};
  let i = 0;
  for (const a of applicants.ta) {
    prog('TA applicant ' + (++i) + '/' + applicants.ta.length);
    try { taDetails[a.id] = parse.taDetail(await c.get(L(routes.applicant(a.id)))); } catch (e) { if (e instanceof AuthError) throw e; warnings.push('TA applicant ' + a.id + ': ' + e.message); }
  }
  i = 0;
  for (const u of applicants.ugca) {
    prog('UGCA applicant ' + (++i) + '/' + applicants.ugca.length);
    try { ugcaDetails[u.id] = parse.ugcaModal(await c.get(L(routes.ugcaModal(u.id)))); } catch (e) { if (e instanceof AuthError) throw e; warnings.push('UGCA applicant ' + u.id + ': ' + e.message); }
  }
  let notify = null, drafts = null;
  prog('agreements');
  try { notify = parse.notify(await c.get(L(routes.notify))); } catch (e) { if (e instanceof AuthError) throw e; warnings.push('Agreement table not read (' + e.message + '). Assignments will come from the applicant list only.'); }
  prog('draft');
  try { drafts = parse.drafts(await c.get(L(routes.assignments))); } catch (e) { if (e instanceof AuthError) throw e; warnings.push('Draft page not read: ' + e.message); }

  // faculty directory
  prog('faculty directory');
  let directory = [], emails = {};
  try {
    directory = parse.people(await c.get(c.people(routes.people)));
    if (directory.length < 20) warnings.push('The people page returned only ' + directory.length + ' names. It may be paged: add the other pages in scraper/routes.js.');
    const profs = [...new Set(classes.ta.concat(classes.proctor).map(x => x.prof))];
    const m = match(profs, directory);
    const slugs = [...new Set(Object.values(m).filter(x => x.pick).map(x => x.pick.slug))];
    let k = 0;
    for (const s of slugs) {
      prog('faculty profile ' + (++k) + '/' + slugs.length);
      try { emails[s] = parse.profile(await c.get(c.people((directory.find(d => d.slug === s).href || '').replace(/^https?:\/\/[^/]+/, '')))).email; } catch (e) { warnings.push('Profile ' + s + ': ' + e.message); }
    }
  } catch (e) { warnings.push('Faculty directory not read: ' + e.message); }

  const payload = buildPayload({ classes, applicants, taDetails, ugcaDetails, notify, drafts, directory, emails, warnings, term: opt.term, now: opt.now });
  payload.meta.requests = c.sent.length;
  payload.meta.nonGetRequests = c.sent.filter(x => !x.startsWith('GET ')).length;
  return payload;
}
module.exports = { sync, AuthError };

if (require.main === module) {
  const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ''; };
  const out = arg('--out') || path.join('sync', 'payload.json');
  if (!process.env.LEGACY_COOKIE) { console.error('Set LEGACY_COOKIE first (the session cookie of a signed-in browser). See docs/INTEGRATION.md.'); process.exit(2); }
  sync({ progress: s => process.stderr.write('\r' + s.padEnd(50)) }).then(p => {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(p));
    console.error('\nWrote ' + out + ' ' + JSON.stringify(p.meta.counts) + ', ' + p.meta.warnings.length + ' warnings, ' + p.meta.requests + ' GET requests, 0 changes made.');
  }).catch(e => { console.error('\n' + (e instanceof AuthError ? 'Sign-in needed: ' : 'Failed: ') + e.message); process.exit(1); });
}
