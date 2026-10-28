/* TA Studio: read-only pull that runs inside your signed-in browser tab.
   How: open any TA app admin page (signed in), open DevTools (Option-Command-I) > Console, paste this whole file, press Enter.
   It only sends GET requests to this same site (it never submits a form), then downloads legacy-dump.json to your
   Downloads folder. Then on your Mac:  npm run sync:dump
   The file holds real student data: it stays on your computer. Delete it when you are done. */
(async () => {
  'use strict';
  const BASE = location.origin + '/taproc/index.php';
  if (!/apps\.cs\.utexas\.edu$/.test(location.hostname) && !window.__TA_DUMP_TEST) { console.error('Open a TA app page on apps.cs.utexas.edu first.'); return; }
  const pages = {}, fails = {}, log = (...a) => console.log('%c[TA Studio]', 'color:#1d5a49;font-weight:bold', ...a);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rel = u => { const x = new URL(u, location.href); return x.origin === location.origin ? x.pathname.replace(/^\/taproc\/index\.php/, '') + x.search : null; };
  let n = 0;
  async function get(path) {
    if (path in pages) return pages[path];
    const url = BASE + path;
    if (new URL(url).origin !== location.origin) throw new Error('refused other host');
    await sleep(120); n++;
    const r = await fetch(url, { method: 'GET', credentials: 'same-origin', redirect: 'follow', cache: 'no-store' });
    const t = await r.text();
    if (!r.ok) { fails[path] = r.status; throw new Error(r.status + ' ' + path); }
    if (/You must be logged in|type="password"/i.test(t)) { fails[path] = 'login'; throw new Error('Not signed in: ' + path); }
    pages[path] = t; return t;
  }
  const doc = t => new DOMParser().parseFromString(t, 'text/html');
  const headsOf = d => [...d.querySelectorAll('table')].map(tb => [...tb.querySelectorAll('thead th, tr:first-child th')].map(th => th.textContent.trim().toLowerCase()));
  const hasTable = (t, want) => headsOf(doc(t)).some(h => want.every(w => h.includes(w)));

  // 0. this page, its nav links and the admin scripts (to find real page addresses)
  pages['@here'] = document.documentElement.outerHTML; pages['@here:path'] = rel(location.href) || '';
  const navLinks = [...new Set([...document.querySelectorAll('a[href]')].map(a => rel(a.href)).filter(p => p && /^\/admin/.test(p)))];
  pages['@nav'] = JSON.stringify(navLinks);
  for (const s of [...document.querySelectorAll('script[src]')].map(s => s.src).filter(s => /admin|app\.js/i.test(s) && new URL(s).origin === location.origin)) {
    try { pages['@script:' + new URL(s).pathname] = await (await fetch(s, { credentials: 'same-origin' })).text(); } catch (e) {}
  }
  // 1. classes and applicants: try the known address, then any nav link that looks right
  async function find(name, known, re, want) {
    const cands = [...new Set(known.concat(navLinks.filter(p => re.test(p))))];
    for (const p of cands) { try { const t = await get(p); if (hasTable(t, want)) { pages['@' + name] = p; log(name + ': ' + p); return t; } } catch (e) { if (/Not signed in/.test(e.message)) throw e; } }
    log(name + ': page not found (tried ' + cands.join(', ') + ')'); return null;
  }
  try {
    const cls = await find('classes', ['/admin/classes', '/admin'], /class/i, ['id', 'course', 'prof']);
    const apps = await find('applicants', ['/admin/applicants'], /applicant/i, ['name', 'eid']);
    if (apps) {
      const d = doc(apps);
      const ta = [...new Set([...d.querySelectorAll('a[href]')].map(a => (a.getAttribute('href').match(/applicant\/(\d+)/) || [])[1]).filter(Boolean))];
      const ug = [...new Set([...d.querySelectorAll('a.proctor-view[data-record], [data-record].proctor-view')].map(a => a.getAttribute('data-record')))];
      log(ta.length + ' TA and ' + ug.length + ' UGCA applicants. Reading each one (about ' + Math.ceil((ta.length + ug.length) * 0.2 / 60) + ' min)...');
      let k = 0;
      for (const id of ta) { try { await get('/admin/applicant/' + id); } catch (e) { if (/Not signed in/.test(e.message)) throw e; } if (++k % 25 === 0) log('TA ' + k + '/' + ta.length); }
      // UGCA pop-up: the address is a guess, so test it on the first one before trying them all
      const modalPaths = ['/admin/proctor_applicant/', '/admin/proctor/', '/admin/proctor_view/', '/admin/ugca_applicant/'];
      let mp = null;
      if (ug.length) for (const p of modalPaths) { try { const t = await get(p + ug[0]); if (/modal|Requested courses/i.test(t)) { mp = p; break; } } catch (e) { if (/Not signed in/.test(e.message)) throw e; } }
      pages['@ugcaModal'] = mp || '';
      if (mp) { k = 0; for (const id of ug) { try { await get(mp + id); } catch (e) { if (/Not signed in/.test(e.message)) throw e; } if (++k % 50 === 0) log('UGCA ' + k + '/' + ug.length); } }
      else if (ug.length) log('UGCA pop-up address not found; UGCA course requests will be missing. The admin script is saved so it can be fixed.');
    }
    for (const p of ['/admin/commitment_students', '/admin/commitments', '/admin/commitment']) { try { await get(p); pages['@commitments'] = p; break; } catch (e) { if (/Not signed in/.test(e.message)) throw e; } }
  } catch (e) { log('Stopped: ' + e.message + '. Sign in again in this tab and re-run.'); }
  const out = { meta: { source: 'legacy-browser-dump', at: new Date().toISOString(), base: BASE, requests: n, method: 'GET only', fails }, pages };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' })); a.download = 'legacy-dump.json'; document.body.appendChild(a); a.click(); a.remove();
  log('Done: ' + n + ' GET requests, nothing changed. legacy-dump.json is in your Downloads folder. Next, in Terminal: npm run sync:dump');
})();
