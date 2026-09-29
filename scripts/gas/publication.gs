/** v458: main-backend.gs의 legacyDoGet/legacyDoPost 앞에서 공개 범위를 제한한다. */
function publicationManaged_(state) {
  if (state && state.publication && state.publication.managed) return true;
  const m = state && state.meeting;
  if (!m) return false;
  const ym = Number(m.year) * 100 + Number(m.month);
  return ym > 202609 || (ym === 202609 && m.body !== '임차' &&
    (m.type !== '임시' || String(m.date || '') >= '2026-09-29'));
}
function publicationState_(item) {
  try { return JSON.parse(item && item.json || '{}'); } catch (_) { return null; }
}
function publishedSheet_(create) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName('minutes_published');
  if (!sh && create) { sh = ss.insertSheet('minutes_published'); sh.appendRow(HEADERS); }
  return sh;
}
let publishedCache_ = null;
function publishedItem_(id) {
  if (publishedCache_) return publishedCache_[id] || null;
  publishedCache_ = {};
  const sh = publishedSheet_(false);
  if (!sh) return null;
  if (sh.getLastRow() > 1) sh.getRange(2,1,sh.getLastRow()-1,5).getValues().forEach(function(v) {
    publishedCache_[String(v[0])] = { id: String(v[0]), name: String(v[1] || ''), date: String(v[2] || ''),
      updatedAt: String(v[3] || ''), json: String(v[4] || '') };
  });
  return publishedCache_[id] || null;
}
function publicationItem_(item, editor) {
  if (!item) return null;
  const state = publicationState_(item);
  const published = publishedItem_(item.id);
  if (!publicationManaged_(state) && !published) return item;
  if (!editor && !published) return null;
  const result = Object.assign({}, editor ? item : published);
  result.publication = { managed: true, public: !editor,
    publishedAt: published ? published.updatedAt : '',
    dirty: !published || published.json !== item.json || published.name !== item.name || published.date !== item.date };
  return result;
}
function publicationList_(editor) {
  // 한 번에 본문을 읽는다. 공개 목록에는 미발행 제목/식별자도 싣지 않는다.
  const sh = getSheet(), last = sh.getLastRow();
  if (last < 2) return [];
  const out = [];
  sh.getRange(2, 1, last - 1, 5).getValues().forEach(function (v) {
    if (!v[0]) return;
    const item = publicationItem_({id:String(v[0]), name:String(v[1] || ''), date:String(v[2] || ''),
      updatedAt:String(v[3] || ''), json:String(v[4] || '')}, editor);
    if (item) { delete item.json; out.push(item); }
  });
  return out.sort(function(a,b) { return b.updatedAt.localeCompare(a.updatedAt); });
}
function doGet(e) {
  publishedCache_ = null;
  const p = e && e.parameter || {};
  if (p.action === 'ping') return jsonOut({ok:true, service:'sandle-minutes', publicationVersion:1});
  if (!checkToken(p.token)) return jsonOut({ok:false, error:'unauthorized'});
  if (p.action === 'list') return jsonOut({ok:true, items:publicationList_(false), publicationVersion:1});
  if (p.action === 'get') return jsonOut({ok:true, item:publicationItem_(getItem(p.id), false)});
  return legacyDoGet(e);
}
function doPost(e) {
  publishedCache_ = null;
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (_) { return jsonOut({ok:false,error:'bad json'}); }
  if (!checkToken(body.token)) return jsonOut({ok:false,error:'unauthorized'});
  const action = body.action;
  if (action === 'authorList' || action === 'authorGet' || action === 'saveAgendas') return jsonOut(writerAction_(body));
  if (action === 'list' || action === 'get' || action === 'publish') {
    if (!checkAdmin(body.adminKey)) return jsonOut({ok:false,error:'admin_required'});
    if (action === 'list') return jsonOut({ok:true,items:publicationList_(true),editor:true,publicationVersion:1});
    if (action === 'get') return jsonOut({ok:true,item:publicationItem_(getItem(body.id),true),editor:true});
    return jsonOut(publishMeeting_(body));
  }
  if (action === 'save') {
    if (!checkAdmin(body.adminKey)) return jsonOut({ok:false,error:'admin_required'});
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      const rec = body.record || {}, old = rec.id && getItem(rec.id);
      const state = publicationState_(rec);
      if (publicationManaged_(state) || publicationManaged_(publicationState_(old)) || (rec.id && publishedItem_(rec.id))) {
        if (!state || !state.meeting) return jsonOut({ok:false,error:'meeting_required'});
        state.publication = {managed:true}; // 클라이언트가 발행 여부를 위조할 수 없다.
        rec.json = JSON.stringify(state);
      }
      if (String(rec.json || '').length > 49000) return jsonOut({ok:false,error:'record_too_large'});
      const id = saveItem(rec);
      return jsonOut({ok:true,id:id,publication:publicationItem_(getItem(id),true).publication || null});
    } finally { lock.releaseLock(); }
  }
  if(action==='setTags'||action==='delete'){
    const lock=LockService.getScriptLock();lock.waitLock(10000);
    try{return legacyDoPost(e);}finally{lock.releaseLock();}
  }
  return legacyDoPost(e);
}
function publishMeeting_(body) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const item = getItem(body.id);
    if (!item) return {ok:false,error:'not_found'};
    if (!publicationManaged_(publicationState_(item))) return {ok:false,error:'legacy_public'};
    if (!body.expectedUpdatedAt || item.updatedAt !== body.expectedUpdatedAt) return {ok:false,error:'conflict'};
    const sh = publishedSheet_(true), r = findRow(sh, item.id);
    const previous = publishedItem_(item.id);
    // 재시도는 같은 결과를 반환한다. 작성본/날짜는 변경하지 않는다.
    if (!previous || previous.json !== item.json || previous.name !== item.name || previous.date !== item.date) {
      const row = [item.id,item.name,item.date,new Date().toISOString(),item.json];
      if (r < 0) sh.appendRow(row); else sh.getRange(r,1,1,5).setValues([row]);
    }
    publishedCache_ = null;
    return {ok:true,id:item.id,publication:publicationItem_(item,true).publication};
  } finally { lock.releaseLock(); }
}
