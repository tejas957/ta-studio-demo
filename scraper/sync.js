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

/* A client that answers from a legacy-dump.json made by scraper/browser-dump.js in a signed-in browser tab. No network. */
function dumpClient(dump) {
  const P = dump.pages || {}, sent = [];
  return { sent, legacy: p => p, people: p => p, async get(p) {
    sent.push('GET ' + p);
    if (!(p in P)) throw new Error('404 for ' + p + ' (not in the dump)');
    if (/type="password"|You must be logged in/i.test(P[p])) throw new AuthError('The dump holds the login page for ' + p + '. Sign in again in that tab and re-run the browser pull.');
    return P[p];
  } };
}

async function sync(opt = {}) {
  const base = opt.base || routes.base, peopleBase = opt.peopleBase || routes.peopleBase;
  const D = opt.dump ? opt.dump.pages || {} : null;
  const R = D ? { ...routes, classes: D['@classes'] ? [D['@classes']] : routes.classes, applicants: D['@applicants'] ? [D['@applicants']] : routes.applicants,
    ugcaModal: id => (D['@ugcaModal'] || '/admin/proctor_applicant/') + id, commitments: D['@commitments'] || routes.commitments } : routes;
  if (D) opt.only = opt.only || 'courses,applicants';
  const c = D ? dumpClient(opt.dump) : client({ base, peopleBase, cookie: opt.cookie || process.env.LEGACY_COOKIE || '', delayMs: opt.delayMs == null ? 250 : opt.delayMs, log: opt.log || (() => {}) });
  const L = p => c.legacy(p);
  const prog = opt.progress || (() => {});
  const warnings = [];
  // opt.only = 'courses,applicants' reads the class lists, the applicant lists, each applicant's page and the commitment
  // list, and skips agreements, drafts (HR) and the faculty directory. Still GET only.
  const lean = !!opt.only && !/assign|draft|faculty|all/.test(String(opt.only));
  const first = async paths => { let last; for (const p of paths) { try { return await c.get(L(p)); } catch (e) { if (e instanceof AuthError) throw e; last = e; } } throw last; };

  prog('classes');
  const classes = parse.classes(await first(R.classes));
  if (!classes.ta.length) warnings.push('No TA classes found. Check the path in scraper/routes.js.');
  prog('applicants');
  const applicants = parse.applicants(await first(R.applicants));
  warnings.push(...applicants.warnings);

  const taDetails = {}, ugcaDetails = {};
  let i = 0;
  for (const a of applicants.ta) {
    prog('TA applicant ' + (++i) + '/' + applicants.ta.length);
    try { taDetails[a.id] = parse.taDetail(await c.get(L(R.applicant(a.id)))); } catch (e) { if (e instanceof AuthError) throw e; warnings.push('TA applicant ' + a.id + ': ' + e.message); }
  }
  i = 0;
  for (const u of applicants.ugca) {
    prog('UGCA applicant ' + (++i) + '/' + applicants.ugca.length);
    try { ugcaDetails[u.id] = parse.ugcaModal(await c.get(L(R.ugcaModal(u.id)))); } catch (e) { if (e instanceof AuthError) throw e; warnings.push('UGCA applicant ' + u.id + ': ' + e.message); }
  }
  let notify = null, drafts = null, commitments = null;
  prog('commitment students');
  try { commitments = parse.commitments(await c.get(L(R.commitments))); if (!commitments) warnings.push('Commitment students page has no table with EID and expiry; the yellow row color is used instead.'); } catch (e) { if (e instanceof AuthError) throw e; warnings.push('Commitment students page not read (' + e.message + '); the yellow row color is used instead.'); }
  let directory = [], emails = {};
  if (!lean) {
  prog('agreements');
  try { notify = parse.notify(await c.get(L(R.notify))); } catch (e) { if (e instanceof AuthError) throw e; warnings.push('Agreement table not read (' + e.message + '). Assignments will come from the applicant list only.'); }
  prog('draft');
  try { drafts = parse.drafts(await c.get(L(R.assignments))); } catch (e) { if (e instanceof AuthError) throw e; warnings.push('Draft page not read: ' + e.message); }

  // faculty directory
  prog('faculty directory');
  try {
    directory = parse.people(await c.get(c.people(R.people)));
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
  } else warnings.push('Courses and applicants only: current assignments, HR draft and professor emails were not read.');

  const payload = buildPayload({ classes, applicants, taDetails, ugcaDetails, notify, drafts, commitments, directory, emails, warnings, term: opt.term || classes.term, now: opt.now });
  payload.meta.requests = c.sent.length;
  payload.meta.nonGetRequests = c.sent.filter(x => !x.startsWith('GET ')).length;
  return payload;
}
module.exports = { sync, AuthError };

if (require.main === module) {
  const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ''; };
  const out = arg('--out') || path.join('sync', 'payload.json');
  if (process.argv.includes('--probe')) {
    // Saves the class and applicant pages as they come back, to sync/probe/ (git-ignored, stays on this computer),
    // so the parsers can be matched to the real markup. GET only, two pages.
    const { client } = require('./http');
    const c = client({ base: routes.base, peopleBase: routes.peopleBase, cookie: process.env.LEGACY_COOKIE || '' });
    const dir = path.join('sync', 'probe'); fs.mkdirSync(dir, { recursive: true });
    (async () => {
      for (const [name, p] of [['classes', routes.classes[0]], ['applicants', routes.applicants[0]]]) {
        try { const t = await c.get(c.legacy(p)); fs.writeFileSync(path.join(dir, name + '.html'), t); console.error('saved ' + name + ' (' + t.length + ' bytes)'); }
        catch (e) { console.error(name + ': ' + e.message); }
      }
      console.error('Done. ' + c.sent.length + ' GET requests, 0 changes made.');
    })();
    return;
  }
  if (process.argv.includes('--dump')) {
    const file = arg('--dump').replace(/^~(?=\/)/, require('os').homedir());
    let dump; try { dump = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error('Could not read ' + file + ': ' + e.message); process.exit(2); }
    if (!dump || dump.meta?.source !== 'legacy-browser-dump') { console.error(file + ' is not a legacy-dump.json from scraper/browser-dump.js'); process.exit(2); }
    sync({ dump, only: arg('--only') }).then(p => {
      fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(p));
      const fl = dump.meta.fails || {}, nFail = Object.keys(fl).length;
      console.error('Wrote ' + out + ' ' + JSON.stringify(p.meta.counts) + ', ' + p.meta.warnings.length + ' warnings. The browser made ' + dump.meta.requests + ' GET requests (' + nFail + ' failed), nothing changed.');
      console.error('Pages found: classes ' + (dump.pages['@classes'] || 'NOT FOUND') + ', applicants ' + (dump.pages['@applicants'] || 'NOT FOUND') + ', UGCA pop-up ' + (dump.pages['@ugcaModal'] || 'NOT FOUND') + ', commitment list ' + (dump.pages['@commitments'] || 'NOT FOUND'));
      if (p.meta.warnings.length) console.error('First warnings (no names):\n  ' + [...new Set(p.meta.warnings.map(w => w.replace(/\d{3,}/g, '#').replace(/: .{0,40}$/, ': …')))].slice(0, 8).join('\n  '));
      if (!p.meta.counts.sections || !(p.meta.counts.taApplicants + p.meta.counts.ugcaApplicants)) { console.error('Nothing usable yet: paste these lines to Claude.'); process.exit(1); }
      console.error('Next: open index.html, Setup > Load a sync file > ' + out);
    }).catch(e => { console.error('Failed: ' + e.message); process.exit(1); });
    return;
  }
  if (!process.env.LEGACY_COOKIE) { console.error('Set LEGACY_COOKIE first (the session cookie of a signed-in browser). See docs/INTEGRATION.md.'); process.exit(2); }
  sync({ only: arg('--only'), progress: s => process.stderr.write('\r' + s.padEnd(50)) }).then(p => {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(p));
    console.error('\nWrote ' + out + ' ' + JSON.stringify(p.meta.counts) + ', ' + p.meta.warnings.length + ' warnings, ' + p.meta.requests + ' GET requests, ' + p.meta.nonGetRequests + ' changes made.');
    if (p.meta.warnings.length) console.error('First warnings (no names):\n  ' + p.meta.warnings.slice(0, 8).map(w => w.replace(/: .{0,40}$/, ': …')).join('\n  '));
  }).catch(e => { console.error('\n' + (e instanceof AuthError ? 'Sign-in needed: ' : 'Failed: ') + e.message); process.exit(1); });
}
