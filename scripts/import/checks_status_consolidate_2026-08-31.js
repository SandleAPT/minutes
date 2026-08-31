// 절차 점검 상태 4종 통합 (2026-08-31, v95) — 사용자 요청: 필터 태그를 5개 이하로.
// 상태(필터·배지): 위반·미충족 확인 / 하자 소지 / 확인중 / 후속조치 대기 — 4종만 사용.
// 기존의 세부 상태("위촉 확인·위반 소견(LH)" 등)는 statusDetail(카드 부제)로 이동 — 정보 손실 없음.
// severity(색)는 그대로. investigations.json(정적 5건)은 repo에서 직접 수정, 이 스크립트는 클라우드 9건 담당.
// 실행: importer.js 로드 후 이 스크립트 로드 → await StatusConsolidate.run()
(function () {
  var MAP = {
    c_t6_schedule:     { status: "확인중",          detail: "후보 공고~투표 1일" },
    c_t5_term:         { status: "하자 소지",        detail: "5기 임기 기록 불일치" },
    c_ec_candidate:    { status: "위반·미충족 확인", detail: "위촉 확인·위반 소견(LH)" },
    c_ec_chair:        { status: "하자 소지",        detail: "정원 미달·보궐 미확인" },
    c_term_limit:      { status: "위반·미충족 확인", detail: "중임 예외 요건 충족 기록 없음" },
    c_ec5_transition:  { status: "확인중",          detail: "위원장 대표 전환·동호수 표기" },
    c_ec6_formation:   { status: "위반·미충족 확인", detail: "공개모집 공고 부재" },
    c_ec_recruit_notice:{ status: "위반·미충족 확인", detail: "공고 7일 요건 전 기수 미충족" },
    c_t3_election:     { status: "하자 소지",        detail: "1~3기 선거 공고류 부재" }
  };
  window.StatusConsolidate = {
    run: async function () {
      if (!window.SandleImporter) throw new Error("importer.js 먼저 로드");
      var cc = await SandleImporter.getFull("checks_v1");
      var log = [], today = new Date().toISOString().slice(0, 10);
      cc.items.forEach(function (it) {
        var m = MAP[it.id];
        if (!m) { log.push(it.id + ": 대상 아님"); return; }
        if (it.status !== m.status || it.statusDetail !== m.detail) {
          log.push(it.id + ": '" + it.status + "' → '" + m.status + "' (부제: " + m.detail + ")");
          it.statusDetail = m.detail; it.status = m.status; it.updatedAt = today;
        } else log.push(it.id + ": 이미 반영됨");
      });
      await SandleImporter.saveFull("checks_v1", "절차 점검 기록 (시스템)", "", cc, 0);
      var back = await SandleImporter.getFull("checks_v1");
      var statuses = {}; back.items.forEach(function (x) { statuses[x.status] = (statuses[x.status] || 0) + 1; });
      var n = Object.keys(statuses).length;
      if (n > 4) throw new Error("상태가 아직 " + n + "종: " + Object.keys(statuses).join(","));
      console.log(log.join("\n") + "\n최종 상태 분포: " + JSON.stringify(statuses));
      return statuses;
    }
  };
  console.log("StatusConsolidate ready — await StatusConsolidate.run()");
})();
