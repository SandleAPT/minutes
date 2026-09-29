const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let savedKey='fixture-writer',requests=[],alerts=[],interval;
const elements={writerMeetingBar:{hidden:true,childNodes:[],innerHTML:''},writerStatus:{textContent:''},agendaList:{innerHTML:'',replaceChildren(){}},
  writerMeetingSelect:{value:'meeting',options:[],replaceChildren(){this.options=[];},appendChild(o){this.options.push(o);}},writerMeetingOpen:{}};
const item={id:'meeting',name:'합성 회의',updatedAt:'revision1',state:{meeting:{year:2026,month:9},agendas:[{id:'a',title:'old'}]}};
let response={ok:true,items:[item]},pending;
const context={console,JSON,document:{getElementById:id=>elements[id],createElement:()=>({}),querySelector:()=>null},
  state:{cloudId:'public',agendas:[]},migrateState:s=>structuredClone(s),renderAgendas(){},renderPreview(){},
  confirm:()=>true,alert:m=>alerts.push(m),setInterval:f=>{interval=f;},
  AdminGate:{savedKey:()=>savedKey},Publication:{accept(){}},GasNet:{json:async(url,options)=>{requests.push(JSON.parse(options.body));return pending?await pending:response;}},
  window:{addEventListener(){}}};context.window.AdminGate=context.AdminGate;
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
  response={ok:true,item};let resolve;pending=new Promise(r=>{resolve=r;});elements.writerMeetingOpen.onclick();savedKey='';resolve(response);await new Promise(r=>setImmediate(r));assert(!W.hasMeeting());interval();assert(!W.isWriter());
  console.log('Agenda writer: meeting selection, scoped save, revision conflict, stale role response, public state reset passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
