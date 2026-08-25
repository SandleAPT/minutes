// ---- ④ 하자판결금 수령 현황 (v54) ----
// haja.json(저장소 정적 파일)을 읽어 세대별 수령/미수령과 수령 시기(공고 차수 사이 구간)를 보여 준다.
// 새 차수 공고가 나오면 haja.json의 pendingByRound/receivedAsOf6/rounds/asOf 를 갱신한다(Claude Code 작업).
(function () {
  var data = null, loading = false, err = "";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]; }); };
  function load(cb) {
    if (data) { cb(); return; }
    if (loading) return; loading = true;
    fetch("haja.json?v=" + encodeURIComponent(new Date().toISOString().slice(0, 10))).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) { data = j; index(); loading = false; cb(); })
      .catch(function (e) { err = String(e && e.message || e); loading = false; cb(); });
  }
  var idx = {}; // "동-호" → {dong,ho,status,period}
  function has(map, dong, ho) { var a = map && map[dong]; return !!a && a.indexOf(ho) >= 0; }
  function index() {
    idx = {};
    var P = data.participants || {}, p4 = (data.pendingByRound || {})["4"], p5 = (data.pendingByRound || {})["5"], p6 = (data.pendingByRound || {})["6"], rc = data.receivedAsOf6 || {};
    Object.keys(P).forEach(function (dong) {
      P[dong].forEach(function (ho) {
        var st, per;
        if (has(p6, dong, ho)) { st = "pending"; per = "pending"; }
        else if (has(p5, dong, ho)) { st = "ok"; per = "r5to6"; }
        else if (has(p4, dong, ho)) { st = "ok"; per = "r4to5"; }
        else { st = "ok"; per = "before4"; }
        idx[dong + "-" + ho] = { dong: dong, ho: ho, status: st, period: per, inReceived: has(rc, dong, ho) };
      });
    });
    // 자료 정합성 점검(콘솔): 6차 수령+미수령 = 참여세대, 미수령 차수별 포함관계
    try {
      var bad = [];
      Object.keys(P).forEach(function (dong) {
        P[dong].forEach(function (ho) { var r = has(rc, dong, ho), q = has(p6, dong, ho); if (r === q) bad.push(dong + "-" + ho + (r ? " 수령·미수령 중복" : " 6차 명단 누락")); if (has(p6, dong, ho) && !has(p5, dong, ho)) bad.push(dong + "-" + ho + " 6차 미수령인데 5차 명단에 없음"); if (has(p5, dong, ho) && !has(p4, dong, ho)) bad.push(dong + "-" + ho + " 5차 미수령인데 4차 명단에 없음"); });
        (rc[dong] || []).concat(p6[dong] || [], p5[dong] || [], p4[dong] || []).forEach(function (ho) { if (!has(P, dong, ho)) bad.push(dong + "-" + ho + " 참여세대 명단에 없음"); });
      });
      if (bad.length) console.warn("[haja.json 정합성]", bad);
    } catch (e) {}
  }
  function periodLabel(per) { var p = (data.periods || {})[per]; return p ? p.label : per; }
  function periodShort(per) { var p = (data.periods || {})[per]; return p ? (p.short || p.label) : per; } // 칸 안 짧은 표기 (v57)
  function periodRange(per) { var p = (data.periods || {})[per]; return p ? p.range : ""; }
  function render() {
    var sub = document.getElementById("hajaSub"); if (!sub) return;
    if (!data) { if (err) sub.textContent = "자료를 불러오지 못했습니다: " + err; else { sub.textContent = "불러오는 중…"; load(render); } return; }
    var t = data.totals || {};
    sub.textContent = (data.asOf ? data.asOf.replace(/-/g, ".") + " 기준 (6차 공고 명단)" : "") + " · 채권양도세대 " + t.participants + "세대 중 수령 " + t.received + " · 미수령 " + t.pending;
    var dongs = Object.keys(data.participants || {}).sort();
    document.getElementById("hajaLookup").innerHTML =
      '<b>우리 집 확인</b> <select id="hajaDong" onchange="Haja.fillHo()">' + dongs.map(function (d) { return '<option value="' + d + '">' + d + '동</option>'; }).join("") + '</select>' +
      '<select id="hajaHo" onchange="Haja.lookup()"></select>' + // 참여세대 호만 드롭박스로 (v56)
      '<button class="btn gold" type="button" onclick="Haja.lookup()">확인</button>' +
      '<span class="small" style="color:#888">하자소송 참여(채권양도) 세대는 201·204·207·208·209·210·211·213동 370세대입니다. 그 외 동은 배당 대상이 아닙니다.</span>';
    fillHo(); // 첫 동의 참여 호 채우기 (v56)
    // 통계
    var ok = 0, pend = 0, perCount = { before4: 0, r4to5: 0, r5to6: 0 };
    Object.keys(idx).forEach(function (k) { var x = idx[k]; if (x.status === "ok") { ok++; perCount[x.period] = (perCount[x.period] || 0) + 1; } else pend++; });
    document.getElementById("hajaStats").innerHTML = '<div class="haja-stats">' +
      '<div class="haja-stat"><b>' + (ok + pend) + '</b><span class="small">참여(채권양도) 세대</span></div>' +
      '<div class="haja-stat ok"><b>' + ok + '</b><span class="small">수령 완료</span></div>' +
      '<div class="haja-stat pending"><b>' + pend + '</b><span class="small">미수령 (' + esc(data.asOf || "") + ' 기준)</span></div>' +
      '<div class="haja-stat"><b>' + Math.round(ok / Math.max(1, ok + pend) * 100) + '%</b><span class="small">수령률</span></div></div>' +
      '<div class="small" style="color:#666;margin:-4px 0 10px">수령 시기 추정: ' + ["before4", "r4to5", "r5to6"].map(function (p) { return periodLabel(p) + " " + (perCount[p] || 0) + "세대"; }).join(" · ") + '</div>';
    // 동별 표
    var html = '<div class="haja-legend"><span class="l-ok">수령 완료 (칸 아래 작은 글씨 = 수령 시기 추정)</span><span class="l-pending">미수령</span><span>— 칸을 누르면 상세</span></div>';
    dongs.forEach(function (d) {
      var list = (data.participants[d] || []).slice().sort(function (a, b) { return a - b; });
      var o = list.filter(function (h) { return idx[d + "-" + h].status === "ok"; }).length, pn = list.length - o;
      html += '<details class="haja-dong"><summary><span>' + d + '동</span><span class="small" style="font-weight:600;color:#666">참여 ' + list.length + ' · 수령 ' + o + ' · 미수령 ' + pn + '</span><span class="haja-bar" title="수령률 ' + Math.round(o / list.length * 100) + '%"><i style="width:' + Math.round(o / list.length * 100) + '%"></i></span></summary>' +
        '<div class="haja-grid">' + list.map(function (h) { var x = idx[d + "-" + h]; return '<span class="haja-ho ' + x.status + ' p-' + x.period + '" title="' + (x.status === "ok" ? "수령 완료 · " + periodLabel(x.period) : "미수령") + '" onclick="Haja.show(\'' + d + '\',' + h + ')">' + h + '<small>' + (x.status === "ok" ? esc(periodShort(x.period)) : "미수령") + '</small></span>'; }).join("") + '</div></details>';
    });
    document.getElementById("hajaTables").innerHTML = html;
    // 출처·제출 서류
    document.getElementById("hajaSources").innerHTML = '<div class="haja-src"><b>미수령 세대 제출 서류(관리사무소)</b><ul>' + (data.documents || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join("") + '</ul>' +
      '<b style="display:block;margin-top:8px">출처 — 하자소송 하자판결금 세대분배 안내문</b><ul>' + (data.rounds || []).map(function (r) { return '<li>' + esc(r.date.replace(/-/g, ".")) + ' ' + esc(r.desc) + '</li>'; }).join("") + '</ul>' +
      '<div style="margin-top:6px">' + esc(data.note || "") + ' (자료 갱신 ' + esc(data.updated || "") + ')</div></div>';
    if (window.track) track("haja_view", {});
  }
  function show(dong, ho) {
    var box = document.getElementById("hajaResult"); if (!box || !data) return;
    ho = Number(ho);
    var x = idx[dong + "-" + ho];
    if (!x) {
      box.innerHTML = '<div class="haja-res none"><b class="st">' + esc(dong === "etc" ? "" : dong + "동 ") + (ho ? ho + "호" : "") + ' — 채권양도(소송 참여) 세대 명단에 없습니다.</b><div class="small">하자소송 판결금 배당 대상은 채권양도 370세대(201·204·207·208·209·210·211·213동)입니다. 명단 오류라고 생각되시면 관리사무소에 확인하세요.</div></div>';
    } else if (x.status === "pending") {
      box.innerHTML = '<div class="haja-res pending"><b class="st">' + dong + '동 ' + ho + '호 — 아직 수령하지 않은 세대입니다</b> <span class="small">(' + esc(data.asOf || "") + ' 기준 6차 공고 미수령 명단)</span>' +
        '<div style="margin-top:6px">관리사무소에 아래 서류를 제출하면 <b>매월 말일</b> 서류 취합 후 지급됩니다. 지급일 기준 등기부등본상 소유주에게 지급되며, 세입자는 소유주에게 전달해 주세요.</div><ul>' + (data.documents || []).slice(0, 4).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join("") + '</ul></div>';
    } else {
      box.innerHTML = '<div class="haja-res ok"><b class="st">' + dong + '동 ' + ho + '호 — 수령 완료 세대입니다</b>' +
        '<div style="margin-top:4px">수령 시기(추정): <b>' + esc(periodLabel(x.period)) + '</b> <span class="small">(' + esc(periodRange(x.period)) + ' — ' + esc(((data.periods || {})[x.period] || {}).desc || "") + ')</span></div>' +
        '<div class="small" style="color:#666;margin-top:4px">공고 차수별 미수령 명단 비교로 추정한 구간입니다. 실제 입금일은 관리사무소에 확인하세요.</div></div>';
    }
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (window.track) track("haja_lookup", { dong: dong, status: x ? x.status : "none" });
  }
  // 동을 고르면 그 동의 참여(채권양도) 세대 호만 드롭박스에 채운다 (v56)
  function fillHo() {
    var d = document.getElementById("hajaDong"), h = document.getElementById("hajaHo"); if (!d || !h || !data) return;
    var list = (data.participants[d.value] || []).slice().sort(function (a, b) { return a - b; });
    h.innerHTML = '<option value="">호 선택 (참여 ' + list.length + '세대)</option>' + list.map(function (ho) { var x = idx[d.value + "-" + ho]; return '<option value="' + ho + '">' + ho + '호' + (x && x.status === "pending" ? " · 미수령" : "") + '</option>'; }).join("");
    var box = document.getElementById("hajaResult"); if (box) box.innerHTML = "";
  }
  function lookup() { var d = document.getElementById("hajaDong"), h = document.getElementById("hajaHo"); if (!d || !h) return; if (!h.value) { var box = document.getElementById("hajaResult"); if (box) box.innerHTML = '<div class="haja-res none">호를 선택해 주세요. 목록에 없는 호는 채권양도(소송 참여) 세대가 아닙니다.</div>'; return; } show(d.value, h.value); }
  window.Haja = { render: render, lookup: lookup, show: show, fillHo: fillHo, data: function () { return data; } };
})();
