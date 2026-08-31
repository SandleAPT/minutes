/**
 * 산들마을 회의록 - 클라우드 저장 백엔드 (독립형 Apps Script)
 * 연결 시트 ID 로 회의록 JSON 을 저장/불러오기.
 * 시트 열: id | name | date | updatedAt | json
 *
 * [v2, 2026-08-31] 2단계 비밀번호(스크립트 속성):
 *  - ADMIN_KEY : 수정용 — save/delete 에 필요
 *  - VIEW_KEY  : 열람용 — action 'verify' 에서 인정(잠긴 화면 열람 확인용). 수정 키도 열람을 겸한다.
 *  - TOKEN     : 공개 읽기 토큰(기존과 동일)
 * 이 파일은 코드 사본(진본은 Apps Script 프로젝트 '제목 없는 프로젝트'). 수정 시 양쪽을 함께 갱신할 것.
 * 키 값은 절대 코드·저장소에 넣지 않는다(스크립트 속성에만).
 */

const SHEET_ID = '1MCVEytoBJpH0n6lmRTX7NwQwcgBxTfWCPvyfjtCrkIU';
const SHEET_NAME = 'minutes';
const HEADERS = ['id', 'name', 'date', 'updatedAt', 'json'];

function getToken() {
  return PropertiesService.getScriptProperties().getProperty('TOKEN') || '';
}
function checkAdmin(k) { const s = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY') || ''; return !!s && String(k) === s; }
function checkView(k) { const v = PropertiesService.getScriptProperties().getProperty('VIEW_KEY') || ''; return (!!v && String(k) === v) || checkAdmin(k); }
function checkToken(t) {
  const server = getToken();
  return !!server && String(t) === server;
}
function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function getSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
  }
  return sh;
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = p.action || '';
  if (action === 'ping') return jsonOut({ ok: true, service: 'sandle-minutes' });
  if (!checkToken(p.token)) return jsonOut({ ok: false, error: 'unauthorized' });
  if (action === 'list') return jsonOut({ ok: true, items: listItems() });
  if (action === 'get')  return jsonOut({ ok: true, item: getItem(p.id) });
  return jsonOut({ ok: false, error: 'unknown action' });
}
function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return jsonOut({ ok: false, error: 'bad json' }); }
  if (!checkToken(body.token)) return jsonOut({ ok: false, error: 'unauthorized' });
  const action = body.action || '';
  if (action === 'verify') return jsonOut({ ok: checkView(body.adminKey), role: checkAdmin(body.adminKey) ? 'edit' : (checkView(body.adminKey) ? 'view' : '') });
  if ((action === 'save' || action === 'delete') && !checkAdmin(body.adminKey)) return jsonOut({ ok: false, error: 'admin_required' });
  if (action === 'save')   return jsonOut({ ok: true, id: saveItem(body.record || {}) });
  if (action === 'delete') return jsonOut({ ok: true, deleted: deleteItem(body.id) });
  return jsonOut({ ok: false, error: 'unknown action' });
}

function listItems() {
  const sh = getSheet();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const rows = sh.getRange(2, 1, last - 1, 4).getValues();
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const id = rows[i][0];
    if (!id) continue;
    out.push({ id: String(id), name: String(rows[i][1] || ''), date: String(rows[i][2] || ''), updatedAt: String(rows[i][3] || '') });
  }
  out.sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
  return out;
}
function findRow(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}
function getItem(id) {
  const sh = getSheet();
  const r = findRow(sh, id);
  if (r < 0) return null;
  const v = sh.getRange(r, 1, 1, 5).getValues()[0];
  return { id: String(v[0]), name: String(v[1] || ''), date: String(v[2] || ''), updatedAt: String(v[3] || ''), json: String(v[4] || '') };
}
function saveItem(rec) {
  const sh = getSheet();
  const id = rec.id || Utilities.getUuid();
  const now = new Date().toISOString();
  const row = [id, rec.name || '', rec.date || '', now, rec.json || ''];
  const r = findRow(sh, id);
  if (r < 0) sh.appendRow(row);
  else sh.getRange(r, 1, 1, 5).setValues([row]);
  return id;
}
function deleteItem(id) {
  const sh = getSheet();
  const r = findRow(sh, id);
  if (r < 0) return false;
  sh.deleteRow(r);
  return true;
}
