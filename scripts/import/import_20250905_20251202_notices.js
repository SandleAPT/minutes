// 공고 2건 추가 적재 (2026-08-31, 2차): 6기 1차 선출공고(25.12.02) + 분양전환 입주자 총회 공고(25.09.05)
// 사용법: minutes 콘솔(관리자 키)에서 실행 후 await ImportN2.run() / await ImportN2.check()
// 겸: 기존 n_20251209_t6_elect2 의 "1차 미수집" notes 갱신, 절차 점검 c_t6_schedule 사실 추가.
(function(){
  var URL_="https://script.google.com/macros/s/AKfycbyhpE-DB5WAAEx7uqTCPwU-e0sPKuupkYN3YoQWALiFWe0IHFNh1y91e1VNtDmMxxoxLA/exec";
  var TOKEN="ITDXaUBDTmrz6DbQ3tv9R";
  function key(){var k=localStorage.getItem("sandle_admin_key");if(!k)throw new Error("관리자 키 없음");return k;}
  async function save(rec){var r=await fetch(URL_,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"save",record:rec,adminKey:key(),token:TOKEN})});var x=await r.json();if(!x.ok)throw new Error("save fail "+rec.id+" "+JSON.stringify(x));return x;}
  async function get(id){var r=await fetch(URL_+"?action=get&token="+TOKEN+"&id="+id);var x=await r.json();if(!x.ok)throw new Error("get fail "+id);return JSON.parse(x.item.json);}

  var NEW_NOTICES=[
    {id:"n_20251202_t6_elect1",date:"2025-12-02",body:"선관위(임차)",kind:"선거공고",noticeNo:"임차선거관리위 제2025-01호",postRange:"2025.12.02~12.08",
     title:"제6기 임차인 동별 대표자 선출 공고",
     summary:"12.1 통합회의 의결에 따른 1차 선출 공고 — 9개 선거구 각 1명(총 9명), 후보자 등록 2025.12.02~12.08, 임기 선출시부터 2년. 본문에 '제5기 동별 대표자 선거 일정'으로 오기(제목은 제6기).",
     facts:["'제5기 임차인대표회의 임기가 2025년 10월 08일로 만료됨에 따라' 명시(2·3차와 동일 문안)","본문 '제5기 동별 대표자 선거 일정' 표기 — 제목(제6기)과 불일치, 2·3차 공고에서는 '제6기'로 수정됨","근거: 민간임대주택에 관한 특별법 제52조제1항, 관리규약 제16조제1항","후보자 등록기간 2025.12.02~12.08(12.1 통합회의 의결과 일치), 등록장소 관리사무소","선거일: 동대표 후보자 공고 후 추후 공지, 투표소·개표소 관리사무소"],
     tags:["선거·임원"],file:"30798 제6기 임차인 동별 대표자 선출 공고 _ 네이버 카페.pdf",link:"",
     related:[{type:"minutes",id:"t_2025_12_v1",label:"25.12.1 통합회의(선거 공고 의결)"},{type:"notice",id:"n_20251209_t6_elect2",label:"2차 선출 공고(12.9)"},{type:"notice",id:"n_20251216_t6_elect3",label:"3차 선출 공고(12.16)"}],
     text:"공고 번호 임차선거관리위 제2025-01호 / 게시기간 2025.12.02.부터 2025.12.08.까지\n공 고 문\n\n제6기 임차인 동별 대표자 선출 공고\n\n제5기 임차인대표회의 임기가 2025년 10월 08일로 만료됨에 따라 민간임대주택에 관한 특별법 제52조제1항 및 관리규약 제16조제1항에 따라 제5기 동별 대표자 선거 일정을 다음과 같이 공고합니다.\n\n2025년 12월 02일\n산들마을아파트 임차인 선거관리위원회위원장 (직인)\n\n1. 선거구별 선출인원: 제1선거구:1명(201동3~4라인, 202동) 제2선거구:1명(203동) 제3선거구:1명(205동) 제4선거구:1명(206동) 제5선거구:1명(210동1~4라인) 제6선거구:1명(212동) 제7선거구:1명(214동) 제8선거구:1명(215동) 제9선거구:1명(216동) (총 9명)\n2. 임 기: 선출시부터.~2년\n3. 후보자 등록기간 : 2025.12.02 ~ 2025.12.08\n4. 후보자 등록장소 : 관리사무소\n5. 선거일: 동대표 후보자 공고 후 추후 공지\n※상세일정 및 투표 참여 방법 추후 공지\n6. 투표소 및 개표소 : 관리사무소\n7. 후보자등록 서류:\n가. 후보등록 신청서(1개월 내에 촬영한 반명함 사진 부착) 1부 (관리사무소 비치)\n나. 확약서(관리규약 제16조제3항 결격사유 관련 관리사무소 비치)\n다. 관리비 등의 완납 확인서(관리사무소 발급) 1부\n라. 주민등록등본(공고일 이후 발행분) 1부\n마. 임대차 계약서 사본 1부\n바. 가족관계 등록부 및 위임장 각 1부(임차인의 배우자나 직계 존·비속에 한함)\n사. 선거홍보물용 사진, 약력(학력, 직업, 경력, 연령 등)\n8. 후보자등록 자격 : 동별 대표자 선출공고에서 정한 후보자등록 마감일 기준 아파트 단지 안에서 주민등록을 마친 후 계속하여 6개월 이상 거주하고 우리 아파트 관리규약 제16조 제3항의 결격사유에 해당하지 않는 임차인\n9. 선거인명부 열람 일시 및 장소:(필요시 공지)\n10. 구내방송연설 일시 및 장소(필요시 공지)\n11. 선거벽보의 제출기한, 규격, 수량(필요시 공지)",
     notes:"'제5기 동별 대표자 선거 일정' 본문 표기는 원문 오탈자로 보임. 카페 게시물 첨부 4건 중 확보한 PDF에는 공고문 1장만 담김(나머지 3건 미확인)."},
    {id:"n_20250905_conv_meeting",date:"2025-09-05",body:"임차",kind:"안내",noticeNo:"임차인대표회의 제2025-18호",postRange:"2025.09.05~09.14",
     title:"10년만기 분양전환 입주자 총회 공고",
     summary:"10년만기 분양전환 관련 입주자 총회 개최 공고 — 2025.9.14(일) 오후 6시 커뮤니티센터. 안건: 감정평가법인 설명회·감정평가법인 선정·기타 토의.",
     facts:["장소: 커뮤니티센터, 총회일시 2025.09.14(일) 오후 6시","안건: 1. 감정평가법인 설명회 2. 감정평가법인 선정 3. 기타 토의","발행: 산들마을아파트 임차인대표회의회장(임차인대표회의 명의 공고)","9월 임차 결과공고의 '감정평가법인 정일·리얼티 2곳 선정'과 이어짐"],
     tags:["LH·관리이관"],file:"10년만기 분양전환 입주자 총회 공고 _ 네이버 카페.pdf",link:"",
     related:[{type:"minutes",id:"t_2025_09_v1",label:"25.9 임차 정기(감정평가법인 선정)"},{type:"minutes",id:"t_2025_08_v1",label:"25.8 임차 정기(분양전환 논의)"}],
     text:"공고 번호 임차인대표회의 제2025-18호 / 게시기간 2025.09.05.부터 2025.09.14까지\n공 고 문\n\n10년만기 분양전환 입주자 총회 공고\n\n◎ 장 소 : 커뮤니티 센터\n◎ 총회일시: 2025년09월14일[일요일] 오후6시\n◎ 안 건\n1. 감정평가법인 설명회\n2. 감정평가법인 선정\n3. 기타 토의\n\n2025. 09. 05.\n산들마을아파트 임차인대표회의회장 (직인)",
     notes:""}
  ];

  window.ImportN2={
    NEW_NOTICES:NEW_NOTICES,
    run:async function(){
      var out=[];
      var n=await get("notices_v1");
      var have={};n.items.forEach(function(i){have[i.id]=1;});
      var added=0;NEW_NOTICES.forEach(function(x){if(!have[x.id]){n.items.push(x);added++;}});
      // 2차 공고의 "1차 미수집" 비고 갱신 + 1차 공고로 연결
      var e2=n.items.find(function(x){return x.id==="n_20251209_t6_elect2";});
      if(e2){
        e2.notes="1차 선출공고(12.2, 임차선거관리위 제2025-01호) 확보됨 — n_20251202_t6_elect1 참조.";
        e2.related=e2.related||[];
        if(!e2.related.some(function(r){return r.id==="n_20251202_t6_elect1";}))
          e2.related.unshift({type:"notice",id:"n_20251202_t6_elect1",label:"1차 선출 공고(12.2)"});
      }
      var b=await save({id:"notices_v1",name:"공고·기록 (시스템)",date:"",json:JSON.stringify(n)});
      out.push("notices_v1 저장 "+b.ok+" (신규 "+added+"건, 총 "+n.items.length+"건)");
      // 절차 점검 c_t6_schedule 사실 추가
      var c=await get("checks_v1");
      var it=c.items.find(function(x){return x.id==="c_t6_schedule";});
      if(it){
        var f="1차 선출공고(2025.12.2, 임차선거관리위 제2025-01호) 확보 — 후보등록 12.2~8(통합회의 의결과 일치). 본문에 '제5기 동별 대표자 선거 일정'으로 오기(제목은 제6기, 2·3차에서 수정)";
        if(it.facts.indexOf(f)<0)it.facts.push(f);
        it.related=it.related||[];
        if(!it.related.some(function(r){return r.id==="n_20251202_t6_elect1";}))
          it.related.push({type:"notice",id:"n_20251202_t6_elect1",label:"1차 선출 공고(12.2)"});
        it.updatedAt="2026-08-31";
      }
      var d=await save({id:"checks_v1",name:"절차 점검 기록 (시스템)",date:"",json:JSON.stringify(c)});
      out.push("checks_v1 저장 "+d.ok);
      return out;
    },
    check:async function(){
      var n=await get("notices_v1");
      return ["notices_v1 ✓ "+n.items.length+"건: "+n.items.map(function(x){return x.id}).join(", ")];
    }
  };
  console.log("ImportN2 ready: await ImportN2.run() / await ImportN2.check()");
})();
