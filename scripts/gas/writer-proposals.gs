/** Separate author material store. Committed revisions retain the previous contents. */
const WRITER_PROPOSAL_HEADERS_=['id','revision','part','title','date','updatedAt','owner','chunk','length','status'];
function writerProposalSheet_(create) {
  const ss=SpreadsheetApp.openById(SHEET_ID);let sh=ss.getSheetByName('writer_proposals');
  if(!sh&&create){sh=ss.insertSheet('writer_proposals');sh.appendRow(WRITER_PROPOSAL_HEADERS_);}
  if(sh){const headers=sh.getRange(1,1,1,10).getValues()[0];if(WRITER_PROPOSAL_HEADERS_.some(function(v,i){return v!==headers[i];}))throw new Error('proposal_schema_mismatch');}
  return sh;
}
function writerProposalRows_(sh){return sh&&sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,10).getValues():[];}
function writerProposalLatest_(rows){const out={};rows.forEach(function(r){if(Number(r[2])===0&&r[9]==='committed')out[String(r[0])]=r;});return out;}
function writerProposalMetadata_(r){return {id:String(r[0]),revision:String(r[1]),title:String(r[3]),date:r[4] instanceof Date?Utilities.formatDate(r[4],'Asia/Seoul','yyyy-MM-dd'):String(r[4]),updatedAt:String(r[5]),owner:'writer'};}
function writerProposalAction_(body){
  const admin=checkAdmin(body.adminKey);
  if(!admin&&!checkWriter_(body.adminKey))return {ok:false,error:'writer_required'};
  const action=body.action,rec=body.record||{},id=String(rec.id||body.id||'');
  if(action!=='writerProposalList'&&!/^proposal_writer_[A-Za-z0-9_-]{1,100}$/.test(id))return {ok:false,error:'not_owned'};
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const sh=writerProposalSheet_(false),rows=writerProposalRows_(sh),latest=writerProposalLatest_(rows),old=latest[id];
    if(action==='writerProposalList')return {ok:true,items:Object.keys(latest).filter(function(k){return latest[k][7]!=='deleted';}).map(function(k){return writerProposalMetadata_(latest[k]);})};
    if(action==='writerProposalGet'){
      if(!old||old[7]==='deleted')return {ok:true,item:null};
      const json=rows.filter(function(r){return r[0]===id&&r[1]===old[1]&&Number(r[2])>0;}).sort(function(a,b){return Number(a[2])-Number(b[2]);}).map(function(r){return String(r[7]);}).join('');
      if(json.length!==Number(old[8]))return {ok:false,error:'incomplete_record'};
      return {ok:true,item:Object.assign(writerProposalMetadata_(old),{json:json})};
    }
    if(!['writerProposalSave','writerProposalDelete'].includes(action))return {ok:false,error:'unknown_action'};
    if(old&&(!body.expectedRevision||body.expectedRevision!==String(old[1])))return {ok:false,error:'conflict'};
    if(!old&&body.expectedRevision)return {ok:false,error:'conflict'};
    if(action==='writerProposalDelete'&&(!old||old[7]==='deleted'))return {ok:true};
    let json='',title='',date='';
    if(action==='writerProposalSave'){
      json=String(rec.json||'');title=String(rec.title||'');date=String(rec.date||'');
      let payload;try{payload=JSON.parse(json);}catch(_){return {ok:false,error:'invalid_record'};}
      if(payload.kind!=='agenda-proposal'||!payload.data||!title||title.length>1000||json.length>8*1024*1024||!/^\d{4}-\d{2}-\d{2}$/.test(date))return {ok:false,error:'invalid_record'};
      const parsed=new Date(date+'T00:00:00Z');if(isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)return {ok:false,error:'invalid_record'};
    }else{title=String(old[3]);date=writerProposalMetadata_(old).date;}
    const target=sh||writerProposalSheet_(true),revision=Utilities.getUuid(),at=new Date().toISOString(),chunks=[];
    for(let i=0;i<json.length;i+=40000)chunks.push([id,revision,chunks.length+1,title,date,at,'writer',json.slice(i,i+40000),json.length,'pending']);
    if(chunks.length){
      const start=target.getLastRow()+1;target.getRange(start,1,chunks.length,10).setValues(chunks);SpreadsheetApp.flush();
      const stored=target.getRange(start,1,chunks.length,10).getValues();
      if(stored.map(function(r){return String(r[7]);}).join('')!==json)return {ok:false,error:'backup_failed'};
    }
    // Publish metadata only after every chunk has been read back. Older revisions remain intact.
    const commit=[id,revision,0,title,date,at,'writer',action==='writerProposalDelete'?'deleted':'active',json.length,'committed'];
    target.appendRow(commit);SpreadsheetApp.flush();
    const stored=target.getRange(target.getLastRow(),1,1,10).getValues()[0];
    if(String(stored[1])!==revision||stored[9]!=='committed')return {ok:false,error:'backup_failed'};
    return {ok:true,id:id,revision:revision,updatedAt:at,owner:'writer'};
  }finally{lock.releaseLock();}
}
