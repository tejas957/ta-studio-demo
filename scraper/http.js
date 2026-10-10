'use strict';
/* Read-only HTTP client. It can only send GET. It refuses any host except the two it was given, and it never sends the
   legacy cookie to the people directory. A login page means the cookie is missing or expired, and stops the run. */
class AuthError extends Error {}
function client({ base, peopleBase, cookie, delayMs = 0, fetchImpl = fetch, log = () => {} }) {
  const baseOrigin = new URL(base).origin, peopleOrigin = peopleBase ? new URL(peopleBase).origin : null;
  const sent = [];
  let last = 0;
  async function get(url, opt = {}) {
    const u = new URL(url);
    const legacy = u.origin === baseOrigin;
    if (!legacy && u.origin !== peopleOrigin) throw new Error('Refused: ' + u.origin + ' is not one of the two allowed hosts');
    const wait = last + delayMs - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    last = Date.now();
    const headers = { 'User-Agent': 'ta-studio-sync (read-only)' };
    if (legacy && cookie) headers.Cookie = cookie;
    let res;
    try { res = await fetchImpl(u.href, { method: 'GET', headers, redirect: 'manual' }); }
    catch (e) { // a kept-alive connection the server already closed: a GET can safely be repeated once
      const code = e && e.cause && e.cause.code;
      if (!['ECONNRESET', 'UND_ERR_SOCKET', 'EPIPE'].includes(code)) throw e;
      res = await fetchImpl(u.href, { method: 'GET', headers, redirect: 'manual' });
    }
    sent.push('GET ' + u.pathname + u.search);
    log('GET ' + u.pathname);
    if (res.status >= 300 && res.status < 400) {
      const to = res.headers.get('location') || '';
      if (/login/i.test(to)) throw new AuthError('Not signed in (redirected to login). Set LEGACY_COOKIE to a fresh session cookie.');
      throw new Error('Unexpected redirect to ' + to);
    }
    if (!res.ok) throw new Error(res.status + ' for ' + u.pathname);
    const text = await res.text();
    if (legacy && /type="password"/i.test(text)) throw new AuthError('The login form came back instead of the page. Set LEGACY_COOKIE to a fresh session cookie.');
    return opt.raw ? { text, type: res.headers.get('content-type') } : text;
  }
  return { get, sent, legacy: p => base.replace(/\/$/, '') + p, people: p => peopleBase.replace(/\/$/, '') + p };
}
module.exports = { client, AuthError };
