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
function writerAction_(body) {
  if (!checkWriter_(body.adminKey) && !checkAdmin(body.adminKey)) return {ok:false,error:'writer_required'};
  if (body.action === 'authorList') {
    return {ok:true,items:publicationList_(true).filter(function(item) {return !!item.publication;})};
  }
  if (body.action === 'authorGet') return {ok:true,item:writerItem_(getItem(body.id))};
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const old = getItem(body.id), item = writerItem_(old);
    if (!item) return {ok:false,error:'meeting_not_available'};
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
    // Merge on the server; ignore any client meeting/name/date/roster/source.
    saveItem({id:old.id,name:old.name,date:old.date,json:json});
    return {ok:true,item:writerItem_(getItem(old.id))};
  } finally { lock.releaseLock(); }
}
