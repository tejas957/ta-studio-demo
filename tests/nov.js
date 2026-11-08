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
const M=()=>w.document.querySelector('main').textContent;
const G=()=>w.document.querySelector('#guide').textContent;
// ---- Nov 3 meeting: history archive and returners (mid scenario, Fall 2026) ----
ok(S().scn==='mid','default scenario is Fall 2026 in progress');
ok(T.isReturner('app_f26_0001')&&!T.needsTraining('app_f26_0001'),'Atlas is a returning UGCA (history by EID)');
ok(T.needsTraining('app_f26_0004'),'Delta has never been a UGCA: needs training');
ok(T.tierOf('app_f26_0002').code==='Masters 2','Birch: the Fall 2026 history row is this term, so still first time');
// Doug's real file shape: no header, messy EIDs (leading newline, nbsp, upper case), "spr 24" / "fall 23" semesters
const grid=[['Alex','Sample','\nAB1234','spr 24'],['Bea','Sample',' BS2345 ','fall 23'],['Bea','Sample','bs2345','fall 23'],['No','Eid','','fall 23'],['Cy','Sample','cs3456','return']];
let r=T.importArchive([{name:'Sheet1',rows:grid}],'UGCA','test');
ok(r.added===3&&r.dupes===1&&r.noSem===1,'archive import: header-less sheet, EIDs cleaned, duplicate skipped, odd semester kept ('+JSON.stringify({a:r.added,d:r.dupes,n:r.noSem})+')');
ok(S().arch.rows.some(x=>x.eid==='ab1234'&&x.sem==='Spring 2024')&&S().arch.rows.some(x=>x.eid==='bs2345'&&x.sem==='Fall 2023'),'semesters normalised (spr 24, fall 23)');
const withHead=[['First Name','Last name','UT EID','','Prior times'],['Dee','Sample','dd4567','Fall 24',''],['Eve','Sample','ee5678','new','']];
r=T.importArchive([{name:'Fall 18 to Spr 24',rows:withHead}],'UGCA','test');
ok(r.added===2,'archive import: header row with an unnamed semester column');
ok(T.normSem('Spring 25')==='Spring 2025'&&T.normSem('summer 26')==='Summer 2026'&&T.normSem('return')==='','semester parser');
// grad records
r=T.importGrad([{name:'grads',rows:[['EID','Name','Gender','Citizenship','Program'],['ha4108','Harbor','Female','US Citizen','MSCS'],['zz','x','M','F-1','PhD']]}]);
ok(r.added===1&&r.noEid===1,'grad records import (bad EID skipped)');
ok(T.intlOf('app_f26_0008')==='No'&&T.genderOf('app_f26_0008')==='F','grad record overrides international and gender');
// pay rates
A.setRate('PhD',null,'5100');ok(S().rates.vals.PhD===5100,'rate edited');
A.tab('setup');w.document.getElementById('raisePct').value='2';A.raiseRates();ok(S().rates.vals.PhD===Math.round(4850*1.02/10)*10,'raise all by % over last term');
// remove from pool with a reason
A.tab('applicants');A.removeAsk('app_f26_0006');ok(/Remove from pool|Withdrew/.test(M()),'removal reasons shown');
w.document.getElementById('rmWhy').value='withdrew';A.removeDo('app_f26_0006');
ok(T.FL&&S().removed.app_f26_0006&&/Removed: Withdrew/.test(M()),'removed with reason shows red');
A.setAlloc('crs_f26_003','app_f26_0006','0.5');ok(T.gate().blocks.some(b=>b.code==='Removed from pool'),'assigning a removed student blocks');
A.setAlloc('crs_f26_003','app_f26_0006','0');A.unremove('app_f26_0006');ok(!S().removed.app_f26_0006,'add back to pool');
A.removeAsk('app_f26_0009');w.document.getElementById('rmWhy').value='gra';A.removeDo('app_f26_0009');ok(S().gra.has('app_f26_0009'),'GRA reason uses the GRA list (blue)');
// grad / undergrad picker
A.goCourse('crs_f26_006');ok(/Graduate \(\d+\)/.test(M())&&/Undergraduate \(\d+\)/.test(M()),'add box has Graduate / Undergraduate lists');
A.addLevel('ug');let opts=[...w.document.querySelectorAll('#outsidePick option')].map(o=>o.value);
ok(opts.length&&opts.every(v=>T.state()&&w.__ta.state()&&!/0002|0003|0005|0006|0008|0009|0011/.test(v)),'undergraduate list has only undergraduates');
A.addLevel('grad');opts=[...w.document.querySelectorAll('#outsidePick option')].map(o=>o.value);ok(!opts.includes('app_f26_0001')&&opts.includes('app_f26_0002'),'graduate list has only graduate students');
ok(w.document.querySelectorAll('#outsidePick optgroup').length===2,'graduate list grouped PhD / Master\'s');
A.addQ(null,null,'birch');ok([...w.document.querySelectorAll('#outsidePick option')].length===1,'search narrows the list');
// tabs and tips
ok(/Step 4/.test(w.document.querySelector('.tip').textContent),'page tip explains the step');
A.tipsOff();ok(!w.document.querySelector('.tip'),'tips can be hidden');A.tipsOn();
['history','ugca','hr','setup'].forEach(t=>{A.tab(t);ok(M().length>200,'renders: '+t)});

