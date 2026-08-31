// 2026-08-31 김영자 동대표 사퇴공고 반영 (v96)
// - notices_v1: 사퇴공고 1건 추가 (원문 전문 포함, docs/DATA.md §7·§8)
// - checks_v1: c_ec_candidate 에 사퇴 사실 추가 (LH 위반 소견 답변 수신 당일 사퇴; 하자·효력 문제 존속)
// 출처: 네이버 카페 '성남여수 산들마을' 관리사무소 게시 2026.08.31 16:34 (스크린샷, 사용자 제공)
// 실행: importer.js 로드 후 이 스크립트 로드 → await KimResign.run()
(function () {
  var NOTICE = {
    id: "n_20260831_t6_kim_resign", date: "2026-08-31", body: "선관위(임차)", kind: "사퇴공고",
    noticeNo: "임차인선거관리위 제2026-06호", postRange: "2026.08.31~09.06",
    title: "임차인 동별대표자 사퇴공고 — 김영자(206동)",
    summary: "제6기 임차인대표회의 김영자 동대표(206동)가 '개인사정'으로 사퇴(2026.8.31), 관리규약 제20조 12항에 의해 공고. LH 신문고 답변(선관위원 위촉·후보 등록 규약 위반 소견) 수신일과 같은 날.",
    facts: [
      "사퇴일시: 2026년 08월 31일(월) — 공고일·카페 게시일(16:34)과 같은 날",
      "사퇴자: 김영자 동대표(206동), 근거: 관리규약 제20조 12항",
      "같은 날(8.31) LH 신문고 재확인 답변 수신 — 김영자의 선관위원 위촉이 실시돼 '관리규약을 위반한 것으로 보인다'는 소견(절차 점검 c_ec_candidate)",
      "사퇴 사유는 '개인사정'으로만 기재 — 규약 위반·LH 소견 언급 없음",
      "공고는 사퇴선거구를 '제5선거구(206동)'로 표기 — 6기 후보 등록·당선인 공고에서 김영자는 제4선거구(206동)였음(선거구 표기 불일치)"
    ],
    tags: ["선거·임원"], file: "", link: "",
    related: [
      { type: "check", id: "c_ec_candidate", label: "규약 대조: 선관위원의 후보 등록·당선(김영자)" },
      { type: "notice", id: "n_20251226_t6_winners", label: "6기 당선인 공고(12.26)" },
      { type: "notice", id: "n_20251223_t6_candidates", label: "6기 후보자 등록 공고(12.23)" }
    ],
    text: "공고 번호 임차인선거관리위 제2026-06호 / 게시기간 2026.08.31.부터 2026.09.06.까지\n공 고 문\n\n임차인 동별대표자 사퇴공고\n\n제6기 임차인대표회의 구성원 중 206동 동대표가 개인사정으로 사퇴함에 따라 관리규약제20조 12항에 의해 다음과 같이 공고합니다.\n\n-다 음-\n■사퇴일시 : 2026년 08월 31일(월)\n■사퇴선거구 : 제5선거구(206동)\n■사퇴자 : 김영자 동대표(206동)\n\n2026.08.31.\n산들마을아파트 임차인선거관리위원장 (직인)",
    notes: "카페 게시 2026.08.31 16:34(관리사무소). 원문의 선거구 표기 '제5선거구(206동)'는 종전 공고들(제4선거구=206동, 제5선거구=210동)과 다름."
  };
  var ADD_FACTS = [
    "2026.8.31 사퇴공고(임차인선거관리위 제2026-06호): 김영자 동대표 사퇴 — 사퇴일시 8.31, 사유 '개인사정'. LH 위반 소견 답변 수신 당일이자 공고 당일",
    "사퇴로도 선관위원 신분 중 후보 등록·당선 절차의 하자와 6기 선거 효력 문제는 존속 — LH가 예고한 관리소 '절차 하자 문서' 확보 필요",
    "사퇴공고는 선거구를 '제5선거구(206동)'로 표기 — 후보·당선 공고의 '제4선거구(206동)'와 불일치",
    "후속 감시: 206동 보궐선거 절차(공개모집·공고 기간·공고~투표 간격)와 보궐 당선인 임기 처리(잔여임기 6개월 미만 시 중임 횟수 제외, 제16조⑤)"
  ];
  window.KimResign = {
    run: async function () {
      if (!window.SandleImporter) throw new Error("importer.js 먼저 로드");
      var today = "2026-08-31";
      var nn = await SandleImporter.getFull("notices_v1");
      if (nn.items.some(function (x) { return x.id === NOTICE.id; })) {
        console.log("공고 이미 있음 — 건너뜀");
      } else {
        nn.items.push(NOTICE);
        await SandleImporter.saveFull("notices_v1", "공고·기록 (시스템)", "", nn, 0);
      }
      var cc = await SandleImporter.getFull("checks_v1");
      var c = cc.items.filter(function (x) { return x.id === "c_ec_candidate"; })[0];
      if (!c) throw new Error("c_ec_candidate 없음");
      ADD_FACTS.forEach(function (f) { if (c.facts.indexOf(f) < 0) c.facts.push(f); });
      c.related = c.related || [];
      if (!c.related.some(function (r) { return r.id === NOTICE.id; }))
        c.related.push({ type: "notice", id: NOTICE.id, label: "김영자 사퇴공고(8.31)" });
      c.updatedAt = today;
      await SandleImporter.saveFull("checks_v1", "절차 점검 기록 (시스템)", "", cc, 0);
      var n2 = await SandleImporter.getFull("notices_v1"), c2 = await SandleImporter.getFull("checks_v1");
      var cv = c2.items.filter(function (x) { return x.id === "c_ec_candidate"; })[0];
      var ok = n2.items.some(function (x) { return x.id === NOTICE.id; }) && cv.facts.length === c.facts.length;
      console.log("notices_v1 " + n2.items.length + "건, c_ec_candidate facts " + cv.facts.length + "개, 검증 " + (ok ? "OK" : "FAIL"));
      if (!ok) throw new Error("재조회 검증 실패");
      return { notices: n2.items.length, facts: cv.facts.length };
    }
  };
  console.log("KimResign ready — await KimResign.run()");
})();
