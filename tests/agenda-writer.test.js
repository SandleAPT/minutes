const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let savedKey='fixture-writer',requests=[],alerts=[],interval;
const elements={writerMeetingBar:{hidden:true,childNodes:[],innerHTML:''},writerStatus:{textContent:''},agendaList:{innerHTML:'',replaceChildren(){}},
  writerMeetingSelect:{value:'meeting',options:[],replaceChildren(){this.options=[];},appendChild(o){this.options.push(o);}},writerMeetingOpen:{},
  writerCreateToggle:{},writerCreateForm:{hidden:true},writerCreateSubmit:{},writerCreateDate:{value:'2026-10-20',focus(){}},
  writerCreateType:{value:'정기'},writerCreateTime:{value:'19:00'},writerCreatePlace:{value:'회의실'}};
const item={id:'meeting',name:'합성 회의',updatedAt:'revision1',state:{meeting:{year:2026,month:9},agendas:[{id:'a',title:'old'}]}};
let response={ok:true,items:[item]},pending;
const context={console,JSON,document:{getElementById:id=>elements[id],createElement:()=>({}),querySelector:()=>null},
  state:{cloudId:'public',agendas:[]},migrateState:s=>structuredClone(s),renderAgendas(){},renderPreview(){},
  confirm:()=>true,alert:m=>alerts.push(m),setInterval:f=>{interval=f;},
  AdminGate:{savedKey:()=>savedKey},Publication:{accept(){}},GasNet:{json:async(url,options)=>{requests.push(JSON.parse(options.body));return pending?await pending:response;}},
  window:{crypto:{randomUUID:()=> 'fixture-create-request-0001'},addEventListener(){}}};context.window.AdminGate=context.AdminGate;
vm.createContext(context);vm.runInContext(fs.readFileSync('assets/js/app/agenda-writer.js','utf8'),context);
const W=context.window.AgendaWriter;
(async()=>{
  W.setRole('writer',savedKey);assert(W.isWriter());await W.enter();assert.equal(requests.at(-1).action,'authorList');
  response={ok:true,item};elements.writerMeetingOpen.onclick();await new Promise(r=>setImmediate(r));assert(W.hasMeeting());
  context.state.agendas[0].title='changed';response={ok:true,item:{...item,updatedAt:'revision2'}};await W.save();
  assert.equal(requests.at(-1).action,'saveAgendas');assert.equal(requests.at(-1).expectedUpdatedAt,'revision1');
  assert.equal(requests.at(-1).meeting,undefined);assert.equal(requests.at(-1).agendas[0].title,'changed');
  context.state.agendas[0].title='latest';response={ok:false,error:'conflict'};await W.save();assert(alerts.at(-1).includes('다른 기기'));
  W.clearMeeting();assert(!W.hasMeeting());const before=requests.length;await W.save();assert.equal(requests.length,before);
  await W.newMeeting();assert.equal(elements.writerCreateForm.hidden,false);
  response={ok:false,error:'backup_failed'};await W.create();
  const registration=requests.at(-1);assert.equal(registration.action,'authorCreate');assert.equal(registration.templateId,'meeting');
  assert.equal(registration.meeting.date,'2026-10-20');assert.equal(registration.meeting.time,'19:00');
  assert(elements.writerStatus.textContent.includes('백업'));assert.equal(elements.writerCreateForm.hidden,false);assert(!W.hasMeeting());
  response={ok:true,item:{...item,id:'new',state:{meeting:{year:2026,month:10},agendas:[]}}};await W.create();
  assert.equal(requests.at(-1).requestId,registration.requestId,'retry retains request ID');
  assert(W.hasMeeting());assert.equal(context.state.cloudId,'new');assert.equal(elements.writerMeetingSelect.value,'new');
  assert.equal(elements.writerCreateForm.hidden,true);assert.equal(context.state.agendas.length,0);
  elements.writerMeetingSelect.value='meeting';
  W.clearMeeting();
  response={ok:true,item};let resolve;pending=new Promise(r=>{resolve=r;});elements.writerMeetingOpen.onclick();savedKey='';resolve(response);await new Promise(r=>setImmediate(r));assert(!W.hasMeeting());interval();assert(!W.isWriter());
  console.log('Agenda writer: meeting selection, scoped save, revision conflict, stale role response, public state reset passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