// ---- fresh scenario, start to finish through the guided demo ----
A.guideOpen();
ok(S().scn==='fresh'&&/Spring 2027/.test(txt())&&S().pubs.length===0&&S().draft.rows.length===0&&S().hr.drafts.length===0,'guided demo starts Spring 2027 from nothing');
ok(/Quick demo · step 1 of 6/i.test(G())&&S().user.fid==='fac_j_biswas'&&S().win.fac_j_biswas.state==='open','quick demo opens on the professor ranking (windows opened for it)');
// quick track, the 3-minute presentation path
A.guideDo();ok(S().rank.crs_f26_003.status==='submitted','quick 1: rankings submitted');
A.guideNext();A.guideDo();ok(!S().draft.rows.some(r=>r.decision==='requested'),'quick 2: office accepted');
A.guideNext();A.guideDo();ok(S().pubs.length===1&&S().hr.drafts.length===1,'quick 3: published, HR draft made');
A.guideNext();ok(S().tab==='hr'&&/Draft 1/.test(M()),'quick 4: HR draft shown');
A.guideNext();ok(S().user.type==='student'&&/Accept this position/.test(M()),'quick 5: student page, offers already sent');
A.stuAccept('crs_f26_001|app_f26_0007');A.guideNext();ok(S().tab==='ugca'&&/Y · confirmed/.test(M())&&/needs training/i.test(M()),'quick 6: roster shows the confirmation and training');
ok(/step 6 of 6/.test(G()),'quick track has 6 steps');
A.guideTrack('full');ok(/Full tour · step 12 of 13/.test(G()),'switch to full tour keeps the place');
A.reset();A.guideTrack('full');A.guideGo(0);ok(/step 1 of 13/i.test(G())&&S().pubs.length===0,'full tour from a reset');
['dashboard','setup','applicants','windows','assign','publish','students','hr','ugca','history','mail','concerns','audit'].forEach(t=>{A.tab(t);ok(M().length>100,'fresh renders: '+t)});
ok(T.tierOf('app_f26_0002').code==='Masters 1 (returning)','Birch TA\'d in Fall 2026, so is a returning master\'s in Spring 2027');
ok(T.tierOf('app_f26_0008').code==='Masters 2','Harbor is a first-time master\'s');
// step through
for(let i=1;i<13;i++){A.guideGo(i);ok(/step \d+ of 13/i.test(G()),'guide step '+(i+1)+' shows');}
A.guideGo(4);A.guideDo();
ok(['crs_f26_001','crs_f26_002','crs_f26_003','crs_f26_004','crs_f26_005'].every(c=>S().rank[c].status==='submitted'),'do-it on step 5 also opened the windows and submitted the rankings');
ok(S().draft.rows.filter(r=>r.decision==='requested').length===8,'professors\' requests became requested rows ('+S().draft.rows.length+')');
const hs=S().draft.rows.filter(r=>r.course==='crs_f26_003');ok(hs.length===2&&hs.every(r=>r.fte===0.5),'J Biswas asked for two half-time TAs');
ok(S().rank.crs_f26_003.note.includes('50% GRA'),'professor note kept');
A.role(null,null,'fac:fac_j_biswas');A.facOpen('crs_f26_003');ok(/Half-time/.test(M())&&/50% GRA/.test(M()),'professor sees request and note');
A.guideGo(5);A.guideShow();ok(/note to the office/i.test(M())&&/Asked for: Half-time/.test(M()),'office sees the note and what was asked');
A.guideDo();ok(!S().draft.rows.some(r=>r.decision==='requested'),'requests accepted');
A.guideGo(6);A.guideDo();ok(S().pubs.length===1,'published v1: '+S().guide.msg);
ok(S().hr.drafts.length===1&&S().outbox.some(m=>m.audience==='HR'),'HR draft 1 made and queued on publish');
const h1=T.hrCsv(1);ok(/Masters 1 \(returning\)/.test(h1)&&/Masters 2/.test(h1)&&/,UGCA,15 hours,UGCA,\$18\/h/.test(h1),'HR draft has tiers and rates');
ok(/International/.test(h1)&&/,Yes,F,|,No,F,|,Yes,M,/.test(h1),'HR draft has international and gender');
A.guideGo(7);A.guideDo();ok(S().outbox.filter(m=>m.kind==='Assignment notice').length===8,'8 offers queued');
ok(S().outbox.some(m=>m.kind==='Assignment notice'&&/Pay: \$/.test(m.body)&&/accept or decline/.test(m.body)),'offer email has pay and the reply link');
ok(S().outbox.some(m=>m.kind==='Assignment notice'&&/UGCA training/.test(m.body)),'a new UGCA\'s offer mentions training');
A.guideGo(8);A.guideShow();ok(S().user.type==='student'&&/Accept this position/.test(M()),'student offer page');
const k='crs_f26_001|app_f26_0007';A.stuAccept(k);ok(T.state().pubs[0].responses[k].status==='confirmed','student accepted from the page');
A.guideDo();const p1=S().pubs[0];ok(p1.rows.filter(r=>p1.responses[r.course+'|'+r.app].status==='confirmed').length===7&&p1.responses['crs_f26_005|app_f26_0005'].status==='declined','everyone answered, Ember declined');
A.guideGo(9);A.guideDo();ok(S().pubs.length===2&&S().pubs[1].rows.some(r=>r.app==='app_f26_0004'),'v2 published with Delta as the backup: '+S().guide.msg);
ok(S().hr.drafts.length===2&&/,removed,/.test(T.hrCsv(2))&&/,added,/.test(T.hrCsv(2)),'HR draft 2 shows removed and added');
A.guideGo(11);A.guideShow();
ok(/Grove/.test(M())&&/Needs training|needs training/i.test(M())&&/Y · confirmed/.test(M()),'UGCA roster: confirmed and training');
const tsv=w.__ta.rosterTsv();ok(/^First Name\tLast Name\tUT EID/.test(tsv)&&/\tNew\t0\t/.test(tsv)&&/\tReturn\t3\t/.test(tsv),'roster copy has the spreadsheet columns');
const cb=w.document.querySelector('input[data-chg="training"]');cb.checked=true;cb.dispatchEvent(new w.Event('change',{bubbles:true}));
ok(Object.keys(S().training).length===1,'training marked complete');
A.trainEmail();ok(/New UGCAs who need training/.test(M())&&T.composeTargets().length===1,'email the remaining new UGCA about training');
A.guideGo(11);A.guideDo();ok(S().arch.rows.filter(r=>r.sem==='Spring 2027').length===8,'Spring 2027 added to the history');
A.guideGo(12);ok(/EID sign-in/.test(G()),'last step lists what IT needs');
// HR columns chooser
A.tab('hr');const before=S().hrCols.length;const c1=w.document.querySelector('input[data-chg="hrCol"][data-a="gender"]');c1.checked=false;c1.dispatchEvent(new w.Event('change',{bubbles:true}));
ok(S().hrCols.length===before-1&&!/Gender/.test(T.hrCsv(2)),'HR column can be removed');A.hrColsDefault();ok(/Gender/.test(T.hrCsv(2)),'reset HR columns');
ok(/\t/.test(T.hrCsv(2,'\t')),'copy for Excel is tab-separated');
A.guideClose();ok(!G().trim(),'guide closes');
A.scenario(null,null,'mid');ok(S().scn==='mid'&&S().pubs.length===1&&/Fall 2026/.test(txt()),'switch back to Fall 2026');
{const e2=errs.filter(e=>!/scrollTo|scrollIntoView/.test(e));if(e2.length){console.log(e2.join('\n'));fails++}else console.log('no runtime errors')}
console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);
