// ── ⑤ 규약·공고·계약 ──────────────────────────────────────────────────────────
// 탭 1 관리규약: 정적 rules.json(조문·별표 전문, 별지 서식 목록) + 검색 — 누구나 열람.
// 탭 2 계약·기준문서: 정적 contracts.json(v2: 조문 원문 그대로 + 해석·검토 메모 분리) — 문서는
//   접힌 카드로만 나열하고, 검색하면 모든 문서를 훑어 일치하는 조문만 펼쳐 보여준다.
// 탭 3 공고·안내 / 탭 4 절차 점검: 관리자 비밀번호를 입력한 기기에서만 표시.
// 절차 점검은 investigations.json(조사 현황)과 클라우드 checks_v1(규약 대조 기록)을 한 화면에 합쳐,
//   심각도(위반·미충족 확인 → 소지 → 확인중) 순서로 보여준다. (v85 — 이전에는 checks_v1이 화면에 안 나왔음)
var Notices=(function(){
  var URL_="https://script.google.com/macros/s/AKfycbyhpE-DB5WAAEx7uqTCPwU-e0sPKuupkYN3YoQWALiFWe0IHFNh1y91e1VNtDmMxxoxLA/exec";
  var TOKEN="ITDXaUBDTmrz6DbQ3tv9R";
  var CACHE="sandle_notices_cache_v1";
  var st={
    notices:null,checks:null,rulesDocs:{},contracts:null,investigations:null,elections:null,
    doc:"all",loading:false,contractsLoading:false,investigationsLoading:false,electionsLoading:false,
    err:"",sub:"rules",fBody:"전체",fKind:"전체",q:"",cq:"",checkFilter:"전체",
    unlocked:false,verifying:false
  };
  var RULE_DOCS={
    all:{label:"◆◇ 두 규약 함께"},
    bunyang:{file:"rules.json",label:"◆ 분양 (공동주택관리규약)"},
    tenant:{file:"trules.json",label:"◇ 임차 (임대주택 관리규약)"}
  };
  // 함께 검색 결과를 주제별로 묶기 위한 장(章) 대응표 — 두 규약은 별개 문서라 장 구성·조 번호가 다르다.
  var RULE_TOPICS=[
    {t:"총칙",b:["제1장"],n:["제1장"]},
    {t:"입주자·임차인의 권리와 의무",b:["제2장"],n:["제2장"]},
    {t:"대표회의 (입주자대표회의 / 임차인대표회의)",b:["제3장"],n:["제3장"]},
    {t:"선거관리위원회",b:["제4장"],n:["제4장"]},
    {t:"공동체 활성화",b:["제5장"],n:["제5장"]},
    {t:"관리방법·관리주체의 업무와 책임",b:["제6장","제7장","제8장"],n:["제6장"]},
    {t:"관리비·회계·잡수입",b:["제9장","제10장"],n:["제7장","제8장","제9장"]},
    {t:"관리책임 및 비용부담",b:["제11장"],n:["제10장"]},
    {t:"생활질서·벌칙",b:["제12장"],n:["제11장"]},
    {t:"규약의 제정·개정",b:["제13장"],n:["제12장"]},
    {t:"공사·용역 사업자 선정",b:["제14장"],n:[]},
    {t:"혼합단지 관리·보칙",b:["제15장","제16장"],n:["제13장","제14장"]},
    {t:"부칙·그 밖의 규정",b:["__rest__"],n:["__rest__"]},
    {t:"별표",b:["__app__"],n:["__app__"]},
    {t:"별지 서식",b:["__form__"],n:["__form__"]}
  ];
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c];});}
  // v91: 24시간 만료 규칙 포함(core.js AdminGate와 동일) — 만료 시 키 제거·재입력
  function hasKey(){try{return !!(window.AdminGate?AdminGate.savedKey():localStorage.getItem("sandle_admin_key"));}catch(e){return false;}}
  // v81: 임계(v83부터 30,000자) 초과 레코드는 주제 요약과 같은 조각 방식({chunked,parts} + id_pN 원문 슬라이스)으로 저장된다 — 읽을 때 이어 붙여 파싱.
  function getRec(id){
    return fetch(URL_+"?action=get&token="+TOKEN+"&id="+id).then(function(r){return r.json()}).then(function(x){
      if(!(x&&x.ok&&x.item))return null;
      var j=null;try{j=JSON.parse(x.item.json);}catch(e){return null;}
      if(!(j&&j.chunked&&j.parts))return j;
      var ps=[];for(var i=1;i<=j.parts;i++)ps.push(fetch(URL_+"?action=get&token="+TOKEN+"&id="+id+"_p"+i).then(function(r){return r.json()}));
      return Promise.all(ps).then(function(arr){
        var s="";for(var i=0;i<arr.length;i++){if(!(arr[i]&&arr[i].ok&&arr[i].item))return null;s+=arr[i].item.json;}
        try{return JSON.parse(s);}catch(e){return null;}
      });
    });
  }
  // v92: 2단계 비밀번호 — 열람 잠금은 서버 verify 액션으로 확인(열람 키 또는 수정 키 인정)
  function verifyKey(k){return fetch(URL_,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"verify",adminKey:k,token:TOKEN})}).then(function(r){return r.json()}).then(function(x){return !!(x&&x.ok);});}

  function load(){
    if(st.loading) return; st.loading=true; st.err="";
    Promise.all([
      getRec("notices_v1").catch(function(){return null}),
      getRec("checks_v1").catch(function(){return null})
    ]).then(function(rs){
      st.loading=false;
      if(rs[0]) st.notices=rs[0];
      if(rs[1]) st.checks=rs[1];
      if(rs[0]||rs[1]){
        try{localStorage.setItem(CACHE,JSON.stringify({notices:st.notices,checks:st.checks,at:new Date().toISOString()}));}catch(e){}
      }
      if(!rs[0]&&!rs[1]){
        try{
          var c=JSON.parse(localStorage.getItem(CACHE));
          if(c){st.notices=c.notices;st.checks=c.checks;}
        }catch(e){}
      }
      draw();
    });
  }
  function loadRules(){
    var keys=st.doc==="all"?["bunyang","tenant"]:[st.doc];
    st._ld=st._ld||{};
    keys.forEach(function(d){
      if(st.rulesDocs[d]||st._ld[d]) return;
      st._ld[d]=1;
      fetch(RULE_DOCS[d].file).then(function(r){return r.json()}).then(function(j){
        st._ld[d]=0;st.rulesDocs[d]=j;draw();
      }).catch(function(){st._ld[d]=0;st.err=RULE_DOCS[d].file+"을 불러오지 못했습니다.";draw();});
    });
  }
  function loadContracts(){
    if(st.contracts||st.contractsLoading) return;
    st.contractsLoading=true;
    fetch("contracts.json?v=24").then(function(r){return r.json()}).then(function(j){
      st.contractsLoading=false;st.contracts=j;draw();
    }).catch(function(){st.contractsLoading=false;st.err="contracts.json을 불러오지 못했습니다.";draw();});
  }
  function loadElections(){
    if(st.elections||st.electionsLoading) return;
    st.electionsLoading=true;
    fetch("elections.json?v=2").then(function(r){return r.json()}).then(function(j){
      st.electionsLoading=false;st.elections=j;draw();
    }).catch(function(){st.electionsLoading=false;st.err="elections.json을 불러오지 못했습니다.";draw();});
  }
  function loadInvestigations(){
    if(st.investigations||st.investigationsLoading) return;
    st.investigationsLoading=true;
    fetch("investigations.json?v=4").then(function(r){return r.json()}).then(function(j){
      st.investigationsLoading=false;st.investigations=j;draw();
    }).catch(function(){st.investigationsLoading=false;st.err="절차 점검 현황을 불러오지 못했습니다.";draw();});
  }

  function hl(text,q){
    if(!q) return esc(text);
    var t=esc(text),qq=esc(q),i,out="",low=t.toLowerCase(),ql=qq.toLowerCase(),from=0;
    while((i=low.indexOf(ql,from))>=0){out+=t.slice(from,i)+"<mark>"+t.slice(i,i+qq.length)+"</mark>";from=i+qq.length;}
    return out+t.slice(from);
  }
  // dk: 함께 검색 결과에서 어느 규약의 조문인지 배지로 표시('bunyang'|'tenant')
  function ruleDocBadge(dk){return '<span class="nt-badge '+(dk==='tenant'?'t':'k')+'" style="margin-right:7px">'+(dk==='tenant'?'◇ 임차':'◆ 분양')+'</span>';}
  function ruleArticleHtml(a,q,open,dk){
    return '<details class="rl-art"'+(open?' open':'')+'><summary>'+(dk?ruleDocBadge(dk):'')+'<b>'+hl(a.no+(a.title?'('+a.title+')':''),q)+'</b></summary><div class="rl-text">'+hl(a.text,q).replace(/\n/g,'<br>')+'</div></details>';
  }
  function docBodyHtml(r,q){
    var h="",shown=0;
    (r.chapters||[]).forEach(function(ch){
      var arts=(ch.articles||[]).filter(function(a){return !q||(a.no+(a.title||'')+a.text).toLowerCase().indexOf(q.toLowerCase())>=0;});
      if(!arts.length) return;
      shown+=arts.length;
      h+='<div class="rl-ch">'+esc(ch.no?ch.no+' ':'')+esc(ch.title||'')+'</div>'+arts.map(function(a){return ruleArticleHtml(a,q,!!q);}).join('');
    });
    var apps=(r.appendices||[]).filter(function(a){return !q||(a.no+(a.title||'')+(a.text||'')).toLowerCase().indexOf(q.toLowerCase())>=0;});
    if(apps.length){
      h+='<div class="rl-ch">별표</div>'+apps.map(function(a){return '<details class="rl-art"'+(q?' open':'')+'><summary><b>'+hl(a.no+' '+(a.title||''),q)+'</b></summary><div class="rl-text">'+hl(a.text||'',q).replace(/\n/g,'<br>')+'</div></details>';}).join('');
      shown+=apps.length;
    }
    var forms=(r.forms||[]).filter(function(f){return !q||(f.no+' '+(f.title||'')+' '+(f.note||'')).toLowerCase().indexOf(q.toLowerCase())>=0;});
    if(forms.length){
      h+='<div class="rl-ch">별지 서식 <span class="small">(서식 명칭·용도만 수록 — 양식 원본은 PDF)</span></div><ul class="nt-facts">'+forms.map(function(f){return '<li>'+hl(f.no+' '+(f.title||''),q)+(f.note?' — <span class="small">'+hl(f.note,q)+'</span>':'')+'</li>';}).join('')+'</ul>';
      shown+=forms.length;
    }
    return {html:h,shown:shown};
  }
  // ◆◇ 함께 검색: 결과를 규약별이 아니라 주제별로 묶고, 조문마다 어느 규약인지 배지로 표시
  function allTopicResultsHtml(q){
    var ql=q.toLowerCase();
    function mArt(a){return (a.no+(a.title||'')+a.text).toLowerCase().indexOf(ql)>=0;}
    function mApp(a){return (a.no+(a.title||'')+(a.text||'')).toLowerCase().indexOf(ql)>=0;}
    function mForm(f){return (f.no+' '+(f.title||'')+' '+(f.note||'')).toLowerCase().indexOf(ql)>=0;}
    // 대응표에 없는 장(부칙 등, 장 번호 없음)은 rest 로 모아 "부칙·그 밖의 규정" 주제로 보여준다
    var mapped={};RULE_TOPICS.forEach(function(tp){tp.b.concat(tp.n).forEach(function(no){mapped[no]=1;});});
    var res={};
    ['bunyang','tenant'].forEach(function(d){
      var r=st.rulesDocs[d],o={ch:{},rest:[],app:[],form:[]};
      (r.chapters||[]).forEach(function(ch){
        var arts=(ch.articles||[]).filter(mArt);
        if(!arts.length) return;
        if(ch.no&&mapped[ch.no]) o.ch[ch.no]=(o.ch[ch.no]||[]).concat(arts);
        else o.rest=o.rest.concat(arts);
      });
      o.app=(r.appendices||[]).filter(mApp);
      o.form=(r.forms||[]).filter(mForm);
      res[d]=o;
    });
    var total=0,body='';
    RULE_TOPICS.forEach(function(tp){
      var bArts=[],nArts=[];
      if(tp.b[0]==='__app__'){bArts=res.bunyang.app;nArts=res.tenant.app;}
      else if(tp.b[0]==='__form__'){bArts=res.bunyang.form;nArts=res.tenant.form;}
      else if(tp.b[0]==='__rest__'){bArts=res.bunyang.rest;nArts=res.tenant.rest;}
      else{
        tp.b.forEach(function(no){bArts=bArts.concat(res.bunyang.ch[no]||[]);});
        tp.n.forEach(function(no){nArts=nArts.concat(res.tenant.ch[no]||[]);});
      }
      if(!bArts.length&&!nArts.length) return;
      total+=bArts.length+nArts.length;
      body+='<div class="rl-ch">'+esc(tp.t)+' <span class="small" style="font-weight:400">◆ 분양 '+bArts.length+'건 · ◇ 임차 '+nArts.length+'건</span></div>';
      if(tp.b[0]==='__form__'){
        var li=function(dk){return function(f){return '<li>'+ruleDocBadge(dk)+hl(f.no+' '+(f.title||''),q)+(f.note?' — <span class="small">'+hl(f.note,q)+'</span>':'')+'</li>';};};
        if(bArts.length||nArts.length) body+='<ul class="nt-facts">'+bArts.map(li('bunyang')).join('')+nArts.map(li('tenant')).join('')+'</ul>';
      }else{
        body+=bArts.map(function(a){return ruleArticleHtml(a,q,true,'bunyang');}).join('');
        body+=nArts.map(function(a){return ruleArticleHtml(a,q,true,'tenant');}).join('');
      }
    });
    var h='<div class="rl-count">"'+esc(q)+'" 검색 결과 '+total+'건 — 주제별로 묶어 표시(펼침)</div>';
    h+='<div class="nt-note" style="margin:8px 0 12px"><b>두 규약은 별개 문서입니다</b> — 분양(공동주택관리규약, 2024.10.30 시행)과 임차(임대주택 관리규약, 2020.04.18 시행)는 적용 대상이 다르고, 같은 주제라도 조문 내용·조 번호가 서로 다릅니다. 각 조문 앞의 <span class="nt-badge k">◆ 분양</span> <span class="nt-badge t">◇ 임차</span> 배지로 어느 규약인지 확인하세요.</div>';
    if(!total) h+='<div class="nt-empty">검색 결과가 없습니다.</div>';
    return h+body;
  }
  function rulesHtml(){
    var docBtns='<div class="rl-docs">'+Object.keys(RULE_DOCS).map(function(k){return '<button type="button" class="btn'+(st.doc===k?' gold':'')+'" onclick="Notices.doc(\''+k+'\')">'+RULE_DOCS[k].label+'</button>';}).join('')+'</div>';
    var keys=st.doc==='all'?['bunyang','tenant']:[st.doc];
    var missing=keys.filter(function(d){return !st.rulesDocs[d];});
    if(missing.length) return docBtns+'<div class="nt-empty">관리규약 불러오는 중…</div>';
    var q=st.q.trim();
    var h=docBtns+'<div class="rl-head"><input id="ruleSearch" class="rl-search" placeholder="'+(st.doc==='all'?'두 규약을 함께 검색 (예: 선거관리위원회, 겸임금지)':'규약 전문 검색 (예: 선거관리위원회, 장기수선충당금)')+'" value="'+esc(st.q)+'" oninput="Notices.search(this.value)">';
    if(st.doc==='all') h+='<div class="small" style="margin-top:4px">서로 다른 두 규약 — <b>◆ 분양</b>(공동주택관리규약, 2024.10.30 시행)과 <b>◇ 임차</b>(임대주택 관리규약, 2020.04.18 시행) — 를 함께 봅니다. 검색하면 주제별로 묶어 보여줍니다. 이미지 원본을 옮겨 적은 사본이며, 효력은 원본 문서에 있습니다.</div>';
    else{
      var r0=st.rulesDocs[st.doc];
      h+='<div class="small" style="margin-top:4px">'+esc(r0.title)+' · '+esc(r0.effective)+' 시행 · 원본: '+esc(r0.source)+' — 이미지 원본을 옮겨 적은 사본이며, 효력은 원본 문서에 있습니다.</div>';
    }
    h+='</div>';
    if(st.doc==='all'&&q) return h+allTopicResultsHtml(q);
    var shown=0,body='';
    keys.forEach(function(d){
      var sec=docBodyHtml(st.rulesDocs[d],q);
      if(st.doc==='all'){
        body+='<div class="rl-doc-h">'+esc(RULE_DOCS[d].label)+' <span class="small">'+esc(st.rulesDocs[d].effective)+' 시행'+(q?' — '+sec.shown+'건':'')+'</span></div>';
        if(q&&!sec.shown) body+='<div class="nt-empty" style="padding:10px">이 규약에는 검색 결과가 없습니다.</div>';
      }
      body+=sec.html;shown+=sec.shown;
    });
    if(q) h+='<div class="rl-count">"'+esc(q)+'" 검색 결과 '+shown+'건'+(st.doc==='all'?'(두 규약 합산)':'')+' — 해당 조문만 표시(펼침)</div>';
    h+=body;
    if(q&&!shown) h+='<div class="nt-empty">검색 결과가 없습니다.</div>';
    return h;
  }

  // 계약·기준문서(contracts.json v2): 문서는 접힌 카드로만 나열하고, 펼치면 조문 원문 그대로 + 그 아래 해석·검토 메모.
  // 검색하면 모든 문서의 조문(원문·해석·메모·검색어)을 훑어 일치하는 조문만 펼쳐서 보여준다.
  function contractDocClauses(d){
    if(d.chapters) return d.chapters.reduce(function(a,ch){return a.concat(ch.clauses||[]);},[]);
    return d.clauses||[];
  }
  function contractHay(c){return [c.ref,c.title,c.text,c.summary,c.note,c.issueNote,(c.keywords||[]).join(' ')].join(' ').toLowerCase();}
  function contractClauseHtml(c,q,open){
    var body=c.text||c.summary||'';
    return '<details class="rl-art"'+(open?' open':'')+'><summary><b>'+hl(c.ref+(c.title?'('+c.title+')':''),q)+'</b></summary>'+
      (c.text?'<div class="small" style="font-weight:800;margin:9px 0 2px">원문</div>':'')+
      '<div class="rl-text">'+hl(body,q).replace(/\n/g,'<br>')+'</div>'+
      (c.note?'<div class="nt-note" style="margin-top:10px"><b>해석</b><br>'+hl(c.note,q).replace(/\n/g,'<br>')+'</div>':'')+
      (c.issueNote?'<div class="nt-note" style="margin-top:8px;border-color:#efb3ad;background:#fdf3f2"><b>현재 검토 메모</b><br>'+hl(c.issueNote,q)+'</div>':'')+
      (c.keywords&&c.keywords.length?'<div class="nt-rel">검색어: '+c.keywords.map(function(k){return '<span class="nt-chip">'+hl(k,q)+'</span>';}).join(' ')+'</div>':'')+
    '</details>';
  }
  function contractDocMetaHtml(d){
    var h='<div class="nt-sum" style="margin:8px 0 4px"><b>'+esc(d.type||'계약')+'</b>'+(d.parties&&d.parties.length?' · '+esc(d.parties.join(' ↔ ')):'')+
      (d.signed?'<br>체결일: '+esc(d.signed):'')+(d.period?' · 기간: '+esc(d.period):'')+
      (d.amount?'<br>금액: '+esc(d.amount):'')+
      (d.source?'<br><span class="small">'+esc(d.source)+'</span>':'')+'</div>';
    if(d.deal&&d.deal.length) h+='<div class="nt-note" style="margin:8px 0"><b>체결 정보</b><ul class="nt-facts" style="margin:6px 0 0">'+d.deal.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></div>';
    if(d.sourceNote) h+='<div class="small" style="margin:6px 0 10px">※ '+esc(d.sourceNote)+'</div>';
    return h;
  }
  function contractDocBodyHtml(d,q){
    if(!d.chapters) return contractDocClauses(d).map(function(c){return contractClauseHtml(c,q,false);}).join('');
    return d.chapters.map(function(ch){
      var head=(ch.no==='전문'||!ch.title)?(ch.no||''):(ch.no+' '+ch.title);
      return (head?'<div class="rl-ch">'+esc(head)+'</div>':'')+(ch.clauses||[]).map(function(c){return contractClauseHtml(c,q,false);}).join('');
    }).join('');
  }
  // 묶음 안의 계약 한 건. 접힌 줄에 연도·업체·금액만 두어, 펼치지 않고도 해마다 무엇이 달라졌는지 읽히게 한다.
  function 상대방(d){
    var p=(d.parties||[])[1]||'';
    // 원문의 역할 표기(을·계약상대자·감사인·수임자…)는 이름 뒤에 붙은 꼬리표라 접힌 줄에서는 걷어낸다.
    return p.replace(/\s*\([^()]{0,8}(자|인|처|방|사|을|갑)\)\s*$/,'');
  }
  // 계약이 끝나는 날. 기간 문자열에서 마지막 날짜를 뽑는다 — 못 뽑으면 빈 문자열(판단하지 않음).
  function 끝날(d){
    var m=String(d&&d.period||'').match(/(\d{4})[-.](\d{1,2})[-.](\d{1,2})/g);
    if(!m||!m.length) return '';
    return m[m.length-1].replace(/\./g,'-').replace(/-(\d)(?=-|$)/g,'-0$1');
  }
  // toISOString()은 UTC라 한국 시각으로 오전 9시 이전이면 하루 전 날짜가 나온다.
  // 기한을 세는 화면에서 하루가 어긋나면 안 되므로 보는 사람의 시간대로 맞춘다.
  function 오늘(){var d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
  function 만료(d){var e=끝날(d);return e?(e<오늘()):null;}
  function 날수(날){return Math.round((new Date(날+'T00:00:00')-new Date(오늘()+'T00:00:00'))/86400000);}
  /*
   * 자동연장 계약에서 진짜 기한은 만료일이 아니라 「통보 기한」이다(사용자 지적, 2026-09-02).
   * 만료일만 세면 그날 전에 이미 1년이 더 붙어 버린 뒤다. 통보 기한이 적힌 계약은 그것을 먼저 센다.
   */
  function 기한(d){return (d&&d.통보기한)||끝날(d);}
  function 남은기간(d){
    if(!d) return '';
    var 통보=d.통보기한||'', 끝=끝날(d);
    if(통보){
      var n=날수(통보);
      if(n<0) return ' <span class="nt-badge">자동연장 기한 지남</span>';
      if(n<=45) return ' <span class="nt-badge k">연장 통보 기한 '+n+'일 남음</span>';
      if(n<=120) return ' <span class="nt-badge t">연장 통보 기한 '+n+'일 남음</span>';
      return '';
    }
    if(!끝) return '';
    var 일=날수(끝);
    if(일<0) return ' <span class="nt-badge">만기 지남</span>';
    if(일<=30) return ' <span class="nt-badge k">만기 '+일+'일 남음</span>';
    if(일<=90) return ' <span class="nt-badge t">만기 '+일+'일 남음</span>';
    return '';
  }
  /*
   * 만기가 가까운 것부터 늘어놓는다(사용자 지시, 2026-09-02).
   * 적재한 순서로 두면 무엇을 먼저 준비해야 하는지가 화면에 드러나지 않는다.
   * 같은 해에 끝나는 것끼리 묶고, 그 안에서는 끝나는 날 순, 날짜가 같으면 이름 ㄱㄴㄷ 순.
   * 만기라는 것이 없는 것(그때그때 맺는 공사, 해마다 새로 맺는 감사)은 맨 아래에 따로 둔다.
   */
  function 만기순으로(카드){
    var 기간있음=[],기타=[];
    카드.forEach(function(c){ (c.끝&&!c.성격?기간있음:기타).push(c); });
    기간있음.sort(function(a,b){ return a.끝<b.끝?-1:a.끝>b.끝?1:a.이름.localeCompare(b.이름,'ko'); });
    기타.sort(function(a,b){ return (a.성격||'힣').localeCompare(b.성격||'힣','ko')||a.이름.localeCompare(b.이름,'ko'); });
    var h='',해='';
    기간있음.forEach(function(c){
      var y=c.끝.slice(0,4), 지남=c.끝<오늘();
      var 머리=지남?'만기 지남':(y+'년에 만기');
      if(머리!==해){해=머리;h+='<div class="rl-ch">'+esc(머리)+'</div>';}
      h+=c.html;
    });
    var 라벨={'공사':'그때그때 맺는 공사','연례':'해마다 새로 맺는 것'};
    var 앞='';
    기타.forEach(function(c){
      var 머리=라벨[c.성격]||'만기가 적혀 있지 않은 것';
      if(머리!==앞){앞=머리;h+='<div class="rl-ch">'+esc(머리)+'</div>';}
      h+=c.html;
    });
    return h;
  }
  // 한 해에 두 건 이상인 묶음(보수공사 등)은 연도만으로 구분되지 않는다. 체결월까지 있으면 함께 쓴다.
  function 카드이름(d){
    var m=String(d.signed||'').match(/^(\d{4})-(\d{1,2})/);
    if(m) return m[1]+'년 '+Number(m[2])+'월';
    return d.year?String(d.year)+'년':(d.title||'');
  }
  function 계약카드(d,현행){
    var n=contractDocClauses(d).length;
    var 줄=[상대방(d),d.amount||''].filter(Boolean).join(' · ');
    return '<details class="rl-art" style="margin-left:10px"'+(현행?' open':'')+'><summary><b>'+esc(카드이름(d))+'</b>'+
      (현행?' <span class="nt-badge o">현행</span>':'')+' <span class="small">'+esc(줄)+'</span></summary>'+
      '<div class="small" style="font-weight:800;margin:8px 0 0">'+esc(d.title||'')+'</div>'+
      contractDocMetaHtml(d)+(n?contractDocBodyHtml(d,''):'')+'</details>';
  }
  /* ── 선거·선관위 ────────────────────────────────────────────────────────────
   * 동별 대표자 명단 자체는 회의록의 명단 기록(roster_history)에 이미 있다. 여기서 값어치가 있는 것은
   * 명단이 아니라 **선거가 어떻게 치러졌는가** — 몇 세대가 대상이었고, 몇이 투표했고, 어디가 왜 부결되었는가다.
   * 공고에 적힌 숫자만 싣고, 동호수는 싣지 않는다.
   */
  function 판정배지(p){
    if(p==='가결') return '<span class="nt-badge o">가결</span>';
    if(p==='부결') return '<span class="nt-badge" style="background:#fdf3f2;color:#a4443c">부결</span>';
    if(p==='후보 없음') return '<span class="nt-badge">후보 없음</span>';
    return p?esc(p):'';
  }
  function 선거표(rows){
    if(!rows||!rows.length) return '';
    var h='<div style="overflow-x:auto"><table class="nt-table"><thead><tr>'+
      '<th>선거구</th><th>당선인</th><th>대상<br>세대</th><th>투표수<br>(투표율)</th><th>찬성<br>(찬성률)</th><th>반대·무효</th><th>판정</th></tr></thead><tbody>';
    rows.forEach(function(r){
      var 없음=(r.판정==='후보 없음');
      h+='<tr'+(r.판정==='부결'?' style="background:#fdf3f2"':'')+'>'+
        '<td>'+esc(r.선거구||'')+'</td>'+
        '<td>'+(r.당선인?esc(r.당선인):'—')+'</td>'+
        '<td style="text-align:right">'+(없음?'—':esc(String(r.대상세대==null?'':r.대상세대)))+'</td>'+
        '<td style="text-align:right">'+(없음?'—':esc(String(r.투표수==null?'':r.투표수))+(r.투표율?' ('+esc(r.투표율)+')':''))+'</td>'+
        '<td style="text-align:right">'+(없음?'—':esc(String(r.찬성==null?'':r.찬성))+(r.찬성률?' ('+esc(r.찬성률)+')':''))+'</td>'+
        '<td style="text-align:right">'+(없음?'—':esc(String(r.반대무효==null?'':r.반대무효)))+'</td>'+
        '<td>'+판정배지(r.판정)+'</td></tr>';
      if(r.비고) h+='<tr><td colspan="7" class="small" style="color:#6b6656;padding-top:0">↳ '+esc(r.비고)+'</td></tr>';
    });
    h+='</tbody></table></div>';
    return h;
  }
  function 선거카드(e){
    var 부결=(e.결과||[]).filter(function(r){return r.판정==='부결';}).length;
    var 없음=(e.결과||[]).filter(function(r){return r.판정==='후보 없음';}).length;
    var 가결=(e.결과||[]).filter(function(r){return r.판정==='가결';}).length;
    var 줄=[e.투표기간, 가결?('가결 '+가결+'개 선거구'):'', 부결?('부결 '+부결):'', 없음?('후보 없음 '+없음):''].filter(Boolean).join(' · ');
    var 안=(e.요약?'<div class="nt-sum" style="margin:8px 0">'+esc(e.요약)+'</div>':'');
    안+='<div class="nt-sum" style="margin:8px 0 4px"><b>'+esc(e.회의체||'')+'</b>'+
      (e.투표기간?'<br>투표기간: '+esc(e.투표기간):'')+(e.공고일?' · 공고일: '+esc(e.공고일):'')+
      (e.임기?'<br>임기: '+esc(e.임기):'')+
      (e.근거?'<br><span class="small">당선인 결정 근거: '+esc(e.근거)+'</span>':'')+
      (e.출처?'<br><span class="small">'+esc(e.출처)+'</span>':'')+'</div>';
    안+=선거표(e.결과);
    if(e.합계) 안+='<div class="small" style="margin:6px 0">합계 — 대상세대 '+esc(String(e.합계.대상세대))+' · 투표수 '+esc(String(e.합계.투표수))+' · 찬성 '+esc(String(e.합계.찬성))+' · 반대 '+esc(String(e.합계.반대))+'</div>';
    if(e.메모&&e.메모.length) 안+='<div class="nt-note" style="margin:10px 0"><b>공고에 함께 적힌 것</b><ul class="nt-facts" style="margin:6px 0 0">'+e.메모.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></div>';
    return '<details class="rl-art"'+(부결?'':' ')+'><summary><b>'+esc(e.제목||'')+'</b> <span class="small">'+esc(줄)+'</span></summary>'+안+'</details>';
  }
  function 단지표(d){
    if(!d||!d.동별||!d.동별.length) return '';
    var h='<details class="rl-art"><summary><b>단지 구성 — 분양 '+esc(String(d.분양))+'세대 · LH 임대 '+esc(String(d.LH임대))+'세대</b> <span class="small">총 '+esc(String(d.총세대))+'세대</span></summary>';
    if(d.설명) h+='<div class="nt-sum" style="margin:8px 0">'+esc(d.설명)+'</div>';
    h+='<div style="overflow-x:auto"><table class="nt-table"><thead><tr><th>동</th><th>전체 세대</th><th>LH 임대</th><th>분양</th></tr></thead><tbody>';
    d.동별.forEach(function(r){
      h+='<tr><td>'+esc(String(r.동))+'</td><td style="text-align:right">'+esc(String(r.전체))+'</td><td style="text-align:right">'+(r.LH임대?esc(String(r.LH임대)):'—')+'</td><td style="text-align:right">'+esc(String(r.분양))+'</td></tr>';
    });
    h+='<tr style="font-weight:800"><td>합계</td><td style="text-align:right">'+esc(String(d.총세대))+'</td><td style="text-align:right">'+esc(String(d.LH임대))+'</td><td style="text-align:right">'+esc(String(d.분양))+'</td></tr>';
    h+='</tbody></table></div>';
    h+='</details>';
    return h;
  }
  function 원칙카드(p){
    return '<details class="rl-art"><summary><b>'+esc(p.제목||'')+'</b> <span class="small">'+esc(p.회차||'')+' · '+esc(p.날짜||'')+'</span></summary>'+
      '<ul class="nt-facts" style="margin:8px 0">'+(p.항목||[]).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>'+
      (p.출처?'<div class="small">'+esc(p.출처)+'</div>':'')+'</details>';
  }
  // 동대표 선거가 아니라 단지 전체에 묻는 찬반투표(주택관리업자 재계약, 잡수입 사용 등).
  // 전자투표와 방문투표를 나누어 적힌 그대로 보여준다 — 어느 쪽이 결과를 갈랐는지는 그 표에서만 보인다.
  function 투표방식표(집계){
    if(!집계) return '';
    var 줄=[];
    if(집계.전자투표) 줄.push(['전자투표',집계.전자투표]);
    if(집계.방문투표) 줄.push(['방문투표',집계.방문투표]);
    if(집계.합계) 줄.push(['합계',집계.합계]);
    if(!줄.length) return '';
    var h='<div style="overflow-x:auto"><table class="nt-table"><thead><tr><th>구분</th><th>투표수<br>(투표율)</th><th>찬성<br>(찬성률)</th><th>반대·무효</th></tr></thead><tbody>';
    줄.forEach(function(p){
      var k=p[0],v=p[1];
      h+='<tr'+(k==='합계'?' style="font-weight:800"':'')+'><td>'+esc(k)+'</td>'+
        '<td style="text-align:right">'+esc(String(v.투표수==null?'':v.투표수))+(v.투표율?' ('+esc(v.투표율)+')':'')+'</td>'+
        '<td style="text-align:right">'+esc(String(v.찬성==null?'':v.찬성))+(v.찬성률?' ('+esc(v.찬성률)+')':'')+'</td>'+
        '<td style="text-align:right">'+esc(String(v.반대무효==null?'':v.반대무효))+'</td></tr>';
    });
    h+='</tbody></table></div>';
    return h;
  }
  function 찬반카드(v){
    var g=v.집계||{};
    var 줄=[v.투표기간, (g.합계&&g.합계.투표율)?('투표율 '+g.합계.투표율):'', v.결과||''].filter(Boolean).join(' · ');
    var 안=(v.요약?'<div class="nt-sum" style="margin:8px 0">'+esc(v.요약)+'</div>':'');
    안+='<div class="nt-sum" style="margin:8px 0 4px">'+
      (v.투표기간?'투표기간: '+esc(v.투표기간):'')+(v.공고일?' · 공고일: '+esc(v.공고일):'')+
      (g.총세대수?'<br>총 세대수 '+esc(String(g.총세대수))+' · 선거인명부 등재자수 '+esc(String(g['선거인명부 등재자수'])):'')+
      (v.근거?'<br><span class="small">결정 근거: '+esc(v.근거)+'</span>':'')+
      (v.출처?'<br><span class="small">'+esc(v.출처)+'</span>':'')+'</div>';
    안+=투표방식표(g);
    if(v.메모&&v.메모.length) 안+='<div class="nt-note" style="margin:10px 0"><b>함께 볼 것</b><ul class="nt-facts" style="margin:6px 0 0">'+v.메모.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></div>';
    return '<details class="rl-art"><summary><b>'+esc(v.제목||'')+'</b> <span class="small">'+esc(줄)+'</span></summary>'+안+'</details>';
  }
  function 구성카드(c){
    return '<details class="rl-art"><summary><b>선거관리위원회 구성 — '+esc(c.시기||'')+'</b> <span class="small">'+esc(c.위원||'')+'</span></summary>'+
      '<div class="nt-sum" style="margin:8px 0">'+esc(c.위원||'')+(c.출처?'<br><span class="small">'+esc(c.출처)+'</span>':'')+'</div>'+
      (c.메모?'<div class="small">'+esc(c.메모)+'</div>':'')+'</details>';
  }
  function electionsHtml(){
    if(!st.elections) return '<div class="nt-empty">'+(st.electionsLoading?'선거 기록 불러오는 중…':'선거 기록이 없습니다.')+'</div>';
    var j=st.elections, h='<div class="rl-head"><div class="small">'+esc(j.note||'')+'</div></div>';
    h+=단지표(j.단지);
    var 선거=(j.선거||[]).slice();
    var 회차=[];
    선거.forEach(function(e){ if(회차.indexOf(e.회차)<0) 회차.push(e.회차); });
    회차.forEach(function(t){
      h+='<div class="rl-ch">'+esc(t)+'</div>';
      선거.filter(function(e){return e.회차===t;}).forEach(function(e){ h+=선거카드(e); });
      (j.선관위원칙||[]).filter(function(p){return p.회차===t;}).forEach(function(p){ h+=원칙카드(p); });
    });
    if((j.찬반투표||[]).length){
      h+='<div class="rl-ch">단지 전체 찬반투표</div>';
      j.찬반투표.forEach(function(v){ h+=찬반카드(v); });
    }
    if((j.선관위구성||[]).length){
      h+='<div class="rl-ch">선거관리위원회 구성</div>';
      j.선관위구성.forEach(function(c){ h+=구성카드(c); });
    }
    if(!선거.length) h+='<div class="nt-empty">아직 적재된 선거 기록이 없습니다.</div>';
    return h;
  }
  function contractsHtml(){
    if(!st.contracts) return '<div class="nt-empty">'+(st.contractsLoading?'계약·기준문서 불러오는 중…':'계약·기준문서가 없습니다.')+'</div>';
    var q=st.cq.trim(),h='<div class="rl-head"><input id="contractSearch" class="rl-search" placeholder="모든 계약·기준문서 검색 (예: 계약해지, 위탁관리수수료, 감사, 보고)" value="'+esc(st.cq)+'" oninput="Notices.contractSearch(this.value)">';
    h+='<div class="small" style="margin-top:4px">'+esc(st.contracts.note||'')+'</div></div>';
    var items=st.contracts.items||[];
    if(!q){
      // 검색어 없으면: 접힌 카드만 — 펼쳐야 안이 보인다.
      // group이 있는 계약은 항목별로 한 카드에 모은다. 저수조 청소처럼 해마다 다시 맺는 계약은
      // 낱개로 늘어놓으면 90건이 평평하게 쌓여 읽히지 않고, 정작 볼 것(업체·금액이 해마다 어떻게
      // 달라졌는가)이 보이지 않기 때문이다. group이 없는 문서(위·수탁관리계약 등)는 그대로 낱개다.
      var 낱개=[],묶음=[],표={};
      items.forEach(function(d){
        if(!d.group){낱개.push(d);return;}
        if(!표[d.group]){표[d.group]=[];묶음.push(d.group);}
        표[d.group].push(d);
      });
      var 안내=(st.contracts.groups)||{};
      // 카드를 만들어 두고 뒤에서 만기순으로 늘어놓는다(적재 순서가 아니라).
      var 카드=[];
      낱개.forEach(function(d){
        var n=contractDocClauses(d).length;
        카드.push({이름:d.title||'', 끝:기한(d), 성격:'',
          html:'<details class="rl-art"><summary><b>'+esc(d.title)+'</b> <span class="small">'+esc(d.type||'')+(d.period?' · '+esc(d.period):'')+' · 조문 '+n+'건'+남은기간(d)+'</span></summary>'+
            contractDocMetaHtml(d)+contractDocBodyHtml(d,'')+'</details>'});
      });
      묶음.forEach(function(g){
        var 목록=표[g].slice().sort(function(a,b){return (b.year||0)-(a.year||0);});
        var 최신=목록[0],지난=목록.slice(1);
        var 해=목록.map(function(d){return d.year;}).filter(Boolean);
        var 기간=해.length?(해[해.length-1]===해[0]?String(해[0]):해[해.length-1]+'~'+해[0]):'';
        var g정보=안내[g]||{};
        // 접힌 줄에 지금 누구와, 언제까지, 얼마에 맺고 있는지를 둔다. 히스토리는 그 아래에 접어 둔다.
        // 기간을 빼면 위·수탁관리계약 카드와 달리 "지금 유효한 계약인가"를 펼쳐야만 알 수 있다.
        var 공사머리=(안내[g]||{}).성격==='공사';
        var 요약줄=[상대방(최신),공사머리?카드이름(최신):최신.period,최신.amount].filter(Boolean).join(' · ');
        var 안=(g정보.요약?'<div class="nt-sum" style="margin:8px 0">'+esc(g정보.요약)+'</div>':'');
        // 이어지는 용역과 그때그때 맺는 공사는 읽는 법이 다르다.
        // 공사 묶음에 「지금 맺고 있는 계약」이라고 쓰면 이미 끝난 공사를 현행처럼 보이게 한다.
        var 공사=(g정보.성격==='공사');
        안+='<div class="small" style="font-weight:800;margin:10px 0 2px">'+(공사?'가장 최근 공사':'지금 맺고 있는 계약')+'</div>'+
          계약카드(최신,!공사&&만료(최신)!==true);
        // 「확인 필요」는 살펴볼 것과 성격이 다르다 — 계약서와 실제가 어긋나 보이는 지점이라
        // 다음 계약을 기다릴 일이 아니라 지금 물어봐야 하는 것이다. 그래서 위에 따로, 눈에 띄게 둔다.
        if(g정보.확인필요&&g정보.확인필요.length)
          안+='<div class="nt-note" style="margin:12px 0;border-color:#efb3ad;background:#fdf3f2"><b>★ 확인이 필요한 것</b><ul class="nt-facts" style="margin:6px 0 0">'+
            g정보.확인필요.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></div>';
        if(g정보.살펴볼것&&g정보.살펴볼것.length)
          안+='<div class="nt-note" style="margin:12px 0"><b>'+(공사?'다음 공사 때 살펴볼 것':'다음 계약 때 살펴볼 것')+'</b><ul class="nt-facts" style="margin:6px 0 0">'+
            g정보.살펴볼것.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></div>';
        if(지난.length)
          안+='<div class="small" style="font-weight:800;margin:10px 0 2px">'+(공사?'이전 공사 ':'지난 계약 ')+지난.length+'건 <span style="font-weight:400">— '+
            (공사?'끝난 공사입니다. 같은 곳을 다시 고치고 있지는 않은지 견주어 보는 용도입니다.':'기간이 끝난 계약입니다. 다음 계약을 준비할 때 견주어 보는 용도입니다.')+'</span></div>'+
            지난.map(function(d){return 계약카드(d,false);}).join('');
        // 성격이 붙은 묶음(공사·연례)은 '만기'라는 것이 없으므로 남은 기간을 세지 않는다.
        var 만기=g정보.성격?'':기한(최신);
        카드.push({이름:g, 끝:만기, 성격:g정보.성격||'',
          확인:(g정보.확인필요||[]),
          html:'<details class="rl-art"><summary><b>'+esc(g)+'</b>'+(g정보.확인필요&&g정보.확인필요.length?' <span class="nt-badge" style="background:#fdf3f2;color:#a4443c">★ 확인 필요</span>':'')+
            ' <span class="small">'+esc(요약줄)+' · '+(공사머리?'공사 ':'계약 ')+목록.length+'건'+(기간?'('+esc(기간)+')':'')+남은기간(g정보.성격?null:최신)+'</span></summary>'+안+'</details>'});
      });
      // 확인이 필요한 것은 묶음을 펼쳐야 보인다. 그러면 놓치므로 맨 위에 모아 한 번 더 보여준다.
      var 확인목록=카드.filter(function(c){return c.확인&&c.확인.length;});
      if(확인목록.length)
        h+='<div class="nt-note" style="margin:10px 0 14px;border-color:#efb3ad;background:#fdf3f2"><b>★ 확인이 필요한 것</b>'+
          '<ul class="nt-facts" style="margin:6px 0 0">'+확인목록.map(function(c){
            return c.확인.map(function(x){return '<li><b>'+esc(c.이름)+'</b> — '+esc(x)+'</li>';}).join('');
          }).join('')+'</ul></div>';
      h+=만기순으로(카드);
      if(!items.length) h+='<div class="nt-empty">등록된 계약·기준문서가 없습니다.</div>';
      return h;
    }
    var total=0,body='';
    items.forEach(function(d){
      var clauses=contractDocClauses(d).filter(function(c){return contractHay(c).indexOf(q.toLowerCase())>=0;});
      var docHit=[d.title,d.type,d.group,d.amount,d.period,(d.parties||[]).join(' '),(d.tags||[]).join(' '),(d.deal||[]).join(' ')].join(' ').toLowerCase().indexOf(q.toLowerCase())>=0;
      if(!clauses.length&&!docHit) return;
      total+=clauses.length;
      body+='<div class="rl-doc-h">'+hl(d.title,q)+' <span class="small">'+esc(d.period||'')+(clauses.length?' — '+clauses.length+'건':'')+'</span></div>';
      // 조문이 없는 계약(개별 계약 카드)은 조문 대신 체결 정보를 보여준다 — 볼 것이 거기에 있다.
      if(!clauses.length) body+=(contractDocClauses(d).length?'<div class="nt-empty" style="padding:10px">문서 기본정보에 검색어가 있습니다. 조문에는 일치하는 곳이 없습니다.</div>':contractDocMetaHtml(d));
      else body+=clauses.map(function(c){return contractClauseHtml(c,q,true);}).join('');
    });
    h+='<div class="rl-count">"'+esc(q)+'" 검색 결과 '+total+'개 조문 — 일치하는 조문만 표시(펼침)</div>'+body;
    if(!total&&body.indexOf('rl-doc-h')<0) h+='<div class="nt-empty">검색 결과가 없습니다.</div>';
    return h;
  }

  function lockHtml(){
    return '<div class="nt-lock"><div class="nt-lock-ic">🔒</div><b>비밀번호 확인이 필요한 기록입니다</b> <span class="small">(열람용 또는 수정용 비밀번호)</span>'+
      '<p>공고·안내 보관함과 절차 점검 기록은 관리자 비밀번호를 입력한 기기에서만 열람할 수 있습니다.</p>'+
      '<div class="nt-lock-row"><input id="ntKeyInput" type="password" placeholder="관리자 비밀번호" onkeydown="if(event.key===\'Enter\')Notices.unlock()">'+
      '<button type="button" class="btn gold" onclick="Notices.unlock()">'+(st.verifying?'확인 중…':'확인')+'</button></div>'+
      '<div id="ntKeyMsg" class="nt-err" style="margin-top:8px"></div></div>';
  }
  function locked(){return !(st.unlocked||hasKey());}

  function badge(txt,cls){return '<span class="nt-badge '+cls+'">'+esc(txt)+'</span>';}
  function bodyCls(b){return b==='임차'?'t':b&&b.indexOf('선관위')>=0?'e':b==='관리사무소'?'o':'a';}
  function bullets(arr){return arr&&arr.length?'<ul class="nt-facts">'+arr.map(function(f){return '<li>'+esc(f)+'</li>';}).join('')+'</ul>':'';}
  function relChips(rel){
    if(!rel||!rel.length) return '';
    return '<div class="nt-rel">관련 기록: '+rel.map(function(r){
      if(r.type==='minutes') return '<button type="button" class="nt-chip" onclick="Cloud._open(\''+esc(r.id)+'\')">'+esc(r.label||r.id)+'</button>';
      if(r.type==='notice') return '<button type="button" class="nt-chip" onclick="Notices.jump(\''+esc(r.id)+'\')">'+esc(r.label||r.id)+'</button>';
      if(r.type==='check') return '<button type="button" class="nt-chip" onclick="Notices.jumpCheck(\''+esc(r.id)+'\')">🔗 '+esc(r.label||r.id)+'</button>';
      return '<span class="nt-chip">'+esc(r.label||r.id)+'</span>';
    }).join(' ')+'</div>';
  }
  function noticeCard(n){
    var meta=[n.noticeNo?('공고번호 '+n.noticeNo):'',n.postRange?('게시 '+n.postRange):''].filter(Boolean).join(' · ');
    return '<div class="nt-card" id="nt-'+esc(n.id)+'">'+
      '<div class="nt-head"><span class="nt-date">'+esc(n.date||'')+'</span>'+badge(n.body,bodyCls(n.body))+badge(n.kind,'k')+'</div>'+
      '<div class="nt-title">'+esc(n.title)+'</div>'+
      (n.summary?'<div class="nt-sum">'+esc(n.summary)+'</div>':'')+bullets(n.facts)+
      (n.text?'<details class="nt-src"><summary>📄 원문 전문'+(meta?' <span class="small">'+esc(meta)+'</span>':'')+'</summary><pre>'+esc(n.text)+'</pre>'+(n.file?'<div class="nt-foot">원본 파일: '+esc(n.file)+'</div>':'')+'</details>':'')+
      (n.link?'<div class="nt-foot"><a href="'+esc(n.link)+'" target="_blank" rel="noopener">원본 열기(드라이브) ↗</a></div>':'')+
      (n.notes?'<div class="nt-foot">※ '+esc(n.notes)+'</div>':'')+relChips(n.related)+'</div>';
  }

  function invStatusStyle(i){
    if(i.severity==='confirmed') return 'background:#fbe9e7;color:#9b2c23;border-color:#efb3ad';
    if(i.severity==='high') return 'background:#fff2d9;color:#8a5a00;border-color:#efcf91';
    if(i.severity==='medium') return 'background:#edf2f7;color:#4a5568;border-color:#cbd5e0';
    return 'background:#edf5ed;color:#3f6840;border-color:#bdd6bd';
  }
  function invList(title,arr,kind){
    if(!arr||!arr.length) return '';
    return '<section class="pc-section'+(kind?' '+kind:'')+'"><h4>'+esc(title)+'</h4><ul class="nt-facts">'+arr.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></section>';
  }
  function cardDetail(i){
    var sections=invList('확인된 사실',i.facts,'pc-facts')+invList('적용 기준',i.rules,'pc-rules')+invList('확인자료',i.evidence,'pc-evidence')+
      (i.question?'<section class="pc-section pc-question"><h4>판단이 필요한 부분</h4><p>'+esc(i.question)+'</p></section>':'')+
      (i.next?'<section class="pc-section pc-next"><h4>다음 조치</h4><p>'+esc(i.next)+'</p></section>':'')+
      '<div class="pc-related">'+relChips(i.related)+'</div>';
    if(!sections) return '';
    return '<details class="pc-detail"><summary><span>확인된 사실·적용 기준·자료 자세히 보기</span><span class="pc-detail-arrow" aria-hidden="true">⌄</span></summary><div class="pc-detail-body">'+sections+'</div></details>';
  }
  function investigationCard(i){
    return '<details class="nt-card pc-card" id="chk-'+esc(i.id||'')+'">'+
      '<summary class="pc-card-summary">'+
        '<div class="pc-card-main"><div class="pc-card-meta">'+
          '<span class="nt-badge" style="'+invStatusStyle(i)+'">'+esc(i.status)+'</span>'+
          (i.statusDetail?'<span class="pc-status-detail">'+esc(i.statusDetail)+'</span>':'')+
          '<span class="small">'+esc(i.category||'')+(i.updatedAt?' · 갱신 '+esc(i.updatedAt):'')+'</span></div>'+
          '<h3 class="pc-card-title">'+esc(i.title)+'</h3>'+
          '</div>'+
        '<span class="pc-toggle" aria-hidden="true"><span class="pc-toggle-label"></span><span class="pc-toggle-arrow">⌄</span></span>'+
      '</summary>'+
      '<div class="pc-card-body">'+
        '<section class="pc-story"><h4>핵심 이야기</h4><p>'+esc(i.summary||'세부 확인 내용이 정리 중입니다.')+'</p></section>'+
        cardDetail(i)+
      '</div></details>';
  }
  // 클라우드 절차 점검 항목(checks_v1)을 조사 현황과 같은 카드 형태로 변환
  function checkAsInv(c){
    // 중임 항목은 '공개 공고에서 확인되지 않음'과 '요건 미충족 확정'을 구분해 표시한다.
    // 2020.4.18 규약은 4기 이후 판단에 적용하고, 3기는 당시 규약 원본을 확보한 뒤 별도 판단한다.
    if(c.id==='c_term_limit'){
      return {
        id:c.id, status:'확인중', statusDetail:'예외 요건 확인자료 필요', severity:'medium', category:'규약 대조', updatedAt:c.updatedAt,
        title:'임차 6기 중임 제한 대상 — 반드시 확인할 것',
        summary:'제6기 당선인 중 진세택·원영해·강명순은 정리된 재임 기록상 중임 제한을 넘긴 대상으로 보입니다. 예외 선출이었다면 선행 공고 요건과 함께 해당 선거구 전체 임차인의 2분의 1 이상 찬성을 받았는지 확인해야 합니다. 투표자 과반수 찬성만으로는 부족합니다.',
        facts:[
          '현재 정리된 기수 기록상 진세택(1~6기), 한경열(2~5기), 원영해(3~6기), 강명순(4기 보궐~6기)은 3회 이상 재임한 것으로 나타납니다.',
          '제6기 당선인 중 확인 대상은 진세택(제2선거구·203동), 원영해(제5선거구·210동), 강명순(제9선거구·216동)입니다.',
          '2026.8.19 임대세대 분포를 단순 참고하면 203동은 31명 중 16표 이상, 210동은 27명 중 14표 이상, 216동은 28명 중 14표 이상입니다. 다만 이 자료는 2025.12.24 선거 뒤 자료이므로 충족 여부를 확정하는 수치가 아닙니다.',
          '강명순의 4기 보궐 임기는 약 18개월로, 2020.4.18 규약 제16조제5항의 ‘6개월 미만’ 예외에는 해당하지 않습니다.',
          '확보된 4기·4기 보궐·5기·6기 당선인 공고에는 득표수·투표수·찬성수는 기재되어 있지 않습니다.',
          '4기와 5기는 1·2차 공고의 무입후보 사실이 공고에서 확인되지만, 6기는 차수별 후보 등록 결과가 공개 공고에서 확인되지 않습니다.',
          '3기 선거 공고류는 현재 확보된 공개 기록에서 확인되지 않습니다. 3기 선거는 당시 적용 규약과 선관위 원본기록을 함께 확인해야 합니다.'
        ],
        rules:(c.rules||[]).map(function(r){return r.ref+(r.text?': '+r.text:'')+(r.verified===false?' (원문 대조 전)':'');}), evidence:c.evidence,
        question:'각 대상 선거구별로 ① 두 차례 공고의 후보자 등록 결과, ② 중임자가 등록한 후속 공고, ③ 비중임 후보 등록 여부, ④ 선거 당시 선거인명부의 해당 선거구 전체 임차인 수, ⑤ 찬성표가 그 전체 임차인 수의 2분의 1 이상인지 선관위 원본기록 또는 전자투표 집계로 대조해야 합니다. 투표자 과반수 찬성만으로는 부족합니다. 이 자료가 확인되기 전에는 당선 무효나 규약 위반으로 단정하지 않습니다.',
        next:'관리주체에 대상 선거별 후보등록부·개표결과·전자투표 집계와 당시 적용 규약을 확인해 달라고 요청', related:c.related
      };
    }
    return {
      id:c.id, status:c.status||'확인중', statusDetail:c.statusDetail||'', severity:c.severity||'medium', category:'규약 대조',
      title:c.title, summary:c.summary||'', facts:c.facts,
      rules:(c.rules||[]).map(function(r){return r.ref+(r.text?': '+r.text:'')+(r.verified===false?' (원문 대조 전)':'');}),
      question:c.question, next:null, related:c.related, updatedAt:c.updatedAt
    };
  }
  function sevRank(i){return {confirmed:0,high:1,medium:2}[i.severity]!==undefined?{confirmed:0,high:1,medium:2}[i.severity]:3;}
  // v87: 문제 사슬(스레드)별 묶음 — 항목이 어떻게 이어지는지 흐름 한 줄과 함께 보여준다.
  //   ids 순서 = 이야기 순서(원인 → 파생). 어디에도 안 속한 항목은 '그 밖의 점검'으로.
  var CHECK_THREADS=[
    {t:'❶ 6기 선관위 구성 문제와 그 파생',
     flow:'5기 임기 만료(2025.10.8) → 선거 지연 → 공개모집 공고 없이 4명 구성(요건 미충족 확인) → 위원 결격·정원 미달 소지 → 후보 공고 다음 날 투표 → 이 선관위가 뽑은 6기 동대표·커뮤니티센터 투표의 효력 문제 → LH 사실확인 진행 중',
     ids:['tenant-election-delay','c_ec6_formation','c_ec_chair','c_ec_candidate','c_t6_schedule','tenant-election-qualification','lh-missing-application']},
    {t:'❷ 기수를 가로지르는 반복 패턴 (2→6기)',
     flow:'2·3기 선거는 공고가 거의 없음(2기는 후보 등록 공고뿐, 3기는 전무 — 당선인 공고는 4·5·6기만 존재) · 모집 공고~접수 7일 요건은 확인된 전 기수에서 미충족 · 5기 선관위도 4명 구성·위원장의 대표 전환 · 5기 임기 기록 불일치 · 진세택 회장은 1기 부회장→2기부터 회장, 1~6기 연속 재임 — 6기만의 일탈이 아니라 반복돼 온 관행',
     ids:['c_t3_election','c_ec_recruit_notice','c_ec5_transition','c_t5_term','c_term_limit']},
    {t:'❸ 운영경비 위반과 관리주체 책임',
     flow:'운영경비 규약 위반(LH 공식 확인) + 선거자료 제출 누락 경위 → 개별 해명이 아닌 신대한 본사 차원의 사실확정·시정·환수 요구 단계',
     ids:['tenant-expense-violation','management-responsibility']}
  ];
  function investigationsHtml(){
    var cloud=(st.checks&&st.checks.items)?st.checks.items.map(checkAsInv):[];
    if(!st.investigations&&!cloud.length) return '<div class="nt-empty">'+((st.investigationsLoading||st.loading)?'점검 기록 불러오는 중…':'점검 기록이 없습니다.')+'</div>';
    var all=((st.investigations&&st.investigations.items)||[]).concat(cloud);
    var statuses=['전체'].concat(Array.from(new Set(all.map(function(i){return i.status;}))));
    var confirmed=all.filter(function(i){return i.severity==='confirmed';}).length;
    var active=all.filter(function(i){return i.status!=='해소'&&i.status!=='문제없음';}).length;
    var h='<header class="pc-overview"><div class="pc-overview-title"><h2>절차 점검 현황</h2><p>'+esc((st.investigations&&st.investigations.updated)||'')+' 기준 · 조사 '+(((st.investigations&&st.investigations.items)||[]).length)+'건 · 규약 대조 '+cloud.length+'건</p></div>'+
      '<div class="pc-stats"><div><b>'+all.length+'</b><span>전체 점검</span></div><div><b>'+active+'</b><span>진행중</span></div><div class="danger"><b>'+confirmed+'</b><span>위반·미충족 확인</span></div></div></header>';
    h+='<div class="nt-note pc-guide"><p>'+esc((st.investigations&&st.investigations.note)||'')+'</p><p><b>규약 대조</b> 항목은 카페 게시판 공고·회의록 전수 대조와 규약 조문 원문 확인을 바탕으로 한 기록으로, 빨간 배지는 문서상 요건 미충족이 확인된 건입니다. 이어지는 문제끼리 묶어 흐름 순서로 보여줍니다.</p><p class="pc-guide-tip">각 항목의 제목을 누르면 확인된 사실과 근거 자료를 볼 수 있습니다.</p></div>';
    h+='<div class="nt-filters pc-filters" aria-label="절차 점검 상태 필터">'+statuses.map(function(s){var count=s==='전체'?all.length:all.filter(function(i){return i.status===s;}).length;return '<button type="button" class="btn'+(st.checkFilter===s?' gold':'')+'" onclick="Notices.checkFilter(\''+esc(s)+'\')">'+esc(s)+' <span>'+count+'</span></button>';}).join('')+'</div>';
    var byId={};all.forEach(function(i){if(i.id)byId[i.id]=i;});
    var used={},shown=0;
    CHECK_THREADS.forEach(function(th){
      var items=th.ids.map(function(id){used[id]=1;return byId[id];}).filter(Boolean)
        .filter(function(i){return st.checkFilter==='전체'||i.status===st.checkFilter;});
      if(!items.length) return;
      shown+=items.length;
      h+='<details class="pc-thread"><summary class="pc-thread-head"><div><h2>'+esc(th.t)+'</h2><p>'+items.length+'건의 점검 기록</p></div><span class="pc-toggle"><span class="pc-toggle-label"></span><span class="pc-toggle-arrow">⌄</span></span></summary>'+
        '<div class="pc-thread-body"><div class="pc-flow"><b>흐름</b><p>'+esc(th.flow)+'</p></div><div class="pc-card-list">'+items.map(investigationCard).join('')+'</div></div></details>';
    });
    var rest=all.filter(function(i){return !(i.id&&used[i.id]);})
      .filter(function(i){return st.checkFilter==='전체'||i.status===st.checkFilter;})
      .sort(function(a,b){return sevRank(a)-sevRank(b);});
    if(rest.length){
      shown+=rest.length;
      h+='<details class="pc-thread"><summary class="pc-thread-head"><div><h2>그 밖의 점검</h2><p>'+rest.length+'건의 점검 기록</p></div><span class="pc-toggle"><span class="pc-toggle-label"></span><span class="pc-toggle-arrow">⌄</span></span></summary>'+
        '<div class="pc-thread-body"><div class="pc-card-list">'+rest.map(investigationCard).join('')+'</div></div></details>';
    }
    if(!shown) h+='<div class="nt-empty">선택한 상태의 점검 건이 없습니다.</div>';
    return h;
  }

  function draw(){
    var box=document.getElementById('noticeBody');if(!box)return;
    // v91: 🔒는 '비밀번호가 필요한 탭' 표시로 항상 보여준다(풀린 기기에서도) — 사용자 요청: 남들에게 뭐가 잠겼는지 확인용
    var checkCount=(st.investigations&&st.investigations.items?st.investigations.items.length:0)+(st.checks&&st.checks.items?st.checks.items.length:0);
    var h='<div class="nt-tabs">'+
      '<button type="button" class="btn'+(st.sub==='rules'?' gold':'')+'" onclick="Notices.sub(\'rules\')">관리규약</button>'+
      '<button type="button" class="btn'+(st.sub==='contracts'?' gold':'')+'" onclick="Notices.sub(\'contracts\')">계약·기준문서</button>'+
      '<button type="button" class="btn'+(st.sub==='elections'?' gold':'')+'" onclick="Notices.sub(\'elections\')">선거·선관위</button>'+
      '<button type="button" class="btn'+(st.sub==='notices'?' gold':'')+'" onclick="Notices.sub(\'notices\')">공고·안내 🔒'+(!locked()&&st.notices?' ('+st.notices.items.length+')':'')+'</button>'+
      '<button type="button" class="btn'+(st.sub==='checks'?' gold':'')+'" onclick="Notices.sub(\'checks\')">절차 점검 🔒'+(!locked()&&checkCount?' ('+checkCount+')':'')+'</button></div>';
    if(st.err) h+='<div class="nt-err">'+esc(st.err)+'</div>';
    if(st.sub==='rules'){box.innerHTML=h+rulesHtml();return;}
    if(st.sub==='contracts'){box.innerHTML=h+contractsHtml();if(!st.contracts&&!st.contractsLoading)loadContracts();return;}
    if(st.sub==='elections'){box.innerHTML=h+electionsHtml();if(!st.elections&&!st.electionsLoading)loadElections();return;}
    if(locked()){box.innerHTML=h+lockHtml();return;}
    if(st.sub==='notices'){
      if(!st.notices){h+='<div class="nt-empty">'+(st.loading?'불러오는 중…':'기록이 없습니다.')+'</div>';box.innerHTML=h;if(!st.loading)load();return;}
      var items=st.notices.items.slice();
      var bodies=['전체'].concat(Array.from(new Set(items.map(function(n){return n.body;}))));
      var kinds=['전체'].concat(Array.from(new Set(items.map(function(n){return n.kind;}))));
      h+='<div class="nt-filters">'+bodies.map(function(b){return '<button type="button" class="btn'+(st.fBody===b?' gold':'')+'" onclick="Notices.fBody(\''+esc(b)+'\')">'+esc(b)+'</button>';}).join('')+'<span class="nt-sep"></span>'+kinds.map(function(k){return '<button type="button" class="btn'+(st.fKind===k?' gold':'')+'" onclick="Notices.fKind(\''+esc(k)+'\')">'+esc(k)+'</button>';}).join('')+'</div>';
      items=items.filter(function(n){return (st.fBody==='전체'||n.body===st.fBody)&&(st.fKind==='전체'||n.kind===st.fKind);});
      items.sort(function(a,b){return String(b.date).localeCompare(String(a.date));});
      var years={},order=[];
      items.forEach(function(n){var y=String(n.date||'').slice(0,4)||'기타';if(!years[y]){years[y]=[];order.push(y);}years[y].push(n);});
      order.forEach(function(y){h+='<div class="nt-year">'+esc(y)+'년 <span class="small">('+years[y].length+')</span></div>'+years[y].map(noticeCard).join('');});
      if(!items.length)h+='<div class="nt-empty">조건에 맞는 기록이 없습니다.</div>';
    }else{
      h+=investigationsHtml();
      if(!st.investigations&&!st.investigationsLoading) loadInvestigations();
      if(!st.checks&&!st.loading) load(); // 규약 대조 기록(checks_v1)도 함께
    }
    box.innerHTML=h;
  }

  return {
    render:function(){draw();if(st.sub==='rules')loadRules();else if(st.sub==='contracts')loadContracts();else if(st.sub==='elections')loadElections();else if(st.sub==='checks')loadInvestigations();},
    reload:function(){
      st.notices=null;st.checks=null;st.rulesDocs={};st.contracts=null;st.investigations=null;st.elections=null;st.err='';
      if(st.sub==='rules')loadRules();else if(st.sub==='contracts')loadContracts();else if(st.sub==='elections')loadElections();else if(st.sub==='checks')loadInvestigations();else if(!locked())load();
      draw();
    },
    sub:function(s){st.sub=s;draw();if(s==='rules')loadRules();else if(s==='contracts')loadContracts();else if(s==='elections')loadElections();else if(s==='checks'){loadInvestigations();if(!locked()&&!st.checks)load();}else if(!locked()&&!st.notices)load();},
    fBody:function(b){st.fBody=b;draw();},
    doc:function(d){st.doc=d;draw();loadRules();},
    fKind:function(k){st.fKind=k;draw();},
    checkFilter:function(s){st.checkFilter=s;draw();},
    search:function(q){st.q=q;clearTimeout(st._t);st._t=setTimeout(function(){var el=document.getElementById('ruleSearch'),pos=el?el.selectionStart:0;draw();var el2=document.getElementById('ruleSearch');if(el2){el2.focus();try{el2.setSelectionRange(pos,pos);}catch(e){}}},250);},
    contractSearch:function(q){st.cq=q;clearTimeout(st._ct);st._ct=setTimeout(function(){var el=document.getElementById('contractSearch'),pos=el?el.selectionStart:0;draw();var el2=document.getElementById('contractSearch');if(el2){el2.focus();try{el2.setSelectionRange(pos,pos);}catch(e){}}},200);},
    unlock:function(){
      var inp=document.getElementById('ntKeyInput'),msg=document.getElementById('ntKeyMsg');
      var k=inp?inp.value.trim():'';
      if(!k){if(msg)msg.textContent='비밀번호를 입력해 주세요.';return;}
      if(st.verifying)return;st.verifying=true;if(msg)msg.textContent='확인 중…';
      verifyKey(k).then(function(ok){
        st.verifying=false;
        if(ok){try{localStorage.setItem('sandle_admin_key',k);localStorage.setItem('sandle_admin_unlock_at',String(Date.now()));}catch(e){}st.unlocked=true;if(st.sub==='checks')loadInvestigations();load();draw();}
        else if(msg)msg.textContent='비밀번호가 올바르지 않습니다.';
      }).catch(function(){st.verifying=false;if(msg)msg.textContent='확인 실패 — 네트워크 상태를 확인해 주세요.';});
    },
    jump:function(id){if(locked())return;st.sub='notices';draw();var el=document.getElementById('nt-'+id);if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('hl');setTimeout(function(){el.classList.remove('hl');},1600);}},
    // 연관 점검 칩: 절차 점검 목록 안에서 대상 카드로 이동해 펼쳐 보여준다(조사 현황·규약 대조 공통)
    jumpCheck:function(id){if(locked())return;st.sub='checks';st.checkFilter='전체';draw();var el=document.getElementById('chk-'+id);if(el){el.open=true;el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('hl');setTimeout(function(){el.classList.remove('hl');},1600);}}
  };
})();
window.Notices=Notices;
