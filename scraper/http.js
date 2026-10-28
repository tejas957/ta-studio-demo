'use strict';
/* Read-only HTTP client. It can only send GET. It refuses any host except the two it was given, and it never sends the
   legacy cookie to the people directory. A login page means the cookie is missing or expired, and stops the run. */
class AuthError extends Error {}
function client({ base, peopleBase, cookie, delayMs = 0, fetchImpl = fetch, log = () => {} }) {
  const baseOrigin = new URL(base).origin, peopleOrigin = peopleBase ? new URL(peopleBase).origin : null;
  const sent = [];
  // Cookie jar for the legacy host only: starts from LEGACY_COOKIE and takes any cookie the server refreshes.
  const jar = new Map();
  String(cookie || '').split(';').map(x => x.trim()).filter(Boolean).forEach(x => { const i = x.indexOf('='); if (i > 0) jar.set(x.slice(0, i), x.slice(i + 1)); });
  const absorb = r => {
    const list = r.headers && typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
    list.forEach(h => { const kv = h.split(';')[0], i = kv.indexOf('='); if (i > 0) { const k = kv.slice(0, i).trim(), v = kv.slice(i + 1).trim(); if (/^deleted$/i.test(v) || /max-age=0/i.test(h)) jar.delete(k); else jar.set(k, v); } });
  };
  let last = 0;
  async function get(url, opt = {}) {
    const u = new URL(url);
    const legacy = u.origin === baseOrigin;
    if (!legacy && u.origin !== peopleOrigin) throw new Error('Refused: ' + u.origin + ' is not one of the two allowed hosts');
    const wait = last + delayMs - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    last = Date.now();
    // LEGACY_UA: the browser's own User-Agent, for when the site's Cloudflare check ties the session to the browser.
    const once = async (target) => {
      const headers = { 'User-Agent': process.env.LEGACY_UA || 'ta-studio-sync (read-only)' };
      if (legacy && jar.size) headers.Cookie = [...jar].map(([k, v]) => k + '=' + v).join('; ');
      let r;
      try { r = await fetchImpl(target.href, { method: 'GET', headers, redirect: 'manual' }); }
      catch (e) { // a kept-alive connection the server already closed: a GET can safely be repeated once
        const code = e && e.cause && e.cause.code;
        if (!['ECONNRESET', 'UND_ERR_SOCKET', 'EPIPE'].includes(code)) throw e;
        r = await fetchImpl(target.href, { method: 'GET', headers, redirect: 'manual' });
      }
      sent.push('GET ' + target.pathname + target.search);
      log('GET ' + target.pathname);
      if (legacy) absorb(r);
      return r;
    };
    let res = await once(u), hops = 0;
    // The legacy app sometimes refreshes the session and redirects back to the same page. Follow that (GET only,
    // same host, at most 5 times) with the refreshed cookie. A redirect to the login page still stops the run.
    while (res.status >= 300 && res.status < 400) {
      const to = res.headers.get('location') || '';
      if (/login/i.test(to)) throw new AuthError('Not signed in (redirected to login). Set LEGACY_COOKIE to a fresh session cookie.');
      const next = new URL(to, u.href);
      if (next.origin !== u.origin || ++hops > 5) throw new Error('Unexpected redirect to ' + to);
      res = await once(next);
    }
    if (res.status === 403 && legacy && /cf-|cloudflare|challenge/i.test(res.headers.get('server') || '') ) throw new AuthError('Blocked by the site\'s Cloudflare check. Set LEGACY_UA to your browser\'s User-Agent (same Request Headers section) and try again.');
    if (!res.ok) throw new Error(res.status + ' for ' + u.pathname);
    const text = await res.text();
    if (legacy && /type="password"|You must be logged in/i.test(text)) throw new AuthError('The login form came back instead of the page. Set LEGACY_COOKIE to a fresh session cookie.');
    return opt.raw ? { text, type: res.headers.get('content-type') } : text;
  }
  return { get, sent, legacy: p => base.replace(/\/$/, '') + p, people: p => peopleBase.replace(/\/$/, '') + p };
}
module.exports = { client, AuthError };
