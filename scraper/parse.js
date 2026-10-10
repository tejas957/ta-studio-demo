'use strict';
/* Page parsers. Each takes HTML text and returns plain objects. They find things by header text, row class and
   link pattern, not by position, so a small layout change in the legacy app does not break them. */
const cheerio = require('cheerio');
const clean = s => String(s == null ? '' : s).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const idFrom = (href, re) => { const m = String(href || '').match(re); return m ? +m[1] : null; };

function tableByHeaders($, wanted) {
  let hit = null;
  $('table').each((_, t) => {
    const heads = $(t).find('thead th, tr:first-child th').map((__, th) => clean($(th).text()).toLowerCase()).get();
    if (!hit && wanted.every(w => heads.includes(w.toLowerCase()))) hit = { table: $(t), heads };
  });
  return hit;
}
const numOf = s => { const m = String(s).match(/-?\d+(\.\d+)?/); return m ? +m[0] : 0; };
const splitLabel = s => { const t = clean(s); const m = t.match(/^(\S+)\s+(.*)$/); return m ? { number: m[1], title: m[2] } : { number: t, title: '' }; };

/* ----- classes ----- */
function classes(html) {
  const $ = cheerio.load(html);
  const out = { ta: [], proctor: [] };
  const ta = tableByHeaders($, ['Id', 'Course', 'Prof', 'TAs Needed']);
  if (ta) ta.table.find('tbody tr').each((_, tr) => {
    const td = $(tr).children('td'); if (td.length < 4) return;
    const label = clean($(td[1]).text()), sp = splitLabel(label);
    out.ta.push({ id: +clean($(td[0]).text()), number: sp.number, title: sp.title, prof: clean($(td[2]).text()), needed: numOf($(td[3]).text()), assigned: td.length > 4 ? numOf($(td[4]).text()) : 0, label });
  });
  const pr = tableByHeaders($, ['Id', 'Course', 'Prof', 'Proctors Needed']);
  if (pr) pr.table.find('tbody tr').each((_, tr) => {
    const td = $(tr).children('td'); if (td.length < 4) return;
    const label = clean($(td[1]).text()), sp = splitLabel(label);
    out.proctor.push({ id: +clean($(td[0]).text()), number: sp.number, title: sp.title, prof: clean($(td[2]).text()), needed: numOf($(td[3]).text()), label });
  });
  return out;
}

/* ----- applicant lists ----- */
function applicants(html) {
  const $ = cheerio.load(html);
  const out = { ta: [], ugca: [], warnings: [] };
  const ta = tableByHeaders($, ['Name', 'EID', 'Status', 'GRA', 'Available', 'Assignments']);
  if (ta) ta.table.find('tbody tr').each((_, tr) => {
    const row = $(tr), td = row.children('td'); if (td.length < 6) return;
    const a = $(td[0]).find('a').first(), id = idFrom(a.attr('href'), /applicant\/(\d+)/);
    if (!id) { out.warnings.push('TA row without an applicant link: ' + clean(row.text()).slice(0, 40)); return; }
    const nm = clean(a.text()), [last, first] = nm.split(',').map(clean);
    const known = ['commitment', 'other_support', 'declined', 'other'];
    const classes = (row.attr('class') || '').split(/\s+/).filter(Boolean);
    const color = classes.find(c => known.includes(c)) || '';
    const unknown = classes.filter(c => !known.includes(c));
    if (unknown.length) out.warnings.push('Unrecognised row class "' + unknown.join(' ') + '" on applicant ' + id);
    const sel = n => { const s = row.find('select[name^="' + n + '["]'); return s.length ? (s.find('option[selected]').attr('value') || '') : ''; };
    out.ta.push({
      id, last: last || '', first: first || '', eid: clean($(td[1]).text()), status: clean($(td[2]).text()), gra: clean($(td[3]).text()).toLowerCase(),
      avail: clean($(td[4]).text()), color,
      assignments: $(td[5]).find('a').map((_, x) => idFrom($(x).attr('href'), /course\/(\d+)/)).get().filter(Boolean),
      nr: sel('nr'), degree: sel('degree'), ai: sel('ai'), gpa: sel('gpa'),
      updated: clean($(td[td.length - 2]).text())
    });
  });
  else out.warnings.push('TA applicant table not found');
  const ug = tableByHeaders($, ['Name', 'EID', 'Major', 'Phone', 'Email']);
  if (ug) ug.table.find('tbody tr').each((_, tr) => {
    const td = $(tr).children('td'); if (td.length < 5) return;
    const a = $(td[0]).find('a.proctor-view').first(), id = +a.attr('data-record');
    if (!id) return;
    out.ugca.push({ id, name: clean(a.text()), eid: clean($(td[1]).text()), major: clean($(td[2]).text()), phone: clean($(td[3]).text()), email: clean($(td[4]).text()) });
  });
  else out.warnings.push('UGCA applicant table not found');
  return out;
}

