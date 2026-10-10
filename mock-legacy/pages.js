'use strict';
/* HTML for the mock legacy TA app. The markup follows the real pages (table headers, row classes, form fields,
   comment-hidden draft columns, modal markup, absolute links). Where the real page was not seen, the page is marked ASSUMED. */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sp = s => String(s).replace(/\s+/g, ' ');

function make(db, origin) {
  const B = origin + '/taproc/index.php';
  const link = (path, text) => '<a href="' + B + path + '">' + esc(text) + '</a>';
  const cls = id => db.classes.find(c => c.id === id);
  const labelOf = id => { const c = cls(id); return c ? c.label : String(id); };
  const taAll = () => db.ta.concat(db.laterOn ? [db.later] : []);

  const nav = '<nav class="navbar"><span class="navbar-brand">UTCS TA/UGCA Admin - Fall 2026</span><ul class="nav navbar-nav navbar-right"><li><a href="' + B + '/admin/classes">Classes</a></li><li><a href="' + B + '/admin/assignments">Assignments</a></li><li><a href="' + B + '/admin/applicants">Applicants</a></li><li class="dropdown"><a href="#" class="dropdown-toggle">Settings <b class="caret"></b></a><ul class="dropdown-menu"><li><a href="' + B + '/admin/settings">Application settings</a></li><li><a href="' + B + '/admin/users">Users</a></li><li><a href="' + B + '/admin/commitment_students">Commitment students</a></li><li><a href="' + B + '/admin/drafts">Drafts</a></li><li><a href="' + B + '/admin/email_tas">Email TAs</a></li></ul></li></ul></nav>';
  const layout = (title, body) => '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>' + esc(title) + '</title>\n<link rel="stylesheet" href="' + origin + '/assets/css/bootstrap.min.css">\n<link rel="stylesheet" href="' + origin + '/assets/css/theme.css">\n<link rel="stylesheet" href="' + origin + '/assets/css/bg_colors.css">\n</head><body>' + nav + '<div class="container">' + body + '</div></body></html>';

  const css = 'tr.commitment td{background-color:#ffff55}\ntr.other_support td{background-color:#0000ff;color:#fff}\ntr.other_support td a{color:#fff}\ntr.declined td{background-color:#ff3333;color:#fff}\ntr.other td{background-color:#ff3333;color:#fff}\n';

  // ----- classes (TA tab and proctor tab) -----
  function classesPage() {
    const tot = db.classes.length, need = db.classes.reduce((s, c) => s + c.needed, 0), asg = db.classes.reduce((s, c) => s + asgOf(c.id), 0);
    const ta = '<div class="tab-pane active" id="ta"><h1>TA Classes</h1><div class="btn-group"><a class="btn btn-default btn-sm" href="' + B + '/admin/edit_classes">Edit classes</a><a href="' + B + '/admin/update_classes" class="btn btn-default btn-sm">Import classes</a><a class="btn btn-default btn-sm" href="' + B + '/admin/faculty_requirements">Print faculty requirements</a></div>\n<p>Total Classes: <span class="badge">' + tot + '</span> Total TAs Needed: <span class="badge">' + need.toFixed(1) + '</span> Total TAs Assigned: <span class="badge">' + asg + '</span></p>\n<table class="table table-bordered">\n<thead>\n<tr>\n\t<th>Id</th>\n\t<th>Course</th>\n\t<th>Prof</th>\n\t<th>TAs Needed</th>\n\t<th>TAs Assigned</th>\n</tr>\t\n</thead>\n<tbody>\n' +
      db.classes.map(c => '<tr>\n\t<td>' + c.id + '</td>\n\t<td>' + link('/admin/course/' + c.id, c.label) + '</td>\n\t<td>' + esc(c.prof) + '</td>\n\t<td>' + c.needed.toFixed(1) + '</td>\n\t<td>' + asgOf(c.id) + '</td>\n</tr>').join('\n') + '\n</tbody>\n</table></div>';
    const pr = '<div class="tab-pane" id="ugca"><h1>Proctor Classes</h1><p>Total Classes: <span class="badge">' + db.proctor.length + '</span></p>\n<table class="table table-bordered">\n\t<thead>\n\t<tr>\n\t\t<th>Id</th>\n\t\t<th>Course</th>\n\t\t<th>Prof</th>\n\t\t<th>Proctors Needed</th>\t\n\t</tr>\t\n\t</thead>\n\t<tbody>\n' +
      db.proctor.map(c => '\t\t<tr>\n\t\t<td>' + c.id + '</td>\t\t\n\t\t<td>\n\t\t\t<a href="#" class="proctor-course-view" data-record="' + c.id + '" data-toggle="modal" data-target="#modal">\n\t\t\t\t' + esc(c.number) + '  \n\t\t\t\t' + esc(c.title) + '\t\t\t</a>\t\n\t\t</td>\t\n\t\t<td>' + esc(c.prof) + '</td>\n\t\t<td>' + c.needed.toFixed(1) + '</td>\t\t\n\t</tr>').join('\n') + '\n\t</tbody>\n\t</table></div>';
    return layout('Classes', '<ul class="nav nav-tabs"><li class="active"><a href="#ta">TA classes</a></li><li><a href="#ugca">UGCA classes</a></li></ul><div class="tab-content">' + ta + pr + '</div>');
  }
  const asgOf = id => { let s = 0; taAll().forEach(t => t.assignments.forEach(a => { if (a.sid === id) s += a.pct; })); return s; };

  // ----- applicants -----
  const sel = (name, opts, cur) => '<select name="' + name + '">\n' + opts.map(o => '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected="selected"' : '') + '>' + o[1] + '</option>').join('\n') + '\n</select>';
  function taRow(t) {
    const as = t.assignments.length ? '<ul>' + t.assignments.map(a => '<li>' + link('/admin/course/' + a.sid, labelOf(a.sid)) + '</li>').join('') + '</ul>' : '<ul></ul>';
    return '\t\t\t\t\t\t<tr' + (t.cls ? ' class="' + t.cls + '"' : '') + '>\n\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t<td>' + link('/admin/applicant/' + t.id, t.last + ',' + t.first) + '</td>\n\t\t\t\t\t\t\t<td>' + t.eid + '</td>\n\t\t\t\t\t\t\t<td>' + t.status + '</td>\n\t\t\t\t\t\t\t<td>' + t.gra + '</td>\n\t\t\t\t\t\t\n\t\t\t\t\t\t\t<td>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t' + t.avail + '\t\t\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t</td>\n\t\t\t\t\t\n\t\t\t\t\t\t\t<td>\n\t\t\t\t\t\t\t   ' + as + '\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t</td>\t\n\t\t\t\t\t\n\t\t\t\t\t\t\t<!--Accounting info-->\n\t\t\t\t\t\t\t<td>\n\t\t\t\t\t\t\t\t' +
      sel('nr[' + t.id + ']', [['', ''], ['New', 'New'], ['Return', 'Return']], t.nr) + '\n\t\t\t\t\t\t\t</td>\t\n\t\t\t\t\t\t\t<td>\t\n\t\t\t\t\t\t\t\t' + sel('degree[' + t.id + ']', [['', ''], ['C', 'C'], ['M', 'M'], ['B', 'B']], t.degree) + '\n\t\t\t\t\t\t\t</td>\t\n\t\t\t\t\t\t\t<td>\t\n\t\t\t\t\t\t\t\t' + sel('ai[' + t.id + ']', [['', ''], ['1', 'Yes'], ['0', 'No']], t.ai) + '\n\t\t\t\t\t\t\t</td>\t\n\t\t\t\t\t\t\t<td>\n\t\t\t\t\t\t\t\t' + sel('gpa[' + t.id + ']', [['', ''], ['pass', 'Pass'], ['fail', 'Fail']], t.gpa) + '\n\t\t\t\t\t\t\t</td>\t\t\n\t\t\t\t\t\t\t<td>' + t.updated + '</td>\n\t\t\t\t\t\t\t<td><input type="checkbox" name="update[]" value="' + t.id + '">\n</td>\t\n\t\t\t\t\t\t</tr>';
  }
  function applicantsPage() {
    const ta = taAll().slice().sort((a, b) => (a.last + a.first).localeCompare(b.last + b.first));
    const taPane = '<div class="tab-pane active" id="ta"><h1>TA Applicants</h1><p>Total applicants: ' + ta.length + '</p><p><a href="' + B + '/admin/search">Search</a> | <a href="' + B + '/admin/print_applications">Print student applications</a></p><div class="legend">Yellow = Commitment Student<br>Blue = Other Support<br>Red = Declined offer, Graduated, or Other</div>\n<form action="' + B + '/admin/update_accounting" method="post">\n<table class="table table-bordered">\n\t\t\t\t<thead>\n\t\t\t\t\t<tr>\n\t\t\t\t\t\t<th>Name</th>\n\t\t\t\t\t\t<th>EID</th>\n\t\t\t\t\t\t<th>Status</th>\t\n\t\t\t\t\t\t<th>GRA</th>\t\n\t\t\t\t\t\t<th>Available</th>\n\t\t\t\t\t\t<th>Assignments</th>\n\t\n\t\t\t\t\t\t<!--Acct info-->\n\t\t\t\t\t\t<th>New/Return</th>\n\t\t\t\t\t\t<th>Degree</th>\n\t\t\t\t\t\t<th>AI</th>\n\t\t\t\t\t\t<th>GPA</th>\t\n\t\t\t\t\t\t<th>Updated</th>\n\t\t\t\t\t\t<th>Update</th>\n\t\n\t\t\t\t\t</tr>\n\t\t\t\t</thead>\n\t\t\t\t<tbody>\n' + ta.map(taRow).join('\n') + '\n</tbody></table><input type="submit" name="submit" value="Update" class="btn btn-default"></form></div>';
    const ug = '<div class="tab-pane" id="ugca"><h1>UGCA Applicants</h1><p>Total applicants: ' + db.ugca.length + '</p><table class="table table-bordered">\n\t\t\t\t<thead>\n\t\t\t\t\t<tr>\n\t\t\t\t\t\t<th>Name</th>\n\t\t\t\t\t\t<th>EID</th>\n\t\t\t\t\t\t<th>Major</th>\n\t\t\t\t\t\t<th>Phone</th>\n\t\t\t\t\t\t<th>Email</th>\n\t\t\t\t\t</tr>\n\t\t\t\t</thead>\n\t\t\t\t<tbody>\n' +
      db.ugca.slice().sort((a, b) => (a.last + a.first).localeCompare(b.last + b.first)).map(u => '\t\t\t\t\t\t\t\t\t<tr>\n\t\t\t\t\t\t<td>\t\t\t\t\t\n\t\t\t\t\t\t\t<a href="#" class="proctor-view" data-record="' + u.id + '" data-toggle="modal" data-target="#modal">\n\t\t\t\t\t\t\t\t' + esc(u.first) + ' \n\t\t\t\t\t\t\t\t' + esc(u.last) + '\t\t\t\t\t\t</a>\t\t\t\n\t\t\t\t\t\t</td>\n\t\t\t\t\t\t<td>' + u.eid + '</td>\t\n\t\t\t\t\t\t<td>' + esc(u.major) + ' </td>\t\n\t\t\t\t\t\t<td>' + u.phone + '</td>\t\n\t\t\t\t\t\t<td>' + u.email + '</td>\t\n\t\t\t\t\t</tr>').join('\n') + '\n</tbody></table></div>';
    return layout('Applicants', '<ul class="nav nav-tabs"><li class="active"><a href="#ta">TA applicants</a></li><li><a href="#ugca">UGCA applicants</a></li></ul><div class="tab-content">' + taPane + ug + '</div>');
  }

  // ----- TA applicant page -----
  function taDetail(t) {
    const d = t.detail, cur = t.assignments.map(a => link('/admin/course/' + a.sid, labelOf(a.sid)) + ',').join(' ');
    const top = '<div class="row"><div class="col"><p>Commitment of support: ' + t.commitSupport + '<br>Requested by: ' + t.requestedBy + '<br>Currently Assigned to: ' + cur + '</p></div><form action="' + B + '/admin/remove_from_pool/' + t.id + '" method="post"><button class="btn btn-default btn-sm" type="submit">Remove student from TA pool</button></form></div>';
    const th = (k, v) => '\t<tr>\n\t<th>' + k + '</th>\n\t<td>' + v + '</td>\n\t</tr>\n';
    const histLines = d.hist.map(h => 'CS ' + h.number + ', ' + h.prof + ', ' + h.term + ' semester').concat(t.assignments.length ? ['CS ' + labelOf(t.assignments[0].sid).split(/\s+/)[0] + ', ' + db.classes.filter(c => c.label.split(/\s+/)[0] === labelOf(t.assignments[0].sid).split(/\s+/)[0]).map(c => db.profFull(c.prof)).join(' | ') + ', Fall 2026 semester'] : []);
    const rec = '<div id="record" data-id="' + t.id + '"><div class="record">\n\n<h2>\n\t' + esc(t.first) + ' \n\t' + esc(t.last) + ' \n\t(' + t.eid + ')\n</h2> \n\n<table class="table">\n\t<tbody>' +
      '<tr>\n\t\t<th style="width:175px">Email:</th>\n\t\t<td> <a href="mailto:' + t.email + '">' + t.email + '</a></td>\n\t</tr>\n\t<tr>\n\t\t<th>Phone Number:</th>\n\t\t<td>' + t.phone + '</td>\n\t</tr>\n' +
      th('SSN:', d.ssn) + th('Status:', t.status) + th('Native English Speaker:', d.nativeEnglish) + (d.nativeEnglish === 'No' ? th('English Assessment Results:', d.english || 'unknown') : '') + th('Supervising Prof:', esc(d.supervisor)) + th('Major Field:', d.major) + th('Grad School Admission:', d.admitted) + th('Degrees Held:', d.degrees) + th('Citizenship Status:', d.citizenship) + th(' GRA:', '\t\n\t\t\t\t\t' + (t.gra === 'yes' ? 'Yes' : t.gra === 'applied' ? 'Applied' : 'No') + '\n\t\t\t') +
      th('TA History:', '\t\t\n\t\t\t\t\n\t\t\t\t' + histLines.join('<br>\n') + '\t\t\t') + th('Are you looking to gain teaching experience:', d.gainTeaching) + th('Teaching Experience:', '\n\t\t\t\t\n\t\t\t\t' + esc(d.teaching) + '\t\t\t') +
      th('Describe any past experience or background that has made you aware of challenges that might be faced by computer science students:', esc(d.challenges)) + th('Briefly explain what a supportive learning environment means to you, and provide examples of ways to provide appropriate support in classrooms, office hours, and online environments.  You can draw examples from your own experience as a student or TA:', esc(d.supportive)) +
      '\t<tr>\n\t<th>Programming Experience:</th>\n\t<td>\t\n\t\t<table class="table">\n\t\t\t<tbody><tr>\n\t\t\t\t<th>Language</th>\n\t\t\t\t<th>Experience</th>\n\t\t\t</tr>\n' + d.langs.map(l => '\t\t\t\t\t\t<tr>\n\t\t\t\t<td>' + l[0] + '</td>\n\t\t\t\t<td>' + l[1] + '</td>\n\t\t\t</tr>').join('\n') + '\n\t\t\t<tr>\n\t\t\t\t<td>Other</td>\n\t\t\t\t<td>' + esc(d.other) + '\n</td>\n\t\t\t</tr>\n\t\t</tbody></table>\t\n\t</td>\n\t</tr>\n' +
      th('Reseach:', '\t\n\t\t<ol>\n' + d.research.map(r => '\t\t\t\t<li>' + esc(r) + '</li>').join('\n') + '\n\t\t\t\t</ol>\n\t') + th('Discussion session classes requested:', '\n\t\t<ol>\n\t\t</ol>\t\t\n\t') +
      th('Non-Discussion session classes requested:', '\n\t\t<ol>\n' + t.requests.map(s => '\t\t\t\t\t\t\t\t\t\t<li>' + esc(labelOf(s).replace(/\s+/g, ' ').replace(/^(\S+) /, '$1  ')) + '</li>').join('\n') + '\n\t\t\t\t\t\t\t\t</ol>\t\n\t') + '</tbody></table>\n\n</div></div>';
    const asg = '<div class="panel panel-default"><div class="panel-heading">Assignments</div><table class="table table-bordered"><thead><tr><th>Course</th><th>Prof</th><th>Semester</th><th>Percent Assigned</th><th>Grade</th><th>Profs Comments</th></tr></thead><tbody>' +
      d.hist.map(h => '<tr><td>' + esc(h.number) + '</td><td>' + esc(h.prof) + '</td><td>' + h.term + '</td><td>1</td><td>' + d.grade + '</td><td>' + esc(d.profComment) + '</td></tr>').join('') + t.assignments.map(a => { const c = cls(a.sid); return '<tr><td>' + esc(c.label) + '</td><td>' + esc(c.prof) + '</td><td>Fall 2026</td><td>' + a.pct + '</td><td></td><td></td></tr>'; }).join('') + '</tbody></table></div>';
    return layout(t.last + ', ' + t.first, top + rec + asg);
  }

  // ----- UGCA modal -----
  function ugcaModal(u) {
    const p = (k, v) => '<p>\n\t<strong>' + k + ':</strong> \n\t' + v + ' \n</p>\n\n<hr>\n\n';
    const reqs = u.requests.map(id => { const c = db.proctor.find(x => x.id === id); return id + ' - ' + c.number + '  ' + c.title + ' - ' + c.prof; }).join('<br>');
    return '<div class="modal fade in" id="modal" tabindex="-1" role="dialog" aria-labelledby="" style="display: block;">\n  \t<div class="modal-dialog modal-lg" role="document">\n    \t<div class="modal-content">\n\t\t\t<div class="modal-header">\n\t\t\t\t<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>\n\t\t\t\t<h4 class="modal-title">\n\t' + esc(u.first) + ' \n\t' + esc(u.last) + ' \n\t(' + u.eid + ')\n</h4>\n\t\t\t</div>\n\t\t\t<div class="modal-body">\n\n' +
      p('Phone', u.phone) + p('Email', '<a href="mailto:' + u.email + '">' + u.email + ' </a>') + p('Major', esc(u.major) + ' ') + p('Expected graduation', u.grad) + p('Experience', '<br> \n\t' + esc(u.experience)) + p('What a supportive learning environment means to you', esc(u.supportive)) + p('Challenges faced by CS students', esc(u.challenges)) +
      p('Highest CS Courses', '<br> \n\t' + u.courses.map(esc).join('<br>\n')) + p('Resume', '<a href="' + B + '/upload/view?file=/v/filer5b/web-apps/share/files/uploads/resumes/' + u.resume + '">[Download]</a>') + '<p>\n\t<strong>Requested courses to Proctor:</strong><br>\n\t' + reqs + '</p>\n</div>\n\t \t</div>\n\t</div>\n</div>';
  }

  // ----- course page (ASSUMED, not seen yet) -----
  function coursePage(c) {
    const reqs = taAll().filter(t => t.requests.includes(c.id));
    const as = [];
    taAll().forEach(t => t.assignments.forEach(a => { if (a.sid === c.id) as.push({ t, a }); }));
    return layout(c.label, '<h1>' + esc(c.label) + '</h1><p>Prof: ' + esc(c.prof) + '<br>TAs Needed: ' + c.needed.toFixed(1) + '</p><h3>Requested by</h3><table class="table table-bordered"><thead><tr><th>Rank</th><th>Student</th><th>Status</th></tr></thead><tbody>' +
      reqs.map(t => '<tr><td>' + (t.requests.indexOf(c.id) + 1) + '</td><td>' + link('/admin/applicant/' + t.id, t.last + ',' + t.first) + '</td><td>' + t.status + '</td></tr>').join('') + '</tbody></table><h3>Assigned</h3><table class="table table-bordered"><thead><tr><th>Student</th><th>Percent Assigned</th><th>Agreement</th></tr></thead><tbody>' +
      as.map(x => '<tr><td>' + link('/admin/applicant/' + x.t.id, x.t.first + ' ' + x.t.last) + '</td><td>' + x.a.pct + '</td><td>' + x.a.agree + '</td></tr>').join('') + '</tbody></table>');
  }

  // ----- assignments (drafts screen, URL given by Doug) -----
  function assignmentsPage(draft) {
    draft = draft || db.draftNo;
    const rows = draft === db.draftNo ? db.draftRows : [];
    const drow = r => {
      const t = r.t, d = t.detail;
      return '\t\t\n<tr>\n\t<td>' + esc(r.first) + '</td>\n\t<td>' + esc(r.last) + '</td>\t\n\t<td>' + r.eid + '</td>\n\t<td><a href="mailto:' + r.email + '">' + r.email + '</a></td>\n\t<td>' + r.number + ' </td>\n\t<td>' + esc(r.name) + '</td>\t\n\t<td>' + esc(r.prof) + '</td>\t\n\t<td>' + r.pct + '</td>\n\t\n\t<!--<td>' + d.ssn + '</td>\n\t<td>' + d.admitted + '</td>\n\t<td></td>\n\t<td>' + d.english + '</td>\t\n\t<td>' + t.status + '</td>\n\t<td>' + t.gra + '</td>-->\n\t<td>' + t.nr + '</td>\n\t<td>' + t.degree + '</td>\n\t<td>' + (t.ai === '1' ? 'Yes' : 'No') + '</td>\n\t<td>' + t.gpa + '</td>\t\t\n\t<td></td>\n</tr>\t';
    };
    const nums = []; for (let i = db.draftNo; i >= 1; i--) nums.push(i);
    return layout('TA assignment drafts', '<form method="get"><div class="pull-right"><label>Semester: <select name="sem" class="form-control"><option value="8" selected="selected">Fall 2026</option><option value="1">Spring 2026</option></select></label> <input type="submit" value="View"></div></form><h1>TA assignment drafts</h1><h2>Fall 2026 - Draft ' + draft + '</h2>\n<form method="get">Draft: <select name="draft">' + nums.map(n => '<option value="' + n + '"' + (n === draft ? ' selected="selected"' : '') + '>' + n + '</option>').join('') + '</select> <input type="submit" value="View"></form>\n<p><a href="' + B + '/admin/assignments/download?draft=' + draft + '">Download this draft</a></p>\n<table class="table table-bordered">\n<thead>\n<tr>\n\t<th>First name</th>\n\t<th>Last name</th>\t\n\t<th>EID</th>\n\t<th>Email</th>\n\t<th>Course Number</th>\t\n\t<th>Course Name</th>\t\n\t<th>Professor</th>\n\t<th>Percent Assigned</th>\n\t\n\t<!--<th>SSN</th>\n\t<th>Admission Date</th>\n\t<th>Native English Speaker</th>\n\t<th>English Assessment Results</th>\n\t<th>Status</th>\t\n\t<th>GRA</th>-->\t\n\t<th>New/Return</th>\n\t<th>Degree</th>\n\t<th>AI</th>\n\t<th>GPA</th>\t\n\t<th>Updates</th>\n</tr>\n</thead>\n<tbody>\n' + rows.map(drow).join('\n') + '\n</tbody>\n</table>');
  }
  function draftCsv(draft) {
    const q = v => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const head = ['First name', 'Last name', 'EID', 'Email', 'Course Number', 'Course Name', 'Professor', 'Percent Assigned', 'SSN', 'Admission Date', 'Native English Speaker', 'English Assessment Results', 'Status', 'GRA', 'New/Return', 'Degree', 'AI', 'GPA', 'Updates'];
    const rows = (draft === db.draftNo ? db.draftRows : []).map(r => [r.first, r.last, r.eid, r.email, r.number, r.name, r.prof, r.pct, r.t.detail.ssn, r.t.detail.admitted, '', r.t.detail.english, r.t.status, r.t.gra, r.t.nr, r.t.degree, r.t.ai === '1' ? 'Yes' : 'No', r.t.gpa, ''].map(q).join(','));
    return [head.map(q).join(',')].concat(rows).join('\n') + '\n'; // ASSUMED header: confirm against the real download
  }
  // ----- notify page (ASSUMED URL, markup from the real form) -----
  function notifyPage() {
    const rows = [];
    taAll().forEach(t => t.assignments.forEach(a => rows.push({ t, a })));
    rows.sort((x, y) => x.a.sid - y.a.sid);
    return layout('Notify applicants', '<form action="' + B + '/admin/assignment_notifiy" method="post" accept-charset="utf-8">\n<input type="hidden" name="ta_csrf_test" value="MOCKTOKEN0000">                          \n\n\t<table class="table table-bordered">\n\t\t<thead>\n\t\t\t<tr>\n\t\t\t\t<th>Course</th>\t\n\t\t\t\t<th>Student</th>\t\n\t\t\t\t<th>Percent Assigned</th>\n\t\t\t\t<th>Agreement</th>\n\t\t\t</tr>\n\t\t</thead>\n\t\t<tbody>\n' + rows.map(x => '\t\t\t\t\n\t\t\t<tr>\n\t\t\t\t<td>' + link('/admin/course/' + x.a.sid, labelOf(x.a.sid)) + '</td>\t\n\t\t\t\t<td>' + link('/admin/applicant/' + x.t.id, x.t.first + ' ' + x.t.last) + '</td>\t\t\n\t\t\t\t<td>' + x.a.pct + '</td>\t\n\t\t\t\t<td>' + x.a.agree + '</td>\t\n\t\t\t</tr>\t').join('\n') + '\n\t\t\t\t\t</tbody>\n\t</table>\n\n\t\t\t<input type="submit" name="submit" value="Notify applicants" class="btn btn-default">\n\t\t\n</form>');
  }

  // ----- people directory (www.cs.utexas.edu) -----
  function peoplePage() {
    const card = f => '<div class="views-row"><div class="views-field views-field-title"><a href="/people/faculty-researchers/' + f.slug + '">' + esc(f.full) + '</a></div><div class="views-field views-field-field-title">' + esc(f.title) + '</div><div class="views-field views-field-field-research"><a href="/research/' + f.area.toLowerCase().replace(/[^a-z]+/g, '-') + '">' + esc(f.area) + '</a></div></div>';
    const main = db.faculty.filter(f => !/Emeritus/.test(f.title)), aff = db.faculty.filter(f => /Emeritus/.test(f.title));
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>People</title></head><body><h1>Faculty &amp; Researchers</h1><form><select name="type"><option>Faculty</option><option>Adjunct</option><option>Affiliated</option></select><input name="search"><button>Filter</button></form><div class="view-content">' + main.map(card).join('') + '</div><h2>Affiliated Faculty</h2><div class="view-content">' + aff.map(card).join('') + '</div></body></html>';
  }
  function profilePage(f) { // ASSUMED: email as a mailto link in a contact block
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(f.full) + '</title></head><body><h1>' + esc(f.full) + '</h1><div class="title">' + esc(f.title) + '</div><div class="contact"><div>Office: GDC 4.' + (100 + f.slug.length) + '</div>' + (f.email ? '<div>Email: <a href="mailto:' + f.email + '">' + f.email + '</a></div>' : '') + '</div></body></html>';
  }
  const loginPage = () => '<!DOCTYPE html><html><head><title>Login</title></head><body><form action="' + B + '/login" method="post"><input name="username"><input name="password" type="password"><button>Login</button></form></body></html>';
  return { css, classesPage, applicantsPage, taDetail, ugcaModal, coursePage, assignmentsPage, draftCsv, notifyPage, peoplePage, profilePage, loginPage, taAll };
}
module.exports = { make };
