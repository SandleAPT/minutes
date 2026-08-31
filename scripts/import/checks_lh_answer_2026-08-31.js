// LH 답변 반영 (2026-08-31 수신, 신문고 — 2026.8.24 이첩 민원 회신) — 절차 점검 c_ec_candidate·c_ec6_formation 갱신
// 요지: ①6기 선관위 모집 공고(25.11.27) 시 김영자의 신청서 확인·선거관리위원 위촉 확인 ②"관리규약을 위반한 것으로 보입니다"(LH 소견)
//       ③위촉 성립·동대표 결격 판단은 규약 제37조 관리주체의 업무 → 관리소에 절차 하자 문서 시행 예정
// 원본 스크린샷: D:\산들마을-비공개\ (담당자 실명·연락처 포함 — 공개 기록에는 부서 단위까지만)
// 실행: importer.js 로드 후 이 스크립트 로드 → await LhAnswer.run()
(function () {
  var TODAY = new Date().toISOString().slice(0, 10);
  window.LhAnswer = {
    run: async function () {
      if (!window.SandleImporter) throw new Error("importer.js 먼저 로드");
      var cc = await SandleImporter.getFull("checks_v1");
      var cand = cc.items.find(function (x) { return x.id === "c_ec_candidate"; });
      var form = cc.items.find(function (x) { return x.id === "c_ec6_formation"; });
      if (!cand || !form) throw new Error("항목 없음");

      cand.status = "위촉 확인·위반 소견(LH)";
      cand.severity = "confirmed";
      cand.summary = "LH 재확인 답변(2026.8.31 수신): 6기 선관위 모집 공고(2025.11.27) 시 김영자의 신청서 확인 및 선거관리위원 위촉이 확인되며 '관리규약을 위반한 것으로 보입니다'라고 회신 — 최초 답변('활동한 적 없는 것으로 사료')이 뒤집혔습니다. 위촉이 인정된 이상, 선관위원 임기 중 동대표 후보 등록(12.23)·당선(12.26)은 규약 제16조③6호(사퇴해도 잔여임기 중이면 결격)와 정면으로 만나며, LH는 결격 판단이 제37조 관리주체의 업무라며 관리소에 절차 하자 문서를 시행하겠다고 했습니다.";
      [
        "LH 회신(2026.8.24 이첩 민원, 2026.8.31 수신): 6기 선관위원 모집 공고(2025.11.27) 시 김영자는 선거관리위원회 신청서 확인 및 선거관리위원으로 위촉된 것으로 확인 — '이는 관리규약을 위반한 것으로 보입니다'(원문 표현)",
        "같은 회신: 선관위 위촉 성립 여부 및 동대표 결격 여부 등은 '관리규약 제37조 관리주체의 업무'에 해당 — 관리소에 절차 하자와 관련하여 문서를 시행하겠다고 함(경기남부지역본부 담당, 상세 연락처는 비공개 보관자료)",
        "이로써 최초 서면답변('선거관리위원으로 활동한 적이 없는 것으로 사료')은 추가 자료(신청서·회의자료) 제출 후 공식적으로 번복됨"
      ].forEach(function (f) { if (cand.facts.indexOf(f) < 0) cand.facts.push(f); });
      cand.question = "관리소에 시행될 LH 문서(공문) 확보가 다음 단계입니다. 위촉이 확인된 이상 ①김영자 동대표 자격(제16조③6호 결격)에 대한 관리주체의 판단과 조치 ②같은 방식으로 선정된 나머지 3명(위원장 김수자·조영호·곽필임)에 대한 동일 기준 적용 ③결격이 인정될 경우 6기 당선인 구성·의결의 효력 정리가 필요합니다.";
      cand.updatedAt = TODAY;

      [
        "LH 회신(2026.8.31 수신)으로 6기 선관위 '위촉' 자체는 성립한 것으로 확인됨(김영자 포함) — 다만 공개모집 공고 부재·4명 구성 쟁점은 별개로 남아 있으며, LH는 위촉 성립 여부 판단이 제37조 관리주체의 업무라며 관리소에 절차 하자 관련 문서를 시행하겠다고 함"
      ].forEach(function (f) { if (form.facts.indexOf(f) < 0) form.facts.push(f); });
      form.updatedAt = TODAY;

      await SandleImporter.saveFull("checks_v1", "절차 점검 기록 (시스템)", "", cc, 0);
      var back = await SandleImporter.getFull("checks_v1");
      var b = back.items.find(function (x) { return x.id === "c_ec_candidate"; });
      if (!b || b.status !== "위촉 확인·위반 소견(LH)") throw new Error("재조회 불일치");
      console.log("LH 답변 반영 OK — c_ec_candidate: " + b.status + " / c_ec6_formation facts +1");
      return "OK";
    }
  };
  console.log("LhAnswer ready — await LhAnswer.run()");
})();