/* ----- TA applicant page ----- */
function taDetail(html) {
  const $ = cheerio.load(html);
  const top = clean($('.row').first().text());
  const grab = (re) => { const m = top.match(re); return m ? clean(m[1]) : ''; };
  const rec = $('#record');
  const f = {};
  rec.find('> .record > table > tbody > tr, #record table:first-of-type > tbody > tr').each((_, tr) => {
    const th = $(tr).children('th').first(), td = $(tr).children('td').first();
    if (!th.length) return;
    const k = clean(th.text()).replace(/:$/, '').toLowerCase();
    if (!(k in f)) f[k] = td;
  });
  const txt = k => f[k] ? clean(f[k].text()) : '';
  const lis = el => el ? el.find('li').map((_, x) => clean($(x).text())).get() : [];
  const langs = [];
  if (f['programming experience']) f['programming experience'].find('tr').each((_, tr) => {
    const td = $(tr).children('td'); if (td.length === 2) langs.push([clean($(td[0]).text()), clean($(td[1]).text())]);
  });
  const hist = (f['ta history'] ? f['ta history'].html() || '' : '').split(/<br\s*\/?>/i).map(x => clean(cheerio.load('<p>' + x + '</p>').text())).filter(Boolean)
    .map(l => { const m = l.match(/^CS\s+(\S+),\s*(.*),\s*((?:Fall|Spring|Summer)\s+\d{4})\s+semester$/i); return m ? { number: m[1], prof: m[2], term: m[3] } : { number: '', prof: '', term: '', raw: l }; });
  const email = rec.find('a[href^="mailto:"]').first().text().trim();
  const head = clean(rec.find('h2').first().text()), hm = head.match(/\(([^)]+)\)\s*$/);
  const find = k => Object.keys(f).find(x => x.startsWith(k));
  const kk = (...ks) => { for (const k of ks) { const x = find(k); if (x) return txt(x); } return ''; };
  return {
    commitSupport: grab(/Commitment of support:\s*(.*?)\s*Requested by:/), requestedBy: grab(/Requested by:\s*(.*?)\s*Currently Assigned/),
    eid: hm ? hm[1] : '', email, phone: txt('phone number'), ssn: txt('ssn'), nativeEnglish: txt('native english speaker'), english: txt('english assessment results'),
    supervisor: txt('supervising prof').replace(/^Prof\.?\s*/i, ''), major: txt('major field'), admitted: txt('grad school admission'), degrees: txt('degrees held'),
    citizenship: txt('citizenship status'), gra: txt('gra'), hist, gainTeaching: kk('are you looking to gain'), teaching: txt('teaching experience'),
    supportive: kk('briefly explain'), challenges: kk('describe any past'), langs, research: lis(f['reseach'] || f['research']),
    requests: lis(f['non-discussion session classes requested']), requestsDiscussion: lis(f['discussion session classes requested'])
  };
}

/* ----- UGCA modal ----- */
function ugcaModal(html) {
  const $ = cheerio.load(html);
  const f = {};
  $('.modal-body p').each((_, p) => {
    const st = $(p).find('strong').first(); if (!st.length) return;
    const k = clean(st.text()).replace(/:$/, '').toLowerCase();
    const clone = $(p).clone(); clone.find('strong').remove();
    f[k] = clone;
  });
  const t = k => f[k] ? clean(f[k].text()) : '';
  const lines = k => f[k] ? (f[k].html() || '').split(/<br\s*\/?>/i).map(x => clean(cheerio.load('<p>' + x + '</p>').text())).filter(Boolean) : [];
  const head = clean($('.modal-title').first().text()), hm = head.match(/\(([^)]+)\)\s*$/);
  const reqs = lines('requested courses to proctor').map(l => { const m = l.match(/^(\d+)\s*-/); return m ? +m[1] : null; }).filter(Boolean);
  return {
    eid: hm ? hm[1] : '', phone: t('phone'), email: f.email ? clean(f.email.find('a').text() || f.email.text()) : '', major: t('major'), grad: t('expected graduation'),
    experience: t('experience'), supportive: t('what a supportive learning environment means to you'), challenges: t('challenges faced by cs students'),
    courses: lines('highest cs courses'), requests: reqs
  };
}

