/** Limited agenda author. Credentials live only in Script Properties. */
function checkWriter_(key) {
  const expected = PropertiesService.getScriptProperties().getProperty('WRITER_KEY') || '';
  return !!expected && String(key) === expected;
}
function writerItem_(item) {
  const s = publicationState_(item);
  if (!item || !s || !s.meeting || !publicationManaged_(s)) return null;
  // Only the context needed by the agenda form; never source/system records.
  return {id:item.id,name:item.name,date:item.date,updatedAt:item.updatedAt,
    state:{meeting:s.meeting,rosters:s.rosters || {},rosterTermNo:s.rosterTermNo,
      rosterBody:s.rosterBody,agendas:s.agendas || [],publication:{managed:true}}};
}
function writerOwned_(item) {
  const s = publicationState_(item);
  return !!s && (s.writerOwner === "writer" || (!!s.writerCreation && String(item.id).indexOf("m_writer_") === 0));
}
function writerAction_(body) {
  if (!checkWriter_(body.adminKey) && !checkAdmin(body.adminKey)) return {ok:false,error:'writer_required'};
  if (body.action === 'authorTemplates') return {ok:true,items:publicationList_(true).filter(function(item){return !!item.publication;}).map(function(item){return {id:item.id,name:item.name,date:item.date};})};
  if (body.action === 'authorList') {
    return {ok:true,items:publicationList_(true).filter(function(item) {return !!item.publication && (checkAdmin(body.adminKey) || writerOwned_(getItem(item.id)));})};
  }
  if (body.action === 'authorGet') { const old=getItem(body.id); return {ok:true,item:checkAdmin(body.adminKey)||writerOwned_(old)?writerItem_(old):null}; }
  if (body.action === 'authorCreate') return writerCreate_(body);
  if (body.action === 'authorSaveSettings') return writerSaveSettings_(body);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const old = getItem(body.id), item = writerItem_(old);
    if (!item || (!checkAdmin(body.adminKey) && !writerOwned_(old))) return {ok:false,error:'meeting_not_available'};
    if (!body.expectedUpdatedAt || old.updatedAt !== body.expectedUpdatedAt) return {ok:false,error:'conflict'};
    if (!Array.isArray(body.agendas) || body.agendas.length > 100 ||
        body.agendas.some(function(a){return !a || typeof a !== 'object' || Array.isArray(a) ||
          typeof a.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(a.id) ||
          (a.materials && (!Array.isArray(a.materials) || a.materials.some(function(m){return !m || !/^[A-Za-z0-9_-]{1,100}$/.test(m.id || '');})));}))
      return {ok:false,error:'invalid_agendas'};
    const s = publicationState_(old);
    s.agendas = body.agendas;
    s.publication = {managed:true};
    const json = JSON.stringify(s);
    if (json.length > 49000) return {ok:false,error:'record_too_large'};
    if (JSON.stringify(publicationState_(old).agendas || []) === JSON.stringify(body.agendas))
      return {ok:true,item:writerItem_(old)};
    // Archive both states before writing. Admin-key changes are not writer changes.
    if (!checkAdmin(body.adminKey)) {
      try { writerBackup_(old, json); }
      catch (_) { return {ok:false,error:'backup_failed'}; }
    }
    // Merge on the server; ignore any client meeting/name/date/roster/source.
    saveItem({id:old.id,name:old.name,date:old.date,json:json});
    return {ok:true,item:writerItem_(getItem(old.id))};
  } finally { lock.releaseLock(); }
}

