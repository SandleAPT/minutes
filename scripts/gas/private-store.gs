// 산들마을 비공개 자료 저장소 (standalone Apps Script 웹앱) — v84, 2026-08-31
// 목적: 민감 자료(대외 서신 등)를 진짜 비공개로 보관 — 모든 읽기/쓰기가 서버에서 관리자 비밀번호를 검증한다.
//       (기존 회의록 GAS는 공개 토큰으로 읽혀 민감자료 보관 불가 — docs/DATA.md §8, SCALING.md 참조)
// 배포: Apps Script 새 프로젝트에 이 코드 붙여넣기 → 배포 > 새 배포 > 웹 앱(실행: 나, 액세스: 모든 사용자) → URL을 앱 ⑨ 탭에 입력.
// 초기 설정: 배포 직후 첫 setup 호출이 관리자 비밀번호를 등록한다(최초 1회만 허용 — first-call-wins).
// 데이터: 자동 생성되는 구글시트('산들마을 비공개 자료')에 [id, part, title, date, updatedAt, chunk, totalLen] 행으로 저장(45,000자 조각).
// 이 파일은 코드 사본(진본은 Apps Script 프로젝트). 수정 시 양쪽을 함께 갱신할 것.

var PROP = PropertiesService.getScriptProperties();

function sheet_() {
  var id = PROP.getProperty('SHEET_ID');
  var ss;
  if (!id) {
    ss = SpreadsheetApp.create('산들마을 비공개 자료 (private-store)');
    PROP.setProperty('SHEET_ID', ss.getId());
  } else {
    ss = SpreadsheetApp.openById(id);
  }
  var sh = ss.getSheetByName('records');
  if (!sh) sh = ss.insertSheet('records');
  return sh;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() { return json_({ ok: false, error: 'post_only' }); }

function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_json' }); }
  var stored = PROP.getProperty('ADMIN_KEY');

  if (b.action === 'setup') { // 최초 1회만: 관리자 비밀번호 등록
    if (stored) return json_({ ok: false, error: 'already_setup' });
    if (!b.adminKey || String(b.adminKey).length < 4) return json_({ ok: false, error: 'bad_key' });
    PROP.setProperty('ADMIN_KEY', String(b.adminKey));
    sheet_();
    return json_({ ok: true, setup: true });
  }

  if (!stored || String(b.adminKey || '') !== stored) return json_({ ok: false, error: 'denied' });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_();
    var CH = 45000;

    if (b.action === 'list') {
      var rows = sh.getLastRow() ? sh.getRange(1, 1, sh.getLastRow(), 7).getValues() : [];
      var out = [];
      rows.forEach(function (r) {
        if (r[0] && (r[1] === 0 || r[1] === '0')) out.push({ id: r[0], title: r[2], date: r[3], updatedAt: r[4], size: Number(r[6] || 0) });
      });
      out.sort(function (a, c) { return String(c.date).localeCompare(String(a.date)); });
      return json_({ ok: true, items: out });
    }

    if (b.action === 'get') {
      var rows2 = (sh.getLastRow() ? sh.getRange(1, 1, sh.getLastRow(), 7).getValues() : [])
        .filter(function (r) { return r[0] === b.id; })
        .sort(function (a, c) { return a[1] - c[1]; });
      if (!rows2.length) return json_({ ok: false, error: 'not_found' });
      var s = '';
      rows2.forEach(function (r) { s += r[5]; });
      return json_({ ok: true, item: { id: b.id, title: rows2[0][2], date: rows2[0][3], updatedAt: rows2[0][4], json: s } });
    }

    if (b.action === 'save') {
      var rec = b.record || {};
      if (!rec.id) return json_({ ok: false, error: 'no_id' });
      var data = sh.getLastRow() ? sh.getRange(1, 1, sh.getLastRow(), 7).getValues() : [];
      for (var i = data.length - 1; i >= 0; i--) if (data[i][0] === rec.id) sh.deleteRow(i + 1);
      var txt = String(rec.json || '');
      var now = new Date().toISOString();
      var n = Math.max(1, Math.ceil(txt.length / CH));
      var newRows = [];
      for (var p = 0; p < n; p++) newRows.push([rec.id, p, rec.title || '', rec.date || '', now, txt.slice(p * CH, (p + 1) * CH), txt.length]);
      sh.getRange(sh.getLastRow() + 1, 1, newRows.length, 7).setValues(newRows);
      return json_({ ok: true, id: rec.id, parts: n });
    }

    if (b.action === 'delete') {
      var data2 = sh.getLastRow() ? sh.getRange(1, 1, sh.getLastRow(), 7).getValues() : [];
      var cnt = 0;
      for (var j = data2.length - 1; j >= 0; j--) if (data2[j][0] === b.id) { sh.deleteRow(j + 1); cnt++; }
      return json_({ ok: true, deleted: cnt > 0 });
    }

    return json_({ ok: false, error: 'unknown_action' });
  } finally {
    lock.releaseLock();
  }
}
