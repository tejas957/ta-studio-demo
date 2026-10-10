/* End-to-end test: mock legacy site -> read-only scraper -> sync file -> the app in jsdom.
   Everything is fake data. Usage: node tests/live.js index.html */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const { start } = require('../mock-legacy/server');
const { sync, AuthError } = require('../scraper/sync');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

(async () => {
  const srv = await start();
  const base = srv.url + '/taproc/index.php', opt = { base, peopleBase: srv.url, cookie: srv.cookie, delayMs: 0, now: '2026-10-10T09:00:00' };

  // ---- scraper ----
  const p = await sync(opt);
  const c = p.meta.counts;
  ok(c.taApplicants === 166 && c.ugcaApplicants === 264, 'scraper read 166 TA and 264 UGCA applicants');
  ok(c.taClasses === 118 && c.proctorClasses === 101, 'scraper read 118 TA classes and 101 proctor classes');
  ok(c.assignments === 78, 'scraper read 78 current assignments');
  const lgTA = Object.values(p.ext.lg).filter(x => x.kind === 'TA'), by = k => lgTA.filter(x => x.color === k).length;
  ok(by('commitment') === 65 && by('other_support') === 49 && by('declined') === 1 && by('other') === 1, 'row colors: 65 yellow, 49 blue, 1+1 red');
  ok(srv.stats.nonGet.length === 0 && srv.stats.notify === 0, 'scraper sent only GET requests and never notified anyone');
  ok(p.meta.nonGetRequests === 0 && p.meta.requests > 400, 'scraper reports ' + p.meta.requests + ' reads and 0 changes');
  ok(p.hr_baseline && p.hr_baseline.n === 15 && p.hr_baseline.rows.length === 78, 'HR baseline is draft 15 with 78 rows (all matched)');
  ok(p.meta.facultyReview.some(r => r.status === 'ambiguous') && p.meta.facultyReview.some(r => r.status === 'unmatched'), 'faculty review list has ambiguous and unmatched professors');
  ok(p.users.filter(u => u.email).length >= 60, 'most professors got an email from their directory profile');
  ok(!JSON.stringify(p).includes('MOCKTOKEN'), 'the csrf token is not in the payload');
  const agreeSent = Object.values(p.ext.lg).filter(x => /^Sent:/.test(x.agree)).length;
  ok(agreeSent === 1, 'one agreement is "Sent:" (waiting for the student)');
  let authErr = null; try { await sync({ ...opt, cookie: 'ci_session=wrong' }); } catch (e) { authErr = e; }
  ok(authErr instanceof AuthError, 'wrong cookie stops with a sign-in error');
  ok(srv.stats.loginRedirects > 0, 'the mock saw the login redirect');
  const cookieLeak = []; // the cookie must not go to the people host: the mock serves people pages without auth, so check the client
  const http = require('../scraper/http'); const seen = [];
  const cl = http.client({ base, peopleBase: 'http://localhost:1/', cookie: 'x=1', fetchImpl: async (u, o) => { seen.push([u, o.headers.Cookie]); return { status: 200, ok: true, headers: { get: () => 'text/html' }, text: async () => '<html></html>' }; } });
  await cl.get(cl.people('/people')); await cl.get(cl.legacy('/admin/classes'));
  ok(seen[0][1] === undefined && seen[1][1] === 'x=1', 'cookie is sent to the legacy host only');
  let refused = false; try { await cl.get('https://example.com/'); } catch (e) { refused = true; }
  ok(refused, 'any other host is refused');

  // ---- app ----
  const html = fs.readFileSync(process.argv[2], 'utf8');
  const errs = []; const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/scrollTo/.test(String(e))) errs.push(String(e.stack || e)); }); vc.on('error', e => errs.push(String(e)));
  const dom = new JSDOM('<!doctype html><html><body>' + html + '</body></html>', { runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true });
  const w = dom.window; w.scrollTo = () => {};
  const T = w.__ta, A = T.ACT, S = () => T.state(), txt = () => w.document.body.textContent, main = () => w.document.querySelector('main').innerHTML;
  const load = obj => T.loadFeed(w.JSON.parse(JSON.stringify(obj)));
  load(p);
  ok(T.live(), 'app is in live mode');
  ok(!/Candidate Cedar|Atlas/.test(main()), 'no demo people on the dashboard');
  ['dashboard', 'windows', 'assign', 'applicants', 'publish', 'hr', 'students', 'concerns', 'mail', 'setup', 'audit'].forEach(t => { A.tab(t); ok(main().length > 20, 'live tab renders: ' + t); });
  const st = S();
  ok(st.hr.drafts.length === 1 && st.hr.drafts[0].n === 15 && st.hr.drafts[0].rows.length === 78, 'HR draft 15 is the legacy baseline');
  A.tab('hr'); ok(/new_return/.test(w.document.getElementById('hrCsv').value), 'HR spreadsheet has the New/Return, Degree, AI, GPA columns');
  ok(st.pubs.length === 0 && st.draft.rows.length === 78, 'no publications; 78 legacy assignments are the working draft');
  const lg = T.lg(), blue = Object.keys(lg).filter(a => lg[a].color === 'other_support');
  ok(blue.length === 49 && blue.every(a => st.gra.has(a)), 'all 49 blue applicants are excluded like the GRA list');
  const red = Object.keys(lg).filter(a => lg[a].color === 'declined' || lg[a].color === 'other');
  ok(red.length === 2, 'two red applicants');
  const g = T.gate();
  const must = g.iss.filter(i => i.code === 'Must place');
  const commitUnplaced = Object.keys(lg).filter(a => lg[a].color === 'commitment' && !st.draft.rows.some(r => r.app === a));
  ok(must.length === commitUnplaced.length && must.length > 0, 'every unplaced yellow applicant raises "Must place" (' + must.length + ')');
  ok(g.missing.length >= must.length, 'Must place needs an override note before publishing');
  ok(g.blocks.length === 0, 'the legacy assignments themselves have no blocking problems (' + g.blocks.length + ')');
  const home = T.needsHome();
  ok(home.length > 0 && lg[home[0]].color === 'commitment', 'the placement queue starts with a commitment student');
  A.tab('assign'); const firstCourse = st.selCourse; A.goCourse(firstCourse); ok(/Must place|Has a GRA|Commitment/.test(main()) || main().length > 500, 'workspace renders for first course with applicants');
  // every course renders
  let bad = 0; st.course && Object.keys(st.course).forEach(id => { A.goCourse(id); if (main().length < 300) bad++; });
  ok(bad === 0, 'workspace renders for all ' + Object.keys(st.course).length + ' sections');
  // chips
  A.tab('applicants'); ok(/Commitment student/.test(main()) && /Has a GRA/.test(main()), 'applicant list shows Commitment student and Has a GRA chips');
  // GRA paste by EID and by name, and a blue one is not duplicated
  const plain = Object.keys(lg).filter(a => lg[a].kind === 'TA' && !lg[a].color)[0], plain2 = Object.keys(lg).filter(a => lg[a].kind === 'TA' && !lg[a].color)[1];
  const nmOf = a => st.hr && w.document ? null : null;
  const l1 = lg[plain], l2 = lg[plain2];
  const textBox = l1.eid + '\n' + l2.last + ', ' + l2.first + '\nNobody Atall';
  w.document.getElementById('graText') && (w.document.getElementById('graText').value = textBox);
  A.applyGra(); const gr = S().graResult;
  ok(gr.matched.includes(plain) && gr.matched.includes(plain2) && gr.unmatched.length === 1, 'GRA paste matched by EID and by "Last, First", one name matched nobody');
  ok(gr.fromLegacy.length === 49, 'blue rows are still excluded after a paste');
  ok(S().gra.size === 51, 'GRA set is the 2 pasted plus the 49 blue');
  A.graBack(blue[0]); A.applyGra(); ok(!S().gra.has(blue[0]), 'a blue applicant added back stays in the pool after another paste');
  // faculty email in the outbox
  A.tab('windows');
  const facs = w.JSON.parse(JSON.stringify(p.users));
  const withMail = facs.find(u => u.email), noMail = facs.find(u => !u.email);
  A.openWin(withMail.faculty_id); A.openWin(noMail.faculty_id);
  const out = S().outbox;
  ok(out.some(m => m.address === withMail.email), 'window email goes to the professor\'s directory address');
  ok(out.some(m => /NO EMAIL FOUND/.test(m.address)), 'a professor without an email is clearly marked in the outbox');
  // refresh keeps work
  const row = S().draft.rows[0]; A.setNote(row.id, '', 'kept note');
  A.setAlloc && 0;
  const nBefore = Object.keys(lg).length;
  srv.addLateApplicant();
  const p2 = await sync(opt);
  const r = T.refreshFeed(w.JSON.parse(JSON.stringify(p2)));
  ok(r.fresh === 1 && Object.keys(T.lg()).length === nBefore + 1, 'a late applicant arrives on refresh');
  ok(S().draft.rows.find(x => x.id === row.id).note === 'kept note', 'refresh keeps the office\'s notes');
  ok(S().sync.newApps.length === 1, 'the new applicant is marked New');
  ok(S().win[withMail.faculty_id].state === 'open', 'refresh keeps open ranking windows');
  A.tab('applicants'); ok(/New from legacy app/.test(main()), 'new applicant is labeled');
  // bad files
  let e1 = null; try { T.loadFeed({ foo: 1 }); } catch (e) { e1 = e; } ok(e1 && /not a sync file/.test(e1.message), 'a wrong file is rejected with a plain message');
  ok(txt().length > 0 && errs.length === 0, 'no script errors in the app' + (errs.length ? ': ' + errs[0].slice(0, 200) : ''));
  ok(srv.stats.nonGet.length === 0, 'still no non-GET requests after the refresh');
  await srv.close();
  console.log(fails ? fails + ' FAILED' : 'all live checks passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