/** Private server-side archive; never a minutes/system record or public export. */
const WRITER_BACKUP_HEADERS = ['backupId','meetingId','backedUpAt','actor','recordMetadata','beforeJson','afterJson'];
function writerBackupSheet_(create) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName('minutes_writer_backups');
  if (!sh && create) { sh = ss.insertSheet('minutes_writer_backups'); sh.appendRow(WRITER_BACKUP_HEADERS); }
  return sh;
}
function writerBackup_(old, nextJson, operation) {
  const meta = {id:old.id,name:old.name,date:old.date,updatedAt:old.updatedAt};
  if (operation === 'create') meta.operation = 'create';
  const metadata = JSON.stringify(meta);
  // Full state lives in its own cell, avoiding JSON-within-JSON expansion.
  if (String(old.json).length > 50000 || metadata.length > 50000) throw new Error('backup_too_large');
  const sh = writerBackupSheet_(true);
  const headers = sh.getRange(1,1,1,WRITER_BACKUP_HEADERS.length).getValues()[0];
  if (WRITER_BACKUP_HEADERS.some(function(value,i){return headers[i] !== value;})) throw new Error('backup_schema_mismatch');
  const row = [Utilities.getUuid(),old.id,new Date().toISOString(),'writer',metadata,old.json,nextJson];
  const at = sh.getLastRow() + 1;
  sh.getRange(at,1,1,row.length).setValues([row]);
  SpreadsheetApp.flush();
  const stored = sh.getRange(at,1,1,row.length).getValues()[0];
  if (row.some(function(value,i){return String(stored[i]) !== String(value);})) throw new Error('backup_verify_failed');
}
function writerBackupAction_(body) {
  if (!checkAdmin(body.adminKey)) return {ok:false,error:'admin_required'};
  const sh = writerBackupSheet_(false);
  if (!sh) return body.action === 'writerBackupList' ? {ok:true,items:[]} : {ok:true,item:null};
  if (body.action === 'writerBackupGet') {
    const at = findRow(sh,body.backupId);
    if (at < 0) return {ok:true,item:null};
    const v = sh.getRange(at,1,1,7).getValues()[0], meta = JSON.parse(String(v[4]));
    const record = {id:meta.id,name:meta.name,date:meta.date,updatedAt:meta.updatedAt};
    return {ok:true,item:{backupId:String(v[0]),meetingId:String(v[1]),backedUpAt:String(v[2]),actor:String(v[3]),
      operation:meta.operation || 'update',before:meta.operation === 'create' ? null : Object.assign({},record,{json:String(v[5])}),
      proposed:Object.assign({},record,{json:String(v[6])})}};
  }
  const last = sh.getLastRow();
  // Metadata only: listing history never downloads every archived JSON.
  const values = last > 1 ? sh.getRange(2,1,last-1,5).getValues() : [];
  const items = values.filter(function(v){return v[0] && (!body.id || String(v[1]) === String(body.id));})
    .map(function(v){const meta=JSON.parse(String(v[4]));return {backupId:String(v[0]),meetingId:String(v[1]),
      backedUpAt:String(v[2]),actor:String(v[3]),operation:meta.operation || 'update',name:meta.name,date:meta.date,previousUpdatedAt:meta.updatedAt};}).reverse();
  return {ok:true,items:items};
}

