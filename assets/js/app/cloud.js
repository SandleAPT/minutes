(function () {
  "use strict";
  var DEFAULT_URL = "https://script.google.com/macros/s/AKfycbyhpE-DB5WAAEx7uqTCPwU-e0sPKuupkYN3YoQWALiFWe0IHFNh1y91e1VNtDmMxxoxLA/exec";
  var DEFAULT_TOKEN = "ITDXaUBDTmrz6DbQ3tv9R";
  var CFG_KEY = "sandle_cloud_cfg";

  function stored() { try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { return {}; } }
  function loadCfg() { var s = stored(); return { url: s.url || DEFAULT_URL, token: s.token || DEFAULT_TOKEN }; }
  function saveCfg(cfg) { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }

  // ---- 관리자 비밀번호 (저장·삭제 전용) ----
  // 서버(Apps Script)가 save/delete 요청에 adminKey를 요구한다. 비밀번호는 앱 소스에
  // 없고, 관리자가 기기마다 한 번 입력하면 localStorage에 기억된다. 열람은 자유.
  var ADMIN_LS = "sandle_admin_key";
  var promptUnsupported = false; // 일부 내장 브라우저는 prompt()를 지원하지 않음 → 화면 내 입력창으로 대체 (v29)
  function getAdminKey(promptIfMissing) {
    var k = "";
    try { k = localStorage.getItem(ADMIN_LS) || ""; } catch (e) {}
    if (!k && promptIfMissing) {
      try { k = (prompt("관리자 비밀번호를 입력하세요.\n(회의록 저장·삭제에만 필요하며, 이 기기에 기억됩니다)") || "").trim(); }
      catch (e) { promptUnsupported = true; k = ""; }
      if (k) try { localStorage.setItem(ADMIN_LS, k); } catch (e) {}
    }
    return k;
  }
  // prompt()를 쓸 수 없는 환경용 화면 내 비밀번호 입력창. 입력값은 이 기기에 기억되고 onDone()이 이어서 실행된다.
  function askAdminKeyDialog(onDone) {
    var old = document.getElementById("adminKeyDialog"); if (old) old.remove();
    var bd = document.createElement("div"); bd.id = "adminKeyDialog";
    bd.style.cssText = "position:fixed;inset:0;z-index:10001;background:rgba(30,30,28,.45);display:flex;align-items:center;justify-content:center;padding:16px";
    bd.innerHTML =
      '<div role="dialog" aria-modal="true" style="background:#fff;border-radius:16px;max-width:380px;width:100%;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.25);font-size:14px;line-height:1.6">' +
        '<div style="font-weight:800;font-size:16px;margin-bottom:6px">관리자 비밀번호</div>' +
        '<div style="color:#666;font-size:13px;margin-bottom:12px">회의록 저장·삭제에만 필요하며, 이 기기에 기억됩니다.</div>' +
        '<input id="adminKeyInput" type="password" autocomplete="off" style="width:100%;box-sizing:border-box;padding:10px 12px;font-size:15px;border:1px solid #d9d4c8;border-radius:10px;margin-bottom:14px">' +
        '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" id="adminKeyCancel">취소</button><button class="btn gold" id="adminKeyOk">확인</button></div>' +
      '</div>';
    document.body.appendChild(bd);
    var input = document.getElementById("adminKeyInput");
    function close() { bd.remove(); }
    function ok() {
      var k = (input.value || "").trim();
      if (!k) { input.focus(); return; }
      try { localStorage.setItem(ADMIN_LS, k); } catch (e) {}
      close(); if (onDone) onDone();
    }
    document.getElementById("adminKeyOk").onclick = ok;
    document.getElementById("adminKeyCancel").onclick = function () { close(); toast("취소됨 — 관리자 비밀번호가 필요합니다"); };
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") ok(); else if (e.key === "Escape") close(); });
    setTimeout(function () { input.focus(); }, 50);
  }
  function clearAdminKey() { try { localStorage.removeItem(ADMIN_LS); } catch (e) {} }

  // ---- 정적 데이터 파일 (v83: 연도 샤딩) ----
  // 확정된 회의록은 GitHub Pages의 정적 사본에서 즉시 읽고, 사본에 없거나 클라우드에서 더 최근에
  // 수정된 회의록만 클라우드에서 받아온다. v83부터 data-index.json(작은 목차, no-cache) +
  // data-YYYY.json(연도별, ?v=<그 해 최신 updatedAt> 캐시 키)으로 나눠 — 데이터가 30배가 되어도
  // 방문자는 목차 + 바뀐 연도 파일만 새로 내려받는다. 인덱스가 없으면 구형 단일 data.json으로 폴백.
  window.StaticData = { map: null, ready: null };
  window.StaticData.ready = fetch("data-index.json", { cache: "no-cache" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (idx) {
      if (!(idx && idx.years && idx.years.length)) throw new Error("no-index");
      var m = {};
      return Promise.all(idx.years.map(function (y) {
        return fetch(y.file + "?v=" + encodeURIComponent(y.updatedAt || ""), { cache: "force-cache" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) { if (d && d.items) d.items.forEach(function (it) { if (it && it.id) m[it.id] = it; }); })
          .catch(function () {}); // 한 연도 실패는 그 연도만 클라우드 폴백
      })).then(function () { window.StaticData.map = m; });
    })
    .catch(function () {
      return fetch("data.json", { cache: "no-cache" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (d && d.items) {
            var m = {};
            d.items.forEach(function (it) { if (it && it.id) m[it.id] = it; });
            window.StaticData.map = m;
          }
        })
        .catch(function () {});
    });
  // 정적 사본이 있고, 클라우드 목록상 그보다 새 버전이 없으면 정적 사본을 반환
  function staticFresh(id) {
    var m = window.StaticData && window.StaticData.map;
    var sd = m && m[id];
    if (!sd) return null;
    var li = null;
    if (listCache) for (var i = 0; i < listCache.length; i++) if (listCache[i].id === id) { li = listCache[i]; break; }
    if (li && li.updatedAt && sd.updatedAt && new Date(li.updatedAt) - new Date(sd.updatedAt) > 1000) return null;
    return sd;
  }

  function pad(n) { return String(n).padStart(2, "0"); }
  function fmtWhen(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 16).replace("T", " ");
    return d.getFullYear() + "." + pad(d.getMonth() + 1) + "." + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) { alert(msg); return; }
    t.textContent = msg; t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 2400);
  }

  function currentCloudId() {
    if (!state.cloudId) {
      state.cloudId = "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    }
    return state.cloudId;
  }
  function rerender() {
    var fns = ["renderMeetingControls", "renderMeetingExtras", "renderRepMaster", "renderAttendance", "renderAgendas", "renderMetrics", "renderPreview"];
    fns.forEach(function (n) { if (typeof window[n] === "function") { try { window[n](); } catch (e) {} } });
  }
  function applyLoadedState(parsed, cloudId) {
    state = (typeof migrateState === "function") ? migrateState(parsed) : parsed;
    if (cloudId) state.cloudId = cloudId;
    if (typeof ensureRoster === "function") { try { ensureRoster(state.meeting.termNo); ensureRoster(state.rosterTermNo || state.meeting.termNo); } catch (e) {} }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    rerender();
  }

  function apiGet(cfg, params) {
    var q = Object.keys(params).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); }).join("&");
    return fetch(cfg.url + "?" + q, { method: "GET" }).then(function (r) { return r.json(); });
  }
  function apiPost(cfg, payload) {
    payload.token = cfg.token;
    return fetch(cfg.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) }).then(function (r) { return r.json(); });
  }

  // ---- 저장: 덮어쓰기 가드 → 실제 저장 ----
  // 클라우드에 이 기기의 마지막 동기화보다 새 버전이 있으면(다른 기기에서 저장됨) 바로 덮어쓰지 않고
  // 안내 대화상자를 띄운다. (v29)
  function doSave(retried) {
    if (retried) { doSaveNow(true); return; } // 비밀번호 재시도 경로는 가드 생략
    checkCloudConflict(function (conflict) {
      if (!conflict) { doSaveNow(false); return; }
      showConflictDialog(conflict, function () { doSaveNow(false); });
    });
  }
  function doSaveNow(retried) {
    var cfg = loadCfg();
    var key = getAdminKey(true);
    if (!key) {
      if (promptUnsupported) { askAdminKeyDialog(function () { doSaveNow(retried); }); return; }
      toast("저장 취소됨 — 관리자 비밀번호가 필요합니다"); return;
    }
    try { if (typeof saveState === "function") saveState(); } catch (e) {}
    if (state.draft) delete state.draft; // 클라우드에 저장되면 더 이상 '작성 중'이 아님
    var record = { id: currentCloudId(), name: (state.meeting && state.meeting.name) || "회의록", date: (state.meeting && state.meeting.date) || "", json: JSON.stringify(state) };
    // v82: 구글시트 셀 한도(50,000자) 가드 — 넘으면 서버 저장이 통째로 실패하므로 먼저 막고 안내한다
    if (record.json.length > 49000) {
      alert("이 회의록 데이터가 " + record.json.length.toLocaleString() + "자로 클라우드 저장 한도(약 49,000자)를 넘습니다.\n발언 요지나 원문 전문을 줄이거나 회의록을 나눠 주세요. (구글시트 셀 한도 50,000자)");
      return;
    }
    if (record.json.length > 42000) toast("주의: 회의록 데이터 " + record.json.length.toLocaleString() + "자 — 저장 한도(49,000자)에 가까워지고 있습니다");
    toast("클라우드에 저장 중...");
    apiPost(cfg, { action: "save", record: record, adminKey: key }).then(function (res) {
      if (res && res.ok) {
        state.cloudId = res.id; localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        markSynced({ id: res.id }); // 일단 현재 시각으로 기록, 목록 갱신 후 서버 updatedAt으로 보정
        removeSyncBanner();
        toast("클라우드 저장 완료");
        listCache = null;
        fetchList(function () { markSyncedFromList(res.id); renderArchiveList(); });
        try { if (window.Topic) Topic.reload(); } catch (e2) {}
      }
      else if (res && res.error === "admin_required") { clearAdminKey(); toast("관리자 비밀번호가 올바르지 않습니다"); if (!retried) doSave(true); }
      else toast("저장 실패: " + ((res && res.error) || "알 수 없음"));
    }).catch(function (e) { toast("저장 오류: " + e.message); });
  }
  // 현재 문서(state.cloudId)의 클라우드 버전이 이 기기의 마지막 동기화보다 새로운지 확인.
  // cb(null) = 충돌 없음(또는 판단 불가 → 기존처럼 진행), cb({...}) = 충돌 정보
  function checkCloudConflict(cb) {
    var id = state && state.cloudId;
    if (!id) { cb(null); return; } // 아직 클라우드에 없는 새 문서
    toast("클라우드 버전 확인 중...");
    var cfg = loadCfg();
    apiGet(cfg, { action: "list", token: cfg.token }).then(function (res) {
      var items = (res && res.ok && res.items) || null;
      if (items) { listCache = items; updateCloudLatestInfo(); }
      var li = findListItem(id, items);
      if (!li || !li.updatedAt) return null;
      if (!isCloudNewer(id, li.updatedAt)) return null;
      return new Promise(function (resolve) {
        fetchCloudAgendaCount(cfg, id, function (cnt) {
          var s = getSynced();
          resolve({ id: id, name: li.name || "", updatedAt: li.updatedAt, cloudCount: cnt, syncedAt: (s && s.id === id) ? s.updatedAt : null });
        });
      });
    }).then(
      function (info) { cb(info || null); },
      function () { cb(null); } // 네트워크 실패 시에는 기존 동작대로 저장 시도
    ); // cb는 정확히 한 번만 호출 (cb 내부 예외가 실패 핸들러로 넘어가지 않도록 2인자 then 사용)
  }
  function findListItem(id, items) {
    var arr = items || listCache || [];
    for (var i = 0; i < arr.length; i++) if (arr[i] && arr[i].id === id) return arr[i];
    return null;
  }
  function fetchCloudAgendaCount(cfg, id, cb) {
    apiGet(cfg, { action: "get", token: cfg.token, id: id }).then(function (r) {
      var cnt = null;
      try { cnt = (JSON.parse(r.item.json || "{}").agendas || []).length; } catch (e) {}
      cb(cnt);
    }).catch(function () { cb(null); });
  }
  function localAgendaCount() { try { return (state.agendas || []).length; } catch (e) { return 0; } }
  function showConflictDialog(info, onOverwrite) {
    closeConflictDialog();
    var bd = document.createElement("div");
    bd.id = "cloudConflictDialog";
    bd.style.cssText = "position:fixed;inset:0;z-index:10000;background:rgba(30,30,28,.45);display:flex;align-items:center;justify-content:center;padding:16px";
    var cloudLine = fmtWhen(info.updatedAt) + (info.cloudCount != null ? " · 안건 " + info.cloudCount + "건" : "");
    var localLine = (info.syncedAt ? "마지막 동기화 " + fmtWhen(info.syncedAt) : "이 기기의 동기화 기록 없음") + " · 안건 " + localAgendaCount() + "건";
    bd.innerHTML =
      '<div role="dialog" aria-modal="true" style="background:#fff;border-radius:16px;max-width:460px;width:100%;padding:22px 22px 18px;box-shadow:0 20px 50px rgba(0,0,0,.25);font-size:14px;line-height:1.6">' +
        '<div style="font-weight:800;font-size:16px;margin-bottom:8px">⚠ 클라우드에 더 최신 버전이 있습니다</div>' +
        '<div style="color:#444;margin-bottom:10px">' + esc(info.name || (state.meeting && state.meeting.name) || "") + '</div>' +
        '<table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:13px">' +
          '<tr><td style="padding:4px 0;color:#777;white-space:nowrap;width:70px">☁ 클라우드</td><td style="padding:4px 0"><b>' + esc(cloudLine) + '</b></td></tr>' +
          '<tr><td style="padding:4px 0;color:#777;white-space:nowrap">💻 이 기기</td><td style="padding:4px 0">' + esc(localLine) + '</td></tr>' +
        '</table>' +
        '<div style="color:#8a433d;font-size:13px;margin-bottom:16px">지금 저장하면 클라우드 버전이 <b>이 기기 버전으로 덮어써집니다.</b> 다른 기기에서 입력한 내용이 사라질 수 있습니다.</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">' +
          '<button class="btn" id="cloudConflictCancel">취소</button>' +
          '<button class="btn danger" id="cloudConflictOverwrite">덮어쓰고 저장</button>' +
          '<button class="btn gold" id="cloudConflictLoad">클라우드 버전 불러오기</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bd);
    document.getElementById("cloudConflictCancel").onclick = function () { closeConflictDialog(); toast("저장 취소됨"); };
    document.getElementById("cloudConflictOverwrite").onclick = function () { closeConflictDialog(); onOverwrite(); };
    document.getElementById("cloudConflictLoad").onclick = function () { closeConflictDialog(); removeSyncBanner(); doLoad(loadCfg(), info.id); };
    bd.addEventListener("click", function (e) { if (e.target === bd) { closeConflictDialog(); toast("저장 취소됨"); } });
  }
  function closeConflictDialog() { var d = document.getElementById("cloudConflictDialog"); if (d) d.remove(); }
  function doList() {
    var cfg = loadCfg();
    toast("목록 불러오는 중...");
    apiGet(cfg, { action: "list", token: cfg.token }).then(function (res) {
      if (!res || !res.ok) { toast("목록 실패: " + ((res && res.error) || "연결 확인")); return; }
      showPicker(cfg, res.items || []);
    }).catch(function (e) { toast("목록 오류: " + e.message); });
  }
  function applyLoadedItem(item) {
    var parsed = JSON.parse(item.json || "{}");
    applyLoadedState(parsed, item.id);
    markSynced({ id: item.id, updatedAt: item.updatedAt });
    removeSyncBanner();
    closeOverlay();
    renderArchiveList();
    toast("불러오기 완료: " + (item.name || ""));
    try { if (window.track) track("open_minutes", { name: item.name || "", id: item.id || "" }); } catch (e) {}
  }
  function doLoad(cfg, id) {
    var sd = staticFresh(id);
    if (sd) { try { applyLoadedItem(sd); return; } catch (e) {} }
    toast("불러오는 중...");
    apiGet(cfg, { action: "get", token: cfg.token, id: id }).then(function (res) {
      if (!res || !res.ok || !res.item) { toast("불러오기 실패"); return; }
      applyLoadedItem(res.item);
    }).catch(function (e) {
      // 클라우드 실패 시 정적 사본이라도 사용 (오프라인 대비)
      var m = window.StaticData && window.StaticData.map;
      if (m && m[id]) { try { applyLoadedItem(m[id]); return; } catch (e2) {} }
      toast("불러오기 오류: " + e.message);
    });
  }
  function doDelete(cfg, id, name) {
    if (!confirm("클라우드에서 삭제할까요?\n" + (name || id))) return;
    var key = getAdminKey(true);
    if (!key) { toast("삭제 취소됨 — 관리자 비밀번호가 필요합니다"); return; }
    apiPost(cfg, { action: "delete", id: id, adminKey: key }).then(function (res) {
      if (res && res.ok) { toast("삭제 완료"); doList(); listCache = null; }
      else if (res && res.error === "admin_required") { clearAdminKey(); toast("관리자 비밀번호가 올바르지 않습니다"); }
      else toast("삭제 실패");
    }).catch(function (e) { toast("삭제 오류: " + e.message); });
  }

  var overlay = null;
  function closeOverlay() { if (overlay) { overlay.remove(); overlay = null; } }
  function makeOverlay(innerHtml) {
    closeOverlay();
    overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(30,28,22,.45);display:grid;place-items:center;z-index:99999";
    overlay.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:520px;width:92%;max-height:82vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.25)">' + innerHtml + '</div>';
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeOverlay(); });
    document.body.appendChild(overlay);
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]; }); }
  function escAttr(s) { return String(s == null ? "" : s).replace(/'/g, "\\'").replace(/"/g, "&quot;"); }

  function openMenu() {
    makeOverlay(
      '<div style="padding:20px 22px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center">' +
        '<b style="font-size:17px">\u2601 \ud074\ub77c\uc6b0\ub4dc</b>' +
        '<button onclick="Cloud._close()" style="border:0;background:transparent;font-size:22px;cursor:pointer">&times;</button>' +
      '</div>' +
      '<div style="padding:18px 22px;display:grid;gap:10px">' +
        '<button class="btn primary" style="width:100%" onclick="Cloud._save()">\uc774 \ud68c\uc758\ub85d \ud074\ub77c\uc6b0\ub4dc\uc5d0 \uc800\uc7a5</button>' +
        '<button class="btn" style="width:100%" onclick="Cloud._list()">\uc800\uc7a5\ub41c \ud68c\uc758\ub85d \ubd88\ub7ec\uc624\uae30</button>' +
      '</div>'
    );
  }
  function showPicker(cfg, items) {
    var rows = items.length ? items.map(function (it) {
      return '<div style="display:flex;gap:8px;align-items:center;padding:10px 12px;border:1px solid #eee;border-radius:12px">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(it.name || "(\uc774\ub984\uc5c6\uc74c)") + '</div>' +
          '<div style="font-size:11px;color:#999">' + esc(fmtWhen(it.updatedAt)) + '</div>' +
        '</div>' +
        '<button class="btn" onclick="Cloud._pick(\'' + escAttr(it.id) + '\')">\uc5f4\uae30</button>' +
        '<button class="btn danger" onclick="Cloud._del(\'' + escAttr(it.id) + '\',\'' + escAttr(it.name || "") + '\')">\uc0ad\uc81c</button>' +
      '</div>';
    }).join("") : '<div style="color:#999;text-align:center;padding:24px">\uc800\uc7a5\ub41c \ud68c\uc758\ub85d\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.</div>';
    makeOverlay(
      '<div style="padding:20px 22px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center">' +
        '<b style="font-size:17px">\ud68c\uc758\ub85d \ubd88\ub7ec\uc624\uae30</b>' +
        '<button onclick="Cloud._close()" style="border:0;background:transparent;font-size:22px;cursor:pointer">&times;</button>' +
      '</div>' +
      '<div style="padding:16px 20px;display:grid;gap:8px">' + rows + '</div>'
    );
    Cloud._pick = function (id) { doLoad(cfg, id); };
    Cloud._del = function (id, name) { doDelete(cfg, id, name); };
  }

  var listCache = null, rawListCache = null, rawListAt = 0;
  var archiveBodyFilter = "전체"; // ② 회의체 필터 (v43)
  // 시스템 레코드(주제 흐름 요약 저장소 등)는 회의록 목록에서 제외 (v31)
  function isSysRecord(it) { return !!it && /^(topic_summaries|roster_history|notices_v1|checks_v1)/.test(String(it.id || "")); }
  function staticListFallback() {
    var m = window.StaticData && window.StaticData.map;
    if (!m) return [];
    return Object.keys(m).map(function (k) {
      var it = m[k];
      return { id: it.id, name: it.name, date: it.date, updatedAt: it.updatedAt };
    }).filter(function (it) { return !isSysRecord(it); });
  }
  function fetchList(cb) {
    var cfg = loadCfg();
    apiGet(cfg, { action: "list", token: cfg.token }).then(function (res) {
      var raw = (res && res.ok) ? (res.items || []) : null;
      rawListCache = raw; rawListAt = Date.now(); // 주제별 보기가 같은 목록을 재사용 (중복 호출 방지)
      listCache = (raw || staticListFallback()).filter(function (it) { return !isSysRecord(it); });
      updateCloudLatestInfo();
      if (cb) cb();
    }).catch(function () { listCache = staticListFallback(); updateCloudLatestInfo(); if (cb) cb(); });
  }
  // 사이드바: 클라우드에 저장된 회의록 중 가장 최근 저장 시각 표시 (v29)
  function updateCloudLatestInfo() {
    var el = document.getElementById("cloudLatestInfo");
    if (!el) return;
    var latest = null, name = "";
    (listCache || []).forEach(function (it) {
      if (it && it.updatedAt && (!latest || new Date(it.updatedAt) > new Date(latest))) { latest = it.updatedAt; name = it.name || ""; }
    });
    el.textContent = latest ? ("☁ 클라우드 최신 갱신: " + fmtWhen(latest)) : "☁ 클라우드 최신 갱신: 확인 불가";
    if (name) el.title = "가장 최근 저장된 회의록: " + name;
  }
  // 기록 범위 (v47): 회의체별로 첫 회의 ~ 마지막 회의와 연도별 월 보유 현황을 보여 준다.
  // 어느 달 회의록이 아직 안 들어왔는지(자료 누락 구간)를 한눈에 보기 위한 것. 검색어와 무관하게 전체 목록 기준.
  function coverageHtml(all, isTenant, meetDate) {
    var bodies = archiveBodyFilter === "전체" ? ["입대의", "임차"] : [archiveBodyFilter];
    var out = "";
    bodies.forEach(function (b) {
      var tenant = b === "임차";
      var title = tenant ? "◇ 임차인대표회의" : "◆ 입주자대표회의";
      var its = (all || []).filter(function (it) { return (isTenant(it) ? "임차" : "입대의") === b; });
      var ds = its.map(meetDate).filter(Boolean).sort(function (a, c) { return a - c; });
      if (!ds.length) { out += '<div class="arc-cov' + (tenant ? ' tenant' : '') + '"><div class="arc-cov-head"><b>' + title + '</b> <span style="color:#999">기록 없음</span></div></div>'; return; }
      var have = {};
      ds.forEach(function (d) { var k = d.getFullYear() + "-" + (d.getMonth() + 1); have[k] = (have[k] || 0) + 1; });
      var first = ds[0], last = ds[ds.length - 1];
      var y0 = first.getFullYear(), y1 = last.getFullYear();
      var fmtYM = function (d) { return d.getFullYear() + "." + pad(d.getMonth() + 1); };
      var missing = 0, grid = "";
      for (var y = y0; y <= y1; y++) {
        grid += '<div class="arc-cov-row"><span class="arc-cov-y">' + y + '</span>';
        for (var m = 1; m <= 12; m++) {
          var k = y + "-" + m;
          var outside = (y === y0 && m < first.getMonth() + 1) || (y === y1 && m > last.getMonth() + 1);
          if (!have[k] && !outside) missing++;
          grid += '<span class="arc-cov-m' + (have[k] ? ' on' : (outside ? ' na' : ' gap')) + '" title="' + y + '.' + pad(m) + (have[k] ? ' · ' + have[k] + '건 · 눌러서 열기' : (outside ? '' : ' · 회의록 없음')) + '"' +
            (have[k] ? ' role="button" tabindex="0" onclick="Cloud.openMonth(\'' + b + '\',' + y + ',' + m + ')"' : '') + '>' + m + '</span>'; // 달 칸 = 열기 버튼 (v59)
        }
        grid += '</div>';
      }
      out += '<div class="arc-cov' + (tenant ? ' tenant' : '') + '"><div class="arc-cov-head"><b>' + title + '</b> ' + fmtYM(first) + ' ~ ' + fmtYM(last) + ' · ' + its.length + '건' +
        (missing ? ' <span class="arc-cov-miss">· 사이에 비어 있는 달 ' + missing + '개</span>' : ' <span style="color:#6a9a5a">· 빈 달 없음</span>') + '</div>' + grid + '</div>';
    });
    return '<div class="arc-cov-wrap" title="회의일 기준. 색칠된 달 = 회의록 있음(누르면 열기), 빈 칸 = 회의록 없음(미수집)">' + out + '</div><div id="arcCovPick"></div>';
  }
  // 회의일(없으면 회의명의 연·월)을 Date로 — 목록 항목용 (v59: 달 칸 열기에서도 사용)
  function meetDateOf(it) {
    var d = it && it.date ? new Date(it.date) : null;
    if (d && !isNaN(d.getTime())) return d;
    var m = String((it && it.name) || "").match(/(\d{4})년\s*(\d{1,2})월/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : null;
  }
  // 기록 범위의 달 칸을 눌렀을 때: 그 달 회의록이 1건이면 바로 열고, 여러 건이면 고르는 줄을 보여 준다 (v59)
  function openMonth(body, y, m) {
    var items = (listCache || []).filter(function (it) {
      if (!it || !it.id || isSysRecord(it)) return false;
      if ((/임차인대표회의/.test(String(it.name || "")) ? "임차" : "입대의") !== body) return false;
      var d = meetDateOf(it); return !!d && d.getFullYear() === y && d.getMonth() + 1 === m;
    }).sort(function (a, b) { return (meetDateOf(a) - meetDateOf(b)); });
    var pick = document.getElementById("arcCovPick");
    if (!items.length) { if (pick) pick.innerHTML = ""; return; }
    if (items.length === 1) { if (pick) pick.innerHTML = ""; Cloud._open(items[0].id); return; }
    if (!pick) return;
    pick.innerHTML = '<div class="arc-cov-pick"><span class="small"><b>' + y + '.' + pad(m) + '</b> ' + (body === "임차" ? "◇ 임차인대표회의" : "◆ 입주자대표회의") + ' 회의록 ' + items.length + '건 — 열 회의록을 고르세요</span>' +
      items.map(function (it) { var d = meetDateOf(it); return '<button type="button" class="btn" onclick="Cloud._open(\'' + escAttr(it.id) + '\')">' + esc(it.name || it.id) + (d ? ' <span class="small">(' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + ')</span>' : '') + '</button>'; }).join("") +
      '<button type="button" class="btn" style="margin-left:auto" onclick="document.getElementById(\'arcCovPick\').innerHTML=\'\'">닫기</button></div>';
    pick.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function renderArchiveList() {
    var box = document.getElementById("cloudArchiveList");
    if (!box) return;
    if (listCache === null) { box.innerHTML = '<div style="padding:24px;color:#999;text-align:center">불러오는 중…</div>'; fetchList(renderArchiveList); return; }
    var qEl = document.getElementById("cloudSearch");
    var q = (qEl ? qEl.value : "").trim().toLowerCase();
    var items = listCache.filter(function (it) { return !q || String(it.name || "").toLowerCase().indexOf(q) >= 0; });
    if (archiveBodyFilter !== "전체") items = items.filter(function (it) { return (/임차인대표회의/.test(String(it.name || "")) ? "임차" : "입대의") === archiveBodyFilter; }); // 회의체 필터 (v43)
    // 회의 날짜 기준으로 연도별 묶고, 같은 연도 안에서는 최신 회의가 위로 (v37). 날짜가 없으면 회의명의 연·월로 대체.
    function meetDate(it) {
      var d = it && it.date ? new Date(it.date) : null;
      if (d && !isNaN(d.getTime())) return d;
      var m = String((it && it.name) || "").match(/(\d{4})년\s*(\d{1,2})월/);
      return m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : null;
    }
    function fmtDay(d) { var w = "일월화수목금토"; return d.getFullYear() + "." + pad(d.getMonth() + 1) + "." + pad(d.getDate()) + ".(" + w[d.getDay()] + ")"; }
    var groups = {};
    items.forEach(function (it) {
      var d = meetDate(it);
      var yr = d ? String(d.getFullYear()) : "기타";
      (groups[yr] = groups[yr] || []).push({ it: it, d: d, t: d ? d.getTime() : 0 });
    });
    var years = Object.keys(groups).sort(function (a, b) { return b.localeCompare(a); });
    var cur = (typeof state !== "undefined" && state.cloudId) || "";
    // 회의체 필터 (v43): 전체 / 입대의 / 임차 — 회의명으로 판별
    var isTenant = function (it) { return /임차인대표회의/.test(String((it && it.name) || "")); };
    var html = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' + ["전체", "입대의", "임차"].map(function (b) {
      return '<button type="button" class="btn' + (archiveBodyFilter === b ? ' gold' : '') + '" style="padding:6px 12px;font-size:12px" onclick="Cloud.setArchiveBody(\'' + b + '\')">' + (b === "입대의" ? "◆ 입주자대표회의" : b === "임차" ? "◇ 임차인대표회의" : "전체") + '</button>';
    }).join("") + '</div>';
    html += coverageHtml(listCache, isTenant, meetDate); // 기록 범위 (v47)
    if (!items.length) html += '<div style="padding:24px;color:#999;text-align:center">' + (q ? "검색 결과 없음" : "저장된 회의록이 없습니다.") + '</div>';
    years.forEach(function (yr) {
      var rows = groups[yr].sort(function (a, b) { return (b.t - a.t) || String(b.it.updatedAt || "").localeCompare(String(a.it.updatedAt || "")); });
      html += '<div style="margin:16px 0 7px;font-weight:800;color:#5c5b56;font-size:13px">' + esc(yr) + '년 <span style="color:#aaa;font-weight:600">(' + rows.length + ')</span></div>';
      rows.forEach(function (r) {
        var it = r.it, active = it.id === cur;
        html += '<div onclick="Cloud._open(\'' + escAttr(it.id) + '\')" style="display:flex;gap:8px;align-items:center;padding:11px 13px;border:1px solid ' + (active ? '#d8a944' : '#e7e2d8') + ';border-radius:12px;margin-bottom:7px;cursor:pointer;background:' + (active ? '#fbf5e5' : '#fff') + '">' +
          '<div style="flex:1;min-width:0"><div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(it.name || "(이름없음)") + (isTenant(it) ? '<span class="body-badge">◇ 임차</span>' : '') + '</div>' +
          '<div style="font-size:11px;color:#999">' + (r.d ? '<b style="color:#6b6656">회의일 ' + esc(fmtDay(r.d)) + '</b>' : '회의일 미정') + ' · 저장 ' + esc(fmtWhen(it.updatedAt)) + (active ? ' · <span style="color:#b07d10;font-weight:700">현재 열림</span>' : '') + '</div></div>' +
          '<span class="btn" style="pointer-events:none">열기</span>' +
          '<button class="btn danger" onclick="event.stopPropagation();Cloud._delArc(\'' + escAttr(it.id) + '\',\'' + escAttr(it.name || "") + '\')">삭제</button></div>';
      });
    });
    box.innerHTML = html;
  }

  // ---- 접속 시 최신 회의록 자동 열기 ----
  // 마지막 클라우드 동기화(저장/불러오기) 시점의 상태 스냅샷. 현재 상태가 스냅샷과 같으면
  // (= 저장 안 된 수정이 없으면) 시작 시 클라우드의 최신 회의록을 자동으로 연다.
  var SNAP_KEY = "sandle_minutes_cloud_snapshot_v1";
  // 마지막 동기화한 문서의 id와 서버 updatedAt. 시작 시 배너·저장 전 덮어쓰기 가드의 비교 기준. (v29)
  var SYNC_KEY = "sandle_minutes_cloud_synced_v1";
  var BANNER_KEY = "sandle_minutes_cloud_banner_dismissed_v1";
  function markSynced(meta) {
    try { localStorage.setItem(SNAP_KEY, localStorage.getItem(STORAGE_KEY) || ""); } catch (e) {}
    if (meta && meta.id) {
      try { localStorage.setItem(SYNC_KEY, JSON.stringify({ id: meta.id, updatedAt: meta.updatedAt || new Date().toISOString() })); } catch (e) {}
    }
  }
  function getSynced() { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || null; } catch (e) { return null; } }
  // 목록(listCache)의 서버 updatedAt으로 동기화 기록을 보정 (저장 직후 호출)
  function markSyncedFromList(id) {
    var li = findListItem(id, null);
    if (li && li.updatedAt) { try { localStorage.setItem(SYNC_KEY, JSON.stringify({ id: id, updatedAt: li.updatedAt })); } catch (e) {} }
  }
  // 클라우드 updatedAt이 이 기기의 마지막 동기화보다 새로운가? 동기화 기록이 없거나 다른 문서면 '새롭다'로 본다.
  function isCloudNewer(id, cloudUpdatedAt) {
    var s = getSynced();
    if (!s || s.id !== id || !s.updatedAt) return true;
    var diff = new Date(cloudUpdatedAt) - new Date(s.updatedAt);
    return isNaN(diff) ? false : diff > 2000;
  }

  // ---- 시작 시 "클라우드가 더 최신" 배너 ----
  // 저장 안 된 로컬 수정이 있어 자동 열기를 건너뛴 경우, 현재 문서의 클라우드 버전이 더 새로우면 안내한다.
  function checkStartupBanner() {
    try {
      var id = state && state.cloudId;
      if (!id || !listCache) return;
      var li = findListItem(id, null);
      if (!li || !li.updatedAt) return;
      if (!isCloudNewer(id, li.updatedAt)) return;
      var dismissed = "";
      try { dismissed = localStorage.getItem(BANNER_KEY) || ""; } catch (e) {}
      if (dismissed === id + "|" + li.updatedAt) return; // 같은 버전에 대해 '이 기기 작성분 유지'를 이미 선택함
      fetchCloudAgendaCount(loadCfg(), id, function (cnt) { showSyncBanner(li, cnt); });
    } catch (e) {}
  }
  function showSyncBanner(li, cloudCount) {
    removeSyncBanner();
    var main = document.querySelector("main.main");
    if (!main) return;
    var s = getSynced();
    var syncedAt = (s && s.id === li.id) ? s.updatedAt : null;
    var b = document.createElement("div");
    b.id = "cloudSyncBanner";
    b.className = "cloud-sync-banner";
    b.innerHTML =
      '<div class="cloud-sync-banner-text">' +
        '<b>☁ 클라우드에 더 최신 버전이 있습니다</b> — ' + esc(li.name || "") +
        '<span class="cloud-sync-banner-meta">클라우드 ' + esc(fmtWhen(li.updatedAt)) + (cloudCount != null ? ' · 안건 ' + cloudCount + '건' : '') +
        ' &nbsp;|&nbsp; 이 기기 ' + (syncedAt ? '마지막 동기화 ' + esc(fmtWhen(syncedAt)) : '동기화 기록 없음') + ' · 안건 ' + localAgendaCount() + '건 (저장 안 된 수정 포함)</span>' +
      '</div>' +
      '<div class="cloud-sync-banner-actions">' +
        '<button class="btn gold" id="cloudSyncBannerLoad">클라우드 버전 불러오기</button>' +
        '<button class="btn" id="cloudSyncBannerKeep">이 기기 작성분 유지</button>' +
      '</div>';
    main.insertBefore(b, main.firstChild);
    document.getElementById("cloudSyncBannerLoad").onclick = function () {
      removeSyncBanner();
      var v = document.querySelector('[data-view="previewView"]'); if (v) v.click();
      doLoad(loadCfg(), li.id);
    };
    document.getElementById("cloudSyncBannerKeep").onclick = function () {
      try { localStorage.setItem(BANNER_KEY, li.id + "|" + li.updatedAt); } catch (e) {}
      removeSyncBanner();
      toast("이 기기 작성분을 유지합니다. 저장 시 덮어쓰기 전에 다시 확인합니다.");
    };
  }
  function removeSyncBanner() { var b = document.getElementById("cloudSyncBanner"); if (b) b.remove(); }
  function isPristine() {
    try {
      if (state.cloudId) return false;
      if (state.draft) return false; // '＋ 새 회의록'으로 시작한 작성 중 문서는 보호
      var ags = state.agendas || [];
      return ags.every(function (a) {
        return !String(a.title || "").trim() && !String(a.summary || "").trim() && !String(a.decision || "").trim();
      });
    } catch (e) { return false; }
  }
  function autoOpenLatest() {
    if (!listCache || !listCache.length) return false;
    var unchanged = false;
    try { unchanged = (localStorage.getItem(STORAGE_KEY) || "") === (localStorage.getItem(SNAP_KEY) || " "); } catch (e) {}
    if (!unchanged && !isPristine()) return false; // 저장 안 된 작업이 있으면 건드리지 않음 → 배너로 안내
    var newest = listCache.slice().sort(function (a, b) {
      var d = new Date(b.date || 0) - new Date(a.date || 0);
      return d !== 0 ? d : (new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    })[0];
    if (!newest || !newest.id) return false;
    doLoad(loadCfg(), newest.id);
    return true;
  }

  // 시스템 레코드(명단 변동 이력 등) 저장 — 관리자 비밀번호 필요. cb(ok, errorMessage) (v40)
  // v82: 임계 초과 시 조각 저장(v83: 임계 45,000→30,000자 — 한도 도달 전에 미리 조각) ({chunked,parts} 본 레코드 + id_pN 원문 슬라이스, docs/DATA.md §8) — 구글시트 셀 50,000자 한도 대응.
  var SYS_CHUNK_LIMIT = 30000;
  function saveSystemRecord(id, name, json, cb, retried) {
    var key = getAdminKey(true);
    if (!key) {
      if (promptUnsupported) { askAdminKeyDialog(function () { saveSystemRecord(id, name, json, cb, retried); }); return; }
      toast("저장 취소됨 — 관리자 비밀번호가 필요합니다"); if (cb) cb(false, "no_key"); return;
    }
    var cfg = loadCfg();
    toast("클라우드에 저장 중...");
    (async function () {
      // 이전 조각 수 확인 — 조각이 줄면 잉여 조각을 지워야 다음 읽기가 안 깨진다
      var oldParts = 0;
      try {
        var prev = await apiGet(cfg, { action: "get", token: cfg.token, id: id });
        var pm = (prev && prev.ok && prev.item) ? JSON.parse(prev.item.json) : null;
        if (pm && pm.chunked && pm.parts) oldParts = pm.parts;
      } catch (e) {}
      var res;
      if (json.length > SYS_CHUNK_LIMIT) {
        var n = Math.ceil(json.length / SYS_CHUNK_LIMIT);
        for (var i = 1; i <= n; i++) {
          var pr = await apiPost(cfg, { action: "save", record: { id: id + "_p" + i, name: name + " (조각 " + i + "/" + n + ")", date: "", json: json.slice((i - 1) * SYS_CHUNK_LIMIT, i * SYS_CHUNK_LIMIT) }, adminKey: key });
          if (!(pr && pr.ok)) return pr;
        }
        res = await apiPost(cfg, { action: "save", record: { id: id, name: name, date: "", json: JSON.stringify({ version: 1, chunked: true, parts: n, totalLen: json.length, updatedAt: new Date().toISOString() }) }, adminKey: key });
        for (var j = n + 1; j <= oldParts; j++) await apiPost(cfg, { action: "delete", id: id + "_p" + j, adminKey: key });
      } else {
        res = await apiPost(cfg, { action: "save", record: { id: id, name: name, date: "", json: json }, adminKey: key });
        for (var j2 = 1; j2 <= oldParts; j2++) await apiPost(cfg, { action: "delete", id: id + "_p" + j2, adminKey: key });
      }
      return res;
    })().then(function (res) {
      if (res && res.ok) { toast("클라우드 저장 완료"); if (cb) cb(true); }
      else if (res && res.error === "admin_required") { clearAdminKey(); toast("관리자 비밀번호가 올바르지 않습니다"); if (!retried) saveSystemRecord(id, name, json, cb, true); else if (cb) cb(false, "admin_required"); }
      else { toast("저장 실패: " + ((res && res.error) || "알 수 없음")); if (cb) cb(false, res && res.error); }
    }).catch(function (e) { toast("저장 오류: " + e.message); if (cb) cb(false, e.message); });
  }
  function getSystemRecord(id, cb) {
    var cfg = loadCfg();
    apiGet(cfg, { action: "get", token: cfg.token, id: id }).then(function (r) {
      var item = (r && r.ok && r.item) ? r.item : null;
      if (!item) { cb(null); return; }
      var meta = null; try { meta = JSON.parse(item.json); } catch (e) {}
      if (!(meta && meta.chunked && meta.parts)) { cb(item); return; }
      // v82: 조각 레코드면 이어 붙여 원래 item 모양으로 돌려준다 — 호출부는 그대로 JSON.parse(item.json)
      var ps = [];
      for (var i = 1; i <= meta.parts; i++) ps.push(apiGet(cfg, { action: "get", token: cfg.token, id: id + "_p" + i }));
      Promise.all(ps).then(function (arr) {
        var s = "";
        for (var k = 0; k < arr.length; k++) { if (!(arr[k] && arr[k].ok && arr[k].item)) { cb(null); return; } s += arr[k].item.json; }
        cb({ id: item.id, name: item.name, date: item.date, updatedAt: item.updatedAt, json: s });
      }).catch(function () { cb(null); });
    }).catch(function () { cb(null); });
  }

  // 관리자 확인 게이트 (v42): 공개 사이트이므로 수정·삭제성 동작은 먼저 관리자 비밀번호를 요구한다. cb(true)면 진행.
  function requireAdmin(cb) {
    var k = getAdminKey(true);
    if (k) { cb(true); return; }
    if (promptUnsupported) { askAdminKeyDialog(function () { cb(true); }); return; }
    toast("관리자 비밀번호가 필요합니다"); cb(false);
  }

  window.Cloud = {
    setArchiveBody: function (b) { archiveBodyFilter = b || "전체"; renderArchiveList(); },
    openMonth: openMonth, // 기록 범위의 달 칸 → 그 달 회의록 열기 (v59)
    requireAdmin: requireAdmin,
    saveSystemRecord: saveSystemRecord,
    getSystemRecord: getSystemRecord,
    openMenu: openMenu,
    saveNow: function () { doSave(); },
    _save: function () { closeOverlay(); doSave(); },
    _list: doList,
    _close: closeOverlay,
    _pick: function () {},
    _del: function () {},
    renderArchiveList: renderArchiveList,
    _open: function (id) { var b = document.querySelector('[data-view="previewView"]'); if (b) b.click(); doLoad(loadCfg(), id); },
    _delArc: function (id, name) {
      if (!confirm("클라우드에서 삭제할까요?\n" + (name || id))) return;
      var key = getAdminKey(true);
      if (!key) {
        if (promptUnsupported) { askAdminKeyDialog(function () { Cloud._delArc(id, name); }); return; }
        toast("삭제 취소됨 — 관리자 비밀번호가 필요합니다"); return;
      }
      apiPost(loadCfg(), { action: "delete", id: id, adminKey: key }).then(function (res) {
        if (res && res.ok) { toast("삭제 완료"); listCache = null; renderArchiveList(); try { if (window.Topic) Topic.reload(); } catch (e2) {} }
        else if (res && res.error === "admin_required") { clearAdminKey(); toast("관리자 비밀번호가 올바르지 않습니다"); }
        else toast("삭제 실패");
      }).catch(function (e) { toast("삭제 오류: " + e.message); });
    },
    _invalidate: function () { listCache = null; },
    peekList: function () { return { items: rawListCache, at: rawListAt }; } // 주제별 보기가 최근 목록을 재사용
  };
  function bootCloud() {
    // data.json 로드를 먼저 기다렸다가(실패해도 진행) 목록 조회 → 최신 회의록 자동 열기
    var go = function () { fetchList(function () { if (!autoOpenLatest()) checkStartupBanner(); }); };
    if (window.StaticData && window.StaticData.ready) window.StaticData.ready.then(go, go);
    else go();
  }
  if (document.readyState !== "loading") setTimeout(bootCloud, 200);
  else document.addEventListener("DOMContentLoaded", function () { setTimeout(bootCloud, 200); });
})();
