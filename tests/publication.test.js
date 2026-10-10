const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
class Sheet{
  constructor(rows=[]){this.rows=rows;}
  getLastRow(){return this.rows.length;}
  appendRow(r){this.rows.push([...r]);}
  getRange(r,c,n=1,m=1){const self=this;return {
    getValues(){return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>self.rows[r-1+i]?.[c-1+j]??''));},
    getValue(){return self.rows[r-1]?.[c-1]??'';},
    setValues(rows){rows.forEach((v,i)=>v.forEach((x,j)=>{self.rows[r-1+i]||=[];self.rows[r-1+i][c-1+j]=x;}));},
    setValue(v){self.rows[r-1][c-1]=v;}
  };}
  deleteRow(r){this.rows.splice(r-1,1);}
}
const sheets={minutes:new Sheet([['id','name','date','updatedAt','json']])};
const props={TOKEN:'public-token',ADMIN_KEY:'fixture-edit',VIEW_KEY:'fixture-view',WRITER_KEY:'fixture-writer'};
let uuid=0;
const ctx=vm.createContext({console,Date,JSON,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||'',setProperty:(k,v)=>props[k]=v})},
  SpreadsheetApp:{openById:()=>({getSheetByName:n=>sheets[n],insertSheet:n=>(sheets[n]=new Sheet())}),flush(){}},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Utilities:{getUuid:()=> 'fixture-new-'+(++uuid)}});
vm.runInContext(fs.readFileSync('scripts/gas/main-backend.gs','utf8')+'\n'+fs.readFileSync('scripts/gas/publication.gs','utf8')+'\n'+fs.readFileSync('scripts/gas/writer.gs','utf8'),ctx);
const post=b=>ctx.doPost({postData:{contents:JSON.stringify({token:props.TOKEN,...b})}});
const get=b=>ctx.doGet({parameter:{token:props.TOKEN,...b}});
const save=(id,meeting,extra={})=>post({action:'save',adminKey:props.ADMIN_KEY,record:{id,name:id,date:meeting.date,json:JSON.stringify({meeting,agendas:[{id:'a',title:'합성 테스트'}],...extra})}});
const old={body:'입대의',termNo:6,year:2026,month:8,type:'정기',date:'2026-08-26'};
const interim={...old,month:9,type:'임시',date:'2026-09-16'};
const current={...old,month:9,type:'정기',date:'2026-09-29'};
assert.equal(save('old',old).ok,true);assert.equal(save('interim',interim).ok,true);
assert.equal(save('draft',current).ok,true);
assert.equal(get({action:'get',id:'draft'}).item,null);
assert.deepEqual(Array.from(get({action:'list'}).items,x=>x.id).sort(),['interim','old']);
assert.equal(post({action:'get',id:'draft',adminKey:props.VIEW_KEY}).error,'admin_required');
assert.equal(post({action:'publish',id:'draft'}).error,'admin_required');
const read=id=>post({action:'get',id,adminKey:props.ADMIN_KEY}).item;
assert.equal(read('draft').publication.publishedAt,'');
assert.equal(post({action:'publish',id:'draft',adminKey:props.ADMIN_KEY,expectedUpdatedAt:'wrong'}).error,'conflict');
const original=read('draft');
let result=post({action:'publish',id:'draft',adminKey:props.ADMIN_KEY,expectedUpdatedAt:original.updatedAt});
assert.equal(result.ok,true);assert.equal(result.publication.dirty,false);
const published=get({action:'get',id:'draft'}).item;
assert.equal(published.date,original.date);assert.equal(published.json,original.json);
assert.equal(published.publication.public,true);
const publishAt=published.updatedAt;
result=post({action:'publish',id:'draft',adminKey:props.ADMIN_KEY,expectedUpdatedAt:original.updatedAt});
assert.equal(result.publication.publishedAt,publishAt,'idempotent retry');
save('draft',current,{secret:'발행 후 비공개 수정'});
assert.equal(read('draft').publication.dirty,true);
assert.equal(JSON.parse(get({action:'get',id:'draft'}).item.json).secret,undefined);
assert.equal(get({action:'get',id:'draft'}).item.updatedAt,publishAt);
save('draft',{...old},{publication:{managed:false,public:true}});
assert.equal(read('draft').publication.managed,true,'date change cannot bypass publication');
assert.equal(JSON.parse(get({action:'get',id:'draft'}).item.json).meeting.month,9);
save('future',{...current,month:10,date:'2026-10-20'},{publication:{public:true}});
assert.equal(get({action:'get',id:'future'}).item,null,'forged public flag ignored');
assert.equal(get({action:'get',id:'old'}).item.date,'2026-08-26');
assert.equal(get({action:'ping'}).publicationVersion,1);
ctx.logAuth_=()=>{};
assert.equal(post({action:'verify',adminKey:props.WRITER_KEY}).role,'writer');
assert.equal(post({action:'verify',adminKey:props.WRITER_KEY}).privateStoreUrl,undefined);
for(const action of ['save','delete','setTags','publish','get','list','authLog'])assert.equal(post({action,adminKey:props.WRITER_KEY,id:'draft'}).error,'admin_required',action);
for(const adminKey of ['',props.VIEW_KEY])for(const action of ['authorList','authorGet','authorCreate','saveAgendas'])assert.equal(post({action,adminKey,id:'draft'}).error,'writer_required');
const author=b=>post({adminKey:props.WRITER_KEY,...b});
assert.equal(author({action:'authorGet',id:'old'}).item,null);
assert(!author({action:'authorList'}).items.some(x=>x.id==='old'));
const prior=read('draft'),authorItem=author({action:'authorGet',id:'draft'}).item;
assert.equal(authorItem.state.secret,undefined);
assert.equal(author({action:'saveAgendas',id:'draft',expectedUpdatedAt:'stale',agendas:[]}).error,'conflict');
const agendas=[{id:'report',type:'report',title:'임원 구성 보고',reportContent:'합성 보고내용',reportBasis:'합성 근거'}];
const saved=author({action:'saveAgendas',id:'draft',expectedUpdatedAt:prior.updatedAt,agendas,meeting:{date:''},date:'',name:'forged',rosters:{},publication:{public:true}});
assert.equal(saved.ok,true);
const after=read('draft');assert.equal(after.date,prior.date);assert.equal(after.name,prior.name);
const beforeState=JSON.parse(prior.json),afterState=JSON.parse(after.json);
assert.deepEqual(afterState.agendas,agendas);beforeState.agendas=agendas;beforeState.publication={managed:true};assert.deepEqual(afterState,beforeState);
assert.equal(get({action:'get',id:'draft'}).item.json,published.json,'author save does not publish');
// Writer-only history: exact full state, date/name/source preservation, private APIs.
const history=sheets.minutes_writer_backups;
assert.equal(history.getLastRow(),2);
const backups=post({action:'writerBackupList',adminKey:props.ADMIN_KEY,id:'draft'}).items;
assert.equal(backups.length,1);assert.equal(backups[0].date,prior.date);
const snapshot=post({action:'writerBackupGet',adminKey:props.ADMIN_KEY,backupId:backups[0].backupId}).item;
assert.deepEqual(snapshot.before,{id:prior.id,name:prior.name,date:prior.date,updatedAt:prior.updatedAt,json:prior.json});
assert.equal(snapshot.proposed.json,after.json);
assert.equal(snapshot.actor,'writer');assert.equal(JSON.stringify(snapshot).includes(props.WRITER_KEY),false);
assert.equal(get({action:'list'}).items.some(x=>x.id===backups[0].backupId),false);
for(const adminKey of ['',props.VIEW_KEY,props.WRITER_KEY])for(const action of ['writerBackupList','writerBackupGet'])
  assert.equal(post({action,adminKey,id:'draft',backupId:backups[0].backupId}).error,'admin_required');
