'use strict';
/* Fake data for the mock legacy TA app.
   Course sections and professor strings come from the public class lists. Every student is invented
   (names are made from plant and place words, EIDs and emails are fake, emails end in .invalid).
   The counts and the mix of row colors follow the real Fall 2026 export so the mock behaves like it. */
const classes = require('./data/classes.json');
const proctor = require('./data/proctor.json');

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const FIRST = ['Alder', 'Briar', 'Cedar', 'Dune', 'Ember', 'Fennel', 'Garnet', 'Hazel', 'Indigo', 'Juniper', 'Kestrel', 'Laurel', 'Maple', 'Nettle', 'Olive', 'Poppy', 'Quince', 'Rowan', 'Sorrel', 'Thistle', 'Umber', 'Violet', 'Willow', 'Yarrow', 'Zinnia', 'Aspen', 'Basil', 'Clover', 'Dahlia', 'Elder', 'Flint', 'Ginger', 'Heath', 'Iris', 'Jasper', 'Kelp', 'Lark', 'Moss', 'Nutmeg', 'Orchid'];
const LAST = ['Ashford', 'Barrow', 'Cobble', 'Dunmore', 'Eastwick', 'Fairlea', 'Glenmoor', 'Hartwell', 'Ironside', 'Jessop', 'Kingsley', 'Larkspur', 'Marlowe', 'Northcote', 'Oakhurst', 'Pemberly', 'Quarry', 'Ravenel', 'Stonebrook', 'Thornley', 'Underhill', 'Vexford', 'Wrenfield', 'Yardley', 'Zephyrton', 'Alderbrook', 'Brightwater', 'Coldharbor', 'Deepdale', 'Elmhurst'];
const PROF_FIRST = { A: 'Arden', B: 'Briar', C: 'Corin', D: 'Dale', E: 'Elm', F: 'Fenn', G: 'Gale', H: 'Hale', I: 'Ivor', J: 'Jory', K: 'Kell', L: 'Linden', M: 'Marlow', N: 'Noor', O: 'Orrin', P: 'Piper', Q: 'Quill', R: 'Rowan', S: 'Sable', T: 'Tamsin', U: 'Ulric', V: 'Vale', W: 'Wren', X: 'Xan', Y: 'Yarrow', Z: 'Zane' };
const LANGS = ['C', 'Aws', 'C++', 'Java', 'Javascript', 'Kotlin', 'Lisp', 'Perl', 'Python', 'React', 'Sql', 'Swift', 'Unix', 'Assembly'];
const YEARS = ['None', 'None', '1 year', '2 years', '3 years', '5 years', '6+ years'];
const RESEARCH = ['Artificial Intelligence', 'Data Mining & Machine Learning', 'Theory', 'Systems and Networking', 'Security', 'Graphics and Visualization', 'Programming Languages', 'CS Issues and Education', 'Computer Architecture', 'Robotics'];
const MAJORS = ['Computer Science', 'Computer Science', 'Computer Science', 'Computer Science', 'Economics & CS', 'Computer Science, Electrical and Computer Engineering', 'Computer Sciencre', 'Mathematics and CS'];
const TERMS = ['Fall 2023', 'Spring 2024', 'Fall 2024', 'Spring 2025', 'Fall 2025', 'Spring 2026'];
const UPDATED = ['', '', '2023-07-20 16:29:50', '2024-01-19 13:39:44', '2025-04-03 13:44:10', '2025-08-04 16:51:27', '2026-06-18 12:13:45', '2026-07-31 15:48:44'];

const profClean = s => s.replace(/,,/g, ',').trim();
const profLast = s => profClean(s).split(',')[0].trim();
const profInit = s => (profClean(s).split(',')[1] || '').trim();
const titleCase = s => s.toLowerCase().replace(/(^|[-\s])([a-z])/g, (m, a, b) => a + b.toUpperCase());

