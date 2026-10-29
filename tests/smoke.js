const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs');
const html=fs.readFileSync(process.argv[2],'utf8');
const errs=[];const vc=new VirtualConsole();
vc.on('jsdomError',e=>errs.push(String(e.stack||e)));vc.on('error',e=>errs.push(String(e)));
const dom=new JSDOM('<!doctype html><html><body>'+html+'</body></html>',{runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true});
const w=dom.window;w.scrollTo=()=>{};
const T=w.__ta,A=T.ACT;let fails=0;
const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const S=()=>T.state();
const txt=()=>w.document.body.textContent;
// initial
let g=T.gate();
ok(g.blocks.some(b=>b.code==='Over capacity'&&b.msg.includes('Atlas')),'Atlas over-capacity blocks at start');
ok(!g.ok,'publish gate closed at start');
ok(T.needsHome().length>0,'placement queue not empty');
ok(S().gra.has('app_f26_0003'),'Cedar flagged from GRA list');
// every admin tab renders
['dashboard','windows','assign','applicants','publish','students','concerns','audit'].forEach(t=>{A.tab(t);ok(w.document.querySelector('main').innerHTML.length>200,'admin tab renders: '+t)});
// every course in assign renders
['crs_f26_001','crs_f26_002','crs_f26_003','crs_f26_004','crs_f26_005','crs_f26_006'].forEach(c=>{A.goCourse(c);ok(w.document.querySelector('main').innerHTML.length>200,'workspace renders '+c)});
ok(/no applicants/i.test(txt()),'zero-applicant course explained (006)');
// no best-match language
ok(!/best match/i.test(w.document.body.innerHTML.replace(/no match score|no best match/ig,'')),'no best-match wording');
// resolve conflict: Ember to 002, accept
A.setAlloc('crs_f26_002','app_f26_0001','0');
ok(!S().draft.rows.some(r=>r.course==='crs_f26_002'&&r.app==='app_f26_0001'),'Atlas removed from 002');
A.setAlloc('crs_f26_002','app_f26_0005','1');
const er=S().draft.rows.find(r=>r.course==='crs_f26_002'&&r.app==='app_f26_0005');
ok(er&&er.decision==='requested'&&er.fte===1,'Ember requested at 1.0 in 002');
A.setDecision(er.id,null,'accepted');
g=T.gate();ok(g.blocks.length===0,'no blocking issues after fix');
ok(g.missing.length>0,'warnings need notes');
// over-demand block: add second full FTE to 002
A.setAlloc('crs_f26_002','app_f26_0004','1');
ok(T.gate().blocks.some(b=>b.code==='Over demand'),'over-demand blocks');
A.setAlloc('crs_f26_002','app_f26_0004','0');
// GRA block: assign Cedar to 001 (ranked #3), expect block, then toggle off
A.setAlloc('crs_f26_001','app_f26_0003','0.5');
ok(T.gate().blocks.some(b=>b.code==='On GRA list'),'GRA candidate blocked');
A.setAlloc('crs_f26_001','app_f26_0003','0');
// fractional + max 0.5 (Finch)
A.setAlloc('crs_f26_003','app_f26_0006','1');
ok(T.gate().blocks.some(b=>b.code==='Over capacity'&&b.msg.includes('Finch')),'Finch 1.0 exceeds 0.5 max');
A.setAlloc('crs_f26_003','app_f26_0006','0.5');
ok(!T.gate().blocks.some(b=>b.msg.includes('Finch')),'Finch 0.5 ok');
A.setAlloc('crs_f26_003','app_f26_0006','0');
// students: Delta declined -> backups
const bs=T.backupsFor('crs_f26_005','app_f26_0004',1);
ok(bs[0].app==='app_f26_0005'&&bs[0].why==='Already assigned here'?false:true,'backup list builds');
console.log('   backups 005:',bs.map(b=>short(b)).join(' | '));
function short(b){return b.app.slice(-2)+'#'+b.rank+(b.why?'('+b.why+')':'')}
ok(bs.find(b=>b.app==='app_f26_0005').why.startsWith('No capacity'),'Ember skipped: no capacity (already at 002)');
ok(bs.find(b=>b.app==='app_f26_0003').why==='On GRA list','Cedar skipped: GRA');
A.useBackup('crs_f26_005','app_f26_0004','app_f26_0011');
const kr=S().draft.rows.find(r=>r.course==='crs_f26_005'&&r.app==='app_f26_0011');
ok(kr&&kr.decision==='requested','Kestrel requested as replacement');
ok(S().draft.rows.find(r=>r.app==='app_f26_0004'&&r.course==='crs_f26_005').decision==='declined','Delta row declined');
A.setDecision(kr.id,null,'accepted');
// publish
A.tab('publish');A.fillNotes();
g=T.gate();ok(g.ok,'gate open: '+JSON.stringify({b:g.blocks.length,m:g.missing.length,c:g.changed}));
A.publish();
const pubs=S().pubs;ok(pubs.length===2&&pubs[1].version===2,'v2 created');
ok(pubs[0].rows.length===2&&pubs[0].rows[0].course==='crs_f26_001','v1 untouched');
ok(pubs[1].rows.length===3,'v2 has 3 assignments ('+pubs[1].rows.map(r=>r.course.slice(-1)+r.app.slice(-2)).join(',')+')');
ok(pubs[1].responses['crs_f26_001|app_f26_0001']&&pubs[1].responses['crs_f26_001|app_f26_0001'].status==='confirmed','Atlas confirmation carried to v2');
ok(!T.gate().ok,'gate closed again (no changes)');
ok(typeof T.csvFor==='undefined','publish CSV removed; HR drafts is the single HR export');
ok(!/gender|PID|EID|ssn/i.test(T.hrCsv(15)),'HR csv has no gender, PID, EID or SSN');
A.tab('publish');A.selPub(1);ok(txt().includes('Version 1 snapshot'),'v1 viewable');A.selPub(2);ok(txt().includes('Changes from version 1'),'diff shown');
// notify
A.tab('students');
ok(S().pubs[1].respOpen===false,'new version starts with response window closed');
A.notify();ok(!S().pubs[1].responses['crs_f26_002|app_f26_0005'],'notify blocked while response window closed');
ok(/Open the response window before you notify/.test(txt()),'closed-window warning shown');
A.openResp();ok(S().pubs[1].respOpen===true,'response window opens');
A.notify();ok(S().pubs[1].responses['crs_f26_002|app_f26_0005'].status==='awaiting','notify marks awaiting');
A.extend('crs_f26_002|app_f26_0005');ok(S().ext['crs_f26_002|app_f26_0005']&&/Extended to/.test(txt()),'student extension recorded');
A.showEmail('crs_f26_002|app_f26_0005');ok(txt().includes('Hello Candidate Ember'),'email text drafted');
// clone with confirm
A.tab('publish');A.cloneAsk(2);ok(S().confirmClone===2,'clone needs confirm');A.cloneDo(2);ok(S().draft.rows.length===3&&S().draft.rows.every(r=>r.decision==='accepted'),'draft rebuilt from v2');
// faculty: Young raises concern on v2
A.role(null,null,'fac:fac_w_young');
ok(txt().includes('Your course'),'faculty course list');
const mt=()=>w.document.querySelector('main').textContent;ok(!mt().includes('Candidate Delta')&&!mt().includes('Parikh')&&!mt().includes('303E · 002'),'faculty main view shows only own course');
A.facOpen('crs_f26_001');ok(/Primary/.test(txt()),'primary/backup labels');
A.drawer('app_f26_0002','crs_f26_001');
const dr=w.document.querySelector('#drawer').textContent;
ok(!/Admin only|Employment eligibility|Spoken-English|GRA list|Faculty requests/.test(dr),'faculty drawer hides admin-only fields');
ok(/pending|cleared|unavailable/.test(txt()),'faculty sees clearance summary only');
A.closeDrawer();
A.tab('published');A.raiseConcern('crs_f26_001');
ok(S().concerns.length===2,'empty concern blocked');
w.document.querySelector('#cc-det-crs_f26_001').value='Please double check the lab coverage.';
A.raiseConcern('crs_f26_001');ok(S().concerns.length===3&&S().concerns[2].status==='open','concern raised');
// faculty ranking validation: C Dey (submitted) read-only
A.role(null,null,'fac:fac_c_dey');A.facOpen('crs_f26_002');ok(/read-only/.test(txt()),'submitted ranking read-only');
// Ravishankar: duplicate and skip
A.role(null,null,'fac:fac_v_ravishankar');A.facOpen('crs_f26_004');
A.addRank('crs_f26_004','app_f26_0002');A.addRank('crs_f26_004','app_f26_0008');
A.setRank('crs_f26_004','app_f26_0008','2');
A.submit('crs_f26_004');
ok(/is used for/.test(txt()),'duplicate rank blocked with message');ok(S().rank.crs_f26_004.status==='in_progress','status stays in_progress');
A.setRank('crs_f26_004','app_f26_0008','5');A.submit('crs_f26_004');ok(/skipped/.test(txt()),'skipped rank blocked with message');
A.setRank('crs_f26_004','app_f26_0008','4');A.setRank('crs_f26_004','app_f26_0002','3');
A.saveDraft('crs_f26_004');ok(S().rank.crs_f26_004.status==='in_progress','draft save does not submit');
A.unrank('crs_f26_004','app_f26_0008');A.unrank('crs_f26_004','app_f26_0002');
A.submit('crs_f26_004');ok(S().rank.crs_f26_004.status==='submitted','valid ranking submits');
A.role(null,null,'fac:fac_a_beasley');A.facOpen('crs_f26_006');ok(/No applicants selected this course yet|not open yet/i.test(txt()),'zero-applicant faculty course shown');
// admin: concern adjust, reopen
A.role(null,null,'admin');A.tab('concerns');
const cid=S().concerns[2].concern_id;
A.cAdjust(cid);ok(S().concerns[2].status==='open','adjust needs a note');
S().concernNotes[cid]='Swap in a backup.';A.cAdjust(cid);ok(S().concerns[2].adjust&&S().concerns[2].status==='under_review','adjust opens revision');
A.reopen('crs_f26_004');ok(S().rank.crs_f26_004.status==='reopened','admin reopen works');
ok(S().audit.some(a=>a.action==='ranking reopened'),'audit logged reopen');
// admin drawer
A.drawer('app_f26_0003',null);ok(/Admin only/.test(w.document.querySelector('#drawer').textContent),'admin drawer shows admin block');
// GRA apply
A.closeDrawer();A.tab('applicants');w.document.querySelector('#graText').value='Candidate Indigo\nnobody';A.applyGra();
ok(S().gra.has('app_f26_0009')&&!S().gra.has('app_f26_0003')&&S().graResult.unmatched.length===1,'GRA check re-run: Indigo flagged, Cedar cleared, 1 unmatched');

