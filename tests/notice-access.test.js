const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/../assets/js/app/notices.js','utf8');
for(const role of ['', 'view','edit']){
 let requests=[];const box={innerHTML:''};const allowed=sub=>['rules','elections'].includes(sub)||(sub==='contracts'&&!!role)||(['notices','checks'].includes(sub)&&role==='edit');
 const context={NoticeAccess:{allowed,start(){}},document:{getElementById:id=>id==='noticeBody'?box:null},window:{parent:{postMessage(){}}},location:{search:'',origin:'https://example.test'},URLSearchParams,fetch:url=>{requests.push(url);return new Promise(()=>{});},setTimeout,clearTimeout,localStorage:{getItem(){return null},setItem(){}},GasNet:{json:()=>new Promise(()=>{})}};context.window.GasNet=context.GasNet;vm.createContext(context);vm.runInContext(source,context);
 context.Notices.render();
 for(const [sub,label] of [['rules','관리규약'],['elections','선거·선관위'],['contracts','계약·기준문서'],['notices','공고·안내'],['checks','절차 점검']]){
  assert.equal(box.innerHTML.includes('>'+label+'</button>'),allowed(sub),role+':'+sub);
  context.Notices.sub(sub);
 }
 if(role!=='edit')assert(!requests.some(url=>url.includes('investigations')));
 if(!role)assert(!requests.some(url=>url.includes('contracts')));
}
console.log('Notices passed: all role menus, direct restricted sub calls, guarded document loading');
