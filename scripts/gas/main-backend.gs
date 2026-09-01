/**
 * 산들마을 회의록 - 클라우드 저장 백엔드 (독립형 Apps Script)
 * 연결 시트 ID 로 회의록 JSON 을 저장/불러오기.
 * 시트 열: id | name | date | updatedAt | json
 *
 * [v2, 2026-08-31] 2단계 비밀번호(스크립트 속성):
 *  - ADMIN_KEY : 수정용 — save/delete 에 필요
 *  - VIEW_KEY  : 열람용 — action 'verify' 에서 인정(잠긴 화면 열람 확인용). 수정 키도 열람을 겸한다.
 *  - TOKEN     : 공개 읽기 토큰(기존과 동일)
 * [v3, 2026-09-02] `setTags` 추가 — 안건 태그만 바꾸는 부분 수정(아래 함수 주석 참조).
 * [v4, 2026-09-02] 인증 기록(`auth_log` 시트) 추가 — 아래 `logAuth_` 주석 참조.
 *
 * 이 파일은 코드 사본(진본은 Apps Script 프로젝트 '제목 없는 프로젝트'). 수정 시 양쪽을 함께 갱신할 것.
 * **저장소 파일만 고치면 서버는 바뀌지 않는다.** Apps Script 편집기에 붙여넣고 배포까지 해야 한다.
 * 배포할 때 버전 드롭다운에서 '새 버전'을 정확히 고를 것(예전에 잘못 골라 반영이 안 된 적 있음).
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
/**
 * 인증 기록 (v4, 2026-09-02 — Archive 4.3c)
 *
 * 왜 서버에 두는가: 기록을 브라우저에 두면 자기 기기 것만 보이고 지우면 그만이라 아무 의미가 없다.
 * 비밀번호를 확인하는 곳은 여기뿐이므로 기록도 여기서 남긴다.
 *
 * 무엇을 남기는가: 시각 / 무슨 동작이었나 / 통과했나 / 기기가 스스로 밝힌 표시.
 * **무엇을 남기지 않는가: 비밀번호는 어떤 형태로도 남기지 않는다.** 틀린 비밀번호도 남기지 않는다
 * (오타가 대개 진짜 비밀번호와 한두 글자 차이라, 그것을 모아두면 비밀번호를 적어두는 것과 같아진다).
 *
 * 한계 — 이것을 알고 써야 한다:
 *  - Apps Script는 요청한 쪽의 IP를 알 수 없다. 그래서 **누구인지는 기록할 수 없다.**
 *  - `dev`는 기기가 스스로 말한 값이라 **믿을 수 없다.** 같은 기기를 묶어 보는 용도일 뿐이다.
 * 그래도 쓸모는 있다: 실패가 몰아서 찍히면 누가 비밀번호를 찍어보고 있는 것이고,
 * 내가 일하지 않은 시각에 수정용 통과가 찍히면 비밀번호가 샌 것이다.
 *
 * 기록이 실패해도 본 동작은 막지 않는다(try/catch). 로그 때문에 저장이 안 되는 쪽이 더 나쁘다.
 */
const LOG_SHEET = 'auth_log';
const LOG_KEEP = 500;   // 이만큼만 남기고 옛것부터 지운다 — 시트가 무한정 커지지 않게

function logAuth_(action, result, dev) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sh = ss.getSheetByName(LOG_SHEET);
    if (!sh) {
      sh = ss.insertSheet(LOG_SHEET);
      sh.appendRow(['at', 'action', 'result', 'dev']);
    }
    sh.appendRow([
      new Date().toISOString(),
      String(action || ''),
      String(result || ''),
      String(dev || '').slice(0, 40)   // 기기가 보낸 값 — 길이만 자른다
    ]);
    const last = sh.getLastRow();
    if (last > LOG_KEEP + 1) sh.deleteRows(2, last - LOG_KEEP - 1);
  } catch (err) { /* 기록 실패가 본 동작을 막지 않는다 */ }
}

