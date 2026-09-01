// 동대표 명단·임기 회차 정리 (2026-09-01, v99)
// (1) roster_history_v1: 임원 '선출'(회장·부회장·감사 직책 변경) 기록에 붙은 countTerm=false를 제거한다.
//     이 플래그는 '보궐 잔여임기 6개월 미만이라 중임 횟수에 넣지 않음'(규약 제16조⑤)일 때만 쓰는 것인데,
//     임원 선출 기록에 붙어 있어 회차 계산이 해당 기수를 통째로 빼버렸다(진세택 t2·t3 → 1·4·5·6기만 남아 '4회차').
//     v99 코드는 '취임' 계열에만 플래그를 적용하지만, 데이터도 의미에 맞게 정리해 둔다.
// (2) 입대의 1~3기 명단 보강: 결과공고에 동호수가 적히지 않아 좌석이 비어 있던 인물 중
//     다른 공고에서 동이 확인되는 사람만 채운다(사용자 승인 방침: "추정 가능한 사람만").
//       · 왕항종 210동 — 1기 "201동,210동 관리이사"(2016.11 규약 개정으로 201동 24세대+210동 30세대가 한 선거구로 통합), 2기 회장
//       · 김태환 204동 — 1기 204동 대표, 2기 감사
//     동을 알 수 없는 이상진(1기 회장)·박근아(1기 감사)·강지현(2기 이사)·조인주·이화례(3기 대표)는 좌석에 넣지 않고,
//     회차 계산에 잡히도록 roster_history_v1에 '취임' 기록으로만 남긴다(note에 '동호수 미확인' 표기).
// 실행: 회의록 페이지에서 이 스크립트 로드 → await RosterFix.run()
(function () {
  var URL_ = "https://script.google.com/macros/s/AKfycbyhpE-DB5WAAEx7uqTCPwU-e0sPKuupkYN3YoQWALiFWe0IHFNh1y91e1VNtDmMxxoxLA/exec";
  var TOKEN = "ITDXaUBDTmrz6DbQ3tv9R";
  function key() { var k = localStorage.getItem("sandle_admin_key"); if (!k) throw new Error("관리자 키 없음"); return k; }
  async function get(id) { var r = await fetch(URL_ + "?action=get&token=" + TOKEN + "&id=" + id); var x = await r.json(); if (!x.ok) throw new Error("get fail " + id); return { item: x.item, json: JSON.parse(x.item.json) }; }
  async function save(id, name, obj) {
    var r = await fetch(URL_, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "save", record: { id: id, name: name, date: "", json: JSON.stringify(obj) }, adminKey: key(), token: TOKEN }) });
    var x = await r.json(); if (!x.ok) throw new Error("save fail " + id + " " + JSON.stringify(x)); return x;
  }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  // 동호수 미확인 인물 — 회차 계산에 잡히도록 '취임' 기록만 남긴다
  var UNSEATED = [
    { term: "1", date: "2016-05-10", dong: 0, name: "이상진", role: "회장", note: "동호수 미확인(결과공고에 미기재) — 1기 초대 회장" },
    { term: "1", date: "2016-05-10", dong: 0, name: "박근아", role: "감사", note: "동호수 미확인(결과공고에 미기재) — 1기 감사" },
    { term: "2", date: "2018-06-15", dong: 0, name: "강지현", role: "이사", note: "동호수 미확인(결과공고에 미기재) — 2기 이사" },
    { term: "2", date: "2018-06-15", dong: 0, name: "박근이", role: "감사", note: "동호수 미확인 — 2기 감사(2018.8 이후 기록 없음)" },
    { term: "3", date: "2020-11-01", dong: 0, name: "조인주", role: "대표", note: "동호수 미확인(결과공고에 미기재) — 3기 대표" },
    { term: "3", date: "2020-11-01", dong: 0, name: "이화례", role: "대표", note: "동호수 미확인(결과공고에 미기재) — 3기 대표" }
  ];
  // 좌석 보강 — 다른 공고에서 동이 확인되는 사람만
  var SEATS = {
    "2": [{ dong: 210, role: "회장", name: "왕항종" }, { dong: 204, role: "감사", name: "김태환" }]
  };
  window.RosterFix = {
    run: async function () {
      var log = [];
      // (1) 임원 선출 기록의 countTerm=false 제거
      var rh = await get("roster_history_v1");
      var h = rh.json; var fixed = 0;
      Object.keys(h.terms || {}).forEach(function (k) {
        (h.terms[k] || []).forEach(function (e) {
          if (e.countTerm === false && !/취임/.test(e.event || "")) { delete e.countTerm; fixed++; log.push("플래그 정리 " + k + " " + e.name + " " + e.event); }
        });
      });
      // (2) 동호수 미확인 인물 취임 기록 추가
      var added = 0;
      UNSEATED.forEach(function (u) {
        h.terms = h.terms || {}; h.terms[u.term] = h.terms[u.term] || [];
        var dup = h.terms[u.term].some(function (e) { return String(e.name || "").trim() === u.name; });
        if (dup) return;
        h.terms[u.term].push({ id: uid(), date: u.date, dong: u.dong, name: u.name, role: u.role, event: "취임", note: u.note, countTerm: true });
        added++; log.push("이력 추가 " + u.term + "기 " + u.name);
      });
      if (fixed || added) await save("roster_history_v1", rh.item.name || "동대표 변동 이력 (시스템)", h);
      // (3) 입대의 2기 회의록의 좌석 보강
      var ids = ["m_2018_12s_v1", "m_2019_01_v1", "m_2019_02_v1", "m_2019_03_v1", "m_2019_04_v1", "m_2019_05_v1", "m_2019_06_v1", "m_2019_07s_v1", "m_2019_07_v1", "m_2019_08_v1", "m_2019_09_v1", "m_2019_10_v1", "m_2019_11_v1", "m_2019_12_v1", "m_2018_06_v1", "m_2018_07_v1", "m_2018_08_v1", "m_2018_09_v1", "m_2018_10_v1", "m_2018_11_v1"];
      var seatN = 0;
      for (var i = 0; i < ids.length; i++) {
        var rec; try { rec = await get(ids[i]); } catch (e) { log.push(ids[i] + " 없음"); continue; }
        var j = rec.json; var rs = (j.rosters && j.rosters["2"]) || null; if (!rs) continue;
        var ch = false;
        SEATS["2"].forEach(function (s) {
          rs.forEach(function (r) { if (r.dong === s.dong && String(r.name || "").trim() !== s.name) { r.name = s.name; r.role = s.role; ch = true; } });
        });
        if (ch) { await save(ids[i], rec.item.name, j); seatN++; }
      }
      log.push("좌석 보강 회의록 " + seatN + "건");
      // 검증
      var back = await get("roster_history_v1");
      var left = 0; Object.keys(back.json.terms || {}).forEach(function (k) { (back.json.terms[k] || []).forEach(function (e) { if (e.countTerm === false && !/취임/.test(e.event || "")) left++; }); });
      if (left) throw new Error("정리 안 된 플래그 " + left + "건");
      console.log(log.join("\n"));
      return { 플래그정리: fixed, 이력추가: added, 좌석보강: seatN };
    }
  };
  console.log("RosterFix ready — await RosterFix.run()");
})();