assert.equal(post({action:'writerBackupList',adminKey:props.ADMIN_KEY,id:'missing'}).items.length,0);
assert.equal(post({action:'writerBackupGet',adminKey:props.ADMIN_KEY,backupId:'missing'}).item,null);
assert.equal(author({action:'saveAgendas',id:'draft',expectedUpdatedAt:after.updatedAt,agendas}).ok,true);
assert.equal(history.getLastRow(),2,'no-op does not archive');
assert.equal(author({action:'saveAgendas',id:'draft',expectedUpdatedAt:'stale',agendas:[]}).error,'conflict');
assert.equal(author({action:'saveAgendas',id:'draft',expectedUpdatedAt:after.updatedAt,agendas:[{id:'bad!'}]}).error,'invalid_agendas');
assert.equal(history.getLastRow(),2,'rejected writes do not archive');
let beforeEdit=read('draft');
assert.equal(post({action:'saveAgendas',adminKey:props.ADMIN_KEY,id:'draft',expectedUpdatedAt:beforeEdit.updatedAt,
  agendas:[{id:'admin',title:'관리자 수정'}]}).ok,true);
assert.equal(history.getLastRow(),2,'admin changes excluded');
// Revision A retains the old state when adding an agenda; B retains it when deleting.
beforeEdit=read('draft');
assert.equal(author({action:'saveAgendas',id:'draft',expectedUpdatedAt:beforeEdit.updatedAt,
  agendas:[{id:'admin',title:'관리자 수정'},{id:'added',title:'작성자 추가'}]}).ok,true);
