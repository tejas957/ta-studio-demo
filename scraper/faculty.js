'use strict';
/* Match the legacy professor strings ("LAST, F", sometimes truncated or with a doubled comma) to the people directory.
   Result per string: matched | truncated | ambiguous | unmatched, then a separate email status. Nothing is guessed:
   anything not "matched" goes on a review list for the office. */
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
function parseLegacy(s) {
  const t = String(s || '').replace(/,+/g, ',').trim(), i = t.indexOf(',');
  const last = (i < 0 ? t : t.slice(0, i)).trim(), init = (i < 0 ? '' : t.slice(i + 1)).trim();
  return { raw: s, last, init, key: norm(last) + '|' + norm(init).slice(0, 1) };
}
function dirParts(full) {
  const toks = String(full || '').replace(/\b(Dr|Prof|Professor)\.?\s+/i, '').trim().split(/\s+/);
  return { first: toks[0] || '', rest: toks.slice(1) };
}
function match(legacyStrings, directory) {
  const people = directory.map(d => { const p = dirParts(d.full); return { ...d, fi: norm(p.first).slice(0, 1), lastTok: norm(p.rest[p.rest.length - 1] || ''), restAll: norm(p.rest.join('')) }; });
  const out = {};
  for (const raw of new Set(legacyStrings)) {
    const L = parseLegacy(raw), ln = norm(L.last), fi = norm(L.init).slice(0, 1);
    const exact = people.filter(p => (p.lastTok === ln || p.restAll === ln) && (!fi || p.fi === fi));
    let hits = exact, status = 'matched';
    if (!hits.length && ln.length >= 5) { hits = people.filter(p => (p.lastTok.startsWith(ln) || p.restAll.startsWith(ln)) && (!fi || p.fi === fi)); status = 'truncated'; }
    if (hits.length > 1) status = 'ambiguous';
    if (!hits.length) status = 'unmatched';
    out[raw] = { legacy: raw, key: L.key, status, candidates: hits.map(h => ({ slug: h.slug, full: h.full })), pick: hits.length === 1 ? hits[0] : null };
  }
  return out;
}
module.exports = { match, parseLegacy, norm };
