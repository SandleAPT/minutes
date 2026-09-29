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
const ctx=vm.createContext({console,Date,JSON,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||'',setProperty:(k,v)=>props[k]=v})},
  SpreadsheetApp:{openById:()=>({getSheetByName:n=>sheets[n],insertSheet:n=>(sheets[n]=new Sheet())})},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Utilities:{getUuid:()=> 'fixture-new'}});
vm.runInContext(fs.readFileSync('scripts/gas/main-backend.gs','utf8')+'\n'+fs.readFileSync('scripts/gas/publication.gs','utf8')+'\n'+fs.readFileSync('scripts/gas/writer.gs','utf8'),ctx);
const post=b=>ctx.doPost({postData:{contents:JSON.stringify({token:props.TOKEN,...b})}});
const get=b=>ctx.doGet({parameter:{token:props.TOKEN,...b}});
const save=(id,meeting,extra={})=>post({action:'save',adminKey:props.ADMIN_KEY,record:{id,name:id,date:meeting.date,json:JSON.stringify({meeting,agendas:[{id:'a',title:'합성 테스트'}],...extra})}});
const old={body:'입대의',year:2026,month:8,type:'정기',date:'2026-08-26'};
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
for(const adminKey of ['',props.VIEW_KEY])for(const action of ['authorList','authorGet','saveAgendas'])assert.equal(post({action,adminKey,id:'draft'}).error,'writer_required');
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