/** New meetings only; request IDs make network retries safe without overwriting. */
function writerCreate_(body) {
  const m = body.meeting || {}, requestId = String(body.requestId || '');
  const date = String(m.date || ''), time = String(m.time || ''), place = String(m.place || '').trim();
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(requestId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !['정기','임시'].includes(m.type) || (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) || place.length > 200)
    return {ok:false,error:'invalid_meeting'};
  const parsed = new Date(date + 'T00:00:00Z');
  if (isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date) return {ok:false,error:'invalid_meeting'};
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const source = getItem(body.templateId), template = writerItem_(source);
    if (!template) return {ok:false,error:'meeting_not_available'};
    const base = template.state, term = Number(base.meeting.termNo), kind = base.meeting.body;
    if (!Number.isInteger(term) || term < 1 || term > 99 || !['입대의','임차'].includes(kind)) return {ok:false,error:'invalid_template'};
    const input = {templateId:String(body.templateId),date:date,type:m.type,time:time,place:place};
    const id = 'm_writer_' + requestId, existing = getItem(id);
    if (existing) {
      const previous = publicationState_(existing);
      return previous && JSON.stringify(previous.writerCreation) === JSON.stringify(input)
        ? {ok:true,item:writerItem_(existing)} : {ok:false,error:'id_conflict'};
    }
    const meeting = {body:kind,termNo:term,year:Number(date.slice(0,4)),month:Number(date.slice(5,7)),
      date:date,type:m.type,time:time,place:place,attendance:{},guests:[],audience:'',sequence:[]};
    const name = '제' + term + '기 ' + meeting.year + '년' + String(meeting.month).padStart(2,'0') + '월 ' + m.type + ' ' +
      (kind === '임차' ? '임차인대표회의' : '입주자대표회의');
    meeting.name = name;
    const state = {meeting:meeting,rosters:base.rosters || {},rosterTermNo:term,rosterBody:kind,
      agendas:[],cloudId:id,publication:{managed:true},writerOwner:"writer",writerCreation:input};
    const json = JSON.stringify(state);
    if (json.length > 49000) return {ok:false,error:'record_too_large'};
    if (!checkAdmin(body.adminKey)) {
      try { writerBackup_({id:id,name:name,date:date,updatedAt:'',json:''},json,'create'); }
      catch (_) { return {ok:false,error:'backup_failed'}; }
    }
    saveItem({id:id,name:name,date:date,json:json});
    return {ok:true,item:writerItem_(getItem(id))};
  } finally { lock.releaseLock(); }
}

/** Merge only meeting settings into the author's own record. */
function writerSaveSettings_(body) {
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try {
    const old=getItem(body.id),s=publicationState_(old),m=body.meeting;
    if (!writerItem_(old) || (!checkAdmin(body.adminKey)&&!writerOwned_(old))) return {ok:false,error:'meeting_not_available'};
    if (!body.expectedUpdatedAt || body.expectedUpdatedAt!==old.updatedAt) return {ok:false,error:'conflict'};
    if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(m.date||'') || !['정기','임시'].includes(m.type) ||
      !['입대의','임차'].includes(m.body) || !Number.isInteger(Number(m.termNo)) || Number(m.termNo)<1 || Number(m.termNo)>99 ||
      String(m.place||'').length>200 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(m.time||'')) return {ok:false,error:'invalid_meeting'};
    const date=new Date(m.date+'T00:00:00Z');
    if(isNaN(date.getTime())||date.toISOString().slice(0,10)!==m.date)return {ok:false,error:'invalid_meeting'};
    const next=Object.assign({},s.meeting);
    ['body','termNo','type','date','time','place','attendance','guests','audience','sequence'].forEach(function(k){if(Object.prototype.hasOwnProperty.call(m,k))next[k]=m[k];});
    next.termNo=Number(next.termNo);next.year=Number(m.date.slice(0,4));next.month=Number(m.date.slice(5,7));
    next.name='제'+next.termNo+'기 '+next.year+'년'+String(next.month).padStart(2,'0')+'월 '+next.type+' '+(next.body==='임차'?'임차인대표회의':'입주자대표회의');
    if(body.agendas!==undefined){
      if(!Array.isArray(body.agendas)||body.agendas.length>100||body.agendas.some(function(a){return !a||typeof a!=="object"||Array.isArray(a)||!/^([A-Za-z0-9_-]{1,100})$/.test(a.id||'');}))return {ok:false,error:'invalid_agendas'};
      s.agendas=body.agendas;
    }
    if(JSON.stringify(next)===JSON.stringify(s.meeting)&&JSON.stringify(s.agendas)===JSON.stringify(publicationState_(old).agendas))return {ok:true,item:writerItem_(old)};
    s.meeting=next;if(writerOwned_(old))s.writerOwner='writer';const json=JSON.stringify(s);
    if(json.length>49000)return {ok:false,error:'record_too_large'};
    if(!checkAdmin(body.adminKey)){try{writerBackup_(old,json);}catch(_){return {ok:false,error:'backup_failed'};}}
    saveItem({id:old.id,name:next.name,date:next.date,json:json});
    return {ok:true,item:writerItem_(getItem(old.id))};
  } finally {lock.releaseLock();}
}
