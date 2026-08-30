// 절차 점검(checks_v1) 상태 명확화 (2026-08-31, v85와 함께) — 사용자 지적: "문제 있는 거 제대로 표시해줘야 할 것"
// 각 항목에 status(명확한 상태)·severity(카드 색: confirmed=빨강, high=주황, medium=회색)·summary(문제 요지 한 문단)를 부여.
// 원칙 유지: 사실+조문 인용으로 확정되는 것만 '확인'으로 표기, 판단이 남은 것은 '소지/확인중'으로 구분.
// 실행: 회의록 앱을 연 관리자 기기에서 importer.js 로드 후 이 스크립트 로드 → await ChecksClarity.run()
(function () {
  var PATCH = {
    c_ec6_formation: {
      status: "요건 미충족 확인", severity: "confirmed",
      summary: "제6기 선관위(4명)는 공개모집 공고 없이 2025.12.1 통합회의에서 구성됐습니다. 게시판 전수 대조(2020.12~2026.07)에서 모집 공고가 발견되지 않아 규약 제31조①의 공개모집 공고 절차가 지켜지지 않은 것으로 확인되며, 구성 시점도 직전 선관위 임기 만료(2025.10.8) 후 54일 뒤입니다. 인원 요건(5명, 500세대 미만이면 3명)은 세대수 해석에 따라 갈립니다. 이 선관위가 6기 동대표 선거와 커뮤니티센터 투표를 주관했습니다."
    },
    c_ec_recruit_notice: {
      status: "요건 미충족 확인", severity: "confirmed",
      summary: "규약 제31조②는 모집 공고를 신청자 접수 7일 전(긴급 시 3일)에 게시하도록 정하지만, 4기 3건과 6기 보궐은 공고일=접수 시작일, 5기는 6일 간격으로 확인된 전 기수에서 요건이 지켜지지 않았습니다. 어느 공고에도 '긴급' 표기는 없습니다. 반복된 절차 미준수가 위촉 효력에 주는 영향은 확인이 필요합니다."
    },
    c_ec_candidate: {
      status: "결격 저촉 소지", severity: "high",
      summary: "김영자 위원은 선관위원 임기(2025.12.2~2년) 중에 동대표 후보로 등록(12.23)되어 당선(12.26)됐습니다. 규약 제16조③6호는 선관위원을 사퇴하더라도 잔여임기 중이면 동대표 결격으로 정하고 있고, 후보 등록 전 사퇴·해촉 공고도 게시판에서 발견되지 않았습니다. LH 재확인(선관위원 인정 여부) 결과에 따라 최종 판단이 정리됩니다."
    },
    c_ec_chair: {
      status: "정원 미달 소지", severity: "high",
      summary: "6기 선관위는 구성 때부터 4명으로, 단지를 1,170세대 기준으로 보면 규약 제30조②의 최소 5명에 미달합니다. 위원장 사퇴(2026.3.19) 이후에는 확인되는 공고 기준 2~3명이 됐고, 규약 제31조④의 30일 내 보궐 위촉이 이뤄졌는지 확인되는 결과 공고가 없습니다."
    },
    c_t5_term: {
      status: "기록 불일치 확인", severity: "high",
      summary: "규약상 임기 2년이면 5기(2024.5.23 당선 공고)는 2026.5월경 종료여야 하나, 5기 선관위 공고와 6기 선출공고 여러 건이 '2025.10.8 만료'를 명시해 규약 계산과 공고 기록이 서로 맞지 않습니다. 나아가 만료 후인 2025.12.30에도 '제5기' 명의의 정기회의가 열렸는데 참석 6명은 6기 당선인 구성과 동일합니다. 임기 기산 근거 확인이 필요합니다."
    },
    c_term_limit: {
      status: "예외 절차 확인중", severity: "medium",
      summary: "진세택·원영해·강명순은 4→5→6기 세 기수 연속 재임 중으로 중임 제한(1회)을 넘습니다. 다만 규약 제16조④ 단서(2회 선출공고에도 후보 없음 + 임차인 1/2 이상 찬성)에 해당하면 재선출이 가능하고, 6기 선출공고가 1~3차 반복 게시된 만큼 예외에 해당할 가능성이 있어 각 차수의 후보 유무 기록을 확인 중입니다.",
      addFacts: ["6기 선출공고는 1차(2025.12.2)·2차(12.9)·3차(12.16) 세 차례 게시됨 — 각 차수별 후보 등록 유무 기록은 미수집이나, 차수가 반복된 점은 제16조④ 단서(2회 공고 무후보 시 중임자 재선출 가능)의 전제와 맞닿음"]
    },
    c_ec5_transition: {
      status: "확인중", severity: "medium",
      summary: "5기 선관위원장 신금남이 사퇴·해촉 공고 없이 2025.1월부터 임차인대표 명단에 등장하고, 위원 조영호의 동·호수 표기가 공고마다 달라(205-805/808) 자격심사를 통과한 후보 이혜선(205-805)과의 관계 확인이 필요합니다. 5기 선관위도 모집 정원 5명에 4명으로 구성·유지됐습니다."
    },
    c_t6_schedule: {
      status: "확인중", severity: "medium",
      summary: "제6기 선거는 후보자 명단 공고(2025.12.23) 다음 날 바로 투표(12.24)가 실시돼 입주민이 후보를 확인할 수 있는 기간이 하루뿐이었습니다. 6개 선거구 모두 단독 후보였고, 규약상 공고 기간 요건 충족 여부를 확인 중입니다."
    }
  };
  window.ChecksClarity = {
    run: async function () {
      if (!window.SandleImporter) throw new Error("importer.js 먼저 로드");
      var cur = await (async function () {
        var obj = await SandleImporter.getFull("checks_v1");
        if (!obj || !obj.items) throw new Error("checks_v1 없음");
        return obj;
      })();
      var report = [], today = new Date().toISOString().slice(0, 10);
      cur.items.forEach(function (it) {
        var p = PATCH[it.id];
        if (!p) { report.push(it.id + ": 패치 대상 아님(유지)"); return; }
        it.status = p.status; it.severity = p.severity; it.summary = p.summary;
        (p.addFacts || []).forEach(function (f) { if (it.facts.indexOf(f) < 0) it.facts.push(f); });
        it.updatedAt = today;
        report.push(it.id + ": → " + p.status + " (" + p.severity + ")");
      });
      var missing = Object.keys(PATCH).filter(function (id) { return !cur.items.some(function (x) { return x.id === id; }); });
      if (missing.length) throw new Error("항목 없음: " + missing.join(","));
      await SandleImporter.saveFull("checks_v1", "절차 점검 기록 (시스템)", "", cur, 0);
      var back = await SandleImporter.getFull("checks_v1");
      var bad = Object.keys(PATCH).filter(function (id) {
        var b = back.items.find(function (x) { return x.id === id; });
        return !b || b.status !== PATCH[id].status || b.severity !== PATCH[id].severity || b.summary !== PATCH[id].summary;
      });
      if (bad.length) throw new Error("재조회 불일치: " + bad.join(","));
      report.push("재조회 검증 OK (" + back.items.length + "건, " + JSON.stringify(back).length + "자)");
      console.log(report.join("\n"));
      return report;
    }
  };
  console.log("ChecksClarity ready — await ChecksClarity.run()");
})();
