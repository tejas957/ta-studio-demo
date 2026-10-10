'use strict';
/* Turns parsed legacy pages into one payload in the app's own table shapes (see docs/INTEGRATION.md).
   Pure function: no network, no files. */
const { match, parseLegacy } = require('./faculty');
const nrm = s => String(s || '').replace(/\s+/g, ' ').trim().toUpperCase();
const title = s => String(s || '').toLowerCase().replace(/(^|[\s\-(\/])([a-z])/g, (m, a, b) => a + b.toUpperCase());
const slugKey = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const termLabel = ts => (ts || '').trim();

function buildPayload(P) {
  const warnings = (P.warnings || []).slice();
  const now = P.now || new Date().toISOString();
  const cid = id => 'crs_' + id;
  const taCls = new Map(P.classes.ta.map(c => [c.id, c])), prCls = new Map(P.classes.proctor.map(c => [c.id, c]));
  const secIds = [...new Set([...taCls.keys(), ...prCls.keys()])].sort((a, b) => a - b);

  // ----- faculty -----
  const profStrings = [...new Set(secIds.map(id => (taCls.get(id) || prCls.get(id)).prof))];
  const matches = match(profStrings, P.directory || []);
  const facId = raw => 'fac_' + (slugKey(parseLegacy(raw).last + '_' + parseLegacy(raw).init.slice(0, 1)) || 'unknown');
  const faculty = [], users = [], review = [];
  const seenFac = new Set();
  for (const raw of profStrings) {
    const m = matches[raw], L = parseLegacy(raw), fid = facId(raw);
    if (seenFac.has(fid)) continue; seenFac.add(fid);
    const display = m.pick ? m.pick.full : (L.init ? L.init + ' ' : '') + title(L.last);
    const email = m.pick && P.emails ? (P.emails[m.pick.slug] || '') : '';
    faculty.push({ faculty_id: fid, display_name: display, department: 'Computer Science' });
    users.push({ user_id: 'usr_' + fid, role: 'faculty', display_name: display, email, faculty_id: fid });
    const emailStatus = !m.pick ? 'no directory match' : email ? 'ok' : 'profile has no email';
    if (m.status !== 'matched' || !email) review.push({ legacy: raw, status: m.status, email: emailStatus, candidates: m.candidates.map(c => c.full) });
  }
  const facByRaw = {}; profStrings.forEach(r => { facByRaw[r] = facId(r); });
  // one legacy string can map to the same id as another spelling (typos); keep the first display name

  // ----- courses -----
  const courses = [], coursesExt = {}, reqs = [], rw = [];
  const bySecLabel = {}; // normalised label -> section ids (TA classes), to expand "requested class" names
  P.classes.ta.forEach(c => { (bySecLabel[nrm(c.label)] = bySecLabel[nrm(c.label)] || []).push(c.id); });
  for (const id of secIds) {
    const t = taCls.get(id), p = prCls.get(id), base = t || p;
    const taN = t ? t.needed : 0, ugN = p ? p.needed : 0;
    courses.push({ course_id: cid(id), term_id: 'term_live', catalog_number: base.number, title: title(base.title), section_label: String(id), faculty_id: facByRaw[base.prof], ta_slots_required: Math.round((taN + ugN) * 100) / 100, status: 'open' });
    coursesExt[cid(id)] = { aud: t && p ? 'both' : t ? 'grad' : 'undergrad', slots: { TA: taN, UGCA: ugN, Proctor: 0 } };
    reqs.push({ course_id: cid(id), experience_required: false, spoken_english_requirement: 'standard_assessment', required_skills: '', faculty_notes: '' });
    rw.push({ course_id: cid(id), ranking_status: 'not_started', last_saved_at: '', submitted_at: '', admin_reopened: false });
  }

  // ----- applicants -----
  const applicants = [], applications = [], prefs = [], skills = [], cw = [], th = [], extApps = {}, lg = {};
  const term = P.term || 'Fall 2026';
  const years = s => { const m = String(s).match(/(\d+(\.\d+)?)/); return m ? +m[1] : (/none/i.test(s) ? 0 : 0.5); };
  const prof = y => y >= 3 ? 'advanced' : y >= 1 ? 'working' : 'coursework';
  const toIso = s => { const m = String(s || '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/); return m ? m[1] + 'T' + m[2] : ''; };
  const appIdTA = id => 'app_ta_' + id, appIdUG = id => 'app_ug_' + id;
  let prefN = 0;
  const idxByEid = {};

  for (const a of P.applicants.ta) {
    const d = (P.taDetails && P.taDetails[a.id]) || null, aid = appIdTA(a.id), pid = 'apl_ta_' + a.id;
    if (!d) warnings.push('No detail page for TA applicant ' + a.id + '; basic fields only');
    const red = a.color === 'declined' || a.color === 'other';
    const nat = d ? d.nativeEnglish : '';
    const eng = d ? d.english.toLowerCase() : '';
    const spoken = !d ? 'pending' : /^yes/i.test(nat) ? 'not_required' : /^pass/.test(eng) ? 'verified' : 'pending';
    const hist = d ? d.hist.filter(h => h.number) : [];
    const returning = a.nr === 'Return' || hist.length > 0;
    applicants.push({ applicant_id: pid, display_name: a.first + ' ' + a.last, synthetic_person: false });
    applications.push({
      application_id: aid, applicant_id: pid, term_id: 'term_live', degree_level: /masters/i.test(a.status) ? 'Masters' : 'PhD', assistant_type: 'TA',
      program: d ? d.major : '', expected_graduation_term: '', returning_ta: returning, prior_ta_terms: hist.length, max_assignment_fte: 1,
      employment_eligibility_status: red ? 'ineligible' : 'eligible', spoken_english_assessment: spoken, availability_status: /^yes/i.test(a.avail) ? 'available' : 'limited',
      teaching_statement: d ? d.teaching : '', experience_summary: d ? d.supportive : '', application_status: 'submitted', submitted_at: toIso(a.updated) || now.slice(0, 19)
    });
    // requested classes: names only, so every section with that name is requested at the same rank
    let rank = 0; const seenC = new Set();
    const addPref = (secId, r, note) => { if (seenC.has(secId)) return; seenC.add(secId); prefs.push({ preference_id: 'pref_' + (prefN++), application_id: aid, course_id: cid(secId), preference_rank: r, preparedness: 'moderate', applicant_note: note || '' }); };
    for (const label of d ? d.requests : []) {
      const secs = bySecLabel[nrm(label)] || [];
      if (!secs.length) { warnings.push('Requested class not found in class list: "' + label + '" (applicant ' + a.id + ')'); continue; }
      rank++; secs.forEach(s => addPref(s, rank, 'Requested the course by name; all sections of it count.'));
    }
    a.assignments.forEach(s => { if (taCls.has(s)) addPref(s, rank + 1, 'Assigned in the legacy app.'); });
    if (d) {
      d.langs.forEach(([l, y]) => { const yy = years(y); if (yy > 0) skills.push({ application_id: aid, skill_name: l, proficiency: prof(yy), years_experience: yy }); });
      hist.forEach(h => th.push({ application_id: aid, catalog_number: h.number, course_title: '', term: h.term, role: 'TA', allocation_fte: 1 }));
    }
    const ex = { cit: d ? d.citizenship : '', ita: !d ? '' : /^yes/i.test(nat) ? 'Not required' : /^pass/.test(eng) ? 'English test passed' : /conditional/.test(eng) ? 'English test pending' : 'English test pending', sup: d ? d.supervisor : '', area: d ? d.research.join(', ') : '', intern: '', tex: d ? (/^yes/i.test(d.gainTeaching) ? 'Wants teaching experience' : '') : '' };
    extApps[aid] = ex;
    lg[aid] = {
      legacyId: a.id, kind: 'TA', first: a.first, last: a.last, eid: a.eid, email: d ? d.email : '', phone: d ? d.phone : '', color: a.color, gra: a.gra, status: a.status, avail: a.avail,
      commit: a.color === 'commitment' || (d && /^yes/i.test(d.commitSupport)), updated: a.updated, nr: a.nr, degree: a.degree, ai: a.ai, gpa: a.gpa, ssn: d ? d.ssn : '', graDetail: d ? d.gra : '', agree: ''
    };
    idxByEid[a.eid.toLowerCase()] = aid;
  }
  for (const u of P.applicants.ugca) {
    const d = (P.ugcaDetails && P.ugcaDetails[u.id]) || null, aid = appIdUG(u.id), pid = 'apl_ug_' + u.id;
    if (!d) warnings.push('No detail for UGCA applicant ' + u.id);
    const [first, ...rest] = u.name.split(' ');
    applicants.push({ applicant_id: pid, display_name: u.name, synthetic_person: false });
    applications.push({
      application_id: aid, applicant_id: pid, term_id: 'term_live', degree_level: 'Undergraduate', assistant_type: 'UGCA', program: u.major, expected_graduation_term: d ? d.grad : '',
      returning_ta: false, prior_ta_terms: 0, max_assignment_fte: 1, employment_eligibility_status: 'eligible', spoken_english_assessment: 'not_required', availability_status: 'available',
      teaching_statement: d ? d.supportive : '', experience_summary: d ? d.experience : '', application_status: 'submitted', submitted_at: now.slice(0, 19)
    });
    (d ? d.requests : []).forEach((s, i) => { if (prCls.has(s)) prefs.push({ preference_id: 'pref_' + (prefN++), application_id: aid, course_id: cid(s), preference_rank: i + 1, preparedness: 'moderate', applicant_note: '' }); else warnings.push('UGCA ' + u.id + ' requested unknown proctor class ' + s); });
    (d ? d.courses : []).forEach(l => { const m = l.match(/^CS\s+(\S+)\s+(.*)$/i); if (m) cw.push({ application_id: aid, catalog_number: m[1], course_title: title(m[2]), completion_status: 'completed', grade_band: '' }); });
    extApps[aid] = { cit: '', yr: '', hrs: 0 };
    lg[aid] = { legacyId: u.id, kind: 'UGCA', first: first, last: rest.join(' '), eid: u.eid, email: u.email || (d && d.email) || '', phone: u.phone, color: '', gra: '', status: 'Undergraduate', avail: '', commit: false, updated: '', nr: '', degree: '', ai: '', gpa: '', ssn: '', graDetail: '', agree: '' };
    idxByEid[u.eid.toLowerCase()] = aid;
  }

  // ----- current assignments (notify table is the source: section, student, percent, agreement) -----
  const byLegacy = {}; applications.forEach(a => { byLegacy[a.application_id] = a; });
  const draftRows = [];
  const taByLegacyId = id => appIdTA(id);
  const nameToApp = {}; P.applicants.ta.forEach(a => { nameToApp[nrm(a.first + ' ' + a.last)] = appIdTA(a.id); });
  let dn = 1;
  for (const r of (P.notify ? P.notify.rows : [])) {
    const aid = r.studentId ? taByLegacyId(r.studentId) : nameToApp[nrm(r.student)];
    const sec = r.courseId || (bySecLabel[nrm(r.course)] || [])[0];
    if (!aid || !byLegacy[aid] || !sec || !courses.find(c => c.course_id === cid(sec))) { warnings.push('Could not place assignment row: ' + r.student + ' / ' + r.course); continue; }
    lg[aid].agree = r.agreement;
    draftRows.push({ draft_assignment_id: 'draft_live_' + String(dn++).padStart(3, '0'), draft_id: 'draft_live', course_id: cid(sec), application_id: aid, allocation_fte: r.pct, admin_decision_status: 'accepted', publication_status: 'unpublished', admin_note: '' });
  }
  // Assignments seen on the applicant list but missing from the notify table
  for (const a of P.applicants.ta) a.assignments.forEach(s => { const aid = appIdTA(a.id); if (!draftRows.some(r => r.application_id === aid && r.course_id === cid(s)) && taCls.has(s)) warnings.push('Applicant ' + a.id + ' shows an assignment in ' + s + ' that is not in the Agreement table'); });

  // ----- HR baseline: the latest draft on the assignments page -----
  let hr = null;
  if (P.drafts) {
    const rows = [];
    for (const r of P.drafts.rows) {
      const aid = idxByEid[String(r.eid).toLowerCase()];
      const mine = draftRows.filter(x => x.application_id === aid);
      const num = nrm(r.number);
      const row = mine.find(x => { const c = courses.find(c => c.course_id === x.course_id); return c && nrm(c.catalog_number) === num && (taCls.get(+x.course_id.slice(4)) || {}).prof && nrm((taCls.get(+x.course_id.slice(4))).prof.replace(/,+/g, ',')) .split(',')[0] === nrm(String(r.prof).replace(/,+/g, ',')).split(',')[0]; }) || mine.find(x => { const c = courses.find(c => c.course_id === x.course_id); return c && nrm(c.catalog_number) === num; });
      if (!aid || !row) { warnings.push('HR draft row not matched to a current assignment: ' + r.eid + ' ' + r.number); continue; }
      rows.push({ course: row.course_id, app: aid, fte: r.pct, nr: r.nr, degree: r.degree, ai: r.ai, gpa: r.gpa });
    }
    hr = { n: P.drafts.draft, rows, hiddenColumns: P.drafts.hiddenColumns };
  }

  const unmatchedCount = review.filter(x => x.status === 'unmatched').length;
  return {
    meta: { source: 'legacy', syncedAt: now, term, counts: { taApplicants: P.applicants.ta.length, ugcaApplicants: P.applicants.ugca.length, taClasses: taCls.size, proctorClasses: prCls.size, sections: secIds.length, assignments: draftRows.length, faculty: faculty.length, facultyToReview: review.length, facultyUnmatched: unmatchedCount }, warnings, facultyReview: review },
    terms: [{ term_id: 'term_live', name: term, application_deadline: '', faculty_ranking_deadline: '', status: 'faculty_ranking' }],
    faculty, users, courses, applicants, applications, applicant_skills: skills, applicant_coursework: cw, teaching_history: th, course_preferences: prefs, course_requirements: reqs,
    ranking_workflow: rw, faculty_rankings: [], assignment_drafts: [{ draft_id: 'draft_live', term_id: 'term_live', name: term + ' working draft (from the legacy assignments)', status: 'working', created_at: now, created_by_user_id: '' }],
    draft_assignments: draftRows, publication_batches: [], published_assignments: [], faculty_concerns: [],
    ext: { apps: extApps, courses: coursesExt, lg }, hr_baseline: hr
  };
}
module.exports = { buildPayload };
