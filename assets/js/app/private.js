// ⑨ 비공개 자료 (v84) — 별도 비공개 GAS 웹앱(scripts/gas/private-store.gs)과 통신.
// 공개 회의록 GAS와 달리 모든 읽기/쓰기가 서버에서 관리자 비밀번호를 검증한다(POST 전용).
// 엔드포인트 주소는 공개 코드에 넣지 않는다 — 이 기기 localStorage(sandle_private_url)에만 저장(최초 1회 입력).
// 항목 json = {text, files:[{name,type,dataUrl}]} — 파일은 dataURL로 통째 저장(시트 쪽에서 45,000자 조각 분할).
(function () {
  var URL_KEY = "sandle_private_url", ADMIN_LS = "sandle_admin_key";
  var MAX_TOTAL = 8 * 1024 * 1024; // 항목당 저장 한도(대략) — dataURL 기준 8MB
  var st = { items: null, cur: null, mode: "list", err: "", busy: false };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function box() { return document.getElementById("privateBody"); }
  function fmtSize(n) { n = Number(n || 0); if (n > 1048576) return (n / 1048576).toFixed(1) + "MB"; if (n > 1024) return Math.round(n / 1024) + "KB"; return n + "자"; }

  function getUrl(ask) {
    var u = ""; try { u = localStorage.getItem(URL_KEY) || ""; } catch (e) {}
    if (!u && ask) {
      u = (prompt("비공개 저장소 주소(Apps Script 웹앱 URL)를 입력하세요.\n이 기기에만 저장되며, 공개 코드에는 들어가지 않습니다.") || "").trim();
      if (u) try { localStorage.setItem(URL_KEY, u); } catch (e) {}
    }
    return u;
  }
  function getKey(ask) {
    var k = ""; try { k = localStorage.getItem(ADMIN_LS) || ""; } catch (e) {}
    if (!k && ask) {
      k = (prompt("관리자 비밀번호를 입력하세요.\n(비공개 자료는 서버에서 비밀번호를 검증합니다)") || "").trim();
      if (k) try { localStorage.setItem(ADMIN_LS, k); } catch (e) {}
    }
    return k;
  }
  function api(body) {
    var u = getUrl(true); if (!u) return Promise.reject(new Error("저장소 주소가 없습니다"));
    var k = getKey(true); if (!k) return Promise.reject(new Error("관리자 비밀번호가 필요합니다"));
    body.adminKey = k;
    return fetch(u, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (x) {
        if (x && !x.ok && x.error === "denied") { try { localStorage.removeItem(ADMIN_LS); } catch (e) {} throw new Error("비밀번호가 올바르지 않습니다 — 다시 열면 재입력합니다"); }
        return x;
      });
  }

  function load() {
    st.busy = true; st.err = ""; draw();
    api({ action: "list" }).then(function (x) {
      st.busy = false;
      if (x && x.ok) { st.items = x.items || []; } else { st.err = (x && x.error) || "불러오기 실패"; }
      draw();
    }).catch(function (e) { st.busy = false; st.err = e.message; draw(); });
  }

  function openItem(id) {
    st.busy = true; draw();
    api({ action: "get", id: id }).then(function (x) {
      st.busy = false;
      if (x && x.ok && x.item) {
        var obj = {}; try { obj = JSON.parse(x.item.json); } catch (e) {}
        st.cur = { id: x.item.id, title: x.item.title, date: x.item.date, updatedAt: x.item.updatedAt, obj: obj };
        st.mode = "detail";
      } else st.err = (x && x.error) || "열기 실패";
      draw();
    }).catch(function (e) { st.busy = false; st.err = e.message; draw(); });
  }

  function delItem(id) {
    if (!confirm("이 항목을 비공개 저장소에서 삭제할까요?")) return;
    st.busy = true; draw();
    api({ action: "delete", id: id }).then(function () { st.busy = false; st.mode = "list"; st.cur = null; load(); })
      .catch(function (e) { st.busy = false; st.err = e.message; draw(); });
  }

  function saveForm() {
    var title = (document.getElementById("pvTitle").value || "").trim();
    var date = document.getElementById("pvDate").value || "";
    var text = document.getElementById("pvText").value || "";
    if (!title) { alert("제목을 입력하세요"); return; }
    var filesEl = document.getElementById("pvFiles");
    var fs = filesEl && filesEl.files ? Array.prototype.slice.call(filesEl.files) : [];
    var readers = fs.map(function (f) {
      return new Promise(function (res, rej) {
        var r = new FileReader();
        r.onload = function () { res({ name: f.name, type: f.type || "application/octet-stream", dataUrl: r.result }); };
        r.onerror = rej; r.readAsDataURL(f);
      });
    });
    st.busy = true; draw();
    Promise.all(readers).then(function (files) {
      var obj = { text: text, files: files };
      var json = JSON.stringify(obj);
      if (json.length > MAX_TOTAL) { st.busy = false; st.err = "항목이 너무 큽니다(" + fmtSize(json.length) + " / 한도 8MB) — 파일을 나눠 저장하세요"; draw(); return; }
      var id = "pv_" + Date.now().toString(36);
      return api({ action: "save", record: { id: id, title: title, date: date, json: json } }).then(function (x) {
        st.busy = false;
        if (x && x.ok) { st.mode = "list"; load(); } else { st.err = (x && x.error) || "저장 실패"; draw(); }
      });
    }).catch(function (e) { st.busy = false; st.err = e.message; draw(); });
  }

  function fileLink(f, i) {
    return '<div style="margin:4px 0"><a href="' + f.dataUrl + '" download="' + esc(f.name) + '" class="btn" style="text-decoration:none">⬇ ' + esc(f.name) + '</a> <span class="small">' + fmtSize(f.dataUrl.length) + '</span></div>';
  }

  function draw() {
    var el = box(); if (!el) return;
    var h = "";
    if (st.err) h += '<div class="help" style="border-color:#c66;color:#a33">' + esc(st.err) + '</div>';
    if (st.busy) { el.innerHTML = h + '<div class="small">불러오는 중…</div>'; return; }
    if (st.mode === "form") {
      h += '<div class="field"><label>제목</label><input id="pvTitle" style="width:100%"></div>' +
        '<div class="field" style="margin-top:8px"><label>날짜</label><input id="pvDate" type="date"></div>' +
        '<div class="field" style="margin-top:8px"><label>내용(메모)</label><textarea id="pvText" rows="8" style="width:100%"></textarea></div>' +
        '<div class="field" style="margin-top:8px"><label>파일 첨부(선택, 합계 8MB 이내)</label><input id="pvFiles" type="file" multiple></div>' +
        '<div style="margin-top:12px"><button class="btn gold" onclick="PrivateStore._save()">저장</button> <button class="btn" onclick="PrivateStore._list()">취소</button></div>';
    } else if (st.mode === "detail" && st.cur) {
      var o = st.cur.obj || {};
      h += '<div class="card-title"><div><h3>' + esc(st.cur.title) + '</h3><small>' + esc(st.cur.date || "") + ' · 저장 ' + esc(String(st.cur.updatedAt || "").slice(0, 10)) + '</small></div>' +
        '<div><button class="btn" onclick="PrivateStore._list()">← 목록</button> <button class="btn" onclick="PrivateStore._del(\'' + st.cur.id + '\')">삭제</button></div></div>';
      if (o.text) h += '<div style="white-space:pre-wrap;line-height:1.7;margin:10px 0">' + esc(o.text) + '</div>';
      if (o.files && o.files.length) { h += '<div class="small" style="margin-top:10px">첨부 파일</div>'; o.files.forEach(function (f, i) { h += fileLink(f, i); }); }
    } else {
      h += '<div style="margin-bottom:10px"><button class="btn gold" onclick="PrivateStore._form()">＋ 새 항목</button> <button class="btn" onclick="PrivateStore.reload()">↻ 새로고침</button></div>';
      if (!st.items || !st.items.length) h += '<div class="small">저장된 항목이 없습니다.</div>';
      else {
        h += '<div class="table-wrap"><table><thead><tr><th>제목</th><th>날짜</th><th>크기</th><th></th></tr></thead><tbody>';
        st.items.forEach(function (it) {
          h += '<tr><td><a href="#" onclick="PrivateStore._open(\'' + it.id + '\');return false">' + esc(it.title) + '</a></td><td>' + esc(it.date || "") + '</td><td>' + fmtSize(it.size) + '</td>' +
            '<td><button class="btn" onclick="PrivateStore._del(\'' + it.id + '\')">삭제</button></td></tr>';
        });
        h += '</tbody></table></div>';
      }
      h += '<div class="small" style="margin-top:14px;color:#888">이 탭의 자료는 별도 비공개 저장소에 있으며 모든 접근에 서버가 관리자 비밀번호를 검증합니다. 공개 백업(data·system-backup)에는 포함되지 않습니다.</div>';
    }
    el.innerHTML = h;
  }

  window.PrivateStore = {
    render: function () { st.mode = "list"; if (st.items === null) load(); else draw(); },
    reload: function () { st.items = null; load(); },
    _list: function () { st.mode = "list"; st.cur = null; st.err = ""; draw(); },
    _form: function () { st.mode = "form"; st.err = ""; draw(); },
    _save: saveForm,
    _open: openItem,
    _del: delItem,
    // 배포 직후 최초 1회: 이 기기의 관리자 비밀번호를 비공개 저장소에 등록(first-call-wins)
    _setup: function () {
      var u = getUrl(true), k = getKey(true);
      return fetch(u, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "setup", adminKey: k }) }).then(function (r) { return r.json(); });
    },
    _resetUrl: function () { try { localStorage.removeItem(URL_KEY); } catch (e) {} }
  };
})();
