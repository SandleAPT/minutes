// 동대표 명단·임기 회차 정리 (2026-09-01, v99)
// (1) roster_history_v1: 임원 '선출'(회장·부회장·감사 직책 변경) 기록에 붙은 countTerm=false를 제거한다.
//     이 플래그는 '보궐 잔여임기 6개월 미만이라 중임 횟수에 넣지 않음'(규약 제16조⑤)일 때만 쓰는 것인데,
//     임원 선출 기록에 붙어 있어 회차 계산이 해당 기수를 통째로 빼버렸다(진세택 t2·t3 → 1·4·5·6기만 남아 '4회차').
//     v99 코드는 '취임' 계열에만 플래그를 적용하지만, 데이터도 의미에 맞게 정리해 둔다.
// (2) 입대의 1~3기 명단 보강 — 2026-09-01 관리사무소가 제공한 '동별대표자 구성현황(1~4기)' 문서로 동호수 확정.
//     (원본은 사진·연락처가 있어 D:\산들마을-비공개\에 보관, 공개 반영은 이름·동호수·직책만)
//       · 1기(임기 2016.05.02~2018.05.01): 김수영 209 회장, 김현준 207 감사, 김태환 204 감사, 왕항종 201 이사
//       · 2기: 왕항종 201 회장, 김태환 204 감사, 이학수 208 감사, 강지현 213 총무이사
//         ※ 왕항종은 **201동**이다. 회의록의 "201동,210동 관리이사"는 통합 선거구(2016.11 규약 개정으로
//            201동 24세대+210동 30세대가 한 선거구)를 대표한다는 뜻이었고 본인 주소는 201-101 — 종전 210동 추정은 오류.
//       · 3기: 조인주 201, 이화례 204 추가(기존 이상현 207·윤슬기 208·정광수 209·이해숙 211·용덕영 213과 함께 7명)
//     문서에도 없는 이상진(1기 회장)·박근아(1기 감사)·이윤(1기 208동)은 좌석에 넣지 않고,
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
  // 동호수 미확인 인물 — 구성현황 문서에도 없어 좌석을 못 정한다. 회차 계산에 잡히도록 '취임' 기록만 남긴다.
  var UNSEATED = [
    { term: "1", date: "2016-05-10", dong: 0, name: "이상진", role: "회장", note: "동호수 미확인 — 1기 초대 회장(2017.4 이전 교체, 구성현황 문서에도 없음)" },
    { term: "1", date: "2016-05-10", dong: 0, name: "박근아", role: "감사", note: "동호수 미확인 — 1기 감사(구성현황 문서에도 없음)" },
    { term: "1", date: "2016-05-10", dong: 208, name: "이윤", role: "대표", note: "1기 208동 대표(결과공고 기준) — 구성현황 문서에는 없음" },
    { term: "2", date: "2018-06-15", dong: 0, name: "박근이", role: "감사", note: "동호수 미확인 — 2기 감사(2018.8 이후 기록 없음)" }
  ];
  // 좌석 보강 — 2026-09-01 관리사무소 '동별대표자 구성현황(1~4기)' 문서로 확정된 동호수
  var SEATS = {
    "1": [{ dong: 209, role: "회장", name: "김수영" }, { dong: 207, role: "감사", name: "김현준" }, { dong: 204, role: "감사", name: "김태환" }, { dong: 201, role: "이사", name: "왕항종" }],
    "2": [{ dong: 201, role: "회장", name: "왕항종" }, { dong: 204, role: "감사", name: "김태환" }, { dong: 208, role: "감사", name: "이학수" }, { dong: 213, role: "이사", name: "강지현" }],
    "3": [{ dong: 201, role: "대표", name: "조인주" }, { dong: 204, role: "대표", name: "이화례" }]
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
      // (3) 입대의 1~3기 회의록의 좌석 보강
      // 대상 회의록은 브라우저 사본에서 찾고, 사본이 없으면(휴대폰 첫 접속 등) 아래 고정 목록을 쓴다.
      var cache = {}; try { cache = JSON.parse(localStorage.getItem("sandle_topic_records_v1") || "{}"); } catch (e) {}
      var FALLBACK = {
        "1": ["m_2016_05_v1", "m_2016_06_v1", "m_2016_07_v1", "m_2016_10_v1", "m_2016_11_v1", "m_2016_12_v1", "m_2017_02_v1", "m_2017_04_v1", "m_2017_05_v1", "m_2017_05s_v1", "m_2017_07_v1", "m_2017_08_v1", "m_2017_09_v1", "m_2017_10_v1", "m_2017_11_v1", "m_2017_12_v1", "m_2018_02_v1", "m_2018_03_v1", "m_2018_04_v1", "m_2018_04s_v1"],
        "2": ["m_2018_06_v1", "m_2018_07_v1", "m_2018_08_v1", "m_2018_09_v1", "m_2018_10_v1", "m_2018_11_v1", "m_2018_12s_v1", "m_2019_01_v1", "m_2019_02_v1", "m_2019_03_v1", "m_2019_04_v1", "m_2019_05_v1", "m_2019_06_v1", "m_2019_07s_v1", "m_2019_07_v1", "m_2019_08_v1", "m_2019_09_v1", "m_2019_10_v1", "m_2019_11_v1", "m_2019_12_v1"],
        "3": ["m_2020_11_v1", "m_2020_11s_v1", "m_2020_12_v1", "m_2021_01_v1", "m_2021_03_v1", "m_2021_04_v1", "m_2021_05_v1", "m_2021_07_v1", "m_2021_08_v1", "m_2021_10_v1", "m_2021_11_v1", "m_2021_12_v1", "m_2022_01_v1", "m_2022_02_v1", "m_2022_03_v1", "m_2022_04_v1", "m_2022_05_v1", "m_2022_06_v1", "m_2022_07_v1", "m_2022_08_v1", "m_2022_09_v1"]
      };
      var seatN = 0, doneN = 0;
      var termKeys = Object.keys(SEATS);
      var totalN = termKeys.reduce(function (a, k) { return a + (FALLBACK[k] || []).length; }, 0);
      var say = function (m) { var el = document.getElementById("rosterFixStatus"); if (el) el.textContent = m; };
      for (var t = 0; t < termKeys.length; t++) {
        var tk = termKeys[t];
        var ids = Object.keys(cache).filter(function (id) {
          try { var jj = JSON.parse(cache[id].json); return !!(jj.rosters && jj.rosters[tk]); } catch (e) { return false; }
        });
        if (!ids.length) ids = FALLBACK[tk] || [];
        log.push("제" + tk + "기 대상 회의록 " + ids.length + "건");
        for (var i = 0; i < ids.length; i++) {
          doneN++; say("보정 중… " + doneN + "/" + totalN + " (제" + tk + "기)");
          var rec; try { rec = await get(ids[i]); } catch (e) { log.push(ids[i] + " 없음"); continue; }
          var j = rec.json; var rs = (j.rosters && j.rosters[tk]) || null; if (!rs) continue;
          var ch = false;
          SEATS[tk].forEach(function (s) {
            rs.forEach(function (r) {
              if (r.dong === s.dong && String(r.name || "").trim() !== s.name) { r.name = s.name; r.role = s.role; ch = true; }
            });
          });
          if (ch) { await save(ids[i], rec.item.name, j); seatN++; }
        }
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
