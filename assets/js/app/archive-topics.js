(function () {
  "use strict";
  var URL = "https://script.google.com/macros/s/AKfycbyhpE-DB5WAAEx7uqTCPwU-e0sPKuupkYN3YoQWALiFWe0IHFNh1y91e1VNtDmMxxoxLA/exec";
  var TOKEN = "ITDXaUBDTmrz6DbQ3tv9R";
  function cfg() { try { var c = JSON.parse(localStorage.getItem("sandle_cloud_cfg")) || {}; return { url: c.url || URL, token: c.token || TOKEN }; } catch (e) { return { url: URL, token: TOKEN }; } }
  function apiGet(p) { var c = cfg(); p.token = c.token; var q = Object.keys(p).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(p[k]); }).join("&"); return fetch(c.url + "?" + q).then(function (r) { return r.json(); }); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]; }); }

  var TAXONOMY = window.TopicTaxonomy;
  var DEFS = TAXONOMY && Array.isArray(TAXONOMY.defs) ? TAXONOMY.defs : [];
  // 안건명을 먼저 보고(정확도 높음), 없으면 의결·요지 본문에서 찾는다. 일치하는 주제를 모두 돌려준다. (v30: 다중 태그)
  function scanTags(t) {
    var out = [];
    for (var i = 0; i < DEFS.length; i++) {
      for (var j = 0; j < DEFS[i].kw.length; j++) if (t.indexOf(DEFS[i].kw[j]) >= 0) { out.push(DEFS[i].key); break; }
    }
    return out;
  }
  function autoTags(a) {
    var byTitle = scanTags(a.title || "");
    if (byTitle.length) return byTitle;
    var byBody = scanTags((a.decision || "") + " " + (a.summary || ""));
    return byBody.length ? byBody : ["기타"];
  }
  function autoCat(a) { return autoTags(a)[0]; }
  // 안건의 실제 주제 목록: 직접 지정(tags) > 이전 버전의 단일 category > 자동 분류.
  // 과거의 포괄 태그(기타·저수조/청소 혼합)는 현재 제목과 내용으로 다시 판정한다.
  function tagsOf(a) {
    var stored = TAXONOMY && TAXONOMY.resolveStored ? TAXONOMY.resolveStored(a, autoTags) : null;
    return stored || autoTags(a);
  }
  window.autoTags = autoTags; window.autoCategory = autoCat; window.TOPIC_KEYS = DEFS.map(function (d) { return d.key; }).concat(["기타"]);

  var cache = null, sel = [], query = "", bodyFilter = "전체"; // bodyFilter: ③ 회의체 필터 (v43)
  var sortDesc = (function () { try { return localStorage.getItem("sandle_topic_list_desc") !== "0"; } catch (e) { return true; } })(); // 안건 목록 정렬: 기본 최신순, 선택 기억 (v39)
  // ---- 시스템 레코드 (주제 흐름 요약 저장소) ----
  // 요약문은 기존 저장 API로 특수 레코드(id=topic_summaries_v1)에 보관한다. 회의록 목록·주제 집계에서는 제외. (v31)
  var SUM_ID = "topic_summaries_v1";
  function isSystemRecord(it) { return !!it && /^(topic_summaries|roster_history|notices_v1|checks_v1)/.test(String(it.id || "")); }
  window.isSystemRecord = isSystemRecord;
  function apiPost(payload) { var c = cfg(); payload.token = c.token; return fetch(c.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) }).then(function (r) { return r.json(); }); }

  function pushRecord(out, rec, fallbackName) {
    if (isSystemRecord(rec)) return;
    try {
      var st = JSON.parse(rec.json || "{}");
      var mn = (st.meeting && st.meeting.name) || rec.name || fallbackName || "";
      var md = (st.meeting && st.meeting.date) || rec.date || "";
      var body = (st.meeting && st.meeting.body === "임차") || /임차인대표회의/.test(mn) ? "임차" : "입대의"; // v43 회의체
      (st.agendas || []).forEach(function (a, i) { out.push({ mId: rec.id || "", mName: mn, mDate: md, body: body, agenda: a, idx: i }); });
    } catch (e) {}
  }
  // 안건 고유 키: 회의록 id + 안건 id. 요약이 어떤 안건까지 반영했는지 기록하는 데 쓴다.
  function agendaKey(x) { return (x.mId || "") + "/" + (x.agenda && x.agenda.id ? x.agenda.id : ("i" + x.idx)); }
  // ---- 데이터 적재 (v34: 즉시 표시 + 백그라운드 갱신) ----
  // 1) 이 브라우저에 저장된 사본(localStorage) + data.json(정적, 매일 자동 재발행)으로 즉시 구성해 바로 그린다.
  // 2) 그 뒤 클라우드 목록(1회 호출)과 updatedAt을 비교해 바뀐 회의록만 개별로 받아 갱신한다.
  //    → 회의록이 10년치로 늘어도 평소 호출 수는 목록 1회 + 최근 변경분 몇 건. 목록은 접속 시 받은 것을 재사용한다.
  var REC_CACHE_KEY = "sandle_topic_records_v1";
  var recMap = null, refreshing = false, lastRefreshAt = 0;
  function loadRecCache() { try { return JSON.parse(localStorage.getItem(REC_CACHE_KEY)) || {}; } catch (e) { return {}; } }
  function saveRecCache() { try { localStorage.setItem(REC_CACHE_KEY, JSON.stringify(recMap || {})); } catch (e) { /* 용량 초과 등: 캐시 없이 동작 */ } }
  function isNewer(a, b) { return (new Date(a || 0) - new Date(b || 0)) > 1000; }
  function mergeRec(rec) {
    if (!rec || !rec.id || isSystemRecord(rec) || !rec.json) return false;
    var cur = recMap[rec.id];
    if (cur && !isNewer(rec.updatedAt, cur.updatedAt)) return false;
    recMap[rec.id] = { id: rec.id, name: rec.name || "", date: rec.date || "", updatedAt: rec.updatedAt || "", json: rec.json };
    return true;
  }
  function rebuildCache() {
    var out = [];
    Object.keys(recMap || {}).forEach(function (k) { pushRecord(out, recMap[k]); });
    cache = out;
  }
  // 명단 색인 (v48): 전체 회의록(사본)의 기수별 명단에서 "성명 → 재임 기수"를 만든다. ⑥ 임기 회차 계산에 쓴다.
  // 열린 회의록의 명단 스냅샷만 보면 다른 기수 재임을 놓치므로(임차 5기→6기 연임이 1회차로 보이던 문제) 전체 회의록을 본다.
  var rosterIdx = null, rosterIdxSig = "";
  function rosterIndex() {
    var ids = Object.keys(recMap || {});
    var sig = ids.map(function (k) { return k + "@" + (recMap[k].updatedAt || ""); }).join(",");
    if (rosterIdx && sig === rosterIdxSig) return rosterIdx;
    var idx = {}; // 성명 → { o:{기수:true}, t:{기수:true} }  (o=입대의, t=임차)
    ids.forEach(function (k) {
      var st; try { st = JSON.parse(recMap[k].json || "{}"); } catch (e) { return; }
      var ro = st && st.rosters; if (!ro) return;
      Object.keys(ro).forEach(function (rk) {
        var tenant = rk.charAt(0) === "t"; var n = parseInt(rk.replace(/^t/, ""), 10); if (!n) return;
        (ro[rk] || []).forEach(function (r) { var nm = String((r && r.name) || "").trim(); if (!nm) return; var e = idx[nm] = idx[nm] || { o: {}, t: {} }; (tenant ? e.t : e.o)[n] = true; });
      });
    });
    rosterIdx = idx; rosterIdxSig = sig; return idx;
  }
  function termsOf(name, tenant) {
    if (recMap === null) { try { quickBuild(); } catch (e) { return []; } }
    var e = rosterIndex()[String(name || "").trim()];
    return e ? Object.keys(tenant ? e.t : e.o).map(Number).sort(function (a, b) { return a - b; }) : [];
  }
  // 사본(localStorage + data.json)만으로 즉시 구성
  function quickBuild() {
    if (recMap === null) {
      recMap = {};
      var ls = loadRecCache(); Object.keys(ls).forEach(function (k) { mergeRec(ls[k]); });
    }
    var sd = (window.StaticData && window.StaticData.map) || {};
    Object.keys(sd).forEach(function (k) { mergeRec(sd[k]); });
    rebuildCache();
  }
  // 클라우드 목록과 대조해 바뀐 회의록만 받아온다. cb(changed)
  function refreshFromCloud(cb) {
    if (refreshing) { if (cb) cb(false); return; }
    refreshing = true;
    var done = function (changed) { refreshing = false; lastRefreshAt = Date.now(); if (changed) { rebuildCache(); saveRecCache(); } if (cb) cb(changed); };
    var useList = function (items) {
      if (!items) { done(false); return; } // 목록 실패: 사본 유지
      var sumItem = null, ids = {}, toFetch = [];
      items.forEach(function (it) {
        if (!it || !it.id) return;
        if (String(it.id) === SUM_ID) { sumItem = it; return; }
        if (isSystemRecord(it)) return;
        ids[it.id] = 1;
        var cur = recMap[it.id];
        if (!cur || isNewer(it.updatedAt, cur.updatedAt)) toFetch.push(it);
      });
      var changed = false;
      Object.keys(recMap).forEach(function (k) { if (!ids[k]) { delete recMap[k]; changed = true; } }); // 클라우드에서 삭제된 회의록
      refreshSummaries(sumItem);
      if (!toFetch.length) { done(changed); return; }
      var pending = toFetch.length;
      toFetch.forEach(function (it) {
        apiGet({ action: "get", id: it.id }).then(function (r) {
          if (r && r.ok && r.item && mergeRec(r.item)) changed = true;
          if (--pending === 0) done(changed);
        }).catch(function () { if (--pending === 0) done(changed); });
      });
    };
    var peek = (window.Cloud && Cloud.peekList) ? Cloud.peekList() : null;
    if (peek && peek.items && (Date.now() - peek.at) < 15000) { useList(peek.items); return; } // 접속 시 받은 목록 재사용
    apiGet({ action: "list" }).then(function (res) { useList((res && res.ok) ? (res.items || []) : null); })
      .catch(function () { done(false); });
  }
  function loadAll(cb) {
    var start = function () {
      quickBuild();
      if (cb) cb(); // 사본으로 즉시 표시
      refreshFromCloud(function () { render(); }); // 확인이 끝나면 결과·상태 표시 갱신
    };
    if (window.StaticData && window.StaticData.ready) window.StaticData.ready.then(start, start);
    else start();
  }
  function allTags() {
    var s = {};
    (cache || []).forEach(function (x) { tagsOf(x.agenda).forEach(function (t) { s[t] = 1; }); });
    return Object.keys(s);
  }
  function matchesQuery(x) {
    if (!query) return true;
    var a = x.agenda, q = query.toLowerCase();
    return [a.title || "", a.summary || "", a.decision || "", x.mName || ""].join(" ").toLowerCase().indexOf(q) >= 0;
  }
  // ---- 주제 흐름 요약 (v31) ----
  // summaries = { version, updatedAt, topics: { "<주제>" | "__all__": { text, basedOn:[안건키...], count, updatedAt, by } } }
  // 요약문은 Claude Code가 작성해 TopicSummaries.save()로 저장한다. 앱은 표시와 "이후 추가된 안건(미반영)" 판정만 담당.
  var SUM_CACHE_KEY = "sandle_topic_summaries_cache_v1"; // {updatedAt, data} — 이 브라우저 사본 (v34)
  var summaries = null, summariesLoading = false, summariesUpdatedAt = null;
  function loadSumCache() {
    try { var c = JSON.parse(localStorage.getItem(SUM_CACHE_KEY)); if (c && c.data && c.data.topics) { summaries = c.data; summariesUpdatedAt = c.updatedAt || null; return true; } } catch (e) {}
    return false;
  }
  function saveSumCache(data, updatedAt) {
    summaries = data; summariesUpdatedAt = updatedAt || null;
    try { localStorage.setItem(SUM_CACHE_KEY, JSON.stringify({ updatedAt: updatedAt || null, data: data })); } catch (e) {}
  }
  function fetchSummaries(cb) {
    if (summariesLoading) return; // 진행 중인 요청이 끝나면 그쪽에서 다시 그린다
    summariesLoading = true;
    var mainUpdated = null;
    apiGet({ action: "get", id: SUM_ID }).then(function (r) {
      var s = null;
      mainUpdated = (r && r.item && r.item.updatedAt) || null;
      try { if (r && r.ok && r.item) s = JSON.parse(r.item.json || "{}"); } catch (e) {}
      // 조각 저장(v52): 본 레코드가 {chunked:true, parts:N}이면 _p1.._pN 을 차례로 받아 이어 붙인다
      if (s && s.chunked && s.parts > 0) {
        var seq = Promise.resolve(""), n = s.parts;
        for (var i = 1; i <= n; i++) (function (idx) {
          seq = seq.then(function (acc) { return apiGet({ action: "get", id: SUM_ID + "_p" + idx }).then(function (pr) { if (!(pr && pr.ok && pr.item)) throw new Error("조각 " + idx + " 없음"); return acc + String(pr.item.json || ""); }); });
        })(i);
        return seq.then(function (full) { try { return JSON.parse(full); } catch (e) { return null; } });
      }
      return s;
    }).then(function (s) {
      saveSumCache((s && s.topics) ? s : { version: 1, topics: {} }, mainUpdated);
      summariesLoading = false; if (cb) cb();
    }).catch(function () { if (summaries === null) summaries = { version: 1, topics: {} }; summariesLoading = false; if (cb) cb(); });
  }
  // 처음: 이 브라우저 사본이 있으면 즉시 사용(클라우드 대조는 refreshFromCloud가), 없으면 클라우드에서 받아온다
  function loadSummaries(cb) {
    if (summaries === null && loadSumCache()) { if (cb) cb(); return; }
    fetchSummaries(cb);
  }
  // 목록의 updatedAt과 비교해 바뀐 경우에만 다시 받아온다
  function refreshSummaries(sumItem) {
    if (!sumItem) { if (summaries === null) summaries = { version: 1, topics: {} }; return; }
    if (summaries !== null && summariesUpdatedAt && !isNewer(sumItem.updatedAt, summariesUpdatedAt)) return;
    fetchSummaries(render);
  }
  function itemsFor(tag) {
    return (cache || []).filter(function (x) { return tag === "__all__" || (tag === "__tenant__" ? (x.body || "입대의") === "임차" : tagsOf(x.agenda).indexOf(tag) >= 0); })
      .sort(function (a, b) { return String(a.mDate).localeCompare(String(b.mDate)); });
  }
  // 안건 내용 지문: 회의 전 안건명만 있다가 나중에 요지·의결이 채워지는 경우도 '변경'으로 잡기 위함
  function strHash(s) { var h = 5381, i; s = String(s || ""); for (i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function agendaSig(x) { var a = x.agenda || {}; return agendaKey(x) + "#" + strHash((a.title || "") + "\n" + (a.summary || "") + "\n" + (a.decision || "") + "\n" + (a.followup || "")); }
  function keysFor(tag) { return itemsFor(tag).map(agendaSig); }
  function staleInfo(tag) {
    var s = summaries && summaries.topics && summaries.topics[tag];
    var cur = itemsFor(tag);
    if (!s) return { has: false, total: cur.length, added: cur, changed: [], removed: [] };
    var based = {}; (s.basedOn || []).forEach(function (k) { var p = String(k).split("#"); based[p[0]] = p[1] || ""; });
    var curSet = {}; cur.forEach(function (x) { curSet[agendaKey(x)] = 1; });
    var added = [], changed = [];
    cur.forEach(function (x) {
      var k = agendaKey(x);
      if (!(k in based)) added.push(x);
      else if (based[k] && based[k] !== agendaSig(x).split("#")[1]) changed.push(x);
    });
    return {
      has: true, s: s, total: cur.length, added: added, changed: changed,
      removed: Object.keys(based).filter(function (k) { return !curSet[k]; })
    };
  }
  function fmtDate(iso) { if (!iso) return ""; var d = new Date(iso); if (isNaN(d.getTime())) return String(iso).slice(0, 10); var p = function (n) { return String(n).padStart(2, "0"); }; return d.getFullYear() + "." + p(d.getMonth() + 1) + "." + p(d.getDate()); }
  // 주제 흐름 요약 본문 렌더 (v35): '현재 상태' 줄을 맨 위에 강조하고, 날짜 글머리 타임라인은 최신순/오래된순 선택
  var FLOW_ORDER_KEY = "sandle_topic_flow_desc";
  var flowDesc = (function () { try { return localStorage.getItem(FLOW_ORDER_KEY) !== "0"; } catch (e) { return true; } })(); // 기본: 최신순
  // 주제 흐름 요약 렌더링 (v51): 읽기 쉬운 3단 구조 + 펼치기
  //  ① 현재 상태(상자) ⑤ "## 요점" 구간(항상 펼침, 3~5줄) ⑥ 시간 흐름 — 날짜 글머리("YY.MM …")를 연도별로 묶어
  //     <details>로 접고, 가장 최근 연도만 펼친다. 글머리 하나하나는 2줄로 접어 두고(긴 문장) 누르면 펼친다.
  //  날짜 글머리가 아닌 구간(전체 요약의 연도별 서술 등)은 그대로 목록으로 보이되 역시 2줄 접기 적용.
  var FLOW_OPEN_KEY = "sandle_topic_flow_open_v1"; // 연도 그룹 펼침 상태 기억 {tag: {year: true}}
  function flowOpenState() { try { return JSON.parse(localStorage.getItem(FLOW_OPEN_KEY)) || {}; } catch (e) { return {}; } }
  function flowItemHtml(b) {
    // "25.06 정기: 내용" → 날짜·회의 종류를 칩으로, 나머지를 본문으로
    var m = String(b).match(/^(\d{2}\.\d{2}(?:\s*[^:：]{0,14})?)\s*[:：]\s*([\s\S]*)$/);
    var chip = m ? m[1] : "", body = m ? m[2] : String(b);
    return '<li class="tl-li" onclick="Topic.flowToggleItem(event,this)">' + (chip ? '<span class="tl-date">' + esc(chip) + '</span>' : '') +
      '<span class="tl-body">' + esc(body) + '</span><span class="tl-more" title="펼치기/접기"></span></li>';
  }
  function flowListHtml(bullets) { return '<ul class="tl-list">' + bullets.map(flowItemHtml).join("") + '</ul>'; }
  // 회의체 필터에 맞춰 요약을 줄 단위로 거른다 (v63): 날짜 글머리("- YY.MM …:")의 회의 표시(첫 콜론 앞)를 보고
  // 임차만 적힌 줄은 입대의 화면에서, 임차가 없는 줄은 임차 화면에서 숨긴다("25.02 정기 / 25.02 임차" 병행 줄은 둘 다 표시).
  // "## " 소제목 구간도 한쪽 회의체 전용(임차/입대의 표기)이면 통째로 숨긴다. 요점·현재 상태 줄은 공통이라 그대로 둔다.
  function flowBodyFilter(text, tag) {
    if (bodyFilter === "전체" || tag === "__tenant__") return text; // 임차 전용 개요는 통째로 임차 것 (v64)
    var tenantMode = bodyFilter === "임차";
    var out = [], skipSec = false;
    String(text || "").split(/\r?\n/).forEach(function (line) {
      var s = line.trim();
      if (s.indexOf("## ") === 0) {
        var head = s.slice(3), headT = /임차/.test(head), headA = /입대의|입주자대표/.test(head);
        skipSec = tenantMode ? (headA && !headT) : (headT && !headA);
        if (!skipSec) out.push(line);
        return;
      }
      if (skipSec) return;
      var m = s.match(/^[-•·]\s*(\d{2}\.\d{2}[^:：]*)[:：]/);
      if (m) {
        var segs = m[1].replace(/\([^)]*\)/g, "").split("/");
        var hasT = segs.some(function (x) { return /임차/.test(x); });
        var hasA = segs.some(function (x) { return !/임차/.test(x); });
        if (tenantMode ? !hasT : !hasA) return;
      } else if (/^[-•·]\s/.test(s) && !/^[-•·]\s*현재\s*상태/.test(s)) {
        // 날짜 표기가 없는 글머리(요점·관련 등, v64): 임차 화면에서는 임차를 언급한 줄만,
        // 입대의 화면에서는 "임차:"로 시작하는 임차 전용 줄을 숨긴다. 현재 상태 줄은 공통.
        if (tenantMode ? !/임차/.test(s) : /^[-•·]\s*임차\s*[:：]/.test(s)) return;
      }
      out.push(line);
    });
    return out.join("\n");
  }
  function renderFlowText(text, tag) {
    tag = tag || "";
    var lines = String(text || "").split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var status = [], sections = [], cur = { head: "", paras: [], bullets: [] };
    lines.forEach(function (s) {
      if (/^(?:[-•·]\s*)?현재\s*상태\s*[:：]/.test(s)) { status.push(s.replace(/^(?:[-•·]\s*)?현재\s*상태\s*[:：]\s*/, "")); return; }
      if (s.indexOf("## ") === 0) { if (cur.head || cur.paras.length || cur.bullets.length) sections.push(cur); cur = { head: s.slice(3), paras: [], bullets: [] }; return; }
      if (/^[-•·] /.test(s)) { cur.bullets.push(s.slice(2)); return; }
      cur.paras.push(s);
    });
    sections.push(cur);
    var isDated = function (b) { return /^\d{2}\.\d{2}/.test(b); };
    var isTimeline = function (bs) { var d = bs.filter(isDated).length; return bs.length >= 2 && d >= Math.ceil(bs.length * 0.6); };
    var anyTimeline = sections.some(function (sc) { return isTimeline(sc.bullets); });
    var openMap = flowOpenState()[tag] || null; // null = 기본(최근 연도만)
    var html = "";
    if (status.length) html += '<div class="topic-flow-status"><span class="topic-flow-status-label">현재 상태</span>' + status.map(esc).join("<br>") + '</div>';
    if (anyTimeline) {
      html += '<div class="topic-flow-tl-head"><span class="small">시간 흐름 · 연도별로 접혀 있습니다 · ' + (flowDesc ? '최신순' : '오래된순') + '</span><span style="display:flex;gap:4px;flex-wrap:wrap">' +
        '<button type="button" class="btn tag-btn" onclick="Topic.flowOpenAll(true)">모두 펼치기</button>' +
        '<button type="button" class="btn tag-btn" onclick="Topic.flowOpenAll(false)">모두 접기</button>' +
        '<button type="button" class="btn tag-btn" onclick="Topic.flowOrder()">' + (flowDesc ? '오래된순으로 보기 ↑' : '최신순으로 보기 ↓') + '</button></span></div>';
    }
    var isKeySec = function (sc) { return /^(요점|핵심|한눈에)/.test(sc.head || ""); };
    // 최신순이면 구간 순서도 뒤집되, '요점' 구간은 항상 맨 위에 둔다
    var keySecs = sections.filter(isKeySec), restSecs = sections.filter(function (sc) { return !isKeySec(sc); });
    var secs = keySecs.concat((anyTimeline && flowDesc && restSecs.length > 1) ? restSecs.slice().reverse() : restSecs);
    secs.forEach(function (sc) {
      var isKey = isKeySec(sc);
      if (sc.head) html += '<div class="topic-flow-h' + (isKey ? ' key' : '') + '">' + esc(sc.head) + '</div>';
      sc.paras.forEach(function (p) { html += '<p>' + esc(p) + '</p>'; });
      if (!sc.bullets.length) return;
      if (isKey) { html += '<ul class="tl-key">' + sc.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join("") + '</ul>'; return; }
      if (!isTimeline(sc.bullets)) { html += '<div class="tl-plain">' + flowListHtml(sc.bullets) + '</div>'; return; }
      // 연도별 묶기 (YY.MM → 20YY). 날짜 없는 글머리는 '관련' 묶음으로 맨 뒤.
      var groups = {}, order = [], misc = [];
      sc.bullets.forEach(function (b) {
        var m = b.match(/^(\d{2})\.(\d{2})/);
        if (!m) { misc.push(b); return; }
        var y = "20" + m[1];
        if (!groups[y]) { groups[y] = []; order.push(y); }
        groups[y].push(b);
      });
      order.sort(); if (flowDesc) order.reverse();
      var latest = order.length ? (flowDesc ? order[0] : order[order.length - 1]) : "";
      order.forEach(function (y) {
        var bs = flowDesc ? groups[y].slice().reverse() : groups[y];
        var open = openMap ? !!openMap[y] : (y === latest);
        html += '<details class="tl-year"' + (open ? ' open' : '') + ' data-year="' + y + '" ontoggle="Topic.flowYearToggle(this)"><summary><b>' + y + '년</b> <span class="small">' + bs.length + '건</span>' +
          '<span class="tl-year-peek">' + esc(peekOf(bs)) + '</span></summary>' + flowListHtml(bs) + '</details>';
      });
      if (misc.length) html += '<div class="tl-misc"><div class="small" style="font-weight:700;margin:6px 0 2px">관련·참고</div>' + flowListHtml(misc) + '</div>';
    });
    return '<div class="topic-flow-text" data-tag="' + esc(tag) + '">' + html + '</div>';
  }
  // 접힌 연도 요약줄: 그 해 글머리의 월 칩만 나열 (예: 01·02 임시·03 …)
  function peekOf(bs) {
    var chips = bs.map(function (b) { var m = b.match(/^\d{2}\.(\d{2})(?:\s*([^:：]{0,6}))?\s*[:：]/); return m ? (m[1] + (m[2] ? " " + m[2].trim() : "")) : ""; }).filter(Boolean);
    var s = chips.join(" · "); return s.length > 70 ? s.slice(0, 70) + "…" : s;
  }
  // 렌더 후: 2줄을 넘는 글머리에만 '더보기' 표시
  function applyFlowClamp(root) {
    if (!root) return;
    root.querySelectorAll("li.tl-li").forEach(function (li) {
      var body = li.querySelector(".tl-body"); if (!body) return;
      li.classList.remove("clampable");
      if (body.scrollHeight > body.clientHeight + 2) li.classList.add("clampable");
    });
  }
  // 요약문 간이 서식: "## " 소제목, "- " 글머리, 빈 줄 = 문단 구분
  function fmtText(t) {
    var lines = String(t || "").split(/\r?\n/), html = "", inList = false;
    var closeList = function () { if (inList) { html += "</ul>"; inList = false; } };
    lines.forEach(function (ln) {
      var s = ln.trim();
      if (!s) { closeList(); return; }
      if (s.indexOf("## ") === 0) { closeList(); html += '<div class="topic-flow-h">' + esc(s.slice(3)) + '</div>'; return; }
      if (/^[-•·] /.test(s)) { if (!inList) { html += "<ul>"; inList = true; } html += "<li>" + esc(s.slice(2)) + "</li>"; return; }
      closeList(); html += "<p>" + esc(s) + "</p>";
    });
    closeList();
    return html;
  }
  function renderFlow() {
    var flow = document.getElementById("topicFlow");
    if (!flow) return;
    if (sel.length > 1 || query) { flow.innerHTML = ""; return; }
    if (summaries === null) { flow.innerHTML = '<div class="topic-flow empty">주제 흐름 요약 불러오는 중…</div>'; loadSummaries(render); return; }
    // 회의체 필터가 '임차'이면 임차 전용 개요 키(__tenant__)를 쓴다 (v45). 주제별 요약은 회의체 공통.
    var tag = sel.length ? sel[0] : (bodyFilter === "임차" ? "__tenant__" : "__all__");
    var label = sel.length ? sel[0] : (bodyFilter === "임차" ? "임차인대표회의 전체" : "전체");
    if (bodyFilter !== "전체" && (sel.length || bodyFilter === "입대의")) label += " — " + bodyFilter + " 회의만 표시"; // 회의체 필터 연동 (v63)
    var info = staleInfo(tag);
    var hint = 'Claude Code(PC)에서 <b>“요약 갱신해줘”</b>라고 하면 새 안건만 반영해 갱신됩니다.';
    if (!info.has) {
      flow.innerHTML = '<div class="topic-flow empty"><b>주제 흐름 요약 — ' + esc(label) + '</b><span class="small"> · 안건 ' + info.total + '건</span><div style="margin-top:4px">아직 이 주제의 흐름 요약이 없습니다. ' + hint + '</div></div>';
      return;
    }
    var s = info.s;
    var stale = "";
    if (info.added.length || info.changed.length || info.removed.length) {
      var rows = info.added.map(function (x) { return { x: x, tag: "추가" }; }).concat(info.changed.map(function (x) { return { x: x, tag: "내용 변경" }; }));
      var list = rows.slice(0, 6).map(function (r) { return '<li>' + esc(r.x.mDate) + ' · ' + esc(r.x.agenda.title || "(제목 없음)") + ' <span style="color:#9a7b12">(' + r.tag + ')</span></li>'; }).join("");
      if (rows.length > 6) list += '<li>… 외 ' + (rows.length - 6) + '건</li>';
      var parts = [];
      if (info.added.length) parts.push('안건 <b>' + info.added.length + '건 추가</b>');
      if (info.changed.length) parts.push('<b>' + info.changed.length + '건 내용 변경</b>(요지·의결 기입 등)');
      if (info.removed.length) parts.push('반영됐던 안건 ' + info.removed.length + '건 삭제');
      stale = '<div class="topic-flow-stale">⚠ 요약 작성 이후 ' + parts.join(', ') +
        ' — <b>요약 미반영</b>. ' + hint + (list ? '<ul>' + list + '</ul>' : '') + '</div>';
    }
    flow.innerHTML = '<div class="topic-flow' + (stale ? ' stale' : '') + '">' +
      '<div class="topic-flow-head"><b>주제 흐름 요약 — ' + esc(label) + '</b>' +
        '<span class="small">기준 안건 ' + (s.count != null ? s.count : (s.basedOn || []).length) + '건 · ' + esc(fmtDate(s.updatedAt)) + ' 작성' + (s.by ? ' · ' + esc(s.by) : '') + (stale ? '' : ' · <span class="topic-flow-ok">최신</span>') + '</span></div>' +
      renderFlowText(flowBodyFilter(s.text, tag), tag) + stale + '</div>'; // 회의체 필터 적용 (v63)
    flowRenderedAt = Date.now();
    applyFlowClamp(flow); // 2줄 넘는 글머리에만 '더보기' (v51)
  }
  var flowRenderedAt = 0;
  window.TopicSummaries = {
    id: SUM_ID,
    // 데이터(안건 전체 + 요약)가 준비되면 cb 실행
    ready: function (cb) { var go = function () { if (summaries === null) loadSummaries(cb); else if (cb) cb(); }; if (cache === null) loadAll(go); else go(); },
    get: function () { return summaries; },
    tags: function () { return allTags(); },
    keysFor: keysFor,
    // 주제별 현황: {has, total, added, removed} (added/removed는 건수)
    stale: function () { var out = {}; allTags().concat(["__all__", "__tenant__"]).forEach(function (t) { var i = staleInfo(t); out[t] = { has: i.has, total: i.total, added: i.added.length, changed: i.changed.length, removed: i.removed.length, updatedAt: i.has ? i.s.updatedAt : null }; }); return out; },
    // 요약 작성용 원문: 주제의 안건을 시간순으로. onlyNew=true면 요약 이후 추가·내용변경된 안건만
    dump: function (tag, onlyNew) {
      var info = staleInfo(tag);
      var arr = onlyNew ? info.added.concat(info.changed) : itemsFor(tag);
      return arr.map(function (x) { return { key: agendaKey(x), meeting: x.mName, date: x.mDate, title: x.agenda.title || "", tags: tagsOf(x.agenda), summary: x.agenda.summary || "", decision: x.agenda.decision || "", followup: x.agenda.followup || "" }; });
    },
    // 저장: topics = { "<주제>": "요약문" | {text:"요약문"} }. basedOn/count/updatedAt은 현재 안건 기준으로 자동 기록. 관리자 비밀번호 필요.
    save: function (topics, by) {
      var key = ""; try { key = localStorage.getItem("sandle_admin_key") || ""; } catch (e) {}
      if (!key) return Promise.reject(new Error("관리자 비밀번호가 이 기기에 없습니다"));
      var cur = summaries || { version: 1, topics: {} };
      var now = new Date().toISOString();
      Object.keys(topics || {}).forEach(function (t) {
        var v = topics[t]; var text = (v && typeof v === "object") ? String(v.text || "") : String(v || "");
        var keys = keysFor(t);
        cur.topics[t] = { text: text, basedOn: keys, count: keys.length, updatedAt: now, by: by || "Claude Code" };
      });
      cur.version = 1; cur.updatedAt = now;
      // 조각 저장 (v52): 구글 시트 셀 한도(50,000자) 대비 — v83부터 30,000자(여유 40%)를 넘으면 _p1.._pN 레코드로 나눠 저장하고
      // 본 레코드에는 {chunked:true, parts:N}만 둔다. 조각을 먼저 저장하고 본 레코드를 마지막에 저장해 읽는 쪽이 깨진 상태를 보지 않게 한다.
      var json = JSON.stringify(cur), CH = 30000, parts = [], main = json;
      if (json.length > CH) {
        var i = 0;
        while (i < json.length) { var end = Math.min(i + CH, json.length); var c = json.charCodeAt(end - 1); if (end < json.length && c >= 0xD800 && c <= 0xDBFF) end--; parts.push(json.slice(i, end)); i = end; }
        main = JSON.stringify({ version: 1, chunked: true, parts: parts.length, updatedAt: now, totalLen: json.length });
      }
      var seq = Promise.resolve();
      parts.forEach(function (p, idx) {
        seq = seq.then(function () {
          return apiPost({ action: "save", record: { id: SUM_ID + "_p" + (idx + 1), name: "주제 흐름 요약 (시스템, 조각 " + (idx + 1) + "/" + parts.length + ")", date: "", json: p }, adminKey: key })
            .then(function (res) { if (!(res && res.ok)) throw new Error((res && res.error) || ("조각 " + (idx + 1) + " 저장 실패")); });
        });
      });
      return seq.then(function () {
        return apiPost({ action: "save", record: { id: SUM_ID, name: "주제 흐름 요약 (시스템)", date: "", json: main }, adminKey: key });
      }).then(function (res) {
        if (!(res && res.ok)) throw new Error((res && res.error) || "저장 실패");
        saveSumCache(cur, null); render(); return res; // updatedAt은 다음 목록 대조 때 서버값으로 맞춰짐
      });
    }
  };
  function tagChip(t, on) {
    return '<button type="button" class="topic-tag' + (on ? ' on' : '') + '" onclick="Topic.pick(this.getAttribute(\'data-c\'))" data-c="' + esc(t) + '">' + esc(t) + '</button>';
  }
  function render() {
    var chips = document.getElementById("topicChips"), result = document.getElementById("topicResult"), summary = document.getElementById("topicSummary");
    if (!chips) return;
    if (cache === null) { chips.innerHTML = ""; if (summary) summary.textContent = ""; result.innerHTML = '<div style="padding:24px;color:#999;text-align:center">전체 회의록에서 안건을 모으는 중…</div>'; loadAll(render); return; }
    // 주제별 건수 (한 안건이 여러 주제에 속하면 각 주제에 모두 센다)
    var counts = {};
    cache.forEach(function (x) { tagsOf(x.agenda).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
    var tags = Object.keys(counts).sort(function (a, b) { return (counts[b] - counts[a]) || a.localeCompare(b); });
    sel = sel.filter(function (t) { return counts[t]; });
    // 회의체 필터 (v43): 전체 / 입대의 / 임차 — 건수·목록 모두 필터 기준으로
    var scoped = cache.filter(function (x) { return bodyFilter === "전체" || (x.body || "입대의") === bodyFilter; });
    var bodyRow = '<div style="display:flex;gap:6px;flex-wrap:wrap;width:100%;margin-bottom:4px">' + ["전체", "입대의", "임차"].map(function (b) {
      var n = b === "전체" ? cache.length : cache.filter(function (x) { return (x.body || "입대의") === b; }).length;
      return '<button type="button" class="btn' + (bodyFilter === b ? ' gold' : '') + '" style="padding:6px 12px;font-size:12px" onclick="Topic.setBody(\'' + b + '\')">' + (b === "입대의" ? "◆ 입주자대표회의" : b === "임차" ? "◇ 임차인대표회의" : "전체") + ' <b>' + n + '</b></button>';
    }).join("") + '</div>';
    counts = {}; scoped.forEach(function (x) { tagsOf(x.agenda).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
    tags = Object.keys(counts).sort(function (a, b) { return (counts[b] - counts[a]) || a.localeCompare(b); });
    sel = sel.filter(function (t) { return counts[t]; });
    var html = bodyRow + '<button type="button" class="btn' + (sel.length ? '' : ' gold') + '" onclick="Topic.clear()">전체 <b>' + scoped.length + '</b></button>';
    html += tags.map(function (t) {
      var on = sel.indexOf(t) >= 0;
      return '<button type="button" class="btn' + (on ? ' gold' : '') + '" onclick="Topic.toggle(this.getAttribute(\'data-c\'))" data-c="' + esc(t) + '" title="' + (on ? '다시 누르면 전체 보기' : '이 주제만 보기') + '">' + esc(t) + ' <b>' + counts[t] + '</b></button>';
    }).join("");
    chips.innerHTML = html;
    var items = scoped.filter(function (x) {
      var ts = tagsOf(x.agenda);
      for (var i = 0; i < sel.length; i++) if (ts.indexOf(sel[i]) < 0) return false;
      return matchesQuery(x);
    }).sort(function (a, b) {
      var d = String(a.mDate).localeCompare(String(b.mDate));
      return sortDesc ? -d : d;
    });
    if (summary) {
      var what = sel.length ? "‘" + esc(sel[0]) + "’ 안건" : "전체 안건";
      summary.innerHTML = '<span>' + what + " <b>" + items.length + "건</b>" + (query ? ' · 검색 “' + esc(query) + '”' : '') +
        (refreshing ? ' · <span style="color:#bbb">☁ 클라우드 변경분 확인 중…</span>' : (lastRefreshAt ? ' · <span style="color:#9aa68f">☁ 최신</span>' : '')) + '</span>' +
        (items.length > 1 ? '<span class="topic-sort"><span class="small">안건 목록 · ' + (sortDesc ? '최신순' : '오래된순') + '</span> <button type="button" class="btn tag-btn" onclick="Topic.sort()">' + (sortDesc ? '오래된순으로 보기 ↑' : '최신순으로 보기 ↓') + '</button></span>' : '');
    }
    renderFlow();
    result.innerHTML = items.length ? items.map(function (x) {
      var a = x.agenda, ts = tagsOf(x.agenda);
      var body = a.decision || "";
      var extra = "";
      if (!body && a.summary) body = a.summary; // 회의 전(의결 없음)에는 요지를 본문으로
      else if (a.summary) extra = '<details style="margin-top:6px"><summary style="cursor:pointer;font-size:12px;color:#777">안건 요지 보기</summary><div style="font-size:13px;line-height:1.55;color:#3a3f39;white-space:pre-wrap;margin-top:4px">' + esc(a.summary) + '</div></details>';
      return '<div style="border:1px solid #e7e2d8;border-left:4px solid #7f927a;border-radius:0 10px 10px 0;padding:11px 14px;margin-bottom:9px">' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin-bottom:4px"><span style="font-size:11px;color:#8a8f86;font-weight:700">' + esc(x.mName) + ' · ' + esc(x.mDate) + '</span>' + ((x.body || "입대의") === "임차" ? '<span class="body-badge">◇ 임차</span>' : '') +
          '<span class="topic-tags">' + ts.map(function (t) { return tagChip(t, sel.indexOf(t) >= 0); }).join("") + '</span></div>' +
        '<div style="font-weight:800;margin-bottom:4px">' + esc(a.title || "") + '</div>' +
        '<div style="font-size:13px;line-height:1.55;color:#3a3f39;white-space:pre-wrap">' + esc(body) + '</div>' + extra + '</div>';
    }).join("") : '<div style="padding:20px;color:#999">' + (query || sel.length ? '조건에 맞는 안건이 없습니다.' : '안건이 없습니다.') + '</div>';
  }
  window.Topic = {
    render: render,
    pick: function (c) { sel = c ? [c] : []; if (c && window.track) track("topic_pick", { topic: c, via: "card" }); render(); },                             // 한 주제만 보기
    toggle: function (c) { sel = (sel.length && sel[0] === c) ? [] : [c]; if (sel.length && window.track) track("topic_pick", { topic: c, via: "chip" }); render(); }, // 단일 선택: 같은 주제를 다시 누르면 전체로
    clear: function () { sel = []; render(); },
    setBody: function (b) { bodyFilter = b || "전체"; render(); }, // 회의체 필터 (v43)
    search: function (q) { query = String(q || "").trim(); render(); },
    sort: function () { sortDesc = !sortDesc; try { localStorage.setItem("sandle_topic_list_desc", sortDesc ? "1" : "0"); } catch (e) {} render(); }, // 안건 목록 최신순/오래된순 (기억)
    flowOrder: function () { flowDesc = !flowDesc; try { localStorage.setItem(FLOW_ORDER_KEY, flowDesc ? "1" : "0"); } catch (e) {} render(); }, // 흐름 요약 타임라인 최신순/오래된순
    reload: function () { cache = null; render(); },
    knownTags: allTags,
    termsOf: termsOf, // 성명 → 재임 기수 (전체 회의록 명단 색인, v48)
    // 기수 키("4"/"t5")의 명단 — 그 키의 명단이 든 회의록 중 회의일이 가장 최근인 것의 명단 (v59: ③에서 아직 안 연 기수도 채움)
    rosterFor: function (key) {
      if (recMap === null) { try { quickBuild(); } catch (e) { return null; } }
      var best = null, bestDate = "";
      Object.keys(recMap || {}).forEach(function (k) {
        var rec = recMap[k]; var st; try { st = JSON.parse(rec.json || "{}"); } catch (e) { return; }
        var ro = st && st.rosters && st.rosters[key]; if (!ro || !ro.some(function (r) { return String((r && r.name) || "").trim(); })) return;
        var d = (st.meeting && st.meeting.date) || rec.date || "";
        if (!best || String(d) > bestDate) { best = ro; bestDate = String(d); }
      });
      return best ? best.map(function (r) { return { dong: r.dong, role: r.role || "대표", name: r.name || "", unit: r.unit || "" }; }) : null;
    },
    // 흐름 요약 펼치기 (v51)
    flowToggleItem: function (ev, li) { if (ev && ev.target && ev.target.closest && ev.target.closest("a,button")) return; if (!li.classList.contains("clampable") && !li.classList.contains("open")) return; li.classList.toggle("open"); },
    flowYearToggle: function (d) {
      if (Date.now() - flowRenderedAt < 400) { if (d.open) applyFlowClamp(d); return; } // 렌더 직후 초기 open 이벤트는 무시
      var root = d.closest(".topic-flow-text"); var tag = root ? root.getAttribute("data-tag") : "";
      var st = flowOpenState(); var m = {}; (root || d).querySelectorAll("details.tl-year").forEach(function (x) { m[x.getAttribute("data-year")] = !!x.open; }); st[tag] = m;
      try { localStorage.setItem(FLOW_OPEN_KEY, JSON.stringify(st)); } catch (e) {}
      if (d.open) applyFlowClamp(d);
    },
    flowOpenAll: function (open) { var root = document.getElementById("topicFlow"); if (!root) return; root.querySelectorAll("details.tl-year").forEach(function (x) { x.open = !!open; }); applyFlowClamp(root); }
  };
  // 자동 분류 함수(window.autoTags)가 준비된 뒤 ⑦ 안건 카드의 태그 표시를 갱신
  try { if (typeof renderAgendas === "function") renderAgendas(); } catch (e) {}
  // ⑥을 열기 전에 미리 준비(사본 즉시 구성 + 클라우드 변경분 확인 + 요약 사본). 열 때 바로 그려진다. (v34)
  setTimeout(function () { if (cache === null) loadAll(function () { loadSummaries(function () {}); }); }, 1500);
})();