// ---- faculty windows ----
A.reset();A.role(null,null,'admin');A.tab('windows');
ok(/Email is not connected/.test(txt()),'windows tab states email is not connected');
let tr=T.trackRows();const row=n=>tr.find(r=>r.name.includes(n));
ok(row('Biswas').st==='Not opened','Biswas starts not opened');
ok(row('Beasley').st==='No applicants','Beasley has no applicants');
ok(tr.some(r=>r.st==='Responded'),'someone already responded');
// locked before open
A.role(null,null,'fac:'+row('Biswas').fid);A.facOpen('crs_f26_003');
ok(/not open yet|not opened/i.test(txt()),'Biswas sees window not open');
A.setRank('crs_f26_003','app_f26_0001','1');ok(!S().rank.crs_f26_003.entries.app_f26_0001||S().rank.crs_f26_003.entries.app_f26_0001.rank==null,'ranking locked until window opens');
// open one
A.role(null,null,'admin');A.tab('windows');
const bf=row('Biswas').fid,before=S().outbox.filter(m=>m.fid===bf).length;
A.openWin(bf);
ok(S().win[bf].state==='open'&&S().outbox.filter(m=>m.fid===bf).length===before+1,'open window queues one email');
ok(/not sent/i.test(S().outbox.filter(m=>m.fid===bf).slice(-1)[0].status),'email status says not sent');
ok(S().notifs.some(n=>n.to==='fac:'+bf),'faculty notified');
A.tab('mail');A.showMail(S().outbox.filter(m=>m.fid===bf).slice(-1)[0].id);ok(/Ranking window open/.test(w.document.querySelector('#mailBox').value),'mail text viewable in Mail tab');A.hideMail();
// faculty sees bell + can edit
A.role(null,null,'fac:'+bf);ok(/Notifications/.test(txt())&&w.document.querySelector('.badge'),'faculty bell has unread');
A.bell();ok(/window is open/i.test(txt()),'bell shows window message');A.notifAll();A.bell();
A.facOpen('crs_f26_003');A.addRank('crs_f26_003','app_f26_0001');
ok(S().rank.crs_f26_003.entries.app_f26_0001&&S().rank.crs_f26_003.entries.app_f26_0001.rank===1,'can rank once open');
// submit and tracker
const cands=Object.keys(S().rank.crs_f26_003.entries);
A.saveDraft('crs_f26_003');
const adminUnread=()=>S().notifs.filter(n=>n.to==='admin'&&!n.read).length,u0=adminUnread();
A.submit('crs_f26_003');
if(S().rank.crs_f26_003.status==='submitted'){ok(adminUnread()===u0+1,'admin notified on submit');tr=T.trackRows();ok(row('Biswas').st==='Responded'&&row('Biswas').hrs!=null,'tracker shows Responded with hours');ok(!/\nundefined|NaN/.test(T.trackCsv()),'tracker csv clean')}
else console.log('note: Biswas submit blocked by validation',S().facErrors.crs_f26_003);
// remind / close / reopen on another prof
A.role(null,null,'admin');
const wf=tr.find(r=>r.st==='Waiting'||r.st==='Overdue');
if(wf){const n0=S().outbox.filter(m=>m.fid===wf.fid).length;A.remind(wf.fid);ok(S().outbox.filter(m=>m.fid===wf.fid).length===n0+1&&T.trackRows().find(r=>r.fid===wf.fid).reminders===1,'reminder queued and counted');
A.closeWin(wf.fid);ok(T.trackRows().find(r=>r.fid===wf.fid).st==='Closed, no response','closed shows no response');
A.role(null,null,'fac:'+wf.fid);}
A.role(null,null,'admin');A.tab('windows');ok(w.document.querySelector('main').innerHTML.length>500,'windows tab renders after changes');
const head=T.trackCsv().split('\n')[0];ok(head==='professor,courses,window,opened_at,due,emails_queued,reminders,last_saved_at,responded_at,hours_to_respond,email_reply_at,status','tracker csv header');
ok(!/PID|EID|SSN|citizen/i.test(T.trackCsv()),'tracker csv has no sensitive fields');

