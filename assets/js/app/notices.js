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
    notices:null,checks:null,rulesDocs:{},contracts:null,investigations:null,
    doc:"all",loading:false,contractsLoading:false,investigationsLoading:false,
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
  function hasKey(){try{return !!localStorage.getItem("sandle_admin_key");}catch(e){return false;}}
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
  function verifyKey(k){return fetch(URL_,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"delete",id:"___verify_key___",adminKey:k,token:TOKEN})}).then(function(r){return r.json()}).then(function(x){return !!(x&&x.ok);});}

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
    fetch("contracts.json?v=2").then(function(r){return r.json()}).then(function(j){
      st.contractsLoading=false;st.contracts=j;draw();
    }).catch(function(){st.contractsLoading=false;st.err="contracts.json을 불러오지 못했습니다.";draw();});
  }
  function loadInvestigations(){
    if(st.investigations||st.investigationsLoading) return;
    st.investigationsLoading=true;
    fetch("investigations.json?v=3").then(function(r){return r.json()}).then(function(j){
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
  function contractsHtml(){
    if(!st.contracts) return '<div class="nt-empty">'+(st.contractsLoading?'계약·기준문서 불러오는 중…':'계약·기준문서가 없습니다.')+'</div>';
    var q=st.cq.trim(),h='<div class="rl-head"><input id="contractSearch" class="rl-search" placeholder="모든 계약·기준문서 검색 (예: 계약해지, 위탁관리수수료, 감사, 보고)" value="'+esc(st.cq)+'" oninput="Notices.contractSearch(this.value)">';
    h+='<div class="small" style="margin-top:4px">'+esc(st.contracts.note||'')+'</div></div>';
    var items=st.contracts.items||[];
    if(!q){
      // 검색어 없으면: 문서 제목 카드만(접힘) — 펼쳐야 조문이 보인다.
      h+=items.map(function(d){
        var n=contractDocClauses(d).length;
        return '<details class="rl-art"><summary><b>'+esc(d.title)+'</b> <span class="small">'+esc(d.type||'')+(d.period?' · '+esc(d.period):'')+' · 조문 '+n+'건</span></summary>'+
          contractDocMetaHtml(d)+contractDocBodyHtml(d,'')+'</details>';
      }).join('');
      if(!items.length) h+='<div class="nt-empty">등록된 계약·기준문서가 없습니다.</div>';
      return h;
    }
    var total=0,body='';
    items.forEach(function(d){
      var clauses=contractDocClauses(d).filter(function(c){return contractHay(c).indexOf(q.toLowerCase())>=0;});
      var docHit=[d.title,d.type,d.period,(d.tags||[]).join(' '),(d.deal||[]).join(' ')].join(' ').toLowerCase().indexOf(q.toLowerCase())>=0;
      if(!clauses.length&&!docHit) return;
      total+=clauses.length;
      body+='<div class="rl-doc-h">'+hl(d.title,q)+' <span class="small">'+esc(d.period||'')+(clauses.length?' — '+clauses.length+'건':'')+'</span></div>';
      if(!clauses.length) body+='<div class="nt-empty" style="padding:10px">문서 기본정보에 검색어가 있습니다. 조문에는 일치하는 곳이 없습니다.</div>';
      else body+=clauses.map(function(c){return contractClauseHtml(c,q,true);}).join('');
    });
    h+='<div class="rl-count">"'+esc(q)+'" 검색 결과 '+total+'개 조문 — 일치하는 조문만 표시(펼침)</div>'+body;
    if(!total&&body.indexOf('rl-doc-h')<0) h+='<div class="nt-empty">검색 결과가 없습니다.</div>';
    return h;
  }

  function lockHtml(){
    return '<div class="nt-lock"><div class="nt-lock-ic">🔒</div><b>관리자 확인이 필요한 기록입니다</b>'+
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
  function invList(title,arr){
    if(!arr||!arr.length) return '';
    return '<div style="margin-top:13px"><div class="nt-sec" style="margin-top:0">'+esc(title)+'</div><ul class="nt-facts">'+arr.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></div>';
  }
  function investigationCard(i){
    return '<details class="nt-card" id="chk-'+esc(i.id||'')+'" style="padding:0;overflow:hidden;margin:0">'+
      '<summary style="list-style:none;cursor:pointer;padding:15px 16px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start">'+
        '<div style="min-width:0"><div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:7px">'+
          '<span class="nt-badge" style="'+invStatusStyle(i)+'">'+esc(i.status)+'</span><span class="small">'+esc(i.category||'')+(i.updatedAt?' · 갱신 '+esc(i.updatedAt):'')+'</span></div>'+
          '<div class="nt-title" style="margin:0 0 5px">'+esc(i.title)+'</div><div class="nt-sum" style="margin:0">'+esc(i.summary||'')+'</div></div>'+
        '<span aria-hidden="true" style="font-size:18px;color:var(--muted);padding-top:4px">⌄</span>'+
      '</summary>'+
      '<div style="border-top:1px solid var(--line);padding:2px 16px 16px">'+
        invList('확인된 사실',i.facts)+invList('적용 기준',i.rules)+invList('확인자료',i.evidence)+
        (i.question?'<div style="margin-top:13px"><div class="nt-sec" style="margin-top:0">판단이 필요한 부분</div><div class="nt-sum">'+esc(i.question)+'</div></div>':'')+
        (i.next?'<div class="nt-note" style="margin-top:13px"><b>다음 조치</b><br>'+esc(i.next)+'</div>':'')+
        relChips(i.related)+
      '</div></details>';
  }
  // 클라우드 절차 점검 항목(checks_v1)을 조사 현황과 같은 카드 형태로 변환
  function checkAsInv(c){
    return {
      id:c.id, status:c.status||'확인중', severity:c.severity||'medium', category:'규약 대조',
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
     flow:'3기 선거는 공고 자체가 게시판에 없음(2019~20) · 모집 공고~접수 7일 요건은 확인된 전 기수에서 미충족 · 5기 선관위도 4명 구성·위원장의 대표 전환 · 5기 임기 기록 불일치 · 진세택 회장은 2기부터 5개 기수 연속 재임 — 6기만의 일탈이 아니라 반복돼 온 관행',
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
    var h='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin:4px 0 12px">'+
      '<div><div style="font-size:17px;font-weight:900">절차 점검 현황</div><div class="small" style="margin-top:3px">'+esc((st.investigations&&st.investigations.updated)||'')+' 기준 조사 '+(((st.investigations&&st.investigations.items)||[]).length)+'건 · 규약 대조 '+cloud.length+'건</div></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><span class="nt-badge">진행중 '+active+'</span><span class="nt-badge" style="background:#fbe9e7;color:#9b2c23;border-color:#efb3ad">위반·미충족 확인 '+confirmed+'</span></div></div>';
    h+='<div class="nt-note" style="margin-bottom:12px">'+esc((st.investigations&&st.investigations.note)||'')+' <b>규약 대조</b> 항목은 카페 게시판 공고·회의록 전수 대조와 규약 조문 원문 확인을 바탕으로 한 기록으로, 빨간 배지는 문서상 요건 미충족이 확인된 건입니다. 이어지는 문제끼리 묶어 흐름 순서로 보여줍니다.</div>';
    h+='<div class="nt-filters" style="margin-bottom:12px">'+statuses.map(function(s){return '<button type="button" class="btn'+(st.checkFilter===s?' gold':'')+'" onclick="Notices.checkFilter(\''+esc(s)+'\')">'+esc(s)+'</button>';}).join('')+'</div>';
    var byId={};all.forEach(function(i){if(i.id)byId[i.id]=i;});
    var used={},shown=0;
    CHECK_THREADS.forEach(function(th){
      var items=th.ids.map(function(id){used[id]=1;return byId[id];}).filter(Boolean)
        .filter(function(i){return st.checkFilter==='전체'||i.status===st.checkFilter;});
      if(!items.length) return;
      shown+=items.length;
      h+='<div style="margin:20px 0 10px"><div style="font-size:15px;font-weight:900">'+esc(th.t)+'</div>'+
        '<div class="small" style="margin-top:4px;line-height:1.7;color:var(--muted)">'+esc(th.flow)+'</div></div>'+
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:10px">'+items.map(investigationCard).join('')+'</div>';
    });
    var rest=all.filter(function(i){return !(i.id&&used[i.id]);})
      .filter(function(i){return st.checkFilter==='전체'||i.status===st.checkFilter;})
      .sort(function(a,b){return sevRank(a)-sevRank(b);});
    if(rest.length){
      shown+=rest.length;
      h+='<div style="margin:20px 0 10px;font-size:15px;font-weight:900">그 밖의 점검</div>'+
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:10px">'+rest.map(investigationCard).join('')+'</div>';
    }
    if(!shown) h+='<div class="nt-empty">선택한 상태의 점검 건이 없습니다.</div>';
    return h;
  }

  function draw(){
    var box=document.getElementById('noticeBody');if(!box)return;
    var lockMark=locked()?' 🔒':'';
    var checkCount=(st.investigations&&st.investigations.items?st.investigations.items.length:0)+(st.checks&&st.checks.items?st.checks.items.length:0);
    var h='<div class="nt-tabs">'+
      '<button type="button" class="btn'+(st.sub==='rules'?' gold':'')+'" onclick="Notices.sub(\'rules\')">관리규약</button>'+
      '<button type="button" class="btn'+(st.sub==='contracts'?' gold':'')+'" onclick="Notices.sub(\'contracts\')">계약·기준문서</button>'+
      '<button type="button" class="btn'+(st.sub==='notices'?' gold':'')+'" onclick="Notices.sub(\'notices\')">공고·안내'+(!locked()&&st.notices?' ('+st.notices.items.length+')':lockMark)+'</button>'+
      '<button type="button" class="btn'+(st.sub==='checks'?' gold':'')+'" onclick="Notices.sub(\'checks\')">절차 점검'+(!locked()&&checkCount?' ('+checkCount+')':lockMark)+'</button></div>';
    if(st.err) h+='<div class="nt-err">'+esc(st.err)+'</div>';
    if(st.sub==='rules'){box.innerHTML=h+rulesHtml();return;}
    if(st.sub==='contracts'){box.innerHTML=h+contractsHtml();if(!st.contracts&&!st.contractsLoading)loadContracts();return;}
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
    render:function(){draw();if(st.sub==='rules')loadRules();else if(st.sub==='contracts')loadContracts();else if(st.sub==='checks')loadInvestigations();},
    reload:function(){
      st.notices=null;st.checks=null;st.rulesDocs={};st.contracts=null;st.investigations=null;st.err='';
      if(st.sub==='rules')loadRules();else if(st.sub==='contracts')loadContracts();else if(st.sub==='checks')loadInvestigations();else if(!locked())load();
      draw();
    },
    sub:function(s){st.sub=s;draw();if(s==='rules')loadRules();else if(s==='contracts')loadContracts();else if(s==='checks'){loadInvestigations();if(!locked()&&!st.checks)load();}else if(!locked()&&!st.notices)load();},
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
        if(ok){try{localStorage.setItem('sandle_admin_key',k);}catch(e){}st.unlocked=true;if(st.sub==='checks')loadInvestigations();load();draw();}
        else if(msg)msg.textContent='비밀번호가 올바르지 않습니다.';
      }).catch(function(){st.verifying=false;if(msg)msg.textContent='확인 실패 — 네트워크 상태를 확인해 주세요.';});
    },
    jump:function(id){if(locked())return;st.sub='notices';draw();var el=document.getElementById('nt-'+id);if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('hl');setTimeout(function(){el.classList.remove('hl');},1600);}},
    // 연관 점검 칩: 절차 점검 목록 안에서 대상 카드로 이동해 펼쳐 보여준다(조사 현황·규약 대조 공통)
    jumpCheck:function(id){if(locked())return;st.sub='checks';st.checkFilter='전체';draw();var el=document.getElementById('chk-'+id);if(el){el.open=true;el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('hl');setTimeout(function(){el.classList.remove('hl');},1600);}}
  };
})();
window.Notices=Notices;
