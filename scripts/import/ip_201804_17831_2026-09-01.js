// 입대의 8페이지 보완 (2026-09-01) — 17831 제1기 2018.04월 정기 (누락분 1건)
// 실행: importer.js 로드 후 → await IP201804.run()
(function () {
  function R() { var out = []; for (var d = 201; d <= 216; d++) out.push({ dong: d, role: "대표", name: "" }); return out; }
  var rec = {
    id: "m_2018_04_v1", name: "제1기 2018년04월 입주자대표회의", date: "2018-04-27",
    json: {
      meeting: { termNo: 1, year: 2018, month: 4, type: "정기", date: "2018-04-27", time: "19:00~20:00", place: "관리사무실(회의실)", name: "제1기 2018년04월 입주자대표회의", attendance: {}, attendeeNames: ["김수영(회장)", "김태환(감사)", "김현준(감사)", "왕항종(201동,210동 관리이사)"], guests: [], audience: { count: 0 }, sequence: ["개회", "업무보고", "회의안건 상정 및 토의", "폐회"] },
      rosterTermNo: 1, rosters: { "1": R() },
      agendas: [
        { id: "a1_1", title: "입주자대표회의 공고 18-12호 건에 대한 재심의의 건(가. 커뮤니티활성화 방안 나. 도서관장 급여)", summary: "", isOther: false, noRemarks: true, remarks: {}, decision: "커뮤니티 활성화 및 도서관장 급여에 대한 재심의 신청서 접수되어 무효로 한다. 도서관장 임금은 분양동에서 지급[세대당:1,800원/월]하며 도서관 운영에 대하여 전체 투표를 입주민 상대로 실시 하기로 결의함(만장일치 4-0-0)", votes: {}, category: "", tags: [], followup: "", showFollowup: false, materials: [], showMaterials: false },
        { id: "a1_2", title: "조경공사 하자에 관한 건", summary: "", isOther: false, noRemarks: true, remarks: {}, decision: "새롬건설의 수목 하자에 관한 합의 공문은 소송 진행중에 있으며 조경만의 하자문제가 아니므로 협의 문제는 보류한다(만장일치 가결 4-0-0)", votes: {}, category: "", tags: [], followup: "", showFollowup: false, materials: [], showMaterials: false }
      ],
      cloudId: "m_2018_04_v1",
      source: "[index 17831, 2018.04.30 게시] 공고 산들마을 분양 18-14호 / 게시기간 2018.04.30~05.07\n제1기 2018년도 04월 정기 입주자대표회의 회의록 및 결과보고 (공동주택관리법 시행령 제28조 2항 및 관리규약 제30조)\n일시·장소: 2018년 04월 27일(금) 19:00~20:00 관리사무실(회의실)\n참석: 김수영(회장), 김태환(감사), 김현준(감사), 왕항종 (201동,210동 관리이사) 총4명중 4명참석\n제1안 입주자대표회의 공고 18-12호 건에 대한 재심의의 건(가. 커뮤니티활성화 방안의 건 나. 도서관장 급여에 대한 건) — 커뮤니티 활성화 및 도서관장 급여에 대한 재심의 신청서 접수되어 무효로 한다. 도서관장 임금은 분양동에서 지급[세대당:1,800원/월]하며 도서관 운영에 대하여 전체 투표를 입주민 상대로 실시 하기로 결의함 — 만장일치 의결(찬성 4명, 반대0명, 기권0명)\n제2안 조경공사 하자에 관한 건 — 새롬건설의 수목 하자에 관한 합의 공문은 소송 진행중에 있으며 조경만의 하자문제가 아니므로 협의 문제는 보류한다 — 만장일치 가결(찬성 4명, 반대0명, 기권0명)\n2018년 04월 30일 산들마을아파트 입주자대표회의 회장"
    }
  };
  window.IP201804 = { run: async function () { if (!window.SandleImporter) throw new Error("importer.js 먼저 로드"); return await SandleImporter.run({ meetings: [rec] }); } };
  console.log("IP201804 ready — await IP201804.run()");
})();
