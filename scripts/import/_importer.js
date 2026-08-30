// 공통 적재 모듈 (v81, 2026-08-31) — 모든 클라우드 적재는 이 모듈의 run()으로: 저장 → 재조회 대조 → 목록 대조까지 한 단계.
// 배경: tenant_2022.js가 혼입 줄 SyntaxError로 통째로 미실행이었는데 CHANGELOG에는 완료로 남았던 사고(08-31 발견) → 검증 자동화.
// 사용(회의록 앱 https://sandleapt.github.io/minutes/ 을 연 브라우저, 관리자 키 필요):
//   var s=document.createElement("script");s.src="scripts/import/_importer.js?v="+Date.now();document.head.appendChild(s);
//   (데이터 스크립트도 같은 방식으로 로드 — 데이터 스크립트는 JOB 객체만 정의) → await SandleImporter.run(JOB)
// JOB = { label:"설명",
//   meetings:[{id,name,date,json:<앱 상태 객체>,overwrite:false}, ...],   // 회의록 레코드. 이미 있으면 건너뜀(overwrite:true면 덮어씀)
//   notices:[<보관함 item>, ...],                                        // notices_v1에 id 기준 병합(중복 건너뜀, item.overwrite:true면 교체) 후 날짜순 정렬
//   checks:[{id,addFacts:[],addRelated:[],status?,memo?}, ...] }         // checks_v1 항목에 사실·연결 추가(중복 사실은 무시)
// 저장 규칙: notices_v1/checks_v1은 45,000자 초과 시 주제 요약과 같은 조각 방식({chunked,parts}+id_pN 슬라이스)으로 자동 분할(docs/DATA.md §8).
//            회의록 단일 레코드는 49,000자 초과 시 저장 거부(시트 셀 50,000자 한도) — 자료 분리 필요.
// 검증 실패 시 throw — "검증 실패" 없이 끝났을 때만 적재 완료로 기록할 것(CHANGELOG·메모리).
(function(){
  var URL_="https://script.google.com/macros/s/AKfycbyhpE-DB5WAAEx7uqTCPwU-e0sPKuupkYN3YoQWALiFWe0IHFNh1y91e1VNtDmMxxoxLA/exec";
  var TOKEN="ITDXaUBDTmrz6DbQ3tv9R";
  var LIMIT=45000;
  function key(){var k=localStorage.getItem("sandle_admin_key");if(!k)throw new Error("sandle_admin_key 없음 — 관리자 키 있는 기기에서 실행");return k;}
  async function api(qs){var r=await fetch(URL_+qs);return r.json();}
  async function post(body){var r=await fetch(URL_,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body)});return r.json();}
  async function getItem(id){var x=await api("?action=get&token="+TOKEN+"&id="+encodeURIComponent(id));return x&&x.ok&&x.item?x.item:null;}
  async function saveRaw(rec){var x=await post({action:"save",record:rec,adminKey:key(),token:TOKEN});if(!x||!x.ok)throw new Error("save 실패 "+rec.id+" "+JSON.stringify(x));return x;}
  async function del(id){return post({action:"delete",id:id,adminKey:key(),token:TOKEN});}
  // 조각 인식 읽기: {obj, item, parts}
  async function getFull(id){
    var it=await getItem(id);if(!it)return {obj:null,item:null,parts:0};
    var j=JSON.parse(it.json);
    if(!(j&&j.chunked&&j.parts))return {obj:j,item:it,parts:0};
    var s="";for(var i=1;i<=j.parts;i++){var p=await getItem(id+"_p"+i);if(!p)throw new Error(id+"_p"+i+" 조각 없음");s+=p.json;}
    return {obj:JSON.parse(s),item:it,parts:j.parts};
  }
  // 자동 조각 저장. oldParts: 이전 조각 수(줄어든 조각 삭제용). 반환: 새 조각 수(0=단일).
  async function saveFull(id,name,date,obj,oldParts){
    var txt=JSON.stringify(obj);
    if(txt.length>LIMIT){
      var n=Math.ceil(txt.length/LIMIT);
      for(var i=1;i<=n;i++)await saveRaw({id:id+"_p"+i,name:name+" (조각 "+i+"/"+n+")",date:"",json:txt.slice((i-1)*LIMIT,i*LIMIT)});
      await saveRaw({id:id,name:name,date:date||"",json:JSON.stringify({version:(obj&&obj.version)||1,chunked:true,parts:n,totalLen:txt.length,updatedAt:new Date().toISOString()})});
      for(var i2=n+1;i2<=(oldParts||0);i2++)await del(id+"_p"+i2);
      return n;
    }
    await saveRaw({id:id,name:name,date:date||"",json:txt});
    for(var i3=1;i3<=(oldParts||0);i3++)await del(id+"_p"+i3);
    return 0;
  }
  window.SandleImporter={
    getFull:async function(id){return (await getFull(id)).obj;},
    saveFull:saveFull,
    run:async function(job){
      if(!job)throw new Error("JOB 없음");
      var report=[],errors=[];
      // 1) 회의록 레코드 — 저장 후 재조회로 바이트 단위 대조
      var meetings=job.meetings||[];
      for(var m of meetings){
        var txt=JSON.stringify(m.json);
        if(txt.length>49000){errors.push(m.id+": "+txt.length+"자 — 시트 셀 한도(50,000) 임박, 자료 분리 필요");continue;}
        var exist=await getItem(m.id);
        if(exist&&!m.overwrite){report.push(m.id+": 이미 있음 → 건너뜀(덮어쓰려면 overwrite:true)");continue;}
        await saveRaw({id:m.id,name:m.name,date:m.date,json:txt});
        var back=await getItem(m.id);
        if(!back||back.json!==txt)errors.push(m.id+": 재조회 불일치");
        else report.push(m.id+": 저장·재조회 검증 OK ("+txt.length+"자"+(exist?", 덮어씀":"")+")");
      }
      // 2) 공고 보관함 병합
      if(job.notices&&job.notices.length){
        var cur=await getFull("notices_v1");var nj=cur.obj||{version:1,items:[]};
        var byId={};nj.items.forEach(function(x,i){byId[x.id]=i;});
        var added=[],replaced=[];
        job.notices.forEach(function(it){
          var c=Object.assign({},it);delete c.overwrite;
          if(byId[it.id]===undefined){nj.items.push(c);added.push(it.id);}
          else if(it.overwrite){nj.items[byId[it.id]]=c;replaced.push(it.id);}
        });
        nj.items.sort(function(a,b){return String(a.date).localeCompare(String(b.date));});
        var parts=await saveFull("notices_v1",cur.item?cur.item.name:"공고·기록 (시스템)","",nj,cur.parts);
        var back2=await getFull("notices_v1");var ids2={};back2.obj.items.forEach(function(x){ids2[x.id]=1;});
        var miss=added.concat(replaced).filter(function(id){return !ids2[id];});
        if(miss.length)errors.push("notices 재조회 누락: "+miss.join(","));
        else report.push("notices: +"+added.length+"건"+(replaced.length?"·교체 "+replaced.length+"건":"")+" (총 "+back2.obj.items.length+"건"+(parts?", 조각 "+parts+"개":"")+") 검증 OK");
      }
      // 3) 절차 점검 갱신
      if(job.checks&&job.checks.length){
        var cc=await getFull("checks_v1");var cj=cc.obj;var touched=0;
        job.checks.forEach(function(u){
          var it=cj.items.find(function(x){return x.id===u.id;});
          if(!it){errors.push("checks: "+u.id+" 항목 없음");return;}
          (u.addFacts||[]).forEach(function(f){if(it.facts.indexOf(f)<0){it.facts.push(f);touched++;}});
          it.related=it.related||[];
          (u.addRelated||[]).forEach(function(r){if(!it.related.some(function(x){return x.id===r.id;}))it.related.push(r);});
          if(u.status)it.status=u.status;
          if(u.memo!==undefined)it.memo=u.memo;
          it.updatedAt=new Date().toISOString().slice(0,10);
        });
        var partsC=await saveFull("checks_v1",cc.item?cc.item.name:"절차 점검 기록 (시스템)","",cj,cc.parts);
        report.push("checks: 사실 "+touched+"줄 추가"+(partsC?" (조각 "+partsC+"개)":""));
      }
      // 4) 목록 대조 — 저장한 회의록이 실제 목록에 존재하는지
      if(meetings.length){
        var l=await api("?action=list&token="+TOKEN);var lids={};(l.items||[]).forEach(function(x){lids[x.id]=1;});
        var missM=meetings.filter(function(m){return !lids[m.id];}).map(function(m){return m.id;});
        if(missM.length)errors.push("목록에 없음: "+missM.join(","));
        else report.push("목록 대조 OK (클라우드 총 "+(l.items||[]).length+"건)");
      }
      var out=report.concat(errors.map(function(e){return "❌ "+e;}));
      console.log((job.label?"["+job.label+"]\n":"")+out.join("\n"));
      if(errors.length)throw new Error("검증 실패:\n"+out.join("\n"));
      return out;
    }
  };
  console.log("SandleImporter ready — await SandleImporter.run(JOB)");
})();