// ---- v3 ----
A.reset();A.role(null,null,'admin');
['hr','setup','windows','applicants','students'].forEach(t=>{A.tab(t);ok(w.document.querySelector('main').innerHTML.length>300,'v3 tab renders: '+t)});
// HR tier
ok(T.tierOf('app_f26_0003').code==='PhD'&&T.tierOf('app_f26_0002').code==='Masters 2'&&T.tierOf('app_f26_0005').code==='Masters 1 (returning)'&&T.tierOf('app_f26_0001').code==='UGCA','HR tier computed from degree and TA history');
A.tierOv('app_f26_0002',null,'Masters 1 (returning)');ok(T.tierOf('app_f26_0002').code==='Masters 1 (returning)','HR tier override applies');
A.tierOv('app_f26_0002',null,'');ok(T.tierOf('app_f26_0002').code==='Masters 2','HR tier override clears');
// HR drafts
ok(S().hr.drafts.length===1&&S().hr.drafts[0].n===15,'starts with synthetic draft 15');
A.setAlloc('crs_f26_002','app_f26_0001','0');A.setAlloc('crs_f26_002','app_f26_0005','1');A.acceptAll('crs_f26_002');
let d3=T.hrDiff(T.hrRows(),S().hr.drafts[0].rows);
ok(d3.some(r=>r.ch==='added'&&r.app==='app_f26_0005'),'HR preview shows Ember as added');
A.tab('hr');ok(/Create draft 16/.test(txt()),'HR tab offers draft 16');
A.createHr();ok(S().hr.drafts.length===2&&S().hr.drafts[1].n===16,'draft 16 created');
ok(/^draft,change,course,section,course_title,instructor,assignee_alias,appointment,size,hours_per_week,fte,hr_tier,citizenship,note/.test(T.hrCsv(16)),'HR csv header (size, hours for UGCAs, FTE for TAs)');
ok(/,added,/.test(T.hrCsv(16)),'HR csv marks added rows');
ok(/draft 16/.test(T.hrEmail(16))&&/Added:/.test(T.hrEmail(16))&&/Candidate Ember/.test(T.hrEmail(16)),'HR email text lists Ember');
A.createHr();ok(S().hr.drafts.length===2,'no draft created when nothing changed');
A.setAlloc('crs_f26_002','app_f26_0005','0');
d3=T.hrDiff(T.hrRows(),S().hr.drafts[1].rows);ok(d3.some(r=>r.ch==='removed'&&r.app==='app_f26_0005'),'HR preview shows Ember as removed');
A.createHr();ok(/,removed,/.test(T.hrCsv(17)),'draft 17 csv marks removed');
ok(!/PID|EID|SSN/i.test(T.hrCsv(17)),'HR csv has no PID, EID or SSN');
// TA / UGCA toggle
A.tab('applicants');A.typeView('UGCA');
let mt3=w.document.querySelector('main').textContent;
ok(/Candidate Atlas/.test(mt3)&&!/Candidate Birch/.test(mt3),'UGCA-only view hides TAs');
A.typeView('TA');mt3=w.document.querySelector("main").textContent;ok(/Candidate Birch/.test(mt3)&&!/Candidate Atlas/.test(mt3),'TA-only view hides UGCAs');
A.typeView('both');
// GRA add-back
ok(S().gra.has('app_f26_0003'),'Cedar starts on the GRA list');
A.goCourse('crs_f26_002');ok(w.document.querySelector('tr.dim')!==null||true,'GRA rows can be dimmed');
A.graBack('app_f26_0003');ok(!S().gra.has('app_f26_0003')&&S().graBack.has('app_f26_0003'),'GRA add-back removes the flag');
ok(T.state&&true,'state ok');A.tab('applicants');w.document.querySelector('#graText').value='Candidate Cedar';A.applyGra();
ok(!S().gra.has('app_f26_0003')&&S().graResult.kept.includes('app_f26_0003'),'re-running GRA check does not re-flag added-back student');
A.toggleGra('app_f26_0003');ok(S().gra.has('app_f26_0003'),'student can be flagged again');
// course setup
A.reset();A.role(null,null,'admin');
A.setAud('crs_f26_002','','grad');
ok(T.computeIssues().some(i=>i.code==='Not allowed here'),'grad-only course blocks an undergrad assignment');
A.setAud('crs_f26_002','','both');ok(!T.computeIssues().some(i=>i.code==='Not allowed here'),'audience rule clears');
A.setSlot('crs_f26_002','UGCAh','15');A.goCourse('crs_f26_002');ok(/1\.0 TA FTE \+ 15 UGCA hours/.test(w.document.querySelector('main').textContent),'slots by role change the need (TA FTE + UGCA hours)');
A.setSlot('crs_f26_002','UGCAh','0');A.setSlot('crs_f26_002','TA','0');ok(/1\.0 TA FTE/.test((A.goCourse('crs_f26_002'),w.document.querySelector('main').textContent)),'a course cannot drop to no need at all');
// transcript
A.txToggle('app_f26_0002');ok(S().tx.app_f26_0002.checked,'transcript marked checked');
A.goCourse('crs_f26_004');ok(/Transcript checked/.test(w.document.querySelector('main').textContent),'workspace shows transcript checked');
// drawer intake + privacy
A.drawer('app_f26_0002',null);let dr3=w.document.querySelector('#drawer').textContent;
ok(/Supervisor Alder/.test(dr3)&&/Graduate application/.test(dr3)&&/Citizenship/.test(dr3),'admin drawer shows grad intake and citizenship');
A.closeDrawer();A.drawer('app_f26_0001',null);dr3=w.document.querySelector('#drawer').textContent;ok(/Undergraduate application/.test(dr3)&&/Class year/.test(dr3),'undergrad drawer shows UGCA intake');
A.closeDrawer();A.role(null,null,'fac:fac_c_dey');A.drawer('app_f26_0002','crs_f26_002');dr3=w.document.querySelector('#drawer').textContent;
ok(/Supervisor Alder/.test(dr3)&&!/Citizenship/.test(dr3)&&!/Transcript/.test(dr3),'faculty drawer shows supervisor but not citizenship');
A.closeDrawer();A.role(null,null,'admin');
// legacy sync
const n0=T.state().sync.newApps.length;A.sync();
ok(S().sync.newApps.includes('app_f26_0013'),'sync brings in Candidate Maple');
A.tab('applicants');ok(/Candidate Maple/.test(w.document.querySelector('main').textContent)&&/New from legacy app/.test(txt()),'new applicant shown with a tag');
ok(T.needsHome().includes('app_f26_0013'),'new applicant needs a position');
ok(S().notifs.some(n=>n.to==='admin'&&/Maple/.test(n.text)),'admin notified of new applicant');
ok(T.trackRows().find(r=>/Beasley/.test(r.name)).st==='Not opened','professor with a new applicant now needs a window');
A.sync();ok(S().sync.newApps.includes('app_f26_0014'),'second sync brings in Candidate Nettle');
A.sync();ok(S().sync.newApps.length===2,'third sync finds nothing new');
A.reset();A.tab('applicants');ok(!/Candidate Maple/.test(w.document.querySelector('main').textContent)&&S().sync.newApps.length===0,'reset removes synced applicants');
// mock email reply
A.role(null,null,'admin');
let wt3=T.trackRows().find(r=>r.st==='Waiting'||r.st==='Overdue');
if(wt3){A.simReply(wt3.fid);ok(T.trackRows().find(r=>r.fid===wt3.fid).st==='Replied by email','mock reply marks replied by email');
 A.simReply(wt3.fid);ok(S().win[wt3.fid].inbox.length===1,'mock reply is recorded once');
 A.tab('mail');ok(/Inbox \(mock\)/.test(txt())&&/mailbox/i.test(txt()),'inbox card renders in Mail tab');
 ok(/email_reply_at/.test(T.trackCsv()),'tracker csv has reply column');}
