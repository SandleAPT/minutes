// 선관위 구성 절차 전 기수 점검 기록 (2026-08-31) — 임대주택 관리규약(2020.4.18, trules.json) 조문 원문 확인 후 작성.
// 원칙: 사실(공고·회의록 기재)과 규정 조문만, 판단·평가 없음(docs/DATA.md §8). rules[].verified=true는 조문 원문 확인 완료 의미.
// 사용: minutes 앱 콘솔에서 importer.js 로드 → 이 파일 로드 → await EcAudit.run()
(function(){
window.EcAudit={run:async function(){
  var c=await SandleImporter.getFull("checks_v1");
  var today="2026-08-31";var added=[],log=[];
  function up(id,fn){var it=c.items.find(function(x){return x.id===id;});if(!it){log.push(id+" 없음");return;}fn(it);it.updatedAt=today;log.push(id+" 갱신");}
  function addFact(it,f){if(it.facts.indexOf(f)<0)it.facts.push(f);}
  function addRule(it,r){it.rules=it.rules||[];if(!it.rules.some(function(x){return x.ref===r.ref;}))it.rules.push(r);}
  function addRel(it,r){it.related=it.related||[];if(!it.related.some(function(x){return x.id===r.id;}))it.related.push(r);}

  // ① 신규: 6기 선관위 구성 절차
  if(!c.items.some(function(x){return x.id==="c_ec6_formation";})){
    c.items.push({id:"c_ec6_formation",title:"제6기 임차 선관위 구성 절차 — 4명 구성·공개모집 공고 부재",status:"확인중",opened:today,
      facts:[
        "제6기 임차인 선거관리위원회는 2025.12.1 통합회의에서 구성 확정 — 위원장 김수자, 위원 조영호·김영자·곽필임 총 4명(회의록 t_2025_12_v1, 임기 2025.12.2~2년)",
        "6기 선관위의 위원 공개모집 공고·위원 구성 공고는 카페 게시판 전수 대조(30개씩 보기 1~6페이지, 2020.12~2026.07)에서 발견되지 않음 — 4기(모집 2건+위원 공고)·5기(모집+위원 공고)는 있음",
        "위원장 선임 방식: 통합회의 결과공고에 '위원장 김수자로 구성'으로만 기재 — 규약 제30조②의 '위원 중 호선' 절차 여부는 기재 없음",
        "직전 5기 선관위 임기는 2024.3.22~2025.10.8(4·5기 공고 명시) — 6기 구성(12.1)은 임기 만료 후 약 54일 뒤이며, 만료 60일 전(2025.8.9경) 공개모집 공고는 게시판에서 발견되지 않음",
        "규약 제30조②의 구성 인원은 '위원장 포함 5명 이상 9명 이하(500세대 미만 공동주택은 3명 이상)' — '공동주택' 세대수를 단지 전체(1,170세대)로 보면 5명 이상, 임대 잔여 세대(2026.3 집계표 기준 총 200세대)로 보면 3명 이상으로 해석이 갈릴 수 있음",
        "이 선관위가 제6기 동별 대표자 선거(2025.12.24)와 커뮤니티센터 위탁 찬반투표(2026.2~3)를 주관함 — 선거 일정 관련 사실은 c_t6_schedule, 위원 김영자의 후보 등록은 c_ec_candidate 참조"
      ],
      rules:[
        {ref:"임대주택 관리규약(2020.4.18) 제30조② ",text:"선거관리위원회는 위원장을 포함하여 5명(500세대 미만의 공동주택의 경우에는 3명)이상 9명 이하의 위원으로 구성하고, 위원장은 위원 중에서 호선한다.",verified:true},
        {ref:"임대주택 관리규약(2020.4.18) 제31조①",text:"위원장이 임기만료 60일전까지 공개모집 공고하고 임기만료일 전에 위촉하여야 하며, 구성되지 않거나 60일전까지 공고되지 않으면 관리사무소장이 공개모집 공고하여야 한다.",verified:true},
        {ref:"임대주택 관리규약(2020.4.18) 제31조③",text:"공개모집 정원 미달 시 위원장이 임차인대표회의 추천 1인, 관리사무소장 추천 1인, 통장·경로회·자생단체 추천 등의 순서로 위촉할 수 있다.",verified:true}
      ],
      question:"6기 선관위가 공개모집 절차 없이 통합회의에서 4명으로 구성된 경위와, 이 구성이 규약 제30조②·제31조의 요건을 충족하는지(500세대 기준의 해석 포함), 충족하지 못한다면 그 선관위가 주관한 6기 동별 대표자 선출 절차의 효력에 어떤 영향이 있는지 확인 필요.",
      memo:"관련 대응 서신(위탁사 본사 확인요청, 2026.8.13/8.21/8.29)은 개인정보 포함으로 로컬 비공개 폴더에만 보관 — 클라우드·저장소 미업로드.",
      related:[
        {type:"minutes",id:"t_2025_12_v1",label:"25.12.1 통합회의(선관위 구성)"},
        {type:"notice",id:"n_20251202_t6_elect1",label:"6기 1차 선출공고(12.2)"},
        {type:"notice",id:"n_20251226_t6_winners",label:"6기 당선인 공고(12.26)"},
        {type:"notice",id:"n_20260303_cc_tally",label:"커뮤니티센터 투표 집계(26.3.3)"}
      ],updatedAt:today});
    added.push("c_ec6_formation");
  }

  // ② 신규: 공개모집 공고 기간 요건(전 기수 반복 패턴)
  if(!c.items.some(function(x){return x.id==="c_ec_recruit_notice";})){
    c.items.push({id:"c_ec_recruit_notice",title:"선관위 공개모집 공고와 접수 시작 사이 간격 — 전 기수 반복 패턴",status:"확인중",opened:today,
      facts:[
        "규약 제31조②는 공개모집 공고문을 '신청자 접수 7일전(긴급을 요하는 경우 3일)'에 게시하도록 정함",
        "4기 1차 모집(2022.3.2 공고): 접수 3.2~3.10 — 공고일과 접수 시작일이 같음",
        "4기 재공고(2022.3.11): 접수 3.11~3.16 — 공고일=접수 시작일",
        "4기 추가 위촉(2022.10.25): 접수 10.25~10.31 — 공고일=접수 시작일",
        "5기 모집(2024.2.27 공고): 접수 3.5~3.14 — 간격 6일",
        "6기 보궐(2026.3.20 공고): 접수 3.20~3.27 — 공고일=접수 시작일",
        "6기 본구성은 공개모집 공고 자체가 게시판에서 발견되지 않음(c_ec6_formation 참조)",
        "각 공고에 '긴급'이라는 표기는 없음"
      ],
      rules:[{ref:"임대주택 관리규약(2020.4.18) 제31조②",text:"공개모집 공고문은 신청자 접수 7일전(긴급을 요하는 경우 3일)에 전체 임차인 등이 알 수 있도록 게시판 등에 공고하여야 한다.",verified:true}],
      question:"모집 공고와 접수 시작 사이 7일(긴급 3일) 요건이 4·5·6기에 걸쳐 지켜지지 않은 것으로 보이는 바, 당시 긴급 사유가 있었는지와 이 절차가 위촉의 효력에 영향을 주는지 확인 필요.",
      memo:"",related:[
        {type:"notice",id:"n_20220302_ec4_recruit",label:"4기 모집(3.2)"},
        {type:"notice",id:"n_20221025_ec4_recruit2",label:"4기 추가 위촉(10.25)"},
        {type:"notice",id:"n_20240227_ec5_recruit",label:"5기 모집(2.27)"},
        {type:"notice",id:"n_20260320_ec_byelect",label:"6기 보궐(3.20)"}
      ],updatedAt:today});
    added.push("c_ec_recruit_notice");
  }

  // ③ 기존 강화
  up("c_ec5_transition",function(it){
    addFact(it,"규약 제30조② 원문 확인 — 구성은 '위원장 포함 5명 이상(500세대 미만 공동주택은 3명 이상)': 5기 선관위는 모집 정원 5명에 4명 구성·유지, 정원 미달 시의 제31조③ 보충 위촉(임차회장 추천 1인 등) 사용 흔적은 공고에서 발견되지 않음");
    addFact(it,"4기 선관위 임기 만료(2024.3.21~23 표기 혼재) 60일 전 공개모집 공고는 없고 2.27 관리사무소장 명의 공고 — 제31조① 후단(위원장 미공고 시 소장이 공고)의 경로와 부합하는지 확인 필요");
    addRule(it,{ref:"임대주택 관리규약(2020.4.18) 제30조②",text:"선거관리위원회는 위원장 포함 5명(500세대 미만은 3명) 이상 9명 이하로 구성, 위원장은 위원 중 호선.",verified:true});
    addRule(it,{ref:"임대주택 관리규약(2020.4.18) 제31조①·③",text:"임기만료 60일 전 공개모집 공고(미공고 시 관리사무소장), 정원 미달 시 추천 순서에 따른 위촉.",verified:true});
  });
  up("c_ec_chair",function(it){
    addFact(it,"위원장 김수자 사퇴(2026.3.19)로 4명 구성에서 3명이 됨 — 보궐 선출공고(3.20, 모집 1명)는 공개모집 방식이나, 규약 제31조④는 결원 시 30일 이내에 제3항의 추천 순서(임차회장 추천 1인 등)로 위촉하도록 정함. 보궐 선출 결과 공고는 게시판에 없어 충원 여부 미확인");
    addRule(it,{ref:"임대주택 관리규약(2020.4.18) 제31조④",text:"위원 임기중 사퇴 또는 해촉 등으로 결원이 발생한 경우 결원이 발생한 날로부터 30일 이내에 위원장이 제3항 각호의 순서에 따라 위촉한다.",verified:true});
    addRule(it,{ref:"임대주택 관리규약(2020.4.18) 제30조③",text:"선거관리위원회는 그 구성원 과반수의 찬성으로 의사를 결정한다.",verified:true});
  });
  up("c_ec_candidate",function(it){
    addFact(it,"임대규약 제32조③1호 원문 확인 — '동별 대표자 또는 그 후보자'는 위원이 될 수 없음(2호: 그 배우자·직계존비속). 김영자 위원의 사퇴·해촉 공고는 후보 등록 공고(2025.12.23) 이전에 게시판에서 발견되지 않음");
    addRule(it,{ref:"임대주택 관리규약(2020.4.18) 제32조③",text:"1. 동별 대표자 또는 그 후보자, 2. 그 배우자나 직계존·비속, 3. 임기 중 사퇴자(잔여임기 중)는 위원이 될 수 없다.",verified:true});
  });
  up("c_t6_schedule",function(it){
    addRule(it,{ref:"임대주택 관리규약(2020.4.18) 제30조①",text:"최초 선거관리위원회가 구성된 경우 제18조 제1항 각 호의 사항을 포함한 선출공고문을 작성하여 60일 이내에 동별 대표자 선출을 위해 공고하여야 한다.",verified:true});
    addFact(it,"6기 선거를 주관한 선관위의 구성 절차 자체에 대한 점검은 c_ec6_formation 참조");
  });

  await SandleImporter.saveFull("checks_v1","절차 점검 기록 (시스템)","",c,0);
  var back=await SandleImporter.getFull("checks_v1");
  return "checks "+back.items.length+"건 (신규: "+added.join(",")+") | "+log.join(" / ");
}};
console.log("EcAudit ready — await EcAudit.run()");
})();
