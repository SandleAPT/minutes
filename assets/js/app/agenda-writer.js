(function(){
  'use strict';
  var role='',key='',loaded=null,busy=false,sequence=0,pendingCreate=null;
  var url='https://script.google.com/macros/s/AKfycbyhpE-DB5WAAEx7uqTCPwU-e0sPKuupkYN3YoQWALiFWe0IHFNh1y91e1VNtDmMxxoxLA/exec';
  function isWriter(){return role==='writer'&&key&&window.AdminGate&&AdminGate.savedKey()===key;}
  function setRole(next,k){if(role!==next||key!==k){loaded=null;pendingCreate=null;sequence++;}role=next;key=k;}
  function message(text){var el=document.getElementById('writerStatus');if(el)el.textContent=text;}
  async function request(action,fields){
    var k=key;if(!isWriter())throw new Error('안건 작성 권한을 다시 확인해 주세요.');
    var result=await GasNet.json(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({action:action,token:'ITDXaUBDTmrz6DbQ3tv9R',adminKey:k},fields))});
    if(!isWriter()||key!==k)throw new Error('작성 권한이 종료되었습니다.');
    if(result&&result.error==='backup_failed')throw new Error('별도 백업을 저장하지 못해 회의록은 변경하지 않았습니다. 다시 시도해 주세요.');
    if(result&&result.error==='invalid_meeting')throw new Error('회의 날짜·종류·시간을 확인해 주세요.');
    if(result&&['meeting_not_available','invalid_template'].includes(result.error))throw new Error('기수·명단을 이어받을 수 있는 기준 회의를 선택해 주세요.');
    if(!result||!result.ok)throw new Error(result&&result.error==='conflict'?'다른 기기에서 수정되었습니다. 입력 내용을 복사한 뒤 회의를 다시 열어 주세요.':result&&result.error==='record_too_large'?'저장 한도를 초과했습니다. 안건 내용을 줄여 주세요.':'요청을 처리하지 못했습니다. 권한과 연결을 확인해 주세요.');
    return result;
  }
  function dirty(){return loaded&&state.cloudId===loaded.id&&JSON.stringify(state.agendas)!==loaded.agendas;}
  async function open(id){
    if(!id||busy)return;
    if(dirty()&&!confirm('저장하지 않은 안건 변경을 버리고 회의를 다시 열까요?'))return;
    var ticket=++sequence;busy=true;message('회의를 불러오는 중…');
    try{
      var r=await request('authorGet',{id:id});if(ticket!==sequence)return;
      if(!r.item)throw new Error('작성할 수 있는 회의가 아닙니다.');
      state=migrateState(r.item.state);state.cloudId=r.item.id;
      Publication.accept(state,null);
      loaded={id:r.item.id,updatedAt:r.item.updatedAt,agendas:JSON.stringify(state.agendas)};
      // Keep author drafts in memory; do not publish them into shared public caches.
      renderAgendas();renderPreview();
      message(r.item.name+' · 안건만 수정할 수 있습니다. 저장 후 편집자가 발행합니다.');
    }catch(e){message(e.message);}finally{busy=false;}
  }
  async function enter(){
    var bar=document.getElementById('writerMeetingBar');if(!bar)return;
    bar.hidden=!isWriter();if(!isWriter())return;
    if(bar.childNodes.length&&loaded&&state.cloudId===loaded.id)return;
    bar.innerHTML='<label for="writerMeetingSelect">작성할 회의 </label><select id="writerMeetingSelect" style="max-width:100%;padding:8px"></select> <button class="btn" id="writerMeetingOpen">선택 회의 열기</button> <button class="btn" id="writerCreateToggle">＋ 새 회의 등록</button>' +
      '<form id="writerCreateForm" hidden style="margin-top:12px"><p>위에서 선택한 회의의 기수·명단을 이어받습니다. 안건과 출석은 빈 상태로 시작합니다.</p>' +
      '<label>회의 날짜 <input id="writerCreateDate" type="date" required></label> ' +
      '<label>종류 <select id="writerCreateType"><option>정기</option><option>임시</option></select></label> ' +
      '<label>시간 <input id="writerCreateTime" type="time"></label> ' +
      '<label>장소 <input id="writerCreatePlace" maxlength="200"></label> ' +
      '<button class="btn gold" id="writerCreateSubmit" type="submit">등록하고 열기</button></form>' +
      '<div id="writerStatus" role="status" style="margin-top:8px">작성 가능한 회의를 불러오는 중…</div>';
    document.getElementById('agendaList').innerHTML='<div class="empty">위에서 작성할 회의를 선택해 주세요.</div>';
    document.getElementById('writerMeetingOpen').onclick=function(){open(document.getElementById('writerMeetingSelect').value);};
    document.getElementById('writerCreateToggle').onclick=newMeeting;
    document.getElementById('writerCreateForm').onsubmit=function(event){event.preventDefault();create();};
    try{
      var r=await request('authorList');var select=document.getElementById('writerMeetingSelect');
      select.replaceChildren();
      (r.items||[]).forEach(function(item){var o=document.createElement('option');o.value=item.id;o.textContent=item.name;select.appendChild(o);});
      document.getElementById('writerCreateSubmit').disabled=!select.options.length;
      message(select.options.length?'회의를 열거나, 선택한 회의를 기준으로 새 회의를 등록할 수 있습니다.':'명단을 이어받을 기준 회의를 편집자가 먼저 등록해야 합니다.');
    }catch(e){message(e.message);}
  }
  async function newMeeting(){
    if(!isWriter()||busy)return;
    if(!document.getElementById('writerCreateForm'))await enter();
    var form=document.getElementById('writerCreateForm');if(!form||!isWriter())return;
    form.hidden=false;document.getElementById('writerCreateDate').focus();
  }
  async function create(){
    if(!isWriter()||busy)return;
    if(dirty()&&!confirm('저장하지 않은 안건 변경을 버리고 새 회의를 열까요?'))return;
    var input={templateId:document.getElementById('writerMeetingSelect').value,meeting:{
      date:document.getElementById('writerCreateDate').value,type:document.getElementById('writerCreateType').value,
      time:document.getElementById('writerCreateTime').value,place:document.getElementById('writerCreatePlace').value}};
    if(!input.templateId||!input.meeting.date){message('기준 회의와 회의 날짜를 선택해 주세요.');return;}
    var signature=JSON.stringify(input);
    if(!pendingCreate||pendingCreate.signature!==signature)pendingCreate={signature:signature,id:window.crypto.randomUUID()};
    var ticket=++sequence;busy=true;document.getElementById('writerCreateSubmit').disabled=true;message('새 회의를 등록하는 중…');
    try{
      var r=await request('authorCreate',Object.assign({requestId:pendingCreate.id},input));if(ticket!==sequence)return;
      if(!r.item)throw new Error('새 회의를 열지 못했습니다.');
      state=migrateState(r.item.state);state.cloudId=r.item.id;Publication.accept(state,null);
      loaded={id:r.item.id,updatedAt:r.item.updatedAt,agendas:JSON.stringify(state.agendas)};
      var select=document.getElementById('writerMeetingSelect');
      if(!Array.from(select.options).some(function(o){return o.value===r.item.id;})){
        var option=document.createElement('option');option.value=r.item.id;option.textContent=r.item.name;select.appendChild(option);
      }
      select.value=r.item.id;pendingCreate=null;document.getElementById('writerCreateForm').hidden=true;
      renderAgendas();renderPreview();message('새 회의 등록 완료. 안건을 작성하고 저장해 주세요. 공개는 편집자가 발행한 뒤 적용됩니다.');
    }catch(e){message(e.message);}finally{busy=false;document.getElementById('writerCreateSubmit').disabled=false;}
  }
  async function save(){
    if(busy)return;
    if(!loaded||state.cloudId!==loaded.id){alert('안건 입력 화면에서 작성할 회의를 먼저 열어 주세요.');return;}
    busy=true;var submitted=JSON.stringify(state.agendas),id=loaded.id;
    message('안건 저장 중…');
    try{
      var r=await request('saveAgendas',{id:id,expectedUpdatedAt:loaded.updatedAt,agendas:JSON.parse(submitted)});
      if(state.cloudId===id){loaded.updatedAt=r.item.updatedAt;loaded.agendas=submitted;}
      message('안건 저장 완료. 일반 방문자 공개는 편집자가 발행한 뒤 적용됩니다.');
    }catch(e){message(e.message);alert(e.message);}finally{busy=false;}
  }
  setInterval(function(){
    if(role==='writer'&&!isWriter()){
      role='';key='';loaded=null;sequence++;
      var bar=document.getElementById('writerMeetingBar');if(bar)bar.hidden=true;
      var box=document.getElementById('agendaList');if(box)box.replaceChildren();
      var nav=document.querySelector('[data-view="previewView"]');if(nav)nav.click();
    }
  },1000);
  window.addEventListener('beforeunload',function(e){if(isWriter()&&dirty()){e.preventDefault();e.returnValue='';}});
  window.AgendaWriter={setRole:setRole,isWriter:isWriter,clearMeeting:function(){loaded=null;sequence++;},hasMeeting:function(){return loaded&&state.cloudId===loaded.id;},confirmLeave:function(){return !isWriter()||!dirty()||confirm('저장하지 않은 안건 변경을 버리고 다른 회의를 열까요?');},enter:enter,save:save,newMeeting:newMeeting,create:create};
})();