/* ----- course page (shape unconfirmed: used only to cross-check, never required) ----- */
function course($html) { return null; }

/* ----- assignments (drafts screen) ----- */
function drafts(html) {
  const $ = cheerio.load(html);
  const draftSel = $('select[name="draft"] option').map((_, o) => +$(o).attr('value')).get().filter(Boolean);
  const cur = +$('select[name="draft"] option[selected]').attr('value') || (draftSel.length ? Math.max(...draftSel) : 0);
  const dl = $('a').filter((_, a) => /download this draft/i.test($(a).text())).first().attr('href') || '';
  const t = tableByHeaders($, ['First name', 'Last name', 'EID', 'Course Number']);
  const rows = [];
  if (t) t.table.find('tbody tr').each((_, tr) => {
    const td = $(tr).children('td').map((__, x) => clean($(x).text())).get(); if (td.length < t.heads.length - 0 - 0 && td.length < 8) return;
    const o = {}; t.heads.forEach((h, i) => { o[h] = td[i] || ''; });
    rows.push({ first: o['first name'], last: o['last name'], eid: o['eid'], email: o['email'], number: o['course number'], name: o['course name'], prof: o['professor'], pct: numOf(o['percent assigned']), nr: o['new/return'] || '', degree: o['degree'] || '', ai: o['ai'] || '', gpa: o['gpa'] || '' });
  });
  const comment = (html.match(/<!--[\s\S]*?<th>SSN<\/th>[\s\S]*?-->/) || [''])[0];
  return { draft: cur, drafts: draftSel, download: dl, rows, hiddenColumns: comment ? (comment.match(/<th>([^<]+)<\/th>/g) || []).map(x => x.replace(/<\/?th>/g, '')) : [] };
}

/* ----- notify page: the Agreement table (read only; the form is never submitted) ----- */
function notify(html) {
  const $ = cheerio.load(html);
  const t = tableByHeaders($, ['Course', 'Student', 'Percent Assigned', 'Agreement']);
  const rows = [];
  if (t) t.table.find('tbody tr').each((_, tr) => {
    const td = $(tr).children('td'); if (td.length < 4) return;
    const agree = clean($(td[3]).text()), sent = agree.match(/^Sent:\s*(.*)$/i);
    rows.push({
      courseId: idFrom($(td[0]).find('a').attr('href'), /course\/(\d+)/), course: clean($(td[0]).text()),
      studentId: idFrom($(td[1]).find('a').attr('href'), /applicant\/(\d+)/), student: clean($(td[1]).text()), pct: numOf($(td[2]).text()),
      agreement: agree, state: /^yes$/i.test(agree) ? 'yes' : sent ? 'sent' : /^no$/i.test(agree) ? 'no' : agree ? 'other' : 'none', sentAt: sent ? sent[1] : ''
    });
  });
  return { rows, hasForm: $('form input[type="submit"][value="Notify applicants"]').length > 0 };
}

/* ----- people directory ----- */
function people(html) {
  const $ = cheerio.load(html);
  const seen = new Set(), out = [];
  $('a[href*="/people/faculty-researchers/"]').each((_, a) => {
    const href = $(a).attr('href'), slug = (href.match(/faculty-researchers\/([^/?#]+)/) || [])[1];
    if (!slug || seen.has(slug)) return; seen.add(slug);
    const card = $(a).closest('.views-row, article, li, .card');
    const full = clean($(a).text());
    const title = clean(card.find('.views-field-field-title, .title').first().text());
    out.push({ slug, href, full, title });
  });
  return out;
}
function profile(html) {
  const $ = cheerio.load(html);
  let email = $('a[href^="mailto:"]').first().attr('href');
  email = email ? email.replace(/^mailto:/i, '').split('?')[0].trim() : '';
  if (!email) { const m = $.text().match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/); email = m ? m[0] : ''; }
  return { email };
}

module.exports = { classes, applicants, taDetail, ugcaModal, course, drafts, notify, people, profile, clean };