assert.equal(history.getLastRow(),3);
assert.equal(history.rows[2][5],beforeEdit.json);
beforeEdit=read('draft');
assert.equal(author({action:'saveAgendas',id:'draft',expectedUpdatedAt:beforeEdit.updatedAt,agendas:[]}).ok,true);
assert.equal(history.getLastRow(),4);assert.equal(history.rows[3][5],beforeEdit.json);
const unchanged=read('draft');
// Failure to persist/verify a backup must not change the meeting or publication.
const range=history.getRange.bind(history);
history.getRange=()=>{throw new Error('sheet write failed');};
assert.equal(author({action:'saveAgendas',id:'draft',expectedUpdatedAt:unchanged.updatedAt,agendas}).error,'backup_failed');
assert.deepEqual(read('draft'),unchanged);
history.getRange=(r,c,n,m)=>{const result=range(r,c,n,m);return r===1?result:{...result,getValues:()=>[['corrupt']]};};
assert.equal(author({action:'saveAgendas',id:'draft',expectedUpdatedAt:unchanged.updatedAt,agendas}).error,'backup_failed');
assert.deepEqual(read('draft'),unchanged);history.getRange=range;
const headers=history.rows[0];history.rows[0]=['wrong'];
assert.equal(author({action:'saveAgendas',id:'draft',expectedUpdatedAt:unchanged.updatedAt,agendas}).error,'backup_failed');
assert.deepEqual(read('draft'),unchanged);history.rows[0]=headers;
assert.equal(get({action:'get',id:'draft'}).item.json,published.json);
// Writer registration: empty draft from a permitted template, stable retries, no overwrite.
const createBody={action:'authorCreate',templateId:'draft',requestId:'fixture-create-request-0001',
  meeting:{date:'2026-10-20',type:'정기',time:'19:00',place:'회의실',body:'forged',termNo:99},
  id:'old',agendas:[{id:'forged'}],source:{text:'forged'},publication:{public:true}};
const sourceBefore=read('draft'),historyCount=history.getLastRow();
const created=author(createBody);assert.equal(created.ok,true);
assert.notEqual(created.item.id,'old');assert.equal(created.item.state.meeting.date,'2026-10-20');
assert.equal(created.item.state.meeting.body,sourceBefore && JSON.parse(sourceBefore.json).meeting.body);
assert.equal(created.item.state.meeting.termNo,6);assert.equal(created.item.state.meeting.month,10);
assert.deepEqual(created.item.state.agendas,[]);assert.deepEqual(created.item.state.meeting.attendance,{});
assert.equal(read(created.item.id).date,'2026-10-20');assert.deepEqual(read('draft'),sourceBefore);
assert.equal(JSON.parse(read(created.item.id).json).source,undefined);
assert.equal(get({action:'get',id:created.item.id}).item,null,'new writer meeting starts unpublished');
assert.equal(history.getLastRow(),historyCount+1);
const creationList=post({action:'writerBackupList',adminKey:props.ADMIN_KEY,id:created.item.id}).items;
assert.equal(creationList[0].operation,'create');
const creationSnapshot=post({action:'writerBackupGet',adminKey:props.ADMIN_KEY,backupId:creationList[0].backupId}).item;
assert.equal(creationSnapshot.before,null);assert.equal(creationSnapshot.proposed.json,read(created.item.id).json);
assert.equal(author(createBody).item.id,created.item.id);assert.equal(history.getLastRow(),historyCount+1,'create retry does not duplicate');
assert.equal(author({...createBody,meeting:{...createBody.meeting,date:'2026-10-21'}}).error,'id_conflict');
assert.equal(author({...createBody,templateId:'old',requestId:'fixture-other-request-0001'}).error,'meeting_not_available');
assert.equal(author({...createBody,requestId:'short'}).error,'invalid_meeting');
for(const meeting of [{date:'2026-02-30',type:'정기'},{date:'2026-10-20',type:'other'},{date:'2026-10-20',type:'임시',time:'25:00'}])
  assert.equal(author({...createBody,meeting,requestId:'fixture-other-request-0001'}).error,'invalid_meeting');
history.rows[0]=['wrong'];
const failedId='m_writer_fixture-failed-request-0001';
assert.equal(author({...createBody,requestId:'fixture-failed-request-0001'}).error,'backup_failed');
assert.equal(read(failedId),null);history.rows[0]=headers;
assert.equal(author({action:'saveAgendas',id:created.item.id,expectedUpdatedAt:created.item.updatedAt,agendas:[{id:'new',title:'추가'}]}).ok,true);
assert.equal(author(createBody).item.state.agendas[0].title,'추가','retry does not reset later edits');
assert.equal(author({action:'delete',id:created.item.id}).error,'admin_required');
props.WRITER_KEY='';assert.equal(post({action:'verify',adminKey:'fixture-writer'}).ok,false,'unset role fails closed');
// UI role/cache guard: saved password alone does not grant draft viewing.
const ui={window:{},document:{},setInterval(){}};ui.window.AdminGate={savedKey:()=> 'fixture-edit'};
vm.runInNewContext(fs.readFileSync('assets/js/app/publication.js','utf8'),ui);
const P=ui.window.Publication,s={meeting:current};
assert.equal(P.canShow(s),false);P.setEditor(true,'fixture-edit');assert.equal(P.canShow(s),true);
P.setEditor(false,'');assert.equal(P.canShow(s),false);P.accept(s,published);assert.equal(P.canShow(s),true);
P.setEditor(true,'fixture-edit');P.setEditor(false,'');assert.equal(P.canShow(s),false);
assert.equal(P.publicItem(original),false);assert.equal(P.publicItem(published),true);
assert.equal(P.managed({meeting:interim}),false);
console.log('publication: server access, legacy compatibility, snapshot isolation, conflict, date, role/cache guards passed');
