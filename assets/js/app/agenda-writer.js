(function(){
  'use strict';
  var role='',key='',loaded=null,busy=false,sequence=0;
  var url='https://script.google.com/macros/s/AKfycbyhpE-DB5WAAEx7uqTCPwU-e0sPKuupkYN3YoQWALiFWe0IHFNh1y91e1VNtDmMxxoxLA/exec';
  function isWriter(){return role==='writer'&&key&&window.AdminGate&&AdminGate.savedKey()===key;}
  function setRole(next,k){if(role!==next||key!==k){loaded=null;sequence++;}role=next;key=k;}
  function message(text){var el=document.getElementById('writerStatus');if(el)el.textContent=text;}
  async function request(action,fields){
    var k=key;if(!isWriter())throw new Error('안건 작성 권한을 다시 확인해 주세요.');
    var result=await GasNet.json(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({action:action,token:'ITDXaUBDTmrz6DbQ3tv9R',adminKey:k},fields))});
    if(!isWriter()||key!==k)throw new Error('작성 권한이 종료되었습니다.');
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
    bar.innerHTML='<label for="writerMeetingSelect">작성할 회의 </label><select id="writerMeetingSelect" style="max-width:100%;padding:8px"></select> <button class="btn" id="writerMeetingOpen">선택 회의 열기</button><div id="writerStatus" role="status" style="margin-top:8px">편집자가 등록한 회의를 불러오는 중…</div>';
    document.getElementById('agendaList').innerHTML='<div class="empty">위에서 작성할 회의를 선택해 주세요.</div>';
    document.getElementById('writerMeetingOpen').onclick=function(){open(document.getElementById('writerMeetingSelect').value);};
    try{
      var r=await request('authorList');var select=document.getElementById('writerMeetingSelect');
      select.replaceChildren();
      (r.items||[]).forEach(function(item){var o=document.createElement('option');o.value=item.id;o.textContent=item.name;select.appendChild(o);});
      message(select.options.length?'회의를 선택하고 ‘선택 회의 열기’를 눌러 주세요.':'편집자가 먼저 새 회의를 등록해야 합니다.');
    }catch(e){message(e.message);}
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
  window.AgendaWriter={setRole:setRole,isWriter:isWriter,clearMeeting:function(){loaded=null;sequence++;},hasMeeting:function(){return loaded&&state.cloudId===loaded.id;},confirmLeave:function(){return !isWriter()||!dirty()||confirm('저장하지 않은 안건 변경을 버리고 다른 회의를 열까요?');},enter:enter,save:save};
})();