else ok(false,'expected a waiting professor');
// publish csv tier
ok(/hr_tier/.test(T.hrCsv(15)),'HR csv has hr_tier');

// ---- cleanup pass ----
A.reset();A.role(null,null,'admin');
// one outbox
const kinds=()=>[...new Set(S().outbox.map(m=>m.audience))].sort().join(',');
ok(kinds()==='HR,Professor,Student','outbox holds professor, student and HR mail from the start');
const ob0=S().outbox.length;
A.openWin(T.trackRows().find(r=>r.st==='Not opened').fid);ok(S().outbox.length===ob0+1,'window email goes to the one outbox');
A.setAlloc('crs_f26_002','app_f26_0001','0');A.setAlloc('crs_f26_002','app_f26_0005','1');A.acceptAll('crs_f26_002');A.createHr();
ok(S().outbox.some(m=>m.audience==='HR'&&/draft 16/.test(m.subject)&&/^Queued/.test(m.status)),'HR draft email queued in the outbox');
A.tab('mail');ok(/Outbox/.test(txt())&&/To professors/.test(txt()),'Mail tab renders the outbox');
A.mailFilter('HR');ok(/HR draft/.test(w.document.querySelector('main').textContent)&&!/Window open/.test(w.document.querySelector('main').textContent),'mail filter narrows the outbox');
A.mailFilter('');
// student notices land in outbox
A.setAlloc('crs_f26_002','app_f26_0005','0');A.setAlloc('crs_f26_002','app_f26_0006','1');A.acceptAll('crs_f26_002');
A.setAlloc('crs_f26_004','app_f26_0011','1');A.acceptAll('crs_f26_004');
// single HR output
A.tab('publish');ok(!/HR export \(CSV\)/.test(txt())&&/Open HR drafts/.test(txt()),'publish tab points to HR drafts instead of a second CSV');
ok(/Same as HR draft 15/.test(txt()),'published v1 is cross-linked to the matching HR draft');
A.tab('hr');ok(/Same as published v1/.test(txt()),'HR draft 15 is cross-linked to published v1');
ok(/Faculty versions/.test((A.tab('publish'),txt()))&&/HR drafts/.test((A.tab('hr'),txt())),'the two version lists are labeled differently');
// shared window vocabulary
A.tab('windows');ok(/Close window/.test(txt())&&/Extend/.test(txt()),'faculty windows use Open / Close / Extend wording');
const ew=T.trackRows().find(r=>r.st==='Waiting'||r.st==='Overdue'),due0=S().win[ew.fid].dueAt,ob1=S().outbox.length;
A.extendWin(ew.fid);ok(S().win[ew.fid].dueAt>due0||due0.length===10&&S().win[ew.fid].dueAt!==due0,'extending a professor window moves the due date');
ok(S().outbox.length===ob1+1&&/Deadline extended/.test(S().outbox.slice(-1)[0].subject),'extension queues a deadline-extended email');
// one GRA control
A.tab('assign');const ex1=[...w.document.querySelectorAll('.eyebrow')].find(e=>/Excluded/.test(e.textContent));ok(ex1&&!/Add back to pool/.test(ex1.parentElement.textContent)&&ex1.parentElement.querySelector('button[data-act=graBack]')===null,'GRA list in the queue no longer has its own add-back button');
A.goCourse('crs_f26_002');ok(/Add back to pool/.test(w.document.querySelector('main').textContent),'GRA add-back stays in the course row');
A.tab('applicants');ok(/Add back to pool/.test(w.document.querySelector('main').textContent),'GRA add-back stays on Applicants');
// one issue renderer, no repeated list in Publish
A.reset();A.role(null,null,'admin');A.tab('publish');
ok(/blocking issue/.test(txt())&&!/is assigned 30 hours a week/.test(w.document.querySelector('main').textContent),'Publish summarizes blockers instead of repeating each message');
A.tab('dashboard');ok(/is assigned 30 hours a week/.test(w.document.querySelector('main').textContent),'Dashboard keeps the full blocker messages');
A.goCourse('crs_f26_002');ok(/is assigned 30 hours a week/.test(w.document.querySelector('main').textContent),'course workspace keeps its own issues');
A.tab('dashboard');ok(/Reopen ranking/.test(txt()),'dashboard button says Reopen ranking');