// 기록 읽기는 **수정용 키만**. 열람용(입주민)에게 접근 기록을 보여주지 않는다.
function readAuthLog_(limit) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(LOG_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  const n = Math.min(Math.max(Number(limit) || 50, 1), LOG_KEEP);
  const start = Math.max(2, sh.getLastRow() - n + 1);
  const rows = sh.getRange(start, 1, sh.getLastRow() - start + 1, 4).getValues();
  return rows.map(function (r) {
    // 시트가 시각 칸을 Date 로 바꿔놓는 경우가 있어 문자열로 되돌린다.
    const at = (r[0] instanceof Date) ? r[0].toISOString() : String(r[0] || '');
    return { at: at, action: String(r[1] || ''), result: String(r[2] || ''), dev: String(r[3] || '') };
  }).reverse();   // 최근 것이 먼저
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
  if (action === 'verify') {
    const role = checkAdmin(body.adminKey) ? 'edit' : (checkView(body.adminKey) ? 'view' : '');
    logAuth_('verify', role || 'fail', body.dev);
    return jsonOut({ ok: !!role, role: role });
  }
  // 인증 기록 읽기 — 수정용 키만. 입주민(열람용)에게는 보여주지 않는다.
  if (action === 'authLog') {
    if (!checkAdmin(body.adminKey)) { logAuth_('authLog', 'denied', body.dev); return jsonOut({ ok: false, error: 'admin_required' }); }
    return jsonOut({ ok: true, items: readAuthLog_(body.limit) });
  }
  if ((action === 'save' || action === 'delete' || action === 'setTags') && !checkAdmin(body.adminKey)) {
    // 수정용 키 없이 쓰기를 시도한 것 — 보안상 알아야 할 일이라 남긴다.
    logAuth_(action, 'denied', body.dev);
    return jsonOut({ ok: false, error: 'admin_required' });
  }
  if (action === 'save')   return jsonOut({ ok: true, id: saveItem(body.record || {}) });
  if (action === 'delete') return jsonOut({ ok: true, deleted: deleteItem(body.id) });
  if (action === 'setTags') return jsonOut(setTags(body.id, body.tags || {}));
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
/**
 * [v3, 2026-09-02] 안건 태그만 바꾸는 부분 수정.
 *
 * 왜 필요한가 — 예전에는 태그 하나를 바꾸려 해도 브라우저가 회의 레코드 전체를 다시 만들어
 * save 로 보냈다. 그러다 2026-09-01에 date 를 빠뜨린 채 저장해 **회의 64건의 날짜가 지워졌다**.
 * 여기서는 json 열만 손대고 date·name 은 아예 읽지도 쓰지도 않으므로 같은 사고가 구조적으로
 * 불가능하다. 왕복도 3회(읽기·저장·재조회)에서 1회로 준다.
 *
 * body: { action:'setTags', id:<회의id>, tags:{ <안건id>: ["주제",...] }, adminKey, token }
 * 반환: { ok, id, applied:[안건id], missing:[안건id] }
 *
 * 규칙
 *  - 없는 안건은 건드리지 않고 missing 으로 알린다(조용히 넘어가지 않는다).
 *  - 빈 배열이 오면 그 안건의 tags 를 지운다(자동 분류로 되돌리는 뜻). 문자열 하나만 와도 배열로 받는다.
 *  - 바꿀 것이 하나도 없으면 시트를 쓰지 않는다.
 *  - updatedAt 은 갱신한다. 정적 사본 재생성이 이 값으로 바뀐 연도를 찾기 때문이다.
 */
function setTags(id, tags) {
  if (!id) return { ok: false, error: 'no id' };
  const sh = getSheet();
  const r = findRow(sh, id);
  if (r < 0) return { ok: false, error: 'not found' };

  const raw = String(sh.getRange(r, 5).getValue() || '');
  let obj;
  try { obj = JSON.parse(raw); }
  catch (err) { return { ok: false, error: 'bad json in record' }; }

  const agendas = (obj && obj.agendas) || [];
  const applied = [], missing = [];
  Object.keys(tags).forEach(function (agendaId) {
    let hit = null;
    for (let i = 0; i < agendas.length; i++) {
      if (agendas[i] && String(agendas[i].id) === String(agendaId)) { hit = agendas[i]; break; }
    }
    if (!hit) { missing.push(agendaId); return; }
    let v = tags[agendaId];
    if (typeof v === 'string') v = [v];
    if (!Array.isArray(v)) { missing.push(agendaId); return; }
    v = v.filter(function (t) { return t && String(t).trim(); }).map(function (t) { return String(t).trim(); });
    if (v.length) hit.tags = v; else delete hit.tags;
    applied.push(agendaId);
  });

  if (!applied.length) return { ok: false, error: 'nothing applied', missing: missing };

  // json 열과 updatedAt 만 쓴다. date·name 은 손대지 않는다.
  sh.getRange(r, 5).setValue(JSON.stringify(obj));
  sh.getRange(r, 4).setValue(new Date().toISOString());
  return { ok: true, id: String(id), applied: applied, missing: missing };
}

function deleteItem(id) {
  const sh = getSheet();
  const r = findRow(sh, id);
  if (r < 0) return false;
  sh.deleteRow(r);
  return true;
}
