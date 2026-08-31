// 중임 제한(제16조④) 정밀 대조 (2026-08-31) — 사용자 지적: 중임 초과자의 예외 재선출은
// '투표자 과반'이 아니라 '해당 선거구 임차인 2분의 1 이상 찬성'이 필요 — 그 요건 충족 기록이 있는지 점검.
// 결론(공개 기록 기준): 4·5·6기 어느 당선인 공고에도 득표·찬성 수가 없어 요건 충족을 확인할 수 있는 공개 기록이 없음.
// 실행: importer.js 로드 후 이 스크립트 로드 → await TermLimit164.run()
(function () {
  var TODAY = new Date().toISOString().slice(0, 10);
  window.TermLimit164 = {
    run: async function () {
      if (!window.SandleImporter) throw new Error("importer.js 먼저 로드");
      var cc = await SandleImporter.getFull("checks_v1");
      var it = cc.items.find(function (x) { return x.id === "c_term_limit"; });
      if (!it) throw new Error("c_term_limit 없음");

      it.status = "요건 충족 기록 없음";
      it.severity = "confirmed";
      it.title = "중임 제한(제16조④)과 1~6기 연속 재임 — 예외 요건 충족 기록 부재";
      it.summary = "규약 제16조④는 중임(1회) 초과자의 재선출을 '2회 선출공고에도 후보자가 없는 선거구'에 한해, '해당 선거구 임차인 2분의 1 이상의 찬성'(투표자 과반이 아닌 선거구 전체 기준)으로만 허용하고, 비중임 후보가 있으면 중임자는 자격을 상실한다고 정합니다. 그러나 확보된 4·5·6기 당선인 공고 어디에도 득표·투표·찬성 수가 기재되어 있지 않고, 투표 안내문들도 일반 요건인 '투표율 과반'만 언급할 뿐 이 기준을 언급한 공고가 없어 — 중임 초과 당선(진세택 3~6기, 한경열 4~5기, 원영해 5~6기, 강명순 6기)이 이 요건을 충족했는지 확인할 수 있는 공개 기록이 존재하지 않습니다. 3기(2020)는 선거 공고 자체가 없습니다.",
      it.question = "각 선거(특히 중임 초과자가 당선된 선거구)의 개표 결과 — 선거구 임차인 총수, 투표수, 찬성수 — 를 선관위 보관 기록(전자투표 시스템 집계 포함)으로 확인해야 합니다. '선거구 임차인 1/2 이상 찬성'에 미달했다면 해당 당선의 효력 문제로 이어질 수 있고, 수치가 아예 집계·보존되지 않았다면 그 자체가 절차 하자입니다. 6기 1·2차 공고의 무후보 여부(예외 발동 전제)도 공고에 명시돼 있지 않아 함께 확인이 필요합니다.";

      var addRules = [
        { ref: "임대주택 관리규약(2020.4.18) 제16조④ 전문", text: "동별 대표자의 임기는 2년으로 하되, 한 차례만 중임 할 수 있다. 다만, 2회의 선출공고에도 불구하고 동별 대표자의 후보자가 없는 선거구의 경우에는 동별 대표자를 중임한 사람도 선출공고를 거쳐 해당 선거구 임차인 2분의 1 이상의 찬성으로 다시 동별 대표자로 선출될 수 있다. 이 경우 후보자 중 동별 대표자를 중임하지 아니한 사람이 있으면 동별 대표자를 중임한 사람은 후보자의 자격을 상실한다.", verified: true },
        { ref: "임대주택 관리규약(2020.4.18) 제16조②1호", text: "입후보자가 1명인 경우: 해당 선거구 임차인의 과반수가 투표하고 투표한 임차인의 과반수 찬성으로 선출 — 일반 단독후보 요건(중임 예외 요건과 다름)", verified: true },
        { ref: "임대주택 관리규약(2020.4.18) 제16조⑤", text: "보궐선거로 선출된 동별 대표자의 임기가 6개월 미만인 경우에는 임기의 횟수에 포함되지 아니한다 — 강명순 보궐 임기(2022.11~2024.5, 약 18개월)는 6개월 이상이라 횟수에 포함됨", verified: true }
      ];
      it.rules = it.rules || [];
      addRules.forEach(function (r) { if (!it.rules.some(function (x) { return x.ref === r.ref; })) it.rules.push(r); });

      var addFacts = [
        "요건 구분(핵심): 일반 단독후보는 '선거구 임차인 과반 투표 + 투표자 과반 찬성'(②1호)이지만, 중임 초과자의 예외 재선출은 '선거구 임차인 2분의 1 이상 찬성'(④ 단서) — 투표율과 무관한 선거구 전체 기준의 절대 과반",
        "중임 횟수 정리(⑤항 반영, '중임'을 통산으로 보는 일반 해석 기준): 진세택 1~6기 6회(3기 선출부터 초과), 한경열 2~5기 4회(4기부터 초과), 원영해 3~6기 4회(5기부터 초과), 강명순 4기 보궐(18개월, 횟수 포함)~6기 3회(6기부터 초과). 윤정희(1~2기)·박동선(1·3기 통산 2회)·이혜선(5~6기)·신금남(5기 합류~6기)은 허용 범위",
        "확보된 4기(22.5.23)·4기 보궐(22.11.24)·5기(24.5.23)·6기(25.12.26) 당선인 공고 전부에 득표수·투표수·찬성수 기재 없음 — 별지 제16호 서식에 선거구·성명·동호수·비고만 기재",
        "투표 안내 공고들(22.11.14·24.5.16·25.12.23)은 '투표율이 과반에 미달이면 방문 투표'만 언급 — ④항 단서의 '임차인 1/2 이상 찬성' 기준을 언급한 공고가 전 기간에 없음",
        "예외 발동 전제('2회 공고에도 후보 없음')는 4기(1·2차 무입후보 명시)·5기(1·2차 무입후보 명시)는 공고로 확인되나, 6기는 1(12.2)·2(12.9)·3차(12.16) 공고만 있고 각 차수의 무후보 여부가 공고에 명시돼 있지 않음",
        "3기(2020): 선거 공고류가 전무해 진세택 3번째 선출의 절차는 공개 기록상 확인 자체가 불가(c_t3_election 참조)",
        "④항 마지막 문장(비중임 후보 있으면 중임자 자격 상실)은 선거구별 판단 — 확인된 선거들은 선거구별 단독 후보여서 직접 저촉 사례는 미확인"
      ];
      it.facts = it.facts || [];
      addFacts.forEach(function (f) { if (it.facts.indexOf(f) < 0) it.facts.push(f); });

      it.related = it.related || [];
      [{ type: "notice", id: "n_20220523_t4_winners", label: "4기 당선인 공고(수치 없음)" },
       { type: "notice", id: "n_20240523_t5_winners", label: "5기 당선인 공고(수치 없음)" },
       { type: "notice", id: "n_20251226_t6_winners", label: "6기 당선인 공고(수치 없음)" },
       { type: "check", id: "c_t3_election", label: "규약 대조: 2·3기 선거 공고류 부재" }
      ].forEach(function (r) { if (!it.related.some(function (x) { return x.id === r.id; })) it.related.push(r); });

      it.updatedAt = TODAY;
      await SandleImporter.saveFull("checks_v1", "절차 점검 기록 (시스템)", "", cc, 0);
      var back = await SandleImporter.getFull("checks_v1");
      var b = back.items.find(function (x) { return x.id === "c_term_limit"; });
      if (!b || b.status !== "요건 충족 기록 없음" || b.severity !== "confirmed") throw new Error("재조회 불일치");
      console.log("c_term_limit 갱신 OK — status: " + b.status + ", rules " + b.rules.length + "개, facts " + b.facts.length + "줄");
      return "OK";
    }
  };
  console.log("TermLimit164 ready — await TermLimit164.run()");
})();
