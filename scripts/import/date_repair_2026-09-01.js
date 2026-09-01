/*
 * date_repair_2026-09-01.js — 바깥 date 칸 복구
 *
 * 무슨 일이 있었나
 *   2026-09-01 명단 보정(roster_fix_2026-09-01.js)이 레코드를 다시 저장하면서
 *   record.date 를 빈 문자열로 하드코딩했다.
 *       record: { id: id, name: name, date: "", json: ... }
 *   GAS는 받은 값을 그대로 쓰므로(rec.date || ''), 저장된 61건의
 *   시트 date 열이 전부 지워졌다.
 *
 * 왜 8건만 눈에 띄었나
 *   목록 화면(cloud.js meetDate)은 이 순서로 날짜를 정한다.
 *     1) 바깥 date        → 지워짐
 *     2) 회의명에서 "YYYY년 M월" 찾기
 *     3) 실패하면 '기타'
 *   대부분은 회의명에 월이 있어 2)로 구제됐지만, 제1기처럼 이름이
 *   "2016년 3차"(차수)인 것들만 '기타'로 떨어져 드러났다.
 *   나머지도 이름 해석에 기대고 있을 뿐 데이터는 똑같이 비어 있다.
 *
 * 복구 근거
 *   실제 날짜는 json.meeting.date 에 그대로 남아 있다. 원본이 사라진 게
 *   아니라 색인 칸만 비었다. 그 값을 바깥으로 다시 올린다.
 *
 * 안전장치
 *   - json 은 손대지 않는다. date 칸만 채운다.
 *   - meeting.date 가 없으면 건너뛴다(추측하지 않는다).
 *   - 이미 date 가 있으면 건너뛴다.
 *   - 저장 후 다시 읽어 확인한다.
 *
 * 쓰는 법 (회의록 페이지에서 수정용 비밀번호를 넣은 뒤)
 *   var s=document.createElement("script");
 *   s.src="scripts/import/date_repair_2026-09-01.js?v="+Date.now();
 *   document.head.appendChild(s);
 *   await DateRepair.check();   // 먼저 무엇이 바뀔지만 본다
 *   await DateRepair.run();     // 실제 저장
 */
(function () {
  "use strict";
  var URL_ = "https://script.google.com/macros/s/AKfycbyhpE-DB5WAAEx7uqTCPwU-e0sPKuupkYN3YoQWALiFWe0IHFNh1y91e1VNtDmMxxoxLA/exec";
  var TOKEN = "ITDXaUBDTmrz6DbQ3tv9R";

  function key() {
    var k = window.AdminGate && AdminGate.savedKey && AdminGate.savedKey();
    if (!k) throw new Error("수정용 비밀번호가 없습니다. 관리자 메뉴에서 먼저 확인하세요.");
    return k;
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function list() {
    var r = await fetch(URL_ + "?action=list&token=" + TOKEN).then(function (x) { return x.json(); });
    return (r && r.items) || [];
  }
  async function get(id) {
    var r = await fetch(URL_ + "?action=get&token=" + TOKEN + "&id=" + encodeURIComponent(id))
      .then(function (x) { return x.json(); });
    if (!r || !r.ok || !r.item) throw new Error("get 실패 " + id);
    return r.item;
  }
  // 연속 저장 시 Apps Script가 간헐적으로 unauthorized를 돌려주므로 잠깐 쉬고 다시 시도한다.
  async function save(rec, tries) {
    tries = tries || 0;
    var r = await fetch(URL_, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "save", record: rec, adminKey: key(), token: TOKEN })
    });
    var x = await r.json();
    if (!x || !x.ok) {
      if (tries < 3) { await wait(1200 * (tries + 1)); return save(rec, tries + 1); }
      throw new Error("save 실패 " + rec.id + " " + JSON.stringify(x));
    }
    return x;
  }

  // 회의 레코드만 고른다. 시스템 레코드(명단·요약·공고·점검)는 날짜가 없는 게 정상이다.
  function isMeeting(id) { return /^[mt]_\d{4}_/.test(String(id || "")); }

  // 고쳐야 할 것을 찾는다. 저장은 하지 않는다.
  async function plan() {
    var items = await list();
    var 대상 = items.filter(function (it) {
      return isMeeting(it.id) && !String(it.date || "").trim();
    });
    var 고칠것 = [], 건너뜀 = [];
    for (var i = 0; i < 대상.length; i++) {
      var it = 대상[i];
      var full = await get(it.id);
      var j;
      try { j = JSON.parse(full.json); } catch (e) { 건너뜀.push(it.id + ": json 파싱 실패"); continue; }
      var d = j && j.meeting && j.meeting.date;
      if (!d) { 건너뜀.push(it.id + ": meeting.date 없음 — 추측하지 않고 남겨둠"); continue; }
      고칠것.push({ id: it.id, name: full.name, date: String(d), json: full.json });
      await wait(60);
    }
    return { 전체: items.length, 날짜없음: 대상.length, 고칠것: 고칠것, 건너뜀: 건너뜀 };
  }

  async function check() {
    var p = await plan();
    console.log("전체 " + p.전체 + "건 · 바깥 날짜 없는 회의 " + p.날짜없음 + "건");
    console.log("고칠 것 " + p.고칠것.length + "건:");
    p.고칠것.forEach(function (x) { console.log("  " + x.id + " → " + x.date + "  (" + x.name + ")"); });
    if (p.건너뜀.length) { console.log("건너뜀 " + p.건너뜀.length + "건:"); p.건너뜀.forEach(function (s) { console.log("  " + s); }); }
    return p;
  }

  async function run() {
    var p = await plan();
    if (!p.고칠것.length) { console.log("고칠 것이 없습니다."); return p; }
    var ok = 0, fail = [];
    for (var i = 0; i < p.고칠것.length; i++) {
      var t = p.고칠것[i];
      try {
        // json 은 읽은 그대로 되돌려 넣는다. 날짜 칸만 채우는 것이 목적이다.
        await save({ id: t.id, name: t.name, date: t.date, json: t.json });
        var back = await get(t.id);
        // 시트가 "2016-07-29"를 Date 값으로 자동 변환해 돌려주므로 문자열이 아니라 날짜로 비교한다.
        // (문자열 비교로 했다가 정상 저장을 전부 실패로 잡은 적이 있다.)
        if (new Date(back.date).toDateString() !== new Date(t.date).toDateString()) {
          throw new Error("재조회 불일치 (" + back.date + ")");
        }
        if (String(back.json) !== String(t.json)) throw new Error("본문 변형됨");
        ok++;
        console.log("(" + (i + 1) + "/" + p.고칠것.length + ") " + t.id + " → " + t.date);
      } catch (e) {
        fail.push(t.id + ": " + (e && e.message ? e.message : e));
      }
      await wait(200);
    }
    console.log("완료 — 복구 " + ok + "건" + (fail.length ? ", 실패 " + fail.length + "건" : ""));
    fail.forEach(function (s) { console.log("  실패 " + s); });
    return { 복구: ok, 실패: fail, 건너뜀: p.건너뜀 };
  }

  window.DateRepair = { check: check, run: run, plan: plan };
  console.log("DateRepair ready — await DateRepair.check() 로 먼저 확인, await DateRepair.run() 으로 복구");
})();