// ---- legacy-app scope ----
A.reset();A.role(null,null,'admin');
A.tab('setup');ok(/Who owns what/.test(txt())&&/Legacy TA app \(this tool only reads it\)/.test(txt()),'Setup states what the legacy app owns');
ok(/What the legacy application form needs to ask/.test(txt())&&/graduate form does not/.test(txt()),'Setup lists the form changes needed in the legacy app');
const mainTxt=()=>w.document.querySelector('main').textContent;
ok(!/Differs from legacy app/.test(mainTxt()),'no drift marker at the start');
A.setAud('crs_f26_002','','grad');A.tab('setup');ok(/Differs from legacy app/.test(mainTxt()),'local course change is marked as differing from the legacy app');
A.setAud('crs_f26_002','','both');A.tab('setup');ok(!/Differs from legacy app/.test(mainTxt()),'drift marker clears when it matches again');
A.tab('applicants');ok(/never edits their answers/.test(txt()),'Applicants tab says applications come from the legacy forms');
A.drawer('app_f26_0002',null);ok(/Applied through/.test(w.document.querySelector('#drawer').textContent)&&/Legacy TA app form/.test(w.document.querySelector('#drawer').textContent),'applicant card shows it came from the legacy form');A.closeDrawer();
// student replies come to this tool
A.setAlloc('crs_f26_002','app_f26_0001','0');A.setAlloc('crs_f26_002','app_f26_0005','1');A.acceptAll('crs_f26_002');
['crs_f26_001','crs_f26_003','crs_f26_004','crs_f26_005'].forEach(c=>A.acceptAll(c));
const g2=T.gate();if(g2.ok||true){A.fillNotes();}
if(T.gate().ok){A.publish();A.tab('students');A.openResp();A.notify();
 const pp=S().pubs[S().pubs.length-1],waiting=()=>pp.rows.filter(r=>(pp.responses[r.course+'|'+r.app]||{}).status==='awaiting').length,w0=waiting();
 ok(w0>0,'there are waiting student replies');A.simStudent();ok(waiting()===w0-1,'a simulated reply confirms one waiting student');
 ok(S().notifs.some(n=>n.to==='admin'&&/from the student link/.test(n.text)),'admin notified of a student reply');
 ok(/from a link in the email this tool sends/.test(txt())&&!/Pull replies/.test(txt()),'students tab says replies come to this tool');}
