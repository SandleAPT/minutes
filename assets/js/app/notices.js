// ── ⑤ 규약·공고·계약 (v70 확장) ──────────────────────────────
// 탭 1 관리규약: 정적 rules.json(조문·별표 전문, 별지 서식 목록) + 검색 — 누구나 열람.
// 탭 2 계약·기준문서: 정적 contracts.json + 조항·핵심의무·쟁점메모 검색 — 누구나 열람.
// 탭 3 공고·안내 / 탭 4 절차 점검: 클라우드 notices_v1/checks_v1 — 관리자 비밀번호를 입력한 기기에서만 표시.
//   잠금은 화면 표시 단계의 가림이다(저장소 자체의 접근 제한은 GAS 쪽 수정 필요 — docs/DATA.md §8).
//   비밀번호 검증: 존재하지 않는 id에 delete 요청 → 키가 맞으면 {ok:true,deleted:false}, 틀리면 admin_required.
var Notices=(function(){
  var URL_="https://script.google.com/macros/s/AKfycbyhpE-DB5WAAEx7uqTCPwU-e0sPKuupkYN3YoQWALiFWe0IHFNh1y91e1VNtDmMxxoxLA/exec";
  var TOKEN="ITDXaUBDTmrz6DbQ3tv9R";
  var CACHE="sandle_notices_cache_v1";
  var st={notices:null,checks:null,rulesDocs:{},contracts:null,doc:"bunyang",loading:false,rulesLoading:false,contractsLoading:false,err:"",sub:"rules",fBody:"전체",fKind:"전체",q:"",cq:"",unlocked:false,verifying:false};
  var RULE_DOCS={bunyang:{file:"rules.json",label:"◆ 분양 (공동주택관리규약)"},tenant:{file:"trules.json",label:"◇ 임차 (임대주택 관리규약)"},all:{label:"◆◇ 함께 검색"}};
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c];});}
  function hasKey(){try{return !!localStorage.getItem("sandle_admin_key");}catch(e){return false;}}
  function getRec(id){return fetch(URL_+"?action=get&token="+TOKEN+"&id="+id).then(function(r){return r.json()}).then(function(x){return x&&x.ok&&x.item?JSON.parse(x.item.json):null});}
  function verifyKey(k){return fetch(URL_,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"delete",id:"___verify_key___",adminKey:k,token:TOKEN})}).then(function(r){return r.json()}).then(function(x){return !!(x&&x.ok);});}
  function load(){
    if(st.loading) return; st.loading=true; st.err="";
    Promise.all([getRec("notices_v1").catch(function(){return null}),getRec("checks_v1").catch(function(){return null})]).then(function(rs){
      st.loading=false;
      if(rs[0]) st.notices=rs[0]; if(rs[1]) st.checks=rs[1];
      if(rs[0]||rs[1]){ try{localStorage.setItem(CACHE,JSON.stringify({notices:st.notices,checks:st.checks,at:new Date().toISOString()}));}catch(e){} }
      if(!rs[0]&&!rs[1]){ st.err="클라우드에서 불러오지 못했습니다."; try{var c=JSON.parse(localStorage.getItem(CACHE));if(c){st.notices=c.notices;st.checks=c.checks;st.err+=" (저장된 사본 표시: "+String(c.at||"").slice(0,10)+")";}}catch(e){} }
      draw();
    });
  }
  function loadRules(){
    var keys=st.doc==="all"?["bunyang","tenant"]:[st.doc];
    st._ld=st._ld||{};
    keys.forEach(function(d){
      if(st.rulesDocs[d]||st._ld[d]) return; st._ld[d]=1;
      fetch(RULE_DOCS[d].file).then(function(r){return r.json()}).then(function(j){st._ld[d]=0;st.rulesDocs[d]=j;draw();}).catch(function(){st._ld[d]=0;st.err=RULE_DOCS[d].file+"을 불러오지 못했습니다.";draw();});
    });
  }
  function loadContracts(){
    if(st.contracts||st.contractsLoading) return;
    st.contractsLoading=true;
    fetch("contracts.json").then(function(r){return r.json()}).then(function(j){st.contractsLoading=false;st.contracts=j;draw();}).catch(function(){st.contractsLoading=false;st.err="contracts.json을 불러오지 못했습니다.";draw();});
  }
  // ---- 검색 (규약) ----
  function hl(text,q){ if(!q) return esc(text); var t=esc(text),qq=esc(q); var i,out="",low=t.toLowerCase(),ql=qq.toLowerCase(),from=0; while((i=low.indexOf(ql,from))>=0){ out+=t.slice(from,i)+"<mark>"+t.slice(i,i+qq.length)+"</mark>"; from=i+qq.length; } return out+t.slice(from); }
  function ruleArticleHtml(a,q,open){
    return '<details class="rl-art"'+(open?" open":"")+'><summary><b>'+hl(a.no+(a.title?"("+a.title+")":""),q)+'</b></summary><div class="rl-text">'+hl(a.text,q).replace(/\n/g,"<br>")+'</div></details>';
  }
  function docBodyHtml(r,q){
    var h="",shown=0;
    (r.chapters||[]).forEach(function(ch){
      var arts=(ch.articles||[]).filter(function(a){ return !q || (a.no+(a.title||"")+a.text).toLowerCase().indexOf(q.toLowerCase())>=0; });
      if(!arts.length) return;
      shown+=arts.length;
      h+='<div class="rl-ch">'+esc(ch.no?ch.no+" ":"")+esc(ch.title||"")+'</div>'+arts.map(function(a){return ruleArticleHtml(a,q,!!q)}).join("");
    });
    var apps=(r.appendices||[]).filter(function(a){ return !q || (a.no+(a.title||"")+(a.text||"")).toLowerCase().indexOf(q.toLowerCase())>=0; });
    if(apps.length){ h+='<div class="rl-ch">별표</div>'+apps.map(function(a){return '<details class="rl-art"'+(q?" open":"")+'><summary><b>'+hl(a.no+" "+(a.title||""),q)+'</b></summary><div class="rl-text">'+hl(a.text||"",q).replace(/\n/g,"<br>")+'</div></details>'}).join(""); shown+=apps.length; }
    var forms=(r.forms||[]).filter(function(f){ return !q || (f.no+" "+(f.title||"")+" "+(f.note||"")).toLowerCase().indexOf(q.toLowerCase())>=0; });
    if(forms.length){ h+='<div class="rl-ch">별지 서식 <span class="small">(서식 명칭·용도만 수록 — 양식 원본은 PDF)</span></div><ul class="nt-facts">'+forms.map(function(f){return '<li>'+hl(f.no+" "+(f.title||""),q)+(f.note?' — <span class="small">'+hl(f.note,q)+'</span>':'')+'</li>'}).join("")+'</ul>'; shown+=forms.length; }
    return {html:h,shown:shown};
  }
  function rulesHtml(){
    var docBtns='<div class="rl-docs">'+Object.keys(RULE_DOCS).map(function(k){return '<button type="button" class="btn'+(st.doc===k?" gold":"")+'" onclick="Notices.doc(\''+k+'\')">'+RULE_DOCS[k].label+'</button>'}).join("")+'</div>';
    var keys=st.doc==="all"?["bunyang","tenant"]:[st.doc];
    var missing=keys.filter(function(d){return !st.rulesDocs[d]});
    if(missing.length){ return docBtns+'<div class="nt-empty">관리규약 불러오는 중…</div>'; }
    var q=st.q.trim();
    var h=docBtns+'<div class="rl-head"><input id="ruleSearch" class="rl-search" placeholder="'+(st.doc==="all"?"두 규약을 함께 검색 (예: 선거관리위원회, 겸임금지)":"규약 전문 검색 (예: 선거관리위원회, 장기수선충당금)")+'" value="'+esc(st.q)+'" oninput="Notices.search(this.value)">';
    if(st.doc==="all"){ h+='<div class="small" style="margin-top:4px">분양(2024.10.30 시행)·임차(2020.04.18 시행) 규약을 함께 봅니다 — 이미지 원본을 옮겨 적은 사본이며, 효력은 원본 문서에 있습니다.</div>'; }
    else { var r0=st.rulesDocs[st.doc]; h+='<div class="small" style="margin-top:4px">'+esc(r0.title)+' · '+esc(r0.effective)+' 시행 · 원본: '+esc(r0.source)+' — 이미지 원본을 옮겨 적은 사본이며, 효력은 원본 문서에 있습니다.</div>'; }
    h+='</div>';
    var shown=0, body="";
    keys.forEach(function(d){
      var sec=docBodyHtml(st.rulesDocs[d],q);
      if(st.doc==="all"){
        body+='<div class="rl-doc-h">'+esc(RULE_DOCS[d].label)+' <span class="small">'+esc(st.rulesDocs[d].effective)+' 시행'+(q?' — '+sec.shown+'건':'')+'</span></div>';
        if(q&&!sec.shown) body+='<div class="nt-empty" style="padding:10px">이 규약에는 검색 결과가 없습니다.</div>';
      }
      body+=sec.html; shown+=sec.shown;
    });
    if(q) h+='<div class="rl-count">"'+esc(q)+'" 검색 결과 '+shown+'건'+(st.doc==="all"?"(두 규약 합산)":"")+' — 해당 조문만 표시(펼침)</div>';
    h+=body;
    if(q&&!shown) h+='<div class="nt-empty">검색 결과가 없습니다.</div>';
    return h;
  }
  // ---- 계약·기준문서 ----
  function contractHay(c){
    return [c.ref,c.title,c.summary,c.issueNote,(c.keywords||[]).join(" ")].join(" ").toLowerCase();
  }
  function contractClauseHtml(c,q){
    return '<details class="rl-art"'+(q?" open":"")+'><summary><b>'+hl(c.ref+(c.title?"("+c.title+")":""),q)+'</b></summary>'+
      '<div class="rl-text">'+hl(c.summary||"",q)+'</div>'+
      (c.issueNote?'<div class="nt-note" style="margin-top:10px"><b>현재 검토 메모</b><br>'+hl(c.issueNote,q)+'</div>':"")+
      (c.keywords&&c.keywords.length?'<div class="nt-rel">검색어: '+c.keywords.map(function(k){return '<span class="nt-chip">'+hl(k,q)+'</span>'}).join(" ")+'</div>':"")+
    '</details>';
  }
  function contractsHtml(){
    if(!st.contracts){ return '<div class="nt-empty">'+(st.contractsLoading?"계약·기준문서 불러오는 중…":"계약·기준문서가 없습니다.")+'</div>'; }
    var q=st.cq.trim(), h='<div class="rl-head"><input id="contractSearch" class="rl-search" placeholder="계약·기준문서 검색 (예: 계약해지, 관리소장, LH, 감사, 보고)" value="'+esc(st.cq)+'" oninput="Notices.contractSearch(this.value)">';
    h+='<div class="small" style="margin-top:4px">'+esc(st.contracts.note||"")+'</div></div>';
    var total=0;
    (st.contracts.items||[]).forEach(function(d){
      var clauses=(d.clauses||[]).filter(function(c){return !q||contractHay(c).indexOf(q.toLowerCase())>=0;});
      if(q&&!clauses.length && [d.title,d.type,d.period,(d.tags||[]).join(" ")].join(" ").toLowerCase().indexOf(q.toLowerCase())<0) return;
      total+=clauses.length;
      h+='<div class="rl-doc-h">'+esc(d.title)+' <span class="small">'+esc(d.period||"")+'</span></div>';
      h+='<div class="nt-sum"><b>'+esc(d.type||"계약")+'</b> · '+esc((d.parties||[]).join(" ↔ "))+'<br><span class="small">원본: '+esc(d.source||"")+'</span></div>';
      if(!clauses.length && q){ h+='<div class="nt-empty" style="padding:10px">문서 기본정보에는 검색어가 있으나 해당 조항 요약에는 검색 결과가 없습니다.</div>'; }
      else h+=clauses.map(function(c){return contractClauseHtml(c,q)}).join("");
    });
    if(q) h='<div class="rl-count">"'+esc(q)+'" 계약·기준문서 검색 결과 '+total+'개 조항</div>'+h;
    if(q&&!total && h.indexOf('rl-doc-h')<0) h+='<div class="nt-empty">검색 결과가 없습니다.</div>';
    return h;
  }
  // ---- 잠금 ----
  function lockHtml(){
    return '<div class="nt-lock"><div class="nt-lock-ic">🔒</div><b>관리자 확인이 필요한 기록입니다</b>'+
      '<p>공고·안내 보관함과 절차 점검 기록은 관리자 비밀번호를 입력한 기기에서만 열람할 수 있습니다.</p>'+
      '<div class="nt-lock-row"><input id="ntKeyInput" type="password" placeholder="관리자 비밀번호" onkeydown="if(event.key===\'Enter\')Notices.unlock()">'+
      '<button type="button" class="btn gold" onclick="Notices.unlock()">'+(st.verifying?"확인 중…":"확인")+'</button></div>'+
      '<div id="ntKeyMsg" class="nt-err" style="margin-top:8px"></div></div>';
  }
  function locked(){ return !(st.unlocked||hasKey()); }
  // ---- 카드 ----
  function badge(txt,cls){return '<span class="nt-badge '+cls+'">'+esc(txt)+'</span>';}
  function bodyCls(b){return b==="임차"?"t":b&&b.indexOf("선관위")>=0?"e":b==="관리사무소"?"o":"a";}
  function bullets(arr){return (arr&&arr.length)?'<ul class="nt-facts">'+arr.map(function(f){return '<li>'+esc(f)+'</li>'}).join("")+'</ul>':"";}
  function relChips(rel){
    if(!rel||!rel.length) return "";
    return '<div class="nt-rel">관련 기록: '+rel.map(function(r){
      if(r.type==="minutes") return '<button type="button" class="nt-chip" onclick="Cloud._open(\''+esc(r.id)+'\')">'+esc(r.label||r.id)+'</button>';
      if(r.type==="notice") return '<button type="button" class="nt-chip" onclick="Notices.jump(\''+esc(r.id)+'\')">'+esc(r.label||r.id)+'</button>';
      return '<span class="nt-chip">'+esc(r.label||r.id)+'</span>';
    }).join(" ")+'</div>';
  }
  function noticeCard(n){
    var meta=[n.noticeNo?("공고번호 "+n.noticeNo):"",n.postRange?("게시 "+n.postRange):""].filter(Boolean).join(" · ");
    return '<div class="nt-card" id="nt-'+esc(n.id)+'">'+
      '<div class="nt-head"><span class="nt-date">'+esc(n.date||"")+'</span>'+badge(n.body,bodyCls(n.body))+badge(n.kind,"k")+'</div>'+
      '<div class="nt-title">'+esc(n.title)+'</div>'+
      (n.summary?'<div class="nt-sum">'+esc(n.summary)+'</div>':"")+
      bullets(n.facts)+
      (n.text?'<details class="nt-src"><summary>📄 원문 전문'+(meta?' <span class="small">'+esc(meta)+'</span>':"")+'</summary><pre>'+esc(n.text)+'</pre>'+(n.file?'<div class="nt-foot">원본 파일: '+esc(n.file)+'</div>':"")+'</details>':"")+
      (n.link?'<div class="nt-foot"><a href="'+esc(n.link)+'" target="_blank" rel="noopener">원본 열기(드라이브) ↗</a></div>':"")+
      (n.notes?'<div class="nt-foot">※ '+esc(n.notes)+'</div>':"")+
      relChips(n.related)+
    '</div>';
  }
  var ST_CLS={"확인중":"s1","질의함":"s2","해소":"s3","문제없음":"s4"};
  function checkCard(c){
    return '<div class="nt-card" id="nt-'+esc(c.id)+'">'+
      '<div class="nt-head"><span class="nt-badge st '+(ST_CLS[c.status]||"s1")+'">'+esc(c.status||"확인중")+'</span><span class="nt-date">'+esc(c.opened||"")+' 기록</span></div>'+
      '<div class="nt-title">'+esc(c.title)+'</div>'+
      '<div class="nt-sec">사실관계 <span class="small">(공고·회의록 기재 내용)</span></div>'+bullets(c.facts)+
      (c.rules&&c.rules.length?'<div class="nt-sec">근거 규정</div><ul class="nt-facts">'+c.rules.map(function(r){return '<li>'+esc(r.ref)+(r.text?' — '+esc(r.text):'')+(r.verified?' <span class="nt-ok">원문 확인됨</span>':' <span class="nt-todo">조문 원문 확인 필요</span>')+'</li>'}).join("")+'</ul>':"")+
      (c.question?'<div class="nt-sec">확인할 점</div><div class="nt-sum">'+esc(c.question)+'</div>':"")+
      (c.memo?'<div class="nt-memo">🔒 메모: '+esc(c.memo)+'</div>':"")+
      relChips(c.related)+
    '</div>';
  }
  function draw(){
    var box=document.getElementById("noticeBody"); if(!box) return;
    var lockMark=locked()?" 🔒":"";
    var h='<div class="nt-tabs">'+
      '<button type="button" class="btn'+(st.sub==="rules"?" gold":"")+'" onclick="Notices.sub(\'rules\')">관리규약</button>'+
      '<button type="button" class="btn'+(st.sub==="contracts"?" gold":"")+'" onclick="Notices.sub(\'contracts\')">계약·기준문서</button>'+
      '<button type="button" class="btn'+(st.sub==="notices"?" gold":"")+'" onclick="Notices.sub(\'notices\')">공고·안내'+(!locked()&&st.notices?' ('+st.notices.items.length+')':lockMark)+'</button>'+
      '<button type="button" class="btn'+(st.sub==="checks"?" gold":"")+'" onclick="Notices.sub(\'checks\')">절차 점검'+(!locked()&&st.checks?' ('+st.checks.items.length+')':lockMark)+'</button></div>';
    if(st.err) h+='<div class="nt-err">'+esc(st.err)+'</div>';
    if(st.sub==="rules"){ box.innerHTML=h+rulesHtml(); return; }
    if(st.sub==="contracts"){ box.innerHTML=h+contractsHtml(); if(!st.contracts&&!st.contractsLoading) loadContracts(); return; }
    if(locked()){ box.innerHTML=h+lockHtml(); return; }
    if(st.sub==="notices"){
      if(!st.notices){ h+='<div class="nt-empty">'+(st.loading?"불러오는 중…":"기록이 없습니다.")+'</div>'; box.innerHTML=h; if(!st.loading) load(); return; }
      var items=st.notices.items.slice();
      var bodies=["전체"].concat(Array.from(new Set(items.map(function(n){return n.body}))));
      var kinds=["전체"].concat(Array.from(new Set(items.map(function(n){return n.kind}))));
      h+='<div class="nt-filters">'+bodies.map(function(b){return '<button type="button" class="btn'+(st.fBody===b?" gold":"")+'" onclick="Notices.fBody(\''+esc(b)+'\')">'+esc(b)+'</button>'}).join("")+
         '<span class="nt-sep"></span>'+kinds.map(function(k){return '<button type="button" class="btn'+(st.fKind===k?" gold":"")+'" onclick="Notices.fKind(\''+esc(k)+'\')">'+esc(k)+'</button>'}).join("")+'</div>';
      items=items.filter(function(n){return (st.fBody==="전체"||n.body===st.fBody)&&(st.fKind==="전체"||n.kind===st.fKind)});
      items.sort(function(a,b){return String(b.date).localeCompare(String(a.date))});
      var years={},order=[];
      items.forEach(function(n){var y=String(n.date||"").slice(0,4)||"기타";if(!years[y]){years[y]=[];order.push(y)}years[y].push(n)});
      order.forEach(function(y){h+='<div class="nt-year">'+esc(y)+'년 <span class="small">('+years[y].length+')</span></div>'+years[y].map(noticeCard).join("")});
      if(!items.length) h+='<div class="nt-empty">조건에 맞는 기록이 없습니다.</div>';
    }else{
      if(!st.checks){ h+='<div class="nt-empty">'+(st.loading?"불러오는 중…":"기록이 없습니다.")+'</div>'; box.innerHTML=h; if(!st.loading) load(); return; }
      h+='<div class="nt-note">이 기록은 공고·회의록에 적힌 <b>사실</b>과 <b>규정</b>만 싣습니다. 특정인에 대한 판단·평가는 싣지 않으며, 상태는 확인중 → 질의함 → 해소/문제없음으로 갱신합니다.</div>';
      h+=st.checks.items.map(checkCard).join("");
    }
    box.innerHTML=h;
  }
  return {
    render:function(){ draw(); if(st.sub==="rules") loadRules(); else if(st.sub==="contracts") loadContracts(); },
    reload:function(){ st.notices=null; st.checks=null; st.rulesDocs={}; st.contracts=null; if(st.sub==="rules") loadRules(); else if(st.sub==="contracts") loadContracts(); else if(!locked()) load(); draw(); },
    sub:function(s){ st.sub=s; draw(); if(s==="rules") loadRules(); else if(s==="contracts") loadContracts(); else if(!locked()&&!st.notices) load(); },
    fBody:function(b){ st.fBody=b; draw(); },
    doc:function(d){ st.doc=d; draw(); loadRules(); },
    fKind:function(k){ st.fKind=k; draw(); },
    search:function(q){ st.q=q; clearTimeout(st._t); st._t=setTimeout(function(){ var el=document.getElementById("ruleSearch"); var pos=el?el.selectionStart:0; draw(); var el2=document.getElementById("ruleSearch"); if(el2){ el2.focus(); try{el2.setSelectionRange(pos,pos);}catch(e){} } },250); },
    contractSearch:function(q){ st.cq=q; clearTimeout(st._ct); st._ct=setTimeout(function(){ var el=document.getElementById("contractSearch"); var pos=el?el.selectionStart:0; draw(); var el2=document.getElementById("contractSearch"); if(el2){ el2.focus(); try{el2.setSelectionRange(pos,pos);}catch(e){} } },200); },
    unlock:function(){
      var inp=document.getElementById("ntKeyInput"),msg=document.getElementById("ntKeyMsg");
      var k=inp?inp.value.trim():"";
      if(!k){ if(msg) msg.textContent="비밀번호를 입력해 주세요."; return; }
      if(st.verifying) return; st.verifying=true; if(msg) msg.textContent="확인 중…";
      verifyKey(k).then(function(ok){
        st.verifying=false;
        if(ok){ try{localStorage.setItem("sandle_admin_key",k);}catch(e){} st.unlocked=true; load(); draw(); }
        else if(msg) msg.textContent="비밀번호가 올바르지 않습니다.";
      }).catch(function(){ st.verifying=false; if(msg) msg.textContent="확인 실패 — 네트워크 상태를 확인해 주세요."; });
    },
    jump:function(id){ if(locked()) return; st.sub="notices"; draw(); var el=document.getElementById("nt-"+id); if(el){ el.scrollIntoView({behavior:"smooth",block:"center"}); el.classList.add("hl"); setTimeout(function(){el.classList.remove("hl")},1600); } }
  };
})();
window.Notices=Notices;