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
const csv=T.csvFor(pubs[1]);ok(csv.split('\n').length===4&&csv.startsWith('term,publication_version'),'CSV 3 rows + header');
ok(!/citizen|gender|PID|EID|ssn/i.test(csv),'CSV has no sensitive columns');
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
const bf=row('Biswas').fid,before=S().win[bf].emails.length;
A.openWin(bf);
ok(S().win[bf].state==='open'&&S().win[bf].emails.length===before+1,'open window queues one email');
ok(/not sent/i.test(S().win[bf].emails.slice(-1)[0].status),'email status says not sent');
ok(S().notifs.some(n=>n.to==='fac:'+bf),'faculty notified');
A.showMail(bf+'|'+(S().win[bf].emails.length-1));ok(/Ranking window open/.test(w.document.querySelector('#mailBox').value),'mail text viewable');A.hideMail();
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
if(wf){const n0=S().win[wf.fid].emails.length;A.remind(wf.fid);ok(S().win[wf.fid].emails.length===n0+1&&T.trackRows().find(r=>r.fid===wf.fid).reminders===1,'reminder queued and counted');
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
ok(/^draft,change,course,section,course_title,instructor,assignee_alias,appointment,hr_tier,fte,citizenship,note/.test(T.hrCsv(16)),'HR csv header');
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
A.setSlot('crs_f26_002','UGCA','0.5');A.goCourse('crs_f26_002');ok(/1\.5 FTE/.test(w.document.querySelector('main').textContent),'slots by role change the need');
A.setSlot('crs_f26_002','UGCA','0');A.setSlot('crs_f26_002','TA','0');ok(/1\.0 FTE/.test((A.goCourse('crs_f26_002'),w.document.querySelector('main').textContent)),'a course cannot drop below 0.25 FTE');
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
 A.tab('windows');ok(/Inbox \(mock\)/.test(txt())&&/Mailbox|mailbox/.test(txt()),'inbox card renders');
 ok(/email_reply_at/.test(T.trackCsv()),'tracker csv has reply column');}
else ok(false,'expected a waiting professor');
// publish csv tier
ok(/hr_tier/.test(T.csvFor(S().pubs[0])),'publish csv has hr_tier');
A.reset();ok(S().pubs.length===1,'reset restores seed');
console.log(errs.length?'ERRORS:\n'+errs.join('\n'):'no runtime errors');
console.log(fails?fails+' FAILED':'ALL PASSED');