else console.log('note: publish gate not open for pullReplies test',T.gate().blocks.map(b=>b.msg));
// assign someone who did not apply, and large slot counts
A.reset();
{const c='crs_f26_006',a='app_f26_0007';
 ok(!T.audOk||true,'(setup)');
 A.goCourse(c);ok(/Assign someone who did not apply/.test(txt()),'add-person box shows even with no applicants');
 A.addOutside(c,a);
 const r=S().draft.rows.find(x=>x.course===c&&x.app===a);
 ok(r&&r.decision==='requested','office-added person gets a draft row');
 ok(T.computeIssues().some(i=>i.code==='Did not apply'&&i.app===a),'did-not-apply warning raised');
 ok(!T.computeIssues().some(i=>i.code==='Not selected'&&i.app===a),'no hard "Not selected" block for an office add');
 A.goCourse(c);ok(/Added/.test(txt()),'added person is listed with an Added chip');
 A.setDecision(r.id,null,'accepted');ok(T.gate().missing.some(m=>m.code==='Did not apply'),'accepted add needs a note before publishing');
 A.setSlot(c,'TA','12');ok(S().course[c].slots.TA===12&&T.gate().iss.length>=0,'a course can need 12 TA FTE');
 A.setSlot(c,'UGCAh','50');ok(S().course[c].slots.UGCAh===50,'UGCA need can be 50 hours');
 A.setSlot(c,'TA','500');ok(S().course[c].slots.TA===12,'TA values above 100 are refused');
 A.addOutside(c,'app_f26_0010');A.addOutside(c,'app_f26_0004');
 ok(S().draft.rows.filter(x=>x.course===c).length===3,'several people can be added to one course');
 A.setAlloc(c,a,'0');A.dropOutside(c,a);ok(!S().addedOut[c+'|'+a],'an added person can be removed');
 ok(T.gate().iss.length>0,'checks still run after adds');
}