function build(seed = 20261010) {
  const R = rng(seed), pick = a => a[Math.floor(R() * a.length)], int = n => Math.floor(R() * n);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const used = new Set();
  const person = () => { for (;;) { const f = pick(FIRST), l = pick(LAST), k = f + l; if (!used.has(k)) { used.add(k); return { first: f, last: l }; } } };
  const eidN = new Set();
  const eid = (p) => { for (;;) { const e = (p.first[0] + p.last[0]).toLowerCase() + (10000 + int(89999)); if (!eidN.has(e)) { eidN.add(e); return e; } } };

  // ----- faculty directory (people page) -----
  const FIXLAST = { 'HUNTER-JONE': 'Hunter-Jones', 'KRAEHENBUEHL': 'Kraehenbuehl' };
  const profs = {};
  const addProf = s => { const l = FIXLAST[profLast(s)] || titleCase(profLast(s)); let i = profInit(s); if (!i) return; const k = (l + '|' + i).toUpperCase(); profs[k] = profs[k] || { last: l, init: i }; };
  classes.concat(proctor).forEach(c => addProf(c.prof));
  delete profs['OFFNER|S']; // not a CS faculty member: the matcher must report it as unmatched
  const faculty = Object.values(profs).map(p => {
    const first = PROF_FIRST[p.init.toUpperCase()] || 'Sam';
    const slug = (first + '-' + p.last).toLowerCase();
    return { first, last: p.last, init: p.init, full: first + ' ' + p.last, slug, email: slug.replace(/-/g, '.') + '@cs.example.test', title: pick(['Professor', 'Associate Professor', 'Assistant Professor', 'Professor of Instruction', 'Associate Professor of Instruction', 'Lecturer']), area: pick(RESEARCH) };
  });
  // an ambiguous pair: two people whose last name and first initial match the legacy string "KIM, D"
  if (faculty.some(f => f.last === 'Kim' && f.init === 'D')) faculty.push({ first: 'Dax', last: 'Kim', init: 'D', full: 'Dax Kim', slug: 'dax-kim', email: 'dax.kim@cs.example.test', title: 'Assistant Professor', area: 'Systems and Networking' });
  faculty.push({ first: 'Emerson', last: 'Lindqvist', init: 'E', full: 'Emerson Lindqvist', slug: 'emerson-lindqvist', email: '', title: 'Professor Emeritus', area: 'Theory' }); // no email on the profile
  const facByLegacy = s => { const l = FIXLAST[profLast(s)] || titleCase(profLast(s)), i = profInit(s).toUpperCase(); return faculty.find(f => f.last === l && f.init.toUpperCase() === (i || f.init.toUpperCase())); };
  const profFull = s => { const f = facByLegacy(s); return f ? f.full : titleCase(profLast(s)); };

  // ----- TA applicants -----
  const slots = [];
  classes.forEach(c => { let a = c.assigned; while (a > 0) { const p = a >= 1 ? 1 : a; slots.push({ sid: c.id, pct: p }); a -= p; } });
  const TA_N = 166;
  const kinds = []; // class mix of the real export
  const mix = { commitment: 65, other_support: 49, declined: 1, other: 1 };
  Object.entries(mix).forEach(([k, n]) => { for (let i = 0; i < n; i++) kinds.push(k); });
  while (kinds.length < TA_N) kinds.push('');
  const kindList = shuffle(kinds);
  const graOf = { commitment: () => { const r = R(); return r < 0.72 ? 'no' : r < 0.87 ? 'yes' : 'applied'; }, other_support: () => { const r = R(); return r < 0.51 ? 'no' : r < 0.73 ? 'yes' : 'applied'; }, '': () => (R() < 0.96 ? 'no' : pick(['yes', 'applied'])), declined: () => 'no', other: () => 'no' };
  const statuses = shuffle([].concat(Array(109).fill('Ph.D.'), Array(51).fill('Masters'), Array(6).fill('In Candidacy')));
  const slotQ = shuffle(slots);
  const commitIdx = kindList.map((k, i) => k === 'commitment' ? i : -1).filter(i => i >= 0);
  const plainIdx = kindList.map((k, i) => k === '' ? i : -1).filter(i => i >= 0);
  const assignedFor = {}; // applicant index -> slot
  const order = commitIdx.slice(12).concat(shuffle(plainIdx)); // the first 12 commitment students stay unplaced, as in the office's real situation
  slotQ.forEach((s, i) => { if (i < order.length) assignedFor[order[i]] = s; });
  const byLabel = {}; classes.forEach(c => { (byLabel[c.label.replace(/\s+/g, ' ')] = byLabel[c.label.replace(/\s+/g, ' ')] || []).push(c); });
  const ta = [];
  let nextId = 500;
  for (let i = 0; i < TA_N; i++) {
    const p = person(), id = nextId; nextId += 1 + int(6);
    const cls = kindList[i], status = statuses[i], gra = graOf[cls](), slot = assignedFor[i];
    const as = slot ? [{ sid: slot.sid, pct: slot.pct, agree: 'Yes' }] : [];
    const req = []; // requested section ids in order
    const nreq = int(7);
    for (let k = 0; k < nreq; k++) req.push(pick(classes).id);
    if (slot && !req.includes(slot.sid)) req.splice(int(req.length + 1), 0, slot.sid);
    const returning = R() < 0.55;
    const hist = [];
    if (returning) { const n = 1 + int(5); for (let k = 0; k < n; k++) { const c = pick(classes); hist.push({ number: c.label.split(/\s+/)[0], prof: profFull(c.prof), term: TERMS[k] }); } }
    const nat = R() < 0.55;
    ta.push({
      id, first: p.first, last: p.last, eid: eid(p), email: (p.first + '.' + p.last).toLowerCase() + '@mock.invalid', phone: '512555' + String(1000 + int(8999)),
      status, gra, cls, avail: slot ? 'Yes' : (cls === 'declined' ? 'Notified: 2026-08-05 18:10:01' : (cls === '' && R() < 0.5 ? 'Yes' : '')),
      nr: returning ? (R() < 0.8 ? 'Return' : '') : (R() < 0.7 ? 'New' : ''), degree: '', ai: R() < 0.05 ? '1' : '0', gpa: '', updated: pick(UPDATED),
      assignments: as, requests: req, commitSupport: cls === 'commitment' ? 'Yes' : 'No', requestedBy: 'None',
      detail: {
        ssn: R() < 0.93 ? 'Yes' : 'No', nativeEnglish: nat ? 'Yes' : 'No', english: nat ? '' : pick(['pass', 'unknown', 'conditional pass']),
        supervisor: 'Prof. ' + pick(faculty).full, major: 'Computer Science', admitted: pick(['2021-08-01', '2022-08-22', '2023-02-01', '2024-08-26', '2025-08-25', '2026-02-09', '2026-08-24']),
        degrees: pick(['bachelors', 'bachelors,masters', 'bachelors']), citizenship: pick(['US Citizen', 'US Citizen', 'Permanent Resident', 'International', 'International']),
        gainTeaching: pick(['Yes', 'No']), teaching: returning ? 'I have been a TA for several semesters and held office hours and graded.' : 'I tutored classmates and led a study group.',
        challenges: '', supportive: 'I try to answer questions on the forum quickly and leave room for students to work things out.',
        langs: LANGS.map(l => [l, pick(YEARS)]), other: R() < 0.2 ? 'C# - 6 years' : '', research: shuffle(RESEARCH).slice(0, 1 + int(4)), hist,
        grade: returning ? 'A' : '', profComment: returning && R() < 0.2 ? 'Has been great!' : ''
      }
    });
  }
  // a late TA applicant: appears only after db.later() is called (the mock "new applicant" case)
  const lp = person();
  const later = { id: nextId + 7, first: lp.first, last: lp.last, eid: eid(lp), email: (lp.first + '.' + lp.last).toLowerCase() + '@mock.invalid', phone: '5125559999', status: 'Masters', gra: 'no', cls: '', avail: 'Yes', nr: 'New', degree: '', ai: '0', gpa: '', updated: '', assignments: [], requests: [classes[3].id, classes[4].id], commitSupport: 'No', requestedBy: 'None', detail: { ssn: 'Yes', nativeEnglish: 'Yes', english: '', supervisor: 'Prof. ' + faculty[0].full, major: 'Computer Science', admitted: '2026-08-24', degrees: 'bachelors', citizenship: 'US Citizen', gainTeaching: 'Yes', teaching: '', challenges: '', supportive: '', langs: LANGS.map(l => [l, 'None']), other: '', research: ['Theory'], hist: [], grade: '', profComment: '' } };

  // ----- UGCA applicants -----
  const ugca = [];
  let uid = 1180;
  for (let i = 0; i < 264; i++) {
    const p = person(); uid += 1 + int(3);
    const n = 3 + int(11), reqs = shuffle(proctor).slice(0, n).map(c => c.id);
    ugca.push({ id: uid, first: p.first, last: p.last, eid: eid(p), email: (p.first + '.' + p.last).toLowerCase() + '@mock.invalid', phone: '512555' + String(1000 + int(8999)), major: pick(MAJORS), grad: pick(['May 2027', 'December 2027', 'May 2028', 'December 2026']),
      experience: 'Tutor for two semesters. Led review sessions for an intro course.', supportive: 'I would end each message by inviting students to come to office hours.', challenges: 'Early on I wondered whether I belonged and talking to friends helped.',
      courses: shuffle(['CS 311 DISCRETE MATH FOR COMPUTER SCIENCE', 'CS 312 INTRODUCTION TO PROGRAMMING', 'CS 314 DATA STRUCTURES, Java', 'CS 429 COMP ORGANIZATION AND ARCHITECTURE, C', 'CS 439 PRINCIPLES OF COMPUTER SYSTEMS, C++']).slice(0, 1 + int(4)), resume: 'resume_' + (p.first + p.last).toLowerCase() + '.pdf', requests: reqs });
  }

  // ----- drafts (HR table) -----
  const draftRows = [];
  ta.forEach(t => t.assignments.forEach(a => { const c = classes.find(x => x.id === a.sid); draftRows.push({ sid: a.sid, tid: t.id, first: t.first, last: t.last, eid: t.eid, email: t.email, number: c.label.split(/\s+/)[0], name: c.label.replace(/^\S+\s+/, '').trim(), prof: c.prof, pct: a.pct, t }); }));
  draftRows.sort((a, b) => a.last.localeCompare(b.last));
  // one assignment is still waiting for the student (Sent:...) as on the real assignments page
  const sentRow = ta.find(t => t.assignments.length && t.cls === '');
  if (sentRow) sentRow.assignments[0].agree = 'Sent:08-05-26 6:09pm';

  return { classes, proctor, ta, later, ugca, faculty, draftNo: 15, draftRows, profFull, notifies: 0, nonGet: [] };
}

module.exports = { build, profLast, profInit, titleCase };
