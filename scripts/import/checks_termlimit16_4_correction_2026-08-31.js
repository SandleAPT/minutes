// 중임 제한 점검 문구 정정 — 공개 공고에서 수치가 보이지 않는다는 사정만으로 위반을 확정하지 않는다.
// 실행: importer.js 로드 후 이 파일을 로드하고 await TermLimitCorrection.run()
(function () {
  window.TermLimitCorrection = {
    run: async function () {
      if (!window.SandleImporter) throw new Error("importer.js 먼저 로드");
      var cc = await SandleImporter.getFull("checks_v1");
      var it = cc.items.find(function (x) { return x.id === "c_term_limit"; });
      if (!it) throw new Error("c_term_limit 없음");
      it.status = "확인중";
      it.statusDetail = "예외 요건 확인자료 필요";
      it.severity = "medium";
      it.title = "3회 이상 재임한 동별 대표자 — 중임 예외 절차 확인 필요";
      it.summary = "4~6기 공개 공고만으로는 중임 예외 요건을 충족했는지 판단할 수 없습니다. 중임 자체가 곧 위반을 뜻하는 것은 아니지만, 예외 선출이었다면 필요한 공고·후보등록·찬성표 기록을 확인해야 합니다. 3기 선거는 당시 적용 규약과 원본기록을 별도로 확인해야 합니다.";
      it.facts = [
        "현재 정리된 기수 기록상 진세택(1~6기), 한경열(2~5기), 원영해(3~6기), 강명순(4기 보궐~6기)은 3회 이상 재임한 것으로 나타남",
        "강명순의 4기 보궐 임기는 약 18개월로, 2020.4.18 규약 제16조제5항의 ‘6개월 미만’ 예외에는 해당하지 않음",
        "확보된 4기·4기 보궐·5기·6기 당선인 공고에는 득표수·투표수·찬성수가 기재되어 있지 않음",
        "4기와 5기는 1·2차 공고의 무입후보 사실이 공고에서 확인되지만, 6기는 차수별 후보 등록 결과가 공개 공고에서 확인되지 않음",
        "3기 선거 공고류는 현재 확보된 공개 기록에서 확인되지 않음 — 당시 적용 규약과 선관위 원본기록을 함께 확인해야 함"
      ];
      it.question = "각 대상 선거구별로 두 차례 공고의 후보자 등록 결과, 중임자가 등록한 후속 공고, 비중임 후보 등록 여부, 선거구 임차인 총수와 찬성표를 선관위 원본기록 또는 전자투표 집계로 대조해야 합니다. 이 자료가 확인되기 전에는 당선 무효나 규약 위반으로 단정하지 않습니다.";
      it.next = "관리주체에 대상 선거별 후보등록부·개표결과·전자투표 집계와 당시 적용 규약을 확인해 달라고 요청";
      it.updatedAt = new Date().toISOString().slice(0, 10);
      await SandleImporter.saveFull("checks_v1", "절차 점검 기록 (시스템)", "", cc, 0);
      var back = await SandleImporter.getFull("checks_v1");
      var saved = back.items.find(function (x) { return x.id === "c_term_limit"; });
      if (!saved || saved.status !== "확인중" || saved.severity !== "medium") throw new Error("재조회 불일치");
      return "c_term_limit 정정 완료";
    }
  };
})();