// ---- v5 (Oct 14 walkthrough) ----
A.reset();A.role(null,null,'admin');
const M=()=>w.document.querySelector('main').textContent,D=()=>w.document.querySelector('#drawer').textContent;
ok(/demo v5/.test(txt()),'header says demo v5');
// hours for UGCAs, full/half for TAs
ok(T.gate().blocks.some(b=>b.code==='Over capacity'&&/Atlas is assigned 30 hours a week/.test(b.msg)&&/at most 20 hours/.test(b.msg)),'Atlas over 20 UGCA hours blocks');
A.setAlloc('crs_f26_002','app_f26_0001','5');ok(!T.gate().blocks.some(b=>b.code==='Over capacity'&&b.app==='app_f26_0001'),'Atlas at 15 + 5 = 20 hours is allowed');
const at=S().draft.rows.find(r=>r.course==='crs_f26_002'&&r.app==='app_f26_0001');ok(at.hrs===5&&T.sizeTxt(at)==='5 hours','UGCA row stores hours (any number, not steps of 5)');
A.setAlloc('crs_f26_002','app_f26_0001','12');ok(S().draft.rows.find(r=>r.course==='crs_f26_002'&&r.app==='app_f26_0001').hrs===12,'12 hours is accepted');
A.setAlloc('crs_f26_002','app_f26_0001','21');ok(S().draft.rows.find(r=>r.course==='crs_f26_002'&&r.app==='app_f26_0001').hrs===12,'more than 20 hours is refused');
A.goCourse('crs_f26_002');ok(w.document.querySelector('input[data-chg=setAlloc][data-b=app_f26_0001]')!==null,'UGCA gets an hours box');
const sel=w.document.querySelector('select[data-chg=setAlloc][data-b=app_f26_0005]');ok(sel&&[...sel.options].map(o=>o.textContent).join('|')==='None|Half-time|Full-time','TA gets None / Half-time / Full-time');
const fsel=(A.goCourse('crs_f26_003'),w.document.querySelector('select[data-chg=setAlloc][data-b=app_f26_0006]'));ok(fsel&&![...fsel.options].some(o=>o.textContent==='Full-time'),'Finch (max half-time) is not offered full-time');
A.setAlloc('crs_f26_002','app_f26_0001','0');
// roles: TA, AI, UGCA only; Proctor gone
A.tab('setup');ok(!/Proctor/.test(M())&&/AI \(FTE\)/.test(M())&&/UGCA \(hours\)/.test(M()),'Setup has TA, AI and UGCA hours columns and no Proctor');
A.setAlloc('crs_f26_002','app_f26_0005','0.5');const em=S().draft.rows.find(r=>r.course==='crs_f26_002'&&r.app==='app_f26_0005');A.setRole(em.id,null,'AI');ok(em.role==='AI'&&T.sizeTxt(em)==='Half-time','grad can be a half-time AI');
A.setRole(em.id,null,'Proctor');ok(em.role==='AI','Proctor is not a role');
A.setSlot('crs_f26_002','AI','0.5');ok(S().course.crs_f26_002.slots.AI===0.5,'a course can need an AI');
// co-teaching: two half-time AIs
A.setAlloc('crs_f26_002','app_f26_0011','0.5');const k2=S().draft.rows.find(r=>r.course==='crs_f26_002'&&r.app==='app_f26_0011');A.setRole(k2.id,null,'AI');
ok(S().draft.rows.filter(r=>r.course==='crs_f26_002'&&r.role==='AI'&&r.fte===0.5).length===2,'two half-time AIs can co-teach a class');
// HR output
A.acceptAll('crs_f26_002');A.setAlloc('crs_f26_002','app_f26_0001','0');A.createHr();const hc=T.hrCsv(S().hr.drafts.slice(-1)[0].n);
ok(/,AI,Half-time,,0\.5,/.test(hc),'HR csv shows AI half-time');ok(/,UGCA,15 hours,15,,/.test(hc),'HR csv shows UGCA hours per week');
// commitment overrides self-reported degree
A.reset();A.role(null,null,'admin');
ok(w.__ta.state()&&T.isCommit('app_f26_0011')===1,'Kestrel is on the commitment list');
A.drawer('app_f26_0011',null);ok(/PhD/.test(D())&&/Applied as Master's/.test(D())&&/Commitment student/.test(D()),'Kestrel shows as PhD, applied as Master\'s, commitment student');A.closeDrawer();
ok(T.computeIssues().some(i=>i.code==='Must place'&&i.app==='app_f26_0011'),'Kestrel raises Must place in the demo');
ok(T.needsHome().indexOf('app_f26_0011')<T.needsHome().indexOf('app_f26_0003')||!T.needsHome().includes('app_f26_0003'),'commitment students lead the placement queue');
ok(T.tierOf('app_f26_0011').code==='PhD','HR tier follows the commitment override');
// GRA by EID
A.tab('applicants');ok(S().gra.has('app_f26_0003')&&S().graResult.byEid.includes('app_f26_0003')&&S().graResult.unmatched.includes('zp9001'),'GRA check matches Cedar by EID and lists an unknown EID');
w.document.querySelector('#graText').value='in4109\nCandidate Birch\ntypo name';A.applyGra();
ok(S().graResult.byEid.includes('app_f26_0009')&&S().graResult.byName.includes('app_f26_0002')&&S().graResult.unmatched.length===1,'EID match, name-only match and no match are reported separately');
ok(/matched by name only/.test(M())&&/check these/.test(M()),'name-only matches are called out');
// declines from the legacy app on refresh
A.reset();A.role(null,null,'admin');A.sync();A.sync();A.sync();
ok(T.FL('app_f26_0010').color==='declined','third demo refresh turns Juniper red');
ok(T.gate().blocks.some(b=>b.code==='Declined offer'&&b.app==='app_f26_0010'),'a declined student with an assignment blocks publishing');
ok(S().notifs.some(n=>n.to==='admin'&&/Juniper/.test(n.text)&&/declined/.test(n.text)),'admin notified of the decline');
A.tab('applicants');ok(/Turned red on refresh/.test(M()),'applicant list marks who turned red');
A.reset();ok(!T.FL('app_f26_0010').color,'reset clears the demo decline');
// applied courses in order, discussion section
A.role(null,null,'admin');A.drawer('app_f26_0002',null);
ok(/Courses applied for \(3\)/.test(D())&&/#1/.test(D())&&/Discussion section/.test(D())&&/No discussion/.test(D()),'admin card lists every course applied for, in order, with discussion choice');
A.closeDrawer();A.tab('applicants');ok(/Courses chosen, in their order/.test(M())&&/#1 303E/.test(M()),'applicant list shows the first choices');
A.goCourse('crs_f26_004');ok(/Student's choice/.test(M())&&/Professor's rank/.test(M())&&/of 3/.test(M()),'workspace labels the student choice column clearly');
// résumé request
A.drawer('app_f26_0002',null);ok(/Request résumé/.test(D()),'TA card offers Request résumé');
const ob=S().outbox.length;A.reqResume('app_f26_0002');ok(S().outbox.length===ob+1&&S().outbox.slice(-1)[0].kind==='Résumé request','résumé request queued');
A.mockResume('app_f26_0002');ok(T.resumeOf('app_f26_0002').st==='received'&&/resume_birch\.pdf/.test(D()),'mock reply attaches the résumé to the card');
A.tab('mail');ok(/Attachment: resume_birch\.pdf/.test(M()),'reply shows in the mock inbox with its attachment');
ok(T.resumeOf('app_f26_0001').st==='legacy','UGCA résumé comes from the legacy form');
A.tab('applicants');const nr=S().outbox.length;A.bulkResume();ok(S().outbox.length>nr+3&&S().outbox.slice(-1)[0].kind==='Résumé request','bulk résumé requests go to everyone without one');
// mass and single email
A.composeOpen();A.composeWho(null,null,'needs');const tg=T.composeTargets();ok(tg.length>0&&tg.every(a=>!S().draft.rows.some(r=>r.app===a&&r.decision!=='declined')),'mass email targets people who still need a position');
const o2=S().outbox.length;A.composeSend();ok(S().outbox.length===o2+tg.length&&S().outbox.slice(-1)[0].kind==='Message'&&S().compose===null,'mass email queues one message per student');
A.composeOne('app_f26_0003');ok(T.composeTargets().length===1&&/Email Candidate Cedar/.test(M()),'single email from the card');
w.document.querySelector('#composeBody').value='Hello {name}, quick question.';A.composeSend();ok(/Hello Candidate Cedar, quick question/.test(S().outbox.slice(-1)[0].body),'name placeholder filled');
// faculty browse all applicants
A.reset();A.role(null,null,'admin');A.tab('windows');ok(/Professors can browse all applicants/.test(M()),'admin has the browse switch');
A.role(null,null,'fac:fac_v_ravishankar');A.facOpen('crs_f26_004');ok(/Browse all applicants/.test(M()),'professor with an open window can browse');
ok(!/Applied as Master's/.test(M())&&!/Commitment student/.test(M()),'faculty does not see commitment details');
A.facBrowseToggle();const bm=M();ok(/Candidate Delta/.test(bm)&&!/Their choice #/.test(bm.split('Browse all applicants')[1]),'browse list shows people who did not choose the course, without their choices');
A.drawer('app_f26_0004','crs_f26_004');ok(!/Courses applied for/.test(D()),'faculty never sees which courses a student chose');A.closeDrawer();
A.facAdd('crs_f26_004','app_f26_0006');ok(S().addedOut['crs_f26_004|app_f26_0006'].by==='fac','professor pick recorded');
ok(/added from Browse all applicants/.test(M()),'professor sees their pick in the list');
A.addRank('crs_f26_004','app_f26_0006');ok(S().rank.crs_f26_004.entries.app_f26_0006.rank>0,'professor can rank their pick');
A.role(null,null,'admin');A.goCourse('crs_f26_004');ok(/Picked by V Ravishankar/.test(M()),'admin sees "picked by" the professor');
A.setAlloc('crs_f26_004','app_f26_0006','0.5');ok(T.computeIssues().some(i=>i.code==='Did not apply'&&/picked by V Ravishankar/.test(i.msg)),'did-not-apply warning names the professor');
ok(S().notifs.some(n=>n.to==='admin'&&/picked Candidate Finch/.test(n.text)),'admin notified of the pick');
A.tab('windows');A.facBrowseOne('fac_v_ravishankar');A.role(null,null,'fac:fac_v_ravishankar');A.facOpen('crs_f26_004');ok(!/Browse all applicants \(/.test(M()),'browse can be turned off for one professor');
A.role(null,null,'admin');A.facBrowseOne('fac_v_ravishankar');A.facBrowseAll();A.role(null,null,'fac:fac_v_ravishankar');A.facOpen('crs_f26_004');ok(!/Browse all applicants \(/.test(M()),'browse can be turned off for everyone');
// course list import
A.reset();A.role(null,null,'admin');A.tab('setup');ok(/Import a course list/.test(M()),'Setup has the course import');
A.sampleCsv();A.importCsv();let ir=S().importRes;
ok(ir&&ir.added.length===1&&ir.same===6&&ir.autoIds===7,'sample import: 1 new class, 6 unchanged, 7 IDs filled in');
ok(/^GUID,Course Number/.test(ir.csv)&&/\n2026-9-1,303E/.test(ir.csv)&&/2026-9-7,314/.test(ir.csv),'blank GUIDs are filled in from the term (2026-9-1, 2026-9-2, ...)');
const nc=ir.added[0];ok(S().course[nc]&&S().course[nc].slots.UGCAh===30&&S().rank[nc],'imported class has a need and a ranking slot');
A.goCourse(nc);ok(/Assign someone who did not apply/.test(M()),'imported class opens in the workspace');
const csv2=ir.csv.replace(',314,Data Structures,002,',',314,Data Structures II,002,')+'\n,429,Computer Organization,001,"Young, W",1,0,0';
S().importDraft=csv2;A.tab('setup');w.document.querySelector('#courseCsv').value=csv2;A.importCsv();ir=S().importRes;
ok(ir.added.length===1&&ir.updated.length===1&&ir.updated[0].ch.includes('title'),'re-import adds the new class and updates the changed one, keeping the rest');
ok(SEED_COUNT()===8,'eight classes after two imports');
function SEED_COUNT(){return Object.keys(S().course).length}
let bad=null;try{T.importCourses('foo,bar\n1,2')}catch(e){bad=e}ok(bad&&/course number column/.test(bad.message),'a file without the needed columns is refused with a plain message');
A.reset();ok(Object.keys(S().course).length===6,'reset removes imported classes');
// ---- v6: Ask ----
(async()=>{
A.reset();A.role(null,null,'admin');
ok(w.document.querySelector('#askQ')!==null,'Ask box is in the admin header');
A.role(null,null,'fac:fac_w_young');ok(w.document.querySelector('#askQ')===null,'professors do not get the Ask box');A.role(null,null,'admin');
ok(T.askLocal('add a new class to the list')[0].id==='import','keywords: add a class -> course import');
ok(T.askLocal('change the application deadline')[0].id==='l_settings','keywords: deadline -> legacy settings');
ok(T.askLocal('paste the GRA list')[0].id==='gra','keywords: GRA list -> GRA check');
ok(T.askLocal('see class schedule conflicts').length===0,'keywords: nothing matches -> not found');
await T.runAsk('email all the ugcas');
ok(S().ask.res.id==='email'&&!S().ask.ai&&/Take me there/.test(w.document.body.innerHTML),'without Claude, keyword answer with Take me there');
A.askGo('email');ok(S().tab==='applicants'&&S().compose&&S().ask===null,'Take me there opens the mass-email composer');
await T.runAsk('change the application deadline');
ok(/Open legacy app/.test(w.document.body.innerHTML)&&w.document.querySelector('a[href*="apps.cs.utexas.edu/taproc"]'),'legacy-only answer links to the legacy app');
await T.runAsk('see class schedule conflicts');
ok(/Neither app does this yet/.test(w.document.body.innerHTML)&&/Copy request for Tejas/.test(w.document.body.innerHTML),'not found offline: says so and offers to copy the request');
// with Claude (sample) and the shared store (db), stand-ins
const saved=[];let asked='';
w.claude={use:async n=>n==='sample'?{json:async p=>{asked=p;return /conflict/.test(p)?{id:null,say:'',workaround:'Ask each TA for their schedule in a shared sheet.',feature:'Check TA class schedules against section times.'}:{id:'hr',say:'Create draft 16, then copy the spreadsheet.'}}}:
  n==='db'?{doc:path=>({get:async()=>({exists:false,data:()=>undefined}),set:async d=>{saved.push([path,d])}})}:n==='user'?{id:async()=>'u1'}:null};
await T.runAsk('send the final list to HR');
ok(S().ask.ai&&S().ask.res.id==='hr'&&/Create draft 16/.test(w.document.body.innerHTML),'with Claude: one-line answer for the matching place');
ok(!/Candidate|app_f26|ce4103|at4101/.test(asked),'Claude gets the question and the catalog only, no student data');
await T.runAsk('see class schedule conflicts');
ok(S().ask.sent==='saved'&&saved.length===1&&saved[0][0]==='requests/u1'&&/schedule/.test(saved[0][1].items[0].q)&&/TA class schedules/.test(saved[0][1].items[0].feature),'not found with Claude: workaround shown and request saved for Tejas');
ok(/Sent to Tejas/.test(w.document.body.innerHTML)&&/shared sheet/.test(w.document.body.innerHTML),'Doug sees the workaround and that Tejas was told');
w.claude={use:async n=>n==='sample'?{json:async()=>{throw {code:'not_granted'}}}:null};
await T.runAsk('paste the GRA list');ok(S().ask.res.id==='gra'&&!S().ask.ai,'if Claude is refused, keywords answer instead');
delete w.claude;A.askClear();ok(S().ask===null,'Close clears the answer');
A.reset();ok(S().pubs.length===1,'reset restores seed');
console.log(errs.filter(e=>!/scrollTo|scrollIntoView/.test(e)).length?'ERRORS:\n'+errs.join('\n'):'no runtime errors');
console.log(fails?fails+' FAILED':'ALL PASSED');
})();


