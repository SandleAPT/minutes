const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../assets/js/app/core.js'),'utf8')
  .split('document.getElementById("restoreInput").addEventListener')[0];
const elements=new Map();
const document={documentElement:{classList:{contains(){return false}}},querySelectorAll(){return []},querySelector(){return null},addEventListener(){},getElementById(id){
  if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',style:{},classList:{toggle(){}},querySelector(){return null}});
  return elements.get(id);
}};
const context=vm.createContext({document,localStorage:{getItem(){return null}},window:{},Date,console,setTimeout,Math});
vm.runInContext(source,context);
const evaluate=expression=>vm.runInContext(expression,context);
const report={
  id:'report-example',type:'report',title:'제6기 입주자대표회의 임원 구성 보고',
  summary:'제6기 입주자대표회의 출범에 따라 관리규약에서 정한 임원 구성이 완료되어 그 결과를 보고함.',
  reportContent:'- 이사: 213동 이주희 대표\n- 공동체 활성화 이사: 205동 권유림 대표\n- 이사는 회장을 보좌하고, 회장이 직무를 수행할 수 없는 경우 관리규약에서 정한 순서에 따라 직무를 대행함.\n- 이주희 이사는 제6기 내부 업무분담에 따라 회의 중 논의사항과 의결 결과를 정리하는 등 회의록 작성·정리를 담당함.\n- 공동체 활성화 이사는 단지 내 공동체 활성화 사업의 발굴·장려 및 필요한 사업계획 제안 등의 역할을 하며, 특정 시설이나 단체를 직접 운영하는 역할은 아님.',
  reportBasis:'- 공동주택관리법 시행령 제12조\n- 산들마을 공동주택관리규약 제19조',
  followup:'',showFollowup:false,noRemarks:true,remarks:{},votes:{201:'for'},decision:'과거 입력값은 출력하면 안 됨',materials:[]
};
const old={id:'old',title:'기존 의결안건',summary:'',decision:'원안대로 의결함',votes:{},noRemarks:true,remarks:{},materials:[]};
context.testData={agendas:[old,report]};
evaluate('state.agendas=testData.agendas; normalizeRemarks(state.agendas[0]); normalizeRemarks(state.agendas[1])');
assert.equal(old.type,'decision');
assert.equal(evaluate('migrateState(JSON.parse(JSON.stringify({meeting:state.meeting,agendas:state.agendas}))).agendas[1].reportContent'),report.reportContent);
assert.equal(evaluate('agendaMissingFields(state.agendas[1]).length'),0);
assert.equal(evaluate('agendaMissingFields(state.agendas[0]).includes("표결")'),true);
assert.equal(evaluate('outputAgendaItems().some(item=>item.report)'),true);
assert.equal(evaluate('outputAgendaItems().some(item=>item.agenda.id==="old")'),false);
evaluate('renderAgendas()');
const form=elements.get('agendaList').innerHTML;
const reportForm=form.split('id="agenda-card-report-example"')[1].split('<div class="agenda-bottom-actions">')[0];
assert.match(reportForm,/보고사항/);
assert.match(reportForm,/보고내용/);
assert.doesNotMatch(reportForm,/vote-box|의결사항 <b>|찬성\(/);
const page=evaluate('agendaPageHtml(outputAgendaItems()[0],2,2)');
assert.match(page,/보고내용/);
assert.match(page,/공동체 활성화 이사/);
assert.match(page,/공동주택관리법 시행령 제12조/);
assert.doesNotMatch(page,/의결사항|의결결과|찬성 \d|표결/);
const cover=evaluate('coverHtml(2)');
assert.match(cover,/Ⅰ\. 의결사항/);
assert.match(cover,/Ⅱ\. 보고사항/);
const word=evaluate('wordDocumentHtml()');
const wordReport=word.split('보고 1')[1];
assert.match(wordReport,/보고내용/);
assert.doesNotMatch(wordReport,/의결사항|찬성\(/);
const xml=evaluate('docxDocumentXml()');
const xmlReport=xml.split('보고 1')[1];
assert.match(xmlReport,/보고내용/);
assert.doesNotMatch(xmlReport,/의결사항|찬성\(/);
// The legacy agenda still uses the decision path after migration.
assert.match(evaluate('agendaPageHtml(outputAgendaItems(true)[0],2,3)'),/의결사항/);
evaluate('state.agendas=[testData.agendas[1]]');
assert.match(evaluate('coverHtml(2)'),/Ⅰ\. 보고사항/);
assert.doesNotMatch(evaluate('agendaPageHtml(outputAgendaItems()[0],2,2)'),/의결사항|표결 미기입|찬성 \d/);
evaluate('state.agendas=[testData.agendas[0]]');
assert.doesNotMatch(evaluate('coverHtml(2)'),/Ⅰ\. 의결사항/); // old single-type layout stays as it was
console.log('report agenda: legacy compatibility, form, cover, preview, Word HTML and DOCX XML passed');
