'use strict';
/* Mock of the legacy TA app and the CS people directory. Fake data only.
   It records anything that is not a GET so tests can prove the scraper never changes or emails anything. */
const http = require('http');
const { build } = require('./gen');
const { make } = require('./pages');
const COOKIE = 'ci_session=mock-session';

function start(opts = {}) {
  const db = build(opts.seed);
  db.laterOn = false;
  const stats = { gets: [], nonGet: [], notify: 0, loginRedirects: 0 };
  let origin = '';
  let pages = null;
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), p = u.pathname, B = '/taproc/index.php';
    const send = (code, type, body) => { res.writeHead(code, { 'Content-Type': type + '; charset=utf-8' }); res.end(body); };
    if (req.method !== 'GET') {
      stats.nonGet.push(req.method + ' ' + p);
      if (p === B + '/admin/assignment_notifiy') stats.notify++;
      req.resume(); return send(200, 'text/html', 'ok');
    }
    stats.gets.push(p + u.search);
    if (p.startsWith('/assets/css/')) return send(200, 'text/css', p.endsWith('bg_colors.css') ? pages.css : '/* css */');
    if (p === '/people') return send(200, 'text/html', pages.peoplePage());
    const pm = p.match(/^\/people\/faculty-researchers\/([a-z-]+)$/);
    if (pm) { const f = db.faculty.find(x => x.slug === pm[1]); return f ? send(200, 'text/html', pages.profilePage(f)) : send(404, 'text/html', 'not found'); }
    if (p === B + '/login') return send(200, 'text/html', pages.loginPage());
    if (!p.startsWith(B + '/admin')) return send(404, 'text/html', 'not found');
    if (!opts.noAuth && !(req.headers.cookie || '').includes(COOKIE)) { stats.loginRedirects++; res.writeHead(302, { Location: origin + B + '/login' }); return res.end(); }
    const a = p.slice((B + '/admin').length);
    let m;
    if (a === '/classes') return send(200, 'text/html', pages.classesPage());
    if (a === '/applicants') return send(200, 'text/html', pages.applicantsPage());
    if ((m = a.match(/^\/applicant\/(\d+)$/))) { const t = pages.taAll().find(x => x.id === +m[1]); return t ? send(200, 'text/html', pages.taDetail(t)) : send(404, 'text/html', 'no'); }
    if ((m = a.match(/^\/proctor_applicant\/(\d+)$/))) { const x = db.ugca.find(y => y.id === +m[1]); return x ? send(200, 'text/html', pages.ugcaModal(x)) : send(404, 'text/html', 'no'); }
    if ((m = a.match(/^\/course\/(\d+)$/))) { const c = db.classes.find(y => y.id === +m[1]); return c ? send(200, 'text/html', pages.coursePage(c)) : send(404, 'text/html', 'no'); }
    if (a === '/assignments') return send(200, 'text/html', pages.assignmentsPage(+u.searchParams.get('draft') || undefined));
    if (a === '/assignments/download') return send(200, 'text/csv', pages.draftCsv(+u.searchParams.get('draft') || db.draftNo));
    if (a === '/assignment_notify') return send(200, 'text/html', pages.notifyPage());
    return send(404, 'text/html', 'not found');
  });
  return new Promise(resolve => server.listen(opts.port || 0, '127.0.0.1', () => {
    origin = 'http://127.0.0.1:' + server.address().port;
    pages = make(db, origin);
    resolve({ url: origin, db, stats, cookie: COOKIE, close: () => new Promise(r => server.close(r)), addLateApplicant() { db.laterOn = true; } });
  }));
}
module.exports = { start, COOKIE };
if (require.main === module) start({ port: +process.argv[2] || 8787 }).then(s => console.log('mock legacy app on ' + s.url + '/taproc/index.php/admin/applicants  (cookie: ' + COOKIE + ')'));
