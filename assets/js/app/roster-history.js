// ---- 명단 변동 이력 (v40) ----
// 기수별로 사퇴·보궐취임·직책변경을 시간순 기록. 클라우드 시스템 레코드(roster_history_v1)에 공용 저장, 이 브라우저에 사본 캐시.
// 회의록마다 저장되는 명단 스냅샷은 그대로 두고, "누가 언제 바뀌었는지"를 한눈에 보기 위한 보조 기록.
(function () {
  "use strict";
  var REC_ID = "roster_history_v1", CACHE_KEY = "sandle_roster_history_cache_v1";
  var data = null, dirty = false, loading = false, updatedAt = null; // data = { terms: { "5": [entry...] } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]; }); }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function termNo() { return (typeof state !== "undefined" && (state.rosterTermNo || (state.meeting && state.meeting.termNo))) || 5; }
  // 이력 키 (v44): 입대의 "5", 임차 "t5" — 명단 저장 키와 동일
  function termKey(k) { if (k != null && k !== "") return String(k); return (typeof rosterKeyFor === "function") ? rosterKeyFor(termNo(), (typeof rosterBody === "function" ? rosterBody() : undefined)) : String(termNo()); }
  function keyLabel(k) { k = String(k); return (k.charAt(0) === "t" ? "임차인대표회의 제" + k.slice(1) + "기" : "입주자대표회의 제" + k + "기"); }
  function entries(t) { t = termKey(t); if (!data) return []; if (!data.terms) data.terms = {}; if (!data.terms[t]) data.terms[t] = []; return data.terms[t]; }
  function sorted(t) { return entries(t).slice().sort(function (a, b) { return String(a.date || "").localeCompare(String(b.date || "")) || (a.dong - b.dong); }); }
  // 임기 회차 (v44): 같은 회의체의 기수별 명단(state.rosters)에서 이름이 실린 기수를 모으고,
  // 이력에서 '임기 산입 제외'(보궐 잔여임기 6개월 미만 등)로 표시된 기수는 뺀다.
  function termsServed(name, key) {
    name = String(name || "").trim(); if (!name || typeof state === "undefined" || !state.rosters) return [];
    var tenant = String(termKey(key)).charAt(0) === "t";
    var out = [];
    Object.keys(state.rosters).forEach(function (k) {
      if ((k.charAt(0) === "t") !== tenant) return;
      var n = parseInt(k.replace(/^t/, ""), 10); if (!n) return;
      if ((state.rosters[k] || []).some(function (r) { return String(r.name || "").trim() === name; })) out.push(n);
    });
    // 전체 회의록 명단 색인(③ 사본) + 이 기기의 명단 마스터에서도 찾는다 (v48): 열린 회의록 스냅샷만 보면 다른 기수 재임을 놓친다
    try { if (window.Topic && Topic.termsOf) Topic.termsOf(name, tenant).forEach(function (n) { if (out.indexOf(n) < 0) out.push(n); }); } catch (e) {}
    try {
      var rm = (typeof rosterMasterLoad === "function") ? rosterMasterLoad() : {};
      Object.keys(rm).forEach(function (k) {
        if ((k.charAt(0) === "t") !== tenant) return;
        var n = parseInt(k.replace(/^t/, ""), 10); if (!n) return;
        var rows = (rm[k] && rm[k].rows) || (Array.isArray(rm[k]) ? rm[k] : []);
        if (rows.some(function (r) { return String((r && r.name) || "").trim() === name; }) && out.indexOf(n) < 0) out.push(n);
      });
    } catch (e) {}
    // 이력 기반 보정 (v99): 산입 제외(countTerm===false)는 '취임' 계열 기록에만 적용한다.
    // 회장·부회장·감사 '선출'은 임원 직책 변경일 뿐 동별 대표자 임기와 무관한데, 여기에 붙은 미산입 표시를
    // 기수 제거로 해석해 재임 기수가 통째로 빠지던 버그가 있었다(예: 진세택 t2·t3 회장 선출 → 1·4·5·6기만 남음).
    if (data && data.terms) Object.keys(data.terms).forEach(function (k) {
      if ((k.charAt(0) === "t") !== tenant) return;
      var n = parseInt(k.replace(/^t/, ""), 10); if (!n) return;
      (data.terms[k] || []).forEach(function (e) {
        if (String(e.name || "").trim() !== name) return;
        var joined = /취임/.test(e.event || ""); // 취임·보궐취임
        if (e.countTerm === false && joined) out = out.filter(function (x) { return x !== n; });
        else if ((joined || /선출/.test(e.event || "")) && out.indexOf(n) < 0) out.push(n);
      });
    });
    return out.sort(function (a, b) { return a - b; });
  }
  // 회차 라벨 (v99): '이 기수가 그 사람의 몇 번째 임기인가'를 표시한다.
  // - 지금 보는 기수의 명단에 이름이 없으면 회차를 매길 수 없으므로 표시하지 않는다(예전엔 재임 기수 총개수를 잘못 찍었다).
  // - 2회차 = 중임(한도 도달), 3회차 이상 = 중임 초과로 예외 요건(임차 규약 제16조④·시행령 제13조) 확인 대상.
  function termsLabel(name, key) {
    var ts = termsServed(name, key); if (!ts.length) return "";
    var cur = parseInt(String(termKey(key)).replace(/^t/, ""), 10);
    var idx = ts.indexOf(cur);
    var all = ts.length > 1 ? ' (제' + ts.join('·') + '기)' : '';
    if (idx < 0) { // 이 기수 명단엔 없고 다른 기수에만 이름이 있는 경우
      return '<span class="rh-badge" title="' + esc("이 기수 명단에는 없습니다. 재임 기수: " + ts.map(function (n) { return "제" + n + "기"; }).join(", ")) + '">타 기수 재임' + all + '</span>';
    }
    var nth = idx + 1;
    var over = nth >= 3, dup = nth === 2;
    var cls = over ? "rh-badge rh-out" : (dup ? "rh-badge rh-etc" : "rh-badge rh-in");
    var tip = "재임 기수: " + ts.map(function (n) { return "제" + n + "기"; }).join(", ") +
      (over ? " — 중임 초과(3회 이상). 예외 요건(2회 공고 무후보 + 해당 선거구 과반 찬성 등) 확인 대상" : (dup ? " — 중임 1회(한도 도달)" : ""));
    return '<span class="' + cls + '" title="' + esc(tip) + '">' + nth + '회차' + all + (over ? ' · 중임 초과' : (dup ? ' · 중임' : '')) + '</span>';
  }
  function loadCache() { try { var c = JSON.parse(localStorage.getItem(CACHE_KEY)); if (c && c.data) { data = c.data; updatedAt = c.updatedAt || null; return true; } } catch (e) {} return false; }
  function saveCache() { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ updatedAt: updatedAt, data: data })); } catch (e) {} }
  function fetchCloud(cb) {
    if (loading || !window.Cloud || !Cloud.getSystemRecord) { if (cb) cb(); return; }
    loading = true;
    Cloud.getSystemRecord(REC_ID, function (item) {
      loading = false;
      if (item) { try { var d = JSON.parse(item.json || "{}"); if (d && d.terms) { if (!dirty) { data = d; updatedAt = item.updatedAt || null; saveCache(); } } } catch (e) {} }
      if (data === null) data = { terms: {} };
      if (cb) cb();
    });
  }
  function fmtDate(d) { if (!d) return ""; var m = String(d).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/); if (!m) return esc(d); return m[1] + "." + m[2] + (m[3] ? "." + m[3] : ""); }
  function eventClass(ev) { return ev === "사퇴" ? "rh-out" : (/취임|선출|직책변경/.test(ev) ? "rh-in" : "rh-etc"); }
  // 표시용 문구: 선출·직책변경은 "대표→이사 선출"처럼 이전 직책을 함께 보여준다 (v41)
  function eventLabel(e) { var ev = e.event || ""; var from = (e.fromRole || "").trim(), to = (e.role || "").trim(); if (/선출|직책변경|취임/.test(ev) && from && to && from !== to) return from + "→" + to + " " + ev; if (/선출|취임/.test(ev) && to) return to + " " + ev; return ev; }
  // 명단 표 '변동' 칸: 해당 동의 최근 변동 1~2건
  function badge(t, dong) {
    var list = sorted(t).filter(function (e) { return Number(e.dong) === Number(dong); });
    if (!list.length) return "";
    return list.slice(-2).map(function (e) { return '<span class="rh-badge ' + eventClass(e.event) + '" title="' + esc(e.note || "") + '">' + esc(fmtDate(e.date)) + ' ' + esc(eventLabel(e)) + (e.name ? ' · ' + esc(e.name) : '') + '</span>'; }).join(" ");
  }
  function renderTable() {
    var tb = document.getElementById("rosterHistoryTable"); if (!tb) return;
    var t = termKey();
    var label = document.getElementById("rosterHistoryTermLabel"); if (label) label.textContent = keyLabel(t) + " — 사퇴·보궐·직책 변경 기록 (" + entries(t).length + "건)";
    var status = document.getElementById("rosterHistoryStatus"); if (status) status.innerHTML = dirty ? '<span style="color:#b07d10;font-weight:700">저장 안 된 변경 있음</span>' : (updatedAt ? '☁ ' + esc(fmtDate(String(updatedAt).slice(0, 10))) + ' 저장본' : (loading ? '불러오는 중…' : ''));
    var list = sorted(t);
    tb.innerHTML = list.length ? list.map(function (e) {
      return '<tr><td>' + esc(fmtDate(e.date)) + '</td><td class="center">' + esc(e.dong) + '동</td><td>' + esc(e.name || "") + '</td><td>' + esc(e.role || "") + '</td>' +
        '<td><span class="rh-badge ' + eventClass(e.event) + '">' + esc(eventLabel(e)) + '</span></td><td style="white-space:pre-wrap">' + esc(e.note || "") + '</td>' +
        '<td class="center" title="임기 회차 산입 여부 (보궐 잔여임기 6개월 미만 등은 미산입)">' + (e.countTerm === false ? '<span class="small" style="color:#b85c52">미산입</span>' : (/취임|선출/.test(e.event || "") ? '<span class="small">산입</span>' : '')) + '</td>' +
        '<td><button class="btn danger tag-btn" type="button" onclick="RosterHistory.remove(\'' + esc(e.id) + '\')">삭제</button></td></tr>';
    }).join("") : '<tr><td colspan="8" style="color:#999;text-align:center;padding:16px">기록이 없습니다. 아래에서 추가하세요.</td></tr>';
    var dongSel = document.getElementById("rhDong");
    var tenantKey = String(t).charAt(0) === "t";
    if (dongSel && (dongSel.getAttribute("data-mode") !== (tenantKey ? "t" : "d"))) {
      dongSel.innerHTML = ""; dongSel.setAttribute("data-mode", tenantKey ? "t" : "d");
      if (tenantKey) { for (var s = 1; s <= 16; s++) { var o1 = document.createElement("option"); o1.value = s; o1.textContent = s + "번"; dongSel.appendChild(o1); } }
      else { for (var d = 201; d <= 216; d++) { var o = document.createElement("option"); o.value = d; o.textContent = d + "동"; dongSel.appendChild(o); } }
    }
    // 명단 표의 변동 칸 갱신
    document.querySelectorAll("#repMasterTable tr").forEach(function (tr) {
      var cell = tr.querySelector(".roster-change-cell"); var dongTxt = tr.querySelector("td") && tr.querySelector("td").textContent;
      if (cell && dongTxt) cell.innerHTML = badge(t, parseInt(dongTxt, 10));
    });
  }
  function render() {
    if (data === null) { if (!loadCache()) data = { terms: {} }; fetchCloud(renderTable); }
    renderTable();
  }
  window.RosterHistory = {
    render: render,
    badge: badge,
    termsServed: termsServed,
    termsLabel: termsLabel,
    keyLabel: keyLabel,
    entries: function (t) { return sorted(t); },
    add: function () {
      // 공개 사이트: 이력 추가도 관리자 확인 후 진행 (v42)
      if (window.Cloud && Cloud.requireAdmin && !RosterHistory._adminOk) { Cloud.requireAdmin(function (ok) { if (!ok) return; RosterHistory._adminOk = true; RosterHistory.add(); RosterHistory._adminOk = false; }); return; }
      var date = (document.getElementById("rhDate") || {}).value || "";
      var dong = parseInt((document.getElementById("rhDong") || {}).value, 10);
      var name = ((document.getElementById("rhName") || {}).value || "").trim();
      var role = (document.getElementById("rhRole") || {}).value || "";
      var fromRole = (document.getElementById("rhFromRole") || {}).value || "";
      var event = (document.getElementById("rhEvent") || {}).value || "";
      var note = ((document.getElementById("rhNote") || {}).value || "").trim();
      var countEl = document.getElementById("rhCount"); var countTerm = countEl ? !!countEl.checked : true; // 임기 산입 (v44)
      if (!date || !dong) { if (typeof showToast === "function") showToast("날짜와 동(번호)을 입력하세요", "error"); return; }
      if (data === null) data = { terms: {} };
      entries().push({ id: uid(), date: date, dong: dong, name: name, role: role, fromRole: fromRole, event: event, note: note, countTerm: countTerm });
      dirty = true; saveCache(); renderTable();
      var n = document.getElementById("rhName"); if (n) n.value = ""; var nt = document.getElementById("rhNote"); if (nt) nt.value = "";
    },
    remove: function (id) {
      // 공개 사이트: 삭제는 관리자 확인 후 진행 (v42)
      if (window.Cloud && Cloud.requireAdmin && !RosterHistory._adminOk) { Cloud.requireAdmin(function (ok) { if (!ok) return; RosterHistory._adminOk = true; RosterHistory.remove(id); RosterHistory._adminOk = false; }); return; }
      var list = entries(); var i = list.findIndex(function (e) { return e.id === id; });
      if (i < 0) return;
      var sure = true; try { sure = confirm("이 이력을 삭제할까요? (☁ 이력 저장을 눌러야 클라우드에 반영됩니다)"); } catch (e) { sure = true; }
      if (!sure) return;
      list.splice(i, 1); dirty = true; saveCache(); renderTable();
    },
    // 외부(Claude Code 등)에서 일괄 설정: RosterHistory.setEntries(5, [...]) 후 save()
    setEntries: function (t, list) { if (data === null) data = { terms: {} }; data.terms[String(t)] = (list || []).map(function (e) { return Object.assign({ id: uid() }, e); }); dirty = true; saveCache(); renderTable(); },
    save: function (cb) {
      if (data === null) data = { terms: {} };
      if (!window.Cloud || !Cloud.saveSystemRecord) return;
      Cloud.saveSystemRecord(REC_ID, "명단 변동 이력 (시스템)", JSON.stringify(data), function (ok) { if (ok) { dirty = false; updatedAt = new Date().toISOString(); saveCache(); renderTable(); } if (cb) cb(ok); });
    },
    get: function () { return data; }
  };
  // 접속 후 미리 준비(사본 즉시, 클라우드 대조는 백그라운드) → 명단 표 변동 칸이 바로 채워진다
  setTimeout(function () { if (data === null) { if (!loadCache()) data = { terms: {} }; fetchCloud(function () { if (typeof renderRepMaster === "function") renderRepMaster(); }); if (typeof renderRepMaster === "function") renderRepMaster(); } }, 1800);
})();

// v100의 일회성 보정 함수 runRosterFix()는 2026-09-01 반영 완료 후 v102에서 제거했다.
// 같은 보정을 다시 돌려야 하면 scripts/import/roster_fix_2026-09-01.js 를 콘솔에서 불러 RosterFix.run() 한다.
// 다만 그 스크립트는 한 번 실행을 전제로 하므로, 재실행 시 이력이 중복될 수 있다.
