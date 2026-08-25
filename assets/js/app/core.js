const STORAGE_KEY = "sandle_minutes_v3";
const ARCHIVE_KEY = "sandle_minutes_archive_v1";
const dongList = Array.from({length:16},(_,i)=>201+i);

// 산들마을 기수 기준점: 제5기 2024.09.20 ~ 2026.09.19, 이후 2년 단위
const TERM_ANCHOR = {term:5, start:"2024-09-20"};

function localTodayString(){
  const now=new Date();
  const y=now.getFullYear(), m=String(now.getMonth()+1).padStart(2,"0"), d=String(now.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function addYearsYmd(ymd, years){
  const [y,m,d]=ymd.split("-").map(Number);
  return `${y+years}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}
function dayBefore(ymd){
  const [y,m,d]=ymd.split("-").map(Number);
  const dt=new Date(y,m-1,d); dt.setDate(dt.getDate()-1);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
}
function termRange(termNo){
  const delta=termNo-TERM_ANCHOR.term;
  const start=addYearsYmd(TERM_ANCHOR.start,delta*2);
  const end=dayBefore(addYearsYmd(start,2));
  return {start,end};
}
function termForDate(ymd){
  for(let n=1;n<=12;n++){
    const r=termRange(n);
    if(ymd>=r.start && ymd<=r.end) return n;
  }
  return TERM_ANCHOR.term;
}
function formatTermDate(ymd){ return ymd.replaceAll("-","."); }
// 임차인대표회의 기수 기간표 (v49): 입대의(TERM_ANCHOR 2년 주기)와 기간이 다르다 — 선출 시부터 2년, 기수 사이 공백도 있다.
// 자료로 확인된 기수만 적고 나머지는 "기간 미확인"으로 보여 준다. (새 기수 자료가 오면 여기에 추가)
const TENANT_TERMS = {
  4:{start:"", end:"2024-05-22", approx:true,  note:"시작일 미확인. 2024.05.22 마지막 회의(5기 선거 2024.05.20~22와 같은 날) — 5명 구성(진세택 회장·원영해 부회장·김아도 감사·한경열·강명순)"},
  5:{start:"2024-05-23", end:"2025-12-23", approx:true,  note:"2024.05.20~22 선거, 05.23 당선인 공고(6명: 제2·3·4·5·8·9선거구), 06.21 첫 회의에서 임원 선출. 종료일은 6기 취임(2025.12.24) 전날로 적음 — 임기 종료 시점 미확인(2025.10 공고 댓글 '10월 8일 종료'와 어긋남)"},
  6:{start:"2025-12-24", end:"2027-12-23", approx:false, note:"2025.12.24 선거(당선인 공고 12.26), 선출 시부터 2년"}
};
function termRangeFor(termNo, body){
  if(body==="임차"){ const t=TENANT_TERMS[termNo]; return t ? {start:t.start, end:t.end, approx:!!t.approx, note:t.note||""} : null; }
  return termRange(termNo);
}
function termOptionLabel(n, body){
  const r=termRangeFor(n, body);
  const f=(d)=>d ? formatTermDate(d) : "미확인"; // 시작/종료일을 모르는 기수 (v62)
  return r ? `제${n}기 (${f(r.start)} ~ ${f(r.end)}${r.approx?" 추정":""})` : `제${n}기 (기간 미확인)`;
}
// ②·⑥ 기수 선택지를 회의체에 맞는 기간 표기로 다시 채운다 (선택값 유지)
function refreshTermSelects(){
  const fill=(id, body)=>{
    const sel=document.getElementById(id); if(!sel) return;
    if(sel.dataset.body===body) return;
    const cur=sel.value;
    sel.innerHTML=Array.from({length:12},(_,i)=>i+1).map(n=>`<option value="${n}" title="${esc((termRangeFor(n,body)||{}).note||"")}">${termOptionLabel(n, body)}</option>`).join("");
    sel.dataset.body=body; if(cur) sel.value=cur;
  };
  fill("termNo", typeof state!=="undefined"&&state ? bodyOf() : "입대의");
  fill("rosterTermNo", typeof state!=="undefined"&&state ? rosterBody() : "입대의");
}
function defaultMeeting(){
  const today=localTodayString();
  const dt=new Date(today+"T00:00:00");
  return {
    body:"입대의",
    termNo:termForDate(today),
    year:dt.getFullYear(),
    month:dt.getMonth()+1,
    type:"정기",
    date:today,
    time:"오후 7시",
    place:"관리사무소 대표회의실",
    name:"",
    attendance:{},
    guests:[],
    audience:{count:0},
    sequence:["개회","안건 상정·심의·의결","폐회"]
  };
}
function emptyRoster(){
  return dongList.map(d=>({dong:d,role:"대표",name:""}));
}
const defaultState = () => {
  const meeting=defaultMeeting();
  return {
    meeting,
    rosterTermNo:meeting.termNo,
    rosters:{[String(meeting.termNo)]:emptyRoster()},
    agendas:[]
  };
};
let state = loadState();

function uid(){ return Math.random().toString(36).slice(2,9); }
// ---- 회의체 (v43) ----
// 입주자대표회의(입대의) / 임차인대표회의(임차). 레코드에 body가 없으면 입대의로 본다.
function bodyOf(m){ m=m||(state&&state.meeting)||{}; return m.body==="임차" ? "임차" : "입대의"; }
function bodyLabel(b){ return (b||bodyOf())==="임차" ? "임차인대표회의" : "입주자대표회의"; }
function docTitle(){ return `산들마을 ${bodyLabel()} 회의록`; }
// 출력물 머리표시 (v45): 제목 위에 ◆/◇ + 회의체명 한 줄 — 화면·Word 공통, 흑백 인쇄에서도 구분
function bodyMark(){ return (bodyOf()==="임차" ? "◇ 임차인대표회의" : "◆ 입주자대표회의"); }
function bodyMarkHtml(mode){
  const tenant=bodyOf()==="임차";
  if(mode==="word") return `<div style="text-align:center;font-size:9pt;font-weight:bold;letter-spacing:.08em;color:${tenant?"#2f5f80":"#7a5a12"};margin:0 0 4pt">${bodyMark()}</div>`;
  return `<div class="doc-body-mark${tenant?"":" owner"}">${bodyMark()}</div>`;
}
// 명단 저장 키: 입대의는 "5", 임차는 "t6"처럼 회의체별로 분리
function rosterKeyFor(termNo, body){ const n=String(Number(termNo)); return (body||bodyOf())==="임차" ? "t"+n : n; }
function applyBodyTheme(){
  const b=bodyOf();
  try{ document.documentElement.setAttribute("data-body", b); }catch(e){}
  const chip=document.getElementById("bodyChip");
  if(chip) chip.textContent=(b==="임차"?"◇ ":"◆ ")+bodyLabel(b);
  const help=document.getElementById("termHelp");
  if(help) help.textContent = b==="임차" ? "임차인대표회의는 기수를 직접 선택합니다. 기수 기간은 입대의와 다르며(선출 시부터 2년), 자료로 확인된 기수만 날짜를 표기하고 나머지는 「기간 미확인」으로 둡니다." : "오늘 날짜를 기준으로 기수가 자동 선택됩니다. 직접 변경할 수 있습니다.";
}
// ③에서 보는 명단의 회의체 (v46): 현재 회의록의 회의체와 별개로 선택 가능. 미설정이면 현재 회의록의 회의체.
function rosterBody(){ return (state && state.rosterBody==="임차") ? "임차" : (state && state.rosterBody==="입대의") ? "입대의" : bodyOf(); }
// 명단 마스터 (v46): 회의록마다 명단 스냅샷을 따로 갖기 때문에, 다른 회의체/기수 명단은 이 기기에 모아둔 사본(마스터)에서 채운다.
// 이름이 있는 명단이 로드·수정될 때마다 마스터에 반영되고, 현재 회의록에 없는 키를 열면 마스터에서 가져온다.
const ROSTER_MASTER_KEY="sandle_roster_master_v1";
function rosterMasterLoad(){ try{ return JSON.parse(localStorage.getItem(ROSTER_MASTER_KEY))||{}; }catch(e){ return {}; } }
function rosterMasterPut(key, roster){
  if(!roster || !roster.some(r=>String(r.name||"").trim())) return;
  // 같은 키(기수)라도 회의록 시점에 따라 명단이 다를 수 있으므로, 회의 날짜가 더 최근인 것만 마스터로 삼는다
  try{ const m=rosterMasterLoad(); const d=String((state&&state.meeting&&state.meeting.date)||""); const cur=m[key]; if(cur && cur.date && d && d<cur.date) return; m[key]={date:d, rows:roster.map(r=>({dong:r.dong,role:r.role,name:r.name,unit:r.unit||""}))}; localStorage.setItem(ROSTER_MASTER_KEY, JSON.stringify(m)); }catch(e){}
}
function ensureRoster(termNo, body){
  const key=rosterKeyFor(termNo, body);
  if(!state.rosters) state.rosters={};
  // 임차(키 "t…")는 동이 아니라 1~16 번호를 키로 쓴다(동은 unit에 선택 기재). (v44)
  const seats = key.startsWith("t") ? Array.from({length:16},(_,i)=>i+1) : dongList;
  if(!state.rosters[key]){
    const fm=rosterMasterLoad()[key]; let fromMaster=fm && Array.isArray(fm.rows) ? fm.rows : (Array.isArray(fm)?fm:null);
    // 이 기기 사본에 없으면 전체 회의록(⑥ 사본)에서 그 기수 명단이 든 가장 최근 회의록의 명단을 가져온다 (v59)
    if(!(Array.isArray(fromMaster)&&fromMaster.some(r=>String(r.name||"").trim())) && window.Topic && Topic.rosterFor){ try{ const rf=Topic.rosterFor(key); if(rf&&rf.length) fromMaster=rf; }catch(e){} }
    state.rosters[key]=Array.isArray(fromMaster)&&fromMaster.length ? fromMaster.map(r=>({dong:r.dong,role:r.role||"대표",name:r.name||"",unit:r.unit||""})) : seats.map(d=>({dong:d,role:"대표",name:""}));
  }
  rosterMasterPut(key, state.rosters[key]);
  // guarantee 16 rows
  if(state.rosters[key].length!==16 || state.rosters[key].some((r,i)=>Number(r.dong)!==seats[i])){
    const existing=state.rosters[key]||[];
    state.rosters[key]=seats.map(d=>{
      const found=existing.find(r=>Number(r.dong)===d);
      return found?{dong:d,role:found.role||"대표",name:found.name||"",unit:found.unit||""}:{dong:d,role:"대표",name:""};
    });
  }
  return state.rosters[key];
}
function currentRoster(){
  return ensureRoster(state.meeting.termNo);
}
function displayedRoster(){
  return ensureRoster(state.rosterTermNo||state.meeting.termNo, rosterBody());
}
function currentAttendees(){
  const att=state.meeting.attendance||{};
  return currentRoster().filter(r=>r.name.trim() && !!att[String(r.dong)]);
}
function actorKey(rep){
  return String(rep.dong);
}
// 좌석 표기 (v44): 입대의는 "204동", 임차는 동을 알면 "204동", 모르면 "3번"(명단 번호)
function seatLabel(rep){
  if(!rep) return "";
  if(bodyOf()==="임차"){ const u=String(rep.unit||"").trim(); return u ? `${u}동` : `${rep.dong}번`; }
  return `${rep.dong}동`;
}
function actorLabel(rep){
  return `${seatLabel(rep)}`;
}
function actorFullLabel(rep){
  return `${seatLabel(rep)} ${rep.name||"성명 미입력"}${rep.role?`(${rep.role})`:""}`;
}
function guestActorKey(guest){
  return `guest:${guest.id}`;
}
function guestPersonLabel(guest){
  return `${guest.name||"성명 미입력"}${guest.position?`(${guest.position})`:""}`;
}
function guestSpeakerLabel(guest){
  return String(guest.position||"").trim() || String(guest.name||"").trim() || "배석자";
}
function guestCoverLabel(guest){
  const person=guestPersonLabel(guest);
  return `${person}${guest.type?` · ${guest.type}`:""}`;
}
function currentRemarkSpeakers(){
  const representatives=currentAttendees().map(rep=>({key:actorKey(rep),label:actorFullLabel(rep),kind:"representative",rep}));
  const guests=(state.meeting.guests||[])
    .filter(guest=>String(guest.name||"").trim() || String(guest.position||"").trim())
    .map(guest=>({key:guestActorKey(guest),label:guestSpeakerLabel(guest),kind:"guest",guest}));
  return [...representatives,...guests];
}
function remarkSpeakerLabel(key){
  const rep=currentRoster().find(r=>String(r.dong)===String(key)||r.name===key);
  if(rep) return actorFullLabel(rep);
  const guestId=String(key).startsWith("guest:")?String(key).slice(6):"";
  const guest=(state.meeting.guests||[]).find(g=>g.id===guestId || g.name===key);
  return guest?guestSpeakerLabel(guest):String(key||"발언자");
}
function migrateState(parsed){
  const def=defaultState();
  if(!parsed || typeof parsed!=="object") return def;

  parsed.agendas=Array.isArray(parsed.agendas)?parsed.agendas:[];
  const old=parsed.meeting||{};
  const m=defaultMeeting();

  m.body=(old.body==="임차")?"임차":"입대의"; // v43: 회의체(없으면 입대의)
  if(old.termNo) m.termNo=Number(old.termNo);
  else if(old.term){
    const mm=String(old.term).match(/(\d+)/);
    if(mm) m.termNo=Number(mm[1]);
  }
  if(old.year) m.year=Number(old.year);
  if(old.month) m.month=Number(old.month);
  if(old.type) m.type=old.type;
  if(old.date) m.date=old.date;
  if(old.time) m.time=old.time;
  if(old.place) m.place=old.place;
  m.attendance=(old.attendance && typeof old.attendance==="object") ? {...old.attendance} : {};
  m.guests=Array.isArray(old.guests) ? old.guests.map(g=>({
    id:g.id||uid(),
    type:["관리업체","용역·업체","주택관리업체","커뮤니티업체","커뮤니티 위탁운영업체","위탁관리업체(주택관리업자)"].includes(g.type)
      ? "업체 관계자"
      : g.type==="입주민(설명·제안)" ? "안건관계인" : (g.type||"관리사무소"),
    position:g.position||"",
    name:g.name||""
  })) : [];
  m.audience=(old.audience && typeof old.audience==="object")
    ? {count:Math.max(0,Math.floor(Number(old.audience.count)||0))}
    : {count:0};
  m.sequence=Array.isArray(old.sequence) && old.sequence.length
    ? old.sequence.map(x=>String(x))
    : ["개회","안건 상정·심의·의결","폐회"];
  if(m.sequence.length===3 && m.sequence[0]==="개회" && m.sequence[1]==="회의안건 상정 및 토의" && m.sequence[2]==="폐회"){
    m.sequence[1]="안건 상정·심의·의결";
  }

  // v2의 단일 reps 배열을 해당 회의 기수 roster로 변환
  let rosters=parsed.rosters||{};
  if(parsed.reps && Array.isArray(parsed.reps)){
    const roster=emptyRoster();
    parsed.reps.forEach((r,i)=>{
      if(i<16){
        roster[i]={
          dong:Number(r.dong)||dongList[i],
          role:r.role||"대표",
          name:r.name||""
        };
        if(r.attend) m.attendance[String(roster[i].dong)]=true;
      }
    });
    rosters[String(m.termNo)]=roster;
  }
  parsed.meeting=m;
  parsed.rosters=rosters;
  parsed.rosterTermNo=Number(parsed.rosterTermNo)||m.termNo;
  delete parsed.reps;

  // ensure current roster
  const key=String(m.termNo);
  if(!parsed.rosters[key]) parsed.rosters[key]=emptyRoster();
  return parsed;
}
function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    return migrateState(JSON.parse(raw));
  }catch(e){ return defaultState(); }
}
function buildMeetingName(){
  const m=state.meeting;
  const mm=String(Number(m.month)||1).padStart(2,"0");
  const prefix=`제${m.termNo}기 ${m.year}년${mm}월`;
  const body=bodyLabel(bodyOf(m));
  return m.type==="임시" ? `${prefix} 임시 ${body}` : `${prefix} ${body}`;
}
function weekdayKo(ymd){
  if(!ymd) return "";
  const [y,m,d]=ymd.split("-").map(Number);
  const dt=new Date(y,m-1,d);
  return ["일","월","화","수","목","금","토"][dt.getDay()];
}
function formattedMeetingDateTime(){
  const m=state.meeting;
  if(!m.date) return m.time||"";
  const pretty=m.date.replaceAll("-",".");
  const wd=weekdayKo(m.date);
  return `${pretty}.(${wd}) ${m.time||""}`.trim();
}
function saveState(){
  state.meeting.name=buildMeetingName();
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  renderMeetingControls();
  renderMetrics();
  renderPreview();
}
function startNewMeeting(){
  if(!confirm("새 회의록을 만들까요?\n지금 열려 있는 회의록에 저장하지 않은 수정이 있다면, 먼저 ② 이전 회의록에서 '☁ 현재 회의록 저장'을 눌러 주세요.")) return;
  const keepRosters=state.rosters||{};
  const keepTerm=state.rosterTermNo;
  const fresh=defaultState();
  if(Object.keys(keepRosters).length) fresh.rosters=keepRosters;
  fresh.rosterTermNo=keepTerm||fresh.rosterTermNo;
  fresh.cloudId=null;
  fresh.draft=true; // 작성 중 표시: 접속 시 최신 회의록 자동 열기가 이 문서를 덮어쓰지 않게 함
  state=fresh;
  ensureRoster(state.meeting.termNo);ensureRoster(state.rosterTermNo||state.meeting.termNo);
  persistOnly();
  renderMeetingControls();renderRepMaster();renderAttendance();renderAgendas();renderMetrics();renderPreview();
  const btn=document.querySelector('[data-view="setupView"]');
  if(btn) btn.click();
  showToast("새 회의록을 시작합니다. 회의 기본정보를 설정하세요.");
}
function esc(s=""){
  return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function listLineParts(line=""){
  const source=String(line);
  // 줄 앞 기호 인식 (v70 확장): 글머리 -–—•·▪◦*○●□■◇◆▷▶※★☆ / 번호 1. 1) (1) 가. a) ㄱ. ①⑴㉮ⓐ 등
  const match=source.match(/^(\s*)((?:[-–—•·▪◦*○●□■◇◆▷▶※★☆]|(?:\d+|[가-힣]|[A-Za-z]|[ㄱ-ㅎ])[.)]|\((?:\d+|[가-힣]|[A-Za-z]|[ㄱ-ㅎ])\)|[①-⑳⑴-⒇㉠-㉭㉮-㉻ⓐ-ⓩ]))\s*(.*)$/);
  if(!match) return null;
  const marker=match[2];
  const numbered=!/^[-–—•·▪◦*○●□■◇◆▷▶※★☆]$/.test(marker);
  const explicitIndent=Math.floor((match[1]||"").replace(/\t/g,"  ").length/2);
  return {marker,text:match[3],level:Math.min(2,explicitIndent+(numbered?1:0))};
}
function nl2br(s="",{autoBullets=false}={}){
  const lines=String(s??"").replace(/\r/g,"").split("\n");
  return `<div class="formatted-text">${lines.map(line=>{
    if(!line.length) return `<div class="formatted-line blank">&nbsp;</div>`;
    const parts=listLineParts(line);
    if(parts){
      return `<div class="formatted-line hanging level-${parts.level||0}"><span class="formatted-marker">${esc(parts.marker)}</span><span>${esc(parts.text)}</span></div>`;
    }
    return autoBullets
      ? `<div class="formatted-line hanging"><span class="formatted-marker">-</span><span>${esc(line.trimStart())}</span></div>`
      : `<div class="formatted-line">${esc(line)}</div>`;
  }).join("")}</div>`;
}
function sequenceItems(){
  return (state.meeting.sequence||[]).map(s=>String(s||"").trim()).filter(Boolean);
}
function sequenceIsStacked(items=sequenceItems()){
  return items.length!==3 || items.some(item=>item.length>16) || items.join("").length>38;
}
function sequenceDisplayHtml(){
  const items=sequenceItems();
  if(!items.length) return "-";
  const stacked=sequenceIsStacked(items);
  const layoutClass=!stacked&&items.length===3?"three-step":(stacked?"stacked":"");
    return `<div class="sequence-flow ${layoutClass}" style="--sequence-count:${items.length}">${items.map((item)=>
      `<div class="sequence-step"><span>${esc(item)}</span></div>`
  ).join("")}</div>`;
}

// 안건 입력 화면 관리자 잠금(v69)
// 저장·삭제 때 사용하는 것과 같은 서버 검증을 화면 진입 시 먼저 거친다.
// 화면만 가리는 비밀번호 비교가 아니라 Apps Script가 adminKey를 확인한다.
const AdminGate=(function(){
  const URL_="https://script.google.com/macros/s/AKfycbyhpE-DB5WAAEx7uqTCPwU-e0sPKuupkYN3YoQWALiFWe0IHFNh1y91e1VNtDmMxxoxLA/exec";
  const TOKEN="ITDXaUBDTmrz6DbQ3tv9R";
  const KEY="sandle_admin_key";
  let verified=false, checking=false, pending=null, denied=null;

  function saved(){ try{return localStorage.getItem(KEY)||"";}catch(e){return "";} }
  function remember(k){ try{localStorage.setItem(KEY,k);}catch(e){} }
  function forget(){ try{localStorage.removeItem(KEY);}catch(e){} verified=false; }
  function verify(k){
    return fetch(URL_,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"delete",id:"___verify_agenda_key___",adminKey:k,token:TOKEN})})
      .then(r=>r.json()).then(x=>!!(x&&x.ok));
  }
  function close(){ const d=document.getElementById("agendaAdminDialog"); if(d)d.remove(); checking=false; }
  function finish(ok){
    const cb=ok?pending:denied; pending=null; denied=null; close();
    if(cb) cb();
  }
  function showDialog(message=""){
    if(document.getElementById("agendaAdminDialog")) return;
    const bd=document.createElement("div"); bd.id="agendaAdminDialog";
    bd.style.cssText="position:fixed;inset:0;z-index:10002;background:rgba(30,30,28,.48);display:flex;align-items:center;justify-content:center;padding:16px";
    bd.innerHTML='<div role="dialog" aria-modal="true" aria-labelledby="agendaAdminTitle" style="background:#fff;border-radius:16px;max-width:390px;width:100%;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.25);font-size:14px;line-height:1.6">'+
      '<div id="agendaAdminTitle" style="font-weight:800;font-size:16px;margin-bottom:6px">🔒 관리자 전용 메뉴</div>'+
      '<div style="color:#666;font-size:13px;margin-bottom:12px">안건 입력 화면은 관리자 비밀번호를 확인한 뒤 열립니다.</div>'+
      '<input id="agendaAdminInput" type="password" autocomplete="current-password" placeholder="관리자 비밀번호" style="width:100%;box-sizing:border-box;padding:10px 12px;font-size:15px;border:1px solid #d9d4c8;border-radius:10px">'+
      '<div id="agendaAdminMsg" style="min-height:22px;color:#a33;font-size:12px;margin-top:5px">'+esc(message)+'</div>'+
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px"><button class="btn" id="agendaAdminCancel">취소</button><button class="btn gold" id="agendaAdminOk">확인</button></div></div>';
    document.body.appendChild(bd);
    const input=document.getElementById("agendaAdminInput"), msg=document.getElementById("agendaAdminMsg"), ok=document.getElementById("agendaAdminOk");
    function submit(){
      const k=(input.value||"").trim();
      if(!k){msg.textContent="비밀번호를 입력해 주세요.";input.focus();return;}
      if(checking)return; checking=true; ok.disabled=true; msg.style.color="#666";msg.textContent="확인 중…";
      verify(k).then(valid=>{
        checking=false;ok.disabled=false;
        if(!valid){msg.style.color="#a33";msg.textContent="비밀번호가 올바르지 않습니다.";input.select();return;}
        remember(k);verified=true;finish(true);
      }).catch(()=>{checking=false;ok.disabled=false;msg.style.color="#a33";msg.textContent="확인하지 못했습니다. 네트워크 상태를 확인해 주세요.";});
    }
    ok.onclick=submit;
    document.getElementById("agendaAdminCancel").onclick=()=>finish(false);
    input.addEventListener("keydown",e=>{if(e.key==="Enter")submit();else if(e.key==="Escape")finish(false);});
    setTimeout(()=>input.focus(),50);
  }
  function requireAccess(onGranted,onDenied){
    pending=onGranted; denied=onDenied;
    if(verified&&saved()){finish(true);return;}
    const k=saved();
    if(!k){showDialog();return;}
    if(checking)return;
    checking=true;
    verify(k).then(valid=>{
      checking=false;
      if(valid){verified=true;finish(true);}
      else{forget();showDialog("저장된 비밀번호를 다시 확인해 주세요.");}
    }).catch(()=>{checking=false;showDialog("자동 확인에 실패했습니다. 비밀번호를 다시 입력해 주세요.");});
  }
  return {require:requireAccess,forget};
})();
window.AdminGate=AdminGate;

const viewNames={
  setupView:"회의 설정",
  repsView:"동대표 명단",
  agendaView:"안건 · 발언",
  previewView:"회의록 미리보기",
  archiveView:"이전 회의록",
  topicView:"주제별 보기",
  hajaView:"하자판결금 수령 현황",
  noticeView:"관리규약 · 공고 · 점검"
};
// 작성·관리자 메뉴 묶음 접기/펼치기 (v57): 관리자 비밀번호가 있는 기기나 한 번 펼친 기기는 펼친 채로 기억
const NAV_EDIT_KEY="sandle_nav_edit_open";
function setNavGroup(open, remember){
  const g=document.getElementById("navEditGroup"); if(!g) return;
  g.classList.toggle("open", !!open);
  if(remember){ try{ localStorage.setItem(NAV_EDIT_KEY, open?"1":"0"); }catch(e){} }
}
function toggleNavGroup(){ const g=document.getElementById("navEditGroup"); setNavGroup(!(g&&g.classList.contains("open")), true); }
(function(){
  let open=false;
  try{ const v=localStorage.getItem(NAV_EDIT_KEY); if(v==="1") open=true; else if(v===null && localStorage.getItem("sandle_admin_key")) open=true; }catch(e){}
  setNavGroup(open,false);
})();
function openNavView(btn){
    document.querySelectorAll(".nav button[data-view]").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    if(btn.closest("#navEditGroup")) setNavGroup(true,false); // 묶음 안의 화면이 열리면 묶음도 펼친다
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    document.getElementById(btn.dataset.view).classList.add("active");
    document.getElementById("viewTitle").textContent=viewNames[btn.dataset.view];
    updateTopbarSaveBtn(btn.dataset.view);
    if(window.Embed) Embed.notify(btn.dataset.view); // 포털 끼움 모드 (v61)
    if(btn.dataset.view==="previewView") renderPreview();
    if(btn.dataset.view==="archiveView" && window.Cloud) Cloud.renderArchiveList();
    if(btn.dataset.view==="topicView" && window.Topic) Topic.render();
    if(btn.dataset.view==="hajaView" && window.Haja) Haja.render(); // ④ 하자판결금 (v54)
    if(btn.dataset.view==="noticeView" && window.Notices) Notices.render(); // ⑤ 공고·기록 (v65)
    if(btn.dataset.view==="repsView" && window.RosterHistory) RosterHistory.render();
    if(window.track) track("view_tab",{tab:btn.dataset.view, label:btn.textContent.trim()});
}
document.querySelectorAll(".nav button[data-view]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    if(btn.dataset.view==="agendaView"){
      AdminGate.require(
        ()=>openNavView(btn),
        ()=>{ const cur=document.querySelector(".nav button[data-view].active"); if(cur&&window.Embed) Embed.notify(cur.dataset.view); }
      );
      return;
    }
    openNavView(btn);
  });
});
// 주소로 탭 열기 (v60): ?tab=archiveView|topicView|hajaView|repsView… 또는 #archiveView — 포털 등 외부 링크에서 바로 해당 화면으로
(function(){
  try{
    const q=new URLSearchParams(location.search).get("tab") || (location.hash||"").replace(/^#/,"");
    if(!q) return;
    const btn=document.querySelector('.nav button[data-view="'+q.replace(/[^A-Za-z]/g,"")+'"]');
    if(!btn) return;
    const go=()=>btn.click();
    go(); setTimeout(go,700); // 시작 시 자동 열기 등이 화면을 바꿔도 요청한 탭으로
  }catch(e){}
})();
// 포털 끼움 모드 (v61): ?embed=1 이면 왼쪽 메뉴를 숨기고, 같은 호스트의 포털(부모 창)과 화면 전환을 메시지로 주고받는다
//   포털 → 앱: {source:"sandle-portal", type:"show", view:"archiveView"} / {type:"hello"}
//   앱 → 포털: {source:"sandle-minutes", type:"ready"|"view", view:"…"}
const Embed=(function(){
  const on=document.documentElement.classList.contains("embedded") && window.parent!==window;
  function post(msg){ if(!on) return; try{ window.parent.postMessage(Object.assign({source:"sandle-minutes"},msg), location.origin); }catch(e){} }
  function current(){ const b=document.querySelector(".nav button[data-view].active"); return b?b.dataset.view:"previewView"; }
  if(on){
    window.addEventListener("message",e=>{
      if(e.origin!==location.origin || !e.data || e.data.source!=="sandle-portal") return;
      if(e.data.type==="show"){
        const b=document.querySelector('.nav button[data-view="'+String(e.data.view||"").replace(/[^A-Za-z]/g,"")+'"]');
        if(b) b.click();
      }else if(e.data.type==="hello"){
        post({type:"view",view:current()});
      }
    });
    post({type:"ready",view:current()});
  }
  return {on, notify:v=>post({type:"view",view:v})};
})();
window.Embed=Embed;
// ⑤ 회의 설정, ⑦ 안건·발언 화면에서는 상단바에 클라우드 저장 버튼을 보여준다
function updateTopbarSaveBtn(view){
  const el=document.getElementById("topbarSaveBtn");
  if(el) el.style.display=(view==="setupView"||view==="agendaView")?"":"none";
}

function initMeetingControls(){
  const term=document.getElementById("termNo");
  term.innerHTML=Array.from({length:12},(_,i)=>i+1).map(n=>`<option value="${n}">${termOptionLabel(n,"입대의")}</option>`).join(""); // 회의체별 기간은 refreshTermSelects()가 다시 채움 (v49)
  term.dataset.body="입대의";

  const month=document.getElementById("meetingMonth");
  month.innerHTML=Array.from({length:12},(_,i)=>i+1).map(n=>
    `<option value="${n}">${String(n).padStart(2,"0")}월</option>`
  ).join("");

  term.addEventListener("change",()=>{
    const next=Number(term.value);
    if(next!==state.meeting.termNo){
      state.meeting.termNo=next;
      state.meeting.attendance={};
      ensureRoster(next);
    }
    saveState(); renderAttendance(); renderAgendas();
  });
  // 회의체 선택 (v43): 명단·회의명·테마가 함께 바뀐다
  const bodySel=document.getElementById("meetingBody");
  if(bodySel) bodySel.addEventListener("change",()=>{
    const next=bodySel.value==="임차"?"임차":"입대의";
    if(next!==bodyOf()){
      state.meeting.body=next;
      state.meeting.attendance={};
      state.rosterTermNo=state.meeting.termNo;
      state.rosterBody=next; // ⑥ 명단 회의체도 따라감 (v46)
      ensureRoster(state.meeting.termNo);
    }
    applyBodyTheme();
    saveState(); renderMeetingControls(); renderRepMaster(); renderAttendance(); renderAgendas(); renderPreview();
  });
  document.getElementById("meetingYear").addEventListener("input",e=>{state.meeting.year=Number(e.target.value)||new Date().getFullYear();saveState()});
  month.addEventListener("change",()=>{state.meeting.month=Number(month.value);saveState()});
  document.getElementById("meetingType").addEventListener("change",e=>{state.meeting.type=e.target.value;saveState()});
  document.getElementById("meetingDate").addEventListener("change",e=>{
    state.meeting.date=e.target.value;
    if(e.target.value){
      const [y,mo]=e.target.value.split("-").map(Number);
      state.meeting.year=y;
      state.meeting.month=mo;
      const nextTerm=bodyOf()==="임차" ? state.meeting.termNo : termForDate(e.target.value); // 임차는 기수 자동판정 없음 (v43)
      if(nextTerm!==state.meeting.termNo){
        state.meeting.termNo=nextTerm;
        state.meeting.attendance={};
        ensureRoster(nextTerm);
      }
    }
    saveState(); renderAttendance(); renderAgendas();
  });
  document.getElementById("meetingTime").addEventListener("input",e=>{state.meeting.time=e.target.value;saveState()});
  document.getElementById("place").addEventListener("input",e=>{state.meeting.place=e.target.value;saveState()});

  const rosterTerm=document.getElementById("rosterTermNo");
  rosterTerm.innerHTML=Array.from({length:12},(_,i)=>i+1).map(n=>`<option value="${n}">${termOptionLabel(n,"입대의")}</option>`).join(""); // 회의체별 기간은 refreshTermSelects()가 다시 채움 (v49)
  rosterTerm.dataset.body="입대의";
  rosterTerm.addEventListener("change",()=>{
    state.rosterTermNo=Number(rosterTerm.value);
    ensureRoster(state.rosterTermNo, rosterBody());
    persistOnly();
    renderRepMaster();
  });
  // ⑥ 명단 회의체 선택 (v46): 현재 회의록과 무관하게 입대의/임차 명단을 볼 수 있다
  const rosterBodySel=document.getElementById("rosterBodySel");
  if(rosterBodySel) rosterBodySel.addEventListener("change",()=>{
    state.rosterBody=rosterBodySel.value==="임차"?"임차":"입대의";
    ensureRoster(state.rosterTermNo||state.meeting.termNo, rosterBody());
    persistOnly();
    renderRepMaster();
  });

  document.getElementById("audienceCountInput").addEventListener("input",e=>{
    state.meeting.audience.count=Math.max(0,Math.floor(Number(e.target.value)||0));
    persistOnly(); renderPreview();
  });
}
function renderMeetingControls(){
  const m=state.meeting;
  const el=id=>document.getElementById(id);
  if(el("generatedMeetingName")) el("generatedMeetingName").textContent=buildMeetingName();
  if(el("meetingBody")) el("meetingBody").value=bodyOf(m);
  applyBodyTheme();
  refreshTermSelects(); // 기수 기간 표기를 회의체에 맞춤 (v49)
  if(el("termNo")) el("termNo").value=String(m.termNo);
  if(el("meetingYear")) el("meetingYear").value=m.year;
  if(el("meetingMonth")) el("meetingMonth").value=String(m.month);
  if(el("meetingType")) el("meetingType").value=m.type;
  if(el("meetingDate")) el("meetingDate").value=m.date;
  if(el("meetingTime")) el("meetingTime").value=m.time;
  if(el("place")) el("place").value=m.place;
  if(el("rosterTermNo")) el("rosterTermNo").value=String(state.rosterTermNo||m.termNo);
  if(el("rosterBodySel")) el("rosterBodySel").value=rosterBody();
  renderMeetingExtras();
}

function guestTypeOptions(selected){
  const types=["관리사무소","업체 관계자","전문가","안건관계인","기타"];
  return types.map(v=>`<option value="${v}" ${selected===v?"selected":""}>${v}</option>`).join("");
}
function renderMeetingExtras(){
  const m=state.meeting;
  if(!Array.isArray(m.guests)) m.guests=[];
  if(!m.audience) m.audience={count:0};
  if(!Array.isArray(m.sequence) || !m.sequence.length) m.sequence=["개회","안건 상정·심의·의결","폐회"];

  const guestBox=document.getElementById("guestList");
  if(guestBox){
    guestBox.innerHTML=m.guests.length ? m.guests.map(g=>`
      <div class="guest-row">
        <select onchange="updateGuest('${g.id}','type',this.value);renderAgendas()">${guestTypeOptions(g.type)}</select>
        <input value="${esc(g.position)}" placeholder="소속·직위 (예: ㈜스포이즘 본부장)" oninput="updateGuest('${g.id}','position',this.value)" onchange="renderAgendas()">
        <input value="${esc(g.name)}" placeholder="성명" oninput="updateGuest('${g.id}','name',this.value)" onchange="renderAgendas()">
        <button class="btn danger" onclick="removeGuest('${g.id}')">삭제</button>
      </div>`).join("")
      : `<div class="small">등록된 배석자가 없습니다.</div>`;
  }

  const count=document.getElementById("audienceCountInput");
  if(count) count.value=Number(m.audience.count)>0 ? Number(m.audience.count) : "";

  const seqBox=document.getElementById("sequenceList");
  if(seqBox){
    seqBox.innerHTML=m.sequence.map((item,i)=>`
      <div class="sequence-row">
        <div class="sequence-num">${i+1}</div>
        <input value="${esc(item)}" oninput="updateSequenceItem(${i},this.value)">
        <button class="btn danger" onclick="removeSequenceItem(${i})">삭제</button>
      </div>`).join("");
  }
}
function addGuest(){
  state.meeting.guests.push({id:uid(),type:"관리사무소",position:"",name:""});
  persistOnly(); renderMeetingExtras(); renderAgendas(); renderPreview();
}
function updateGuest(id,key,val){
  const g=state.meeting.guests.find(x=>x.id===id); if(!g) return;
  g[key]=val; persistOnly(); renderPreview();
}
function removeGuest(id){
  const remarkKey=`guest:${id}`;
  state.agendas.forEach(agenda=>{
    normalizeRemarks(agenda);
    delete agenda.remarks[remarkKey];
  });
  state.meeting.guests=state.meeting.guests.filter(x=>x.id!==id);
  persistOnly(); renderMeetingExtras(); renderAgendas(); renderPreview();
}
function addSequenceItem(){
  state.meeting.sequence.push("");
  persistOnly(); renderMeetingExtras(); renderPreview();
}
function updateSequenceItem(index,val){
  state.meeting.sequence[index]=val;
  persistOnly(); renderPreview();
}
function removeSequenceItem(index){
  if(state.meeting.sequence.length<=1) return;
  state.meeting.sequence.splice(index,1);
  persistOnly(); renderMeetingExtras(); renderPreview();
}

function roleOptions(selected){
  const roles=["회장","부회장","감사","이사","대표"];
  return roles.map(v=>`<option value="${v}" ${selected===v?"selected":""}>${v}</option>`).join("");
}
function persistOnly(){
  state.meeting.name=buildMeetingName();
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
}
function renderRepMaster(){
  const tb=document.getElementById("repMasterTable");
  if(!tb) return;
  const roster=displayedRoster();
  refreshTermSelects(); // ⑥ 기수 선택지의 기간 표기를 명단 회의체에 맞춤 (v49)
  const head=tb.parentElement && tb.parentElement.querySelector("thead tr");
  if(head && head.children.length===3){ const th=document.createElement("th"); th.textContent="변동"; head.appendChild(th); const th2=document.createElement("th"); th2.textContent="임기"; head.appendChild(th2); } // v40 변동, v44 임기
  const tenant=rosterBody()==="임차";
  if(head && head.children[0]) head.children[0].textContent = tenant ? "번호 · 동" : "동";
  const termKey=rosterKeyFor(state.rosterTermNo||state.meeting.termNo, rosterBody());
  tb.innerHTML=roster.map((r,i)=>`
    <tr>
      <td class="center">${tenant
        ? `<span class="small">${r.dong}번</span> <input class="rep-input" style="width:64px" value="${esc(r.unit||"")}" placeholder="동" title="동(선택)" oninput="updateRosterField(${state.rosterTermNo},${i},'unit',this.value,false)" onchange="syncRosterViews()">`
        : `${r.dong}동`}</td>
      <td>
        <select class="rep-input" onchange="updateRosterField(${state.rosterTermNo},${i},'role',this.value,true)">
          ${roleOptions(r.role)}
        </select>
      </td>
      <td>
        <input class="rep-input" value="${esc(r.name)}" placeholder="성명"
          oninput="updateRosterField(${state.rosterTermNo},${i},'name',this.value,false)"
          onchange="syncRosterViews()">
      </td>
      <td class="roster-change-cell">${window.RosterHistory ? RosterHistory.badge(termKey, r.dong) : ""}</td>
      <td class="roster-term-cell">${window.RosterHistory && r.name ? RosterHistory.termsLabel(r.name, termKey) : ""}</td>
    </tr>
  `).join("");
  if(window.RosterHistory) RosterHistory.render();
}
function renderAttendance(){
  const tb=document.getElementById("attendanceTable");
  if(!tb) return;
  const roster=currentRoster();
  const existing=roster.filter(r=>r.name.trim());
  const att=state.meeting.attendance||{};
  tb.innerHTML=existing.length ? existing.map((r)=>{
    const i=roster.indexOf(r);
    return `<tr>
      <td class="center readonly-cell">${seatLabel(r)}</td>
      <td class="readonly-cell">${esc(r.role)}</td>
      <td class="readonly-cell">${esc(r.name)}</td>
      <td class="center"><input class="attend" type="checkbox" ${att[String(r.dong)]?"checked":""} onchange="updateAttendance(${r.dong},this.checked)"></td>
    </tr>`;
  }).join("") : `<tr><td colspan="4" style="padding:24px;text-align:center;color:var(--muted)">제${state.meeting.termNo}기 동대표 명단을 먼저 입력하세요.</td></tr>`;
}
function updateRosterField(termNo,index,key,val,rerenderAfter){
  const roster=ensureRoster(termNo, rosterBody());
  roster[index][key]=val;
  persistOnly();

  // 현재 회의 기수를 수정 중이면 미리보기/참석자/발언자에도 반영
  if(Number(termNo)===Number(state.meeting.termNo)){
    renderMetrics();
    renderPreview();
  }
  // 직책 콤보 변경처럼 focus 문제가 없는 경우에만 즉시 다른 화면 동기화
  if(rerenderAfter) syncRosterViews();
}
function syncRosterViews(){
  persistOnly();
  renderAttendance();
  renderAgendas();
  renderMetrics();
  renderPreview();
}
function updateAttendance(dong,checked){
  if(!state.meeting.attendance) state.meeting.attendance={};
  state.meeting.attendance[String(dong)]=checked;
  saveState();
  renderAttendance();
  renderAgendas();
}
function goToMeetingTermRoster(){
  state.rosterTermNo=state.meeting.termNo;
  state.rosterBody=bodyOf(); // 현재 회의록의 회의체로 (v46)
  ensureRoster(state.rosterTermNo, rosterBody());
  persistOnly();
  renderMeetingControls();
  renderRepMaster();
}
function copyPreviousRoster(){
  const target=Number(state.rosterTermNo||state.meeting.termNo);
  if(target<=1){ alert("이전 기수가 없습니다."); return; }
  const rb=rosterBody();
  const prev=ensureRoster(target-1, rb);
  const current=ensureRoster(target, rb);
  const hasData=current.some(r=>r.name.trim());
  if(hasData && !confirm(`제${target}기 명단에 입력된 내용이 있습니다. 이전 기수 명단으로 덮어쓰시겠습니까?`)) return;
  state.rosters[rosterKeyFor(target, rb)]=prev.map(r=>({dong:r.dong,role:r.role,name:r.name,unit:r.unit||""}));
  persistOnly();
  renderRepMaster();
  if(target===state.meeting.termNo) syncRosterViews();
}
function attendeeOptions(selected=""){
  return currentAttendees().map(r=>{
    const label=`${seatLabel(r)} ${r.name}${r.role?` · ${r.role}`:""}`;
    return `<option value="${esc(r.name)}" ${selected===r.name?"selected":""}>${esc(label)}</option>`;
  }).join("");
}
function renderMetrics(){
  document.getElementById("repCount").textContent=currentRoster().filter(r=>r.name.trim()).length;
  document.getElementById("attendCount").textContent=currentAttendees().length;
  document.getElementById("agendaCount").textContent=officialAgendaCount();
}
function regularAgendas(){ return state.agendas.filter(a=>!a.isOther); }
function otherAgendas(){ return state.agendas.filter(a=>a.isOther); }
function officialAgendaCount(){ return regularAgendas().length+(otherAgendas().length?1:0); }
function otherAgendaNumber(){ return regularAgendas().length+1; }
function agendaMissingFields(agenda){
  normalizeRemarks(agenda);
  const missing=[];
  if(!String(agenda.title||"").trim()) missing.push("안건명");
  if(!String(agenda.decision||"").trim()) missing.push("의결사항");
  const vote=voteStatus(agenda);
  if(currentAttendees().length===0 || vote.incomplete>0) missing.push("표결");
  return missing;
}
function isAgendaComplete(agenda){ return agendaMissingFields(agenda).length===0; }
// 미리보기·출력 대상: 표지의 상정 안건 목록에는 제목이 입력된 안건을 모두 싣되,
// 본문 페이지는 의결사항과 표결까지 완료된 안건만 만든다.
// 입력 중인 미완성 내용이 공개 미리보기에 노출되지 않도록 목록과 본문 기준을 분리한다.
function hasAgendaTitle(agenda){ return !!String(agenda.title||"").trim(); }
function listedRegularAgendas(){ return regularAgendas().filter(hasAgendaTitle); }
function listedOtherAgendas(){ return otherAgendas().filter(hasAgendaTitle); }
function printableRegularAgendas(){ return listedRegularAgendas().filter(isAgendaComplete); }
function printableOtherAgendas(){ return listedOtherAgendas().filter(isAgendaComplete); }
const DECISION_PENDING_TEXT="의결 전 — 안건 상정 단계(회의 결과 미기입)";
function decisionForOutput(agenda){ const d=String(agenda.decision||"").trim(); return d || DECISION_PENDING_TEXT; }
function voteIsBlank(agenda){ const v=voteStatus(agenda); return currentAttendees().length===0 || (v.forCount+v.againstCount)===0; }
function agendaNumberAt(index){
  const agenda=state.agendas[index];
  return agenda?.isOther ? otherAgendaNumber() : regularAgendas().indexOf(agenda)+1;
}
function agendaLabelAt(index){
  const agenda=state.agendas[index];
  if(!agenda) return "안건";
  if(agenda.isOther) return `기타안건 소제목 ${otherAgendas().indexOf(agenda)+1}`;
  return `제${agendaNumberAt(index)}안`;
}
function officialAgendaRows(){
  const regular=listedRegularAgendas();
  const rows=regular.map((agenda,index)=>({label:`제${index+1}안`,title:agenda.title||"",agenda,isOtherGroup:false}));
  const others=listedOtherAgendas();
  if(others.length) rows.push({label:`제${regular.length+1}안`,title:"기타안건",agendas:others,isOtherGroup:true});
  return rows;
}
// includeDrafts=true(관리자 미리보기 전용)면 제목만 있는 미완성 안건도 본문 페이지로 만든다.
// 인쇄·Word·DOCX 는 항상 기본값(false)으로 불러 완성 안건만 나간다.
function outputAgendaItems(includeDrafts=false){
  const listedRegular=listedRegularAgendas();
  const regular=includeDrafts?listedRegular:printableRegularAgendas();
  const items=regular.map(agenda=>({agenda,label:`제${listedRegular.indexOf(agenda)+1}안`,title:agenda.title,isOther:false,subIndex:0,draft:!isAgendaComplete(agenda)}));
  const others=includeDrafts?listedOtherAgendas():printableOtherAgendas();
  others.forEach((agenda,index)=>items.push({agenda,label:`제${listedRegular.length+1}안`,title:"기타안건",isOther:true,subIndex:index+1,subTotal:others.length,draft:!isAgendaComplete(agenda)}));
  return items;
}
function isAdminDevice(){ try{ return !!localStorage.getItem("sandle_admin_key"); }catch(e){ return false; } }
const AGENDA_CATS=["헬스장","도서관","커뮤니티센터","주차","수광선","LH·관리이관","회계·결산","관리비","잡수입·예산","관리규약","선거·임원","장기수선","승강기","화재·소방","조경·환경","지원사업","저수조·청소","교통·버스","전기·설비","기타"];
// ---- 주제 태그 (v30) ----
// 안건 하나가 여러 주제에 속할 수 있다. a.tags(직접 지정)가 비어 있으면 자동 분류(window.autoTags)를 따른다.
function normTag(t){ return String(t==null?"":t).trim().replace(/\s+/g," "); }
function escJs(s){ return String(s==null?"":s).replace(/\\/g,"\\\\").replace(/'/g,"\\'"); }
function agendaManualTags(a){
  if(!Array.isArray(a.tags)) a.tags=(a.category&&String(a.category).trim())?[String(a.category).trim()]:[];
  return a.tags;
}
function agendaAutoTags(a){ return window.autoTags ? window.autoTags(a) : ["기타"]; }
function agendaEffectiveTags(a){ const m=agendaManualTags(a); return m.length ? m.slice() : agendaAutoTags(a); }
function knownTags(){
  const s=new Set(AGENDA_CATS);
  state.agendas.forEach(a=>agendaManualTags(a).forEach(t=>s.add(t)));
  try{ if(window.Topic && Topic.knownTags) Topic.knownTags().forEach(t=>s.add(t)); }catch(e){}
  return [...s];
}
function setAgendaTags(id,tags){
  const a=state.agendas.find(x=>x.id===id); if(!a) return;
  a.tags=[...new Set(tags.map(normTag).filter(Boolean))];
  a.category=a.tags[0]||""; // 이전 버전 호환용 대표 카테고리
  persistOnly(); renderAgendaTagEditor(id);
}
function addAgendaTag(id,tag){
  tag=normTag(tag); if(!tag) return;
  const a=state.agendas.find(x=>x.id===id); if(!a) return;
  const cur=agendaEffectiveTags(a);
  if(cur.includes(tag)){ renderAgendaTagEditor(id); return; }
  setAgendaTags(id, cur.concat([tag]));
}
function removeAgendaTag(id,tag){
  const a=state.agendas.find(x=>x.id===id); if(!a) return;
  const cur=agendaEffectiveTags(a).filter(t=>t!==tag);
  setAgendaTags(id, cur.length?cur:["기타"]); // 전부 빼면 '기타'로 (비우면 자동 분류로 되돌아가므로)
}
function resetAgendaTags(id){ setAgendaTags(id,[]); }
function tagEditorHTML(a){
  const manual=agendaManualTags(a); const isAuto=!manual.length; const tags=agendaEffectiveTags(a);
  const chips=tags.map(t=>`<span class="tag-chip${isAuto?" auto":""}" title="${isAuto?"자동 분류 (×로 빼거나 ＋로 더하면 직접 지정으로 바뀜)":"직접 지정"}">${esc(t)}${isAuto?'<span class="tag-auto-mark">자동</span>':""}<button type="button" aria-label="주제 제거" onclick="removeAgendaTag('${a.id}','${escJs(t)}')">×</button></span>`).join("");
  const opts=knownTags().filter(t=>!tags.includes(t)).map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("");
  return `<div class="tag-row" id="agenda-tags-${a.id}">${chips}
    <span class="tag-add">
      <select aria-label="주제 추가" onchange="if(this.value==='__custom'){const c=document.getElementById('agenda-tag-custom-${a.id}');c.style.display='inline-flex';document.getElementById('agenda-tag-custom-input-${a.id}').focus();}else if(this.value){addAgendaTag('${a.id}',this.value);} this.value='';">
        <option value="">＋ 주제 추가</option>${opts}<option value="__custom">직접 입력…</option>
      </select>
      <span id="agenda-tag-custom-${a.id}" class="tag-add" style="display:none">
        <input id="agenda-tag-custom-input-${a.id}" placeholder="새 주제명" onkeydown="if(event.key==='Enter'){event.preventDefault();addAgendaTag('${a.id}',this.value);}else if(event.key==='Escape'){this.parentNode.style.display='none';}">
        <button type="button" class="btn soft tag-btn" onclick="addAgendaTag('${a.id}',document.getElementById('agenda-tag-custom-input-${a.id}').value)">추가</button>
      </span>
      ${isAuto?"":`<button type="button" class="btn soft tag-btn" title="직접 지정을 지우고 안건명 기준 자동 분류로 되돌림" onclick="resetAgendaTags('${a.id}')">자동 분류로</button>`}
    </span></div>`;
}
function renderAgendaTagEditor(id){
  const a=state.agendas.find(x=>x.id===id); if(!a) return;
  const el=document.getElementById(`agenda-tags-${id}`); if(!el) return;
  el.outerHTML=tagEditorHTML(a);
}
function newAgenda(){
  return {
    id:uid(),title:"",summary:"",isOther:false,noRemarks:true,remarks:{},decision:"",votes:{},
    category:"",followup:"",showFollowup:false,
    materials:[],showMaterials:false
  };
}
function addAgenda(){
  const agenda=newAgenda();
  state.agendas.push(agenda); saveState(); renderAgendas();
  requestAnimationFrame(()=>{
    const card=document.getElementById(`agenda-card-${agenda.id}`);
    const titleInput=document.getElementById(`agenda-title-input-${agenda.id}`);
    if(card) card.scrollIntoView({behavior:"smooth",block:"start"});
    if(titleInput) setTimeout(()=>titleInput.focus({preventScroll:true}),350);
  });
}
function removeAgenda(id){
  if(!confirm("이 안건을 삭제하시겠습니까?")) return;
  state.agendas=state.agendas.filter(a=>a.id!==id); saveState(); renderAgendas();
}
function moveAgendaTo(id,position){
  const from=state.agendas.findIndex(a=>a.id===id);
  const to=Math.max(0,Math.min(state.agendas.length-1,Number(position)-1));
  if(from<0 || from===to) return;
  const [agenda]=state.agendas.splice(from,1);
  state.agendas.splice(to,0,agenda);
  saveState(); renderAgendas();
  requestAnimationFrame(()=>document.getElementById(`agenda-card-${id}`)?.scrollIntoView({behavior:"smooth",block:"start"}));
}
function normalizeRemarks(a){
  if(Array.isArray(a.remarks)){
    const obj={};
    a.remarks.forEach(r=>{
      if(!r || !r.speaker) return;
      const rep=currentRoster().find(x=>x.name===r.speaker || String(x.dong)===String(r.speaker));
      const key=rep ? actorKey(rep) : String(r.speaker);
      obj[key]=r.text||"";
    });
    a.remarks=obj;
  }
  if(!a.remarks || typeof a.remarks!=="object") a.remarks={};
  if(typeof a.isOther!=="boolean") a.isOther=false;
  if(typeof a.noRemarks!=="boolean") a.noRemarks=true;
  // v30: 단일 category → 다중 태그(tags). 비어 있으면 자동 분류를 따른다.
  if(!Array.isArray(a.tags)) a.tags=(a.category&&String(a.category).trim())?[String(a.category).trim()]:[];

  // 예전 버전의 '이름' 키를 현재 동 번호 키로 변환
  const converted={};
  Object.entries(a.remarks).forEach(([key,text])=>{
    const rep=currentRoster().find(x=>x.name===key || String(x.dong)===String(key));
    const guest=(state.meeting.guests||[]).find(x=>x.name===key || guestActorKey(x)===key);
    converted[rep ? actorKey(rep) : guest ? guestActorKey(guest) : key]=text;
  });
  a.remarks=converted;

  if(typeof a.showFollowup!=="boolean") a.showFollowup=false;
  if(typeof a.showMaterials!=="boolean") a.showMaterials=false;
  if(!Array.isArray(a.materials)) a.materials=[];
  a.materials=a.materials.map(m=>({
    id:m?.id||uid(),
    title:String(m?.title||""),
    reference:String(m?.reference||m?.url||""),
    note:String(m?.note||""),
    fileName:String(m?.fileName||""),
    fileType:String(m?.fileType||""),
    fileSize:Math.max(0,Number(m?.fileSize)||0),
    pageCount:Math.max(0,Math.floor(Number(m?.pageCount)||0)),
    attachmentKey:String(m?.attachmentKey||m?.id||"")
  }));

  normalizeVotes(a);
}
function normalizeVotes(a){
  if(!a.votes || typeof a.votes!=="object") a.votes={};
  const converted={};
  Object.entries(a.votes).forEach(([key,value])=>{
    if(value!=="for" && value!=="against") return;
    const rep=currentRoster().find(x=>x.name===key || String(x.dong)===String(key));
    converted[rep ? actorKey(rep) : key]=value;
  });
  a.votes=converted;
}
function setAgenda(id,key,val){
  const a=state.agendas.find(x=>x.id===id); if(!a) return;
  normalizeRemarks(a);
  a[key]=val;

  // 체크박스처럼 화면 구조가 바뀌는 항목만 다시 렌더링.
  // 안건명·안건요지·의결사항·후속조치는 입력 중 포커스를 유지하도록 저장만 함.
  if(key==="noRemarks" || key==="isOther"){
    saveState();
    renderAgendas();
  }else{
    persistOnly();
    if(key==="title"){
      const titleEl=document.getElementById(`agenda-card-title-${id}`);
      if(titleEl) titleEl.textContent=String(val||"").trim()||"안건명을 입력하세요";
    }
    updateAgendaCompletionUi(id);
    renderMetrics();
    renderPreview();
  }
}
function updateAgendaCompletionUi(id){
  const agenda=state.agendas.find(x=>x.id===id);
  const card=document.getElementById(`agenda-card-${id}`);
  if(!agenda||!card) return;
  const missing=agendaMissingFields(agenda);
  card.classList.toggle("incomplete",missing.length>0);
  const badge=card.querySelector(".agenda-completion");
  if(badge){
    badge.hidden=missing.length===0;
    badge.textContent=missing.length?`미완성 · ${missing.join(" · ")}`:"";
  }
}
function setSpeakerRemark(aid,actor,val){
  const a=state.agendas.find(x=>x.id===aid); if(!a) return;
  normalizeRemarks(a);
  a.remarks[String(actor)]=val;
  persistOnly();
  renderPreview();
}
const ATTACHMENT_DB="sandle_minutes_attachments_v1";
function attachmentDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(ATTACHMENT_DB,1);
    request.onupgradeneeded=()=>request.result.createObjectStore("files");
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function putAttachment(key,blob){
  const db=await attachmentDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction("files","readwrite");
    tx.objectStore("files").put(blob,key);
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
  });
  db.close();
}
async function getAttachment(key){
  if(!key) return null;
  const db=await attachmentDb();
  const value=await new Promise((resolve,reject)=>{
    const tx=db.transaction("files","readonly");
    const request=tx.objectStore("files").get(key);
    request.onsuccess=()=>resolve(request.result||null); request.onerror=()=>reject(request.error);
  });
  db.close(); return value;
}
async function deleteAttachment(key){
  if(!key) return;
  const db=await attachmentDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction("files","readwrite");
    tx.objectStore("files").delete(key);
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
  });
  db.close();
}
async function getPdfLibrary(){
  if(window.pdfjsLib) return window.pdfjsLib;
  if(window.sandlePdfReady) return await window.sandlePdfReady;
  throw new Error("PDF 도구를 불러오지 못했습니다.");
}
// 첨부 종류 (v70): pdf·image 는 인쇄물·DOCX에 페이지로 이어지고, 그 외 파일은 자료 목록 기록 + 내려받기만 된다.
function materialKind(m){
  const type=String(m?.fileType||"").toLowerCase(), name=String(m?.fileName||"").toLowerCase();
  if(type==="application/pdf"||/\.pdf$/.test(name)) return "pdf";
  if(/^image\//.test(type)||/\.(png|jpe?g|gif|webp|bmp)$/.test(name)) return "image";
  return "file";
}
function materialKindLabel(m){
  const kind=materialKind(m);
  return kind==="pdf"?`PDF ${m.pageCount||"?"}쪽`:kind==="image"?"이미지":"파일";
}
async function attachAgendaFile(aid,mid,input){
  const file=input.files&&input.files[0];
  if(!file) return;
  const a=state.agendas.find(x=>x.id===aid); const m=a?.materials?.find(x=>x.id===mid);
  if(!a||!m) return;
  try{
    const kind=materialKind({fileType:file.type,fileName:file.name});
    let pageCount=0;
    if(kind==="pdf"){
      showToast("PDF 파일을 확인하는 중입니다…");
      const lib=await getPdfLibrary();
      const bytes=new Uint8Array(await file.arrayBuffer());
      const pdf=await lib.getDocument({data:bytes}).promise;
      pageCount=pdf.numPages;
    }else if(kind==="image"){
      pageCount=1;
    }
    const key=m.attachmentKey||m.id;
    attPreviewInvalidate(key);
    await putAttachment(key,file);
    m.attachmentKey=key; m.fileName=file.name; m.fileType=file.type||""; m.fileSize=file.size; m.pageCount=pageCount;
    if(!m.title.trim()) m.title=file.name.replace(/\.[^.]+$/,"");
    persistOnly(); renderAgendas(); renderPreview();
    showToast(kind==="pdf"?`${file.name} · ${pageCount}쪽을 첨부했습니다.`
      :kind==="image"?`${file.name} 이미지를 첨부했습니다. 인쇄물에 1쪽으로 이어집니다.`
      :`${file.name} 파일을 첨부했습니다. 인쇄물에는 자료 목록으로만 표시됩니다.`);
  }catch(err){
    console.error(err); showToast("첨부 파일을 읽지 못했습니다.","error");
  }finally{ input.value=""; }
}
async function removeAgendaFile(aid,mid){
  const a=state.agendas.find(x=>x.id===aid); const m=a?.materials?.find(x=>x.id===mid);
  if(!m) return;
  attPreviewInvalidate(m.attachmentKey||m.id);
  await deleteAttachment(m.attachmentKey||m.id);
  m.fileName="";m.fileType="";m.fileSize=0;m.pageCount=0;m.attachmentKey=m.id;
  persistOnly();renderAgendas();renderPreview();
}
async function downloadAgendaFile(aid,mid){
  const a=state.agendas.find(x=>x.id===aid); const m=a?.materials?.find(x=>x.id===mid);
  if(!m||!m.fileName) return;
  const blob=await getAttachment(m.attachmentKey||m.id);
  if(!blob){ showToast(`${m.fileName} 파일을 현재 브라우저에서 찾을 수 없습니다.`,"error"); return; }
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url; link.download=m.fileName; document.body.appendChild(link); link.click();
  setTimeout(()=>{URL.revokeObjectURL(url);link.remove();},1800);
}
function addAgendaMaterial(aid){
  const a=state.agendas.find(x=>x.id===aid); if(!a) return;
  normalizeRemarks(a);
  const id=uid();
  a.materials.push({id,title:"",reference:"",note:"",fileName:"",fileSize:0,pageCount:0,attachmentKey:id});
  saveState(); renderAgendas();
}
function setAgendaMaterial(aid,mid,key,val){
  const a=state.agendas.find(x=>x.id===aid); if(!a) return;
  normalizeRemarks(a);
  const m=a.materials.find(x=>x.id===mid); if(!m) return;
  m[key]=val;
  persistOnly(); renderPreview();
}
async function removeAgendaMaterial(aid,mid){
  const a=state.agendas.find(x=>x.id===aid); if(!a) return;
  normalizeRemarks(a);
  const material=a.materials.find(x=>x.id===mid);
  if(material?.attachmentKey){ attPreviewInvalidate(material.attachmentKey); await deleteAttachment(material.attachmentKey); }
  a.materials=a.materials.filter(x=>x.id!==mid);
  saveState(); renderAgendas();
}
function cycleVote(aid,name){
  const a=state.agendas.find(x=>x.id===aid); if(!a) return;
  a.votes[name]=a.votes[name]==="for" ? "against" : "for";
  saveState(); renderAgendas();
}
function setUnanimousVote(aid,stateName="for"){
  const a=state.agendas.find(x=>x.id===aid); if(!a) return;
  a.votes={};
  currentAttendees().forEach(r=>{ a.votes[actorKey(r)]=stateName; });
  saveState(); renderAgendas();
}
function renderAgendas(){
  const box=document.getElementById("agendaList");
  if(!state.agendas.length){
    box.innerHTML=`<div class="empty">등록된 안건이 없습니다. <b>+ 안건 추가</b> 버튼으로 안건을 등록할 수 있습니다.</div>`;
    renderMetrics(); return;
  }
  const attendees=currentAttendees();
  const speakers=currentRemarkSpeakers();
  box.innerHTML=state.agendas.map((a,idx)=>{
    normalizeRemarks(a);
    const missing=agendaMissingFields(a);
    const materialRows=a.materials.map(m=>`
      <div class="material-row" style="padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--ivory)">
        <input value="${esc(m.title)}" placeholder="자료명" aria-label="자료명" oninput="setAgendaMaterial('${a.id}','${m.id}','title',this.value)">
        <input value="${esc(m.reference)}" placeholder="비공개 링크 · 파일명 · 보관 위치" aria-label="자료 링크 또는 보관 위치" oninput="setAgendaMaterial('${a.id}','${m.id}','reference',this.value)">
        <textarea placeholder="검토한 내용 · 관련 쪽수 · 비고" aria-label="자료 비고" oninput="setAgendaMaterial('${a.id}','${m.id}','note',this.value)">${esc(m.note)}</textarea>
        <button class="btn danger" type="button" onclick="removeAgendaMaterial('${a.id}','${m.id}')">자료 삭제</button>
        <div class="pdf-file-info" style="grid-column:1 / -1">
          ${m.fileName?`<b>${esc(m.fileName)}</b><span>${materialKindLabel(m)} · ${Math.max(1,Math.round((m.fileSize||0)/1024))}KB${materialKind(m)==="file"?" · 인쇄물에는 자료 목록으로만 표시":""}</span>`:`<span>PDF·이미지·문서 등 어떤 파일이든 첨부할 수 있습니다. PDF와 이미지는 ‘출력물에 회의자료 포함’ 선택 시 이 안건 뒤에 페이지로 이어집니다.</span>`}
        </div>
        <div class="inline-actions" style="grid-column:1 / -1">
          <label class="btn soft" for="pdf-${m.id}">${m.fileName?"파일 교체":"파일 첨부"}</label>
          <input id="pdf-${m.id}" type="file" hidden onchange="attachAgendaFile('${a.id}','${m.id}',this)">
          ${m.fileName?`<button class="btn soft" type="button" onclick="downloadAgendaFile('${a.id}','${m.id}')">내려받기</button><button class="btn danger" type="button" onclick="removeAgendaFile('${a.id}','${m.id}')">파일만 제거</button>`:""}
        </div>
      </div>`).join("");
    const remarks=a.noRemarks ? "" : speakers.map(speaker=>{
      const key=speaker.key;
      return `
      <div class="remark-row" style="grid-template-columns:120px 1fr">
        <div style="padding:10px 11px;border:1px solid var(--line);border-radius:10px;background:var(--ivory);font-size:12px;font-weight:800;text-align:center">
          ${esc(speaker.label)}
        </div>
        <textarea placeholder="이 안건에서 의사결정에 영향을 준 주요 발언이 있을 때만 작성"
          oninput="setSpeakerRemark('${a.id}','${key}',this.value)">${esc(a.remarks[key]||"")}</textarea>
      </div>`;
    }).join("");
    normalizeVotes(a);
    const chips=attendees.map(r=>{
      const key=actorKey(r);
      const st=a.votes[key]||"";
      return `<button class="vote-chip" data-state="${st}" onclick="cycleVote('${a.id}','${key}')">${esc(actorFullLabel(r))}${st==="for"?" · 찬성":st==="against"?" · 반대":""}</button>`;
    }).join("");
    const vote=voteStatus(a);
    return `
      <div class="card agenda-card ${missing.length?"incomplete":""}" id="agenda-card-${a.id}">
        <div class="agenda-head">
          <span class="num">${agendaLabelAt(idx)}</span>
          <strong id="agenda-card-title-${a.id}">${a.title?esc(a.title):"안건명을 입력하세요"}</strong>
          <span class="agenda-completion" ${missing.length?"":"hidden"}>${missing.length?`미완성 · ${esc(missing.join(" · "))}`:""}</span>
          <label class="toggle"><input type="checkbox" ${a.isOther?"checked":""} onchange="setAgenda('${a.id}','isOther',this.checked)"> 기타안건 소제목 <span class="small">(여러 건 선택 가능)</span></label>
          <label class="agenda-order"><span>순서</span><select aria-label="안건 순서" onchange="moveAgendaTo('${a.id}',this.value)">${
            state.agendas.map((_,order)=>`<option value="${order+1}" ${order===idx?"selected":""}>${order+1}</option>`).join("")
          }</select></label>
          <button class="btn danger" onclick="removeAgenda('${a.id}')">안건 삭제</button>
        </div>
        <div class="agenda-body">
          <div class="grid" style="grid-template-columns:1fr 1.4fr">
            <div class="field"><label>안건명 <b>*</b></label><input id="agenda-title-input-${a.id}" value="${esc(a.title)}" placeholder="예: 관리비 부과 내역서 심의 건" oninput="setAgenda('${a.id}','title',this.value)"></div>
            <div class="field"><label>회의 전 안건 요지 <span class="small">(선택)</span></label><textarea placeholder="확인 및 결정할 내용을 미리 입력" oninput="setAgenda('${a.id}','summary',this.value)">${esc(a.summary)}</textarea></div>
          </div>
          <div class="field" style="margin-top:8px"><label>주제 태그 <span class="small">(여러 개 가능 · 안건명 기준 자동 분류, ×로 빼거나 ＋로 더하면 직접 지정 · ③ 주제별 보기에서 모아봄)</span></label>
            ${tagEditorHTML(a)}</div>
          <div class="subsection">
            <div class="subsection-head">
              <div>
                <h4>회의자료 · 첨부자료 기록</h4>
                <div class="small">글로 기록하거나 원문 파일(PDF·이미지·문서 등)을 첨부할 수 있습니다. 첨부 파일은 현재 브라우저에 저장됩니다.</div>
              </div>
              <button class="btn soft" type="button" onclick="addAgendaMaterial('${a.id}')">+ 자료 추가</button>
            </div>
            <label class="toggle"><input type="checkbox" ${a.showMaterials?"checked":""} onchange="setAgenda('${a.id}','showMaterials',this.checked)"> 출력물에 회의자료 포함 <span class="small">(PDF·이미지 원문도 안건 뒤에 연속 포함)</span></label>
            <div class="material-list">${materialRows||`<div class="small">등록된 회의자료가 없습니다.</div>`}</div>
          </div>
          <div class="inline-actions" style="margin-top:10px">
            <label class="toggle"><input type="checkbox" ${a.noRemarks?"checked":""} onchange="setAgenda('${a.id}','noRemarks',this.checked)"> 주요 발언 없음</label>
          </div>
          ${a.noRemarks
            ? `<div class="small" style="margin-top:10px">출력물에서 주요 발언 항목이 생략됩니다.</div>`
            : `<div class="remarks">${remarks||`<div class="small">회의 설정에서 참석 동대표 또는 배석자를 등록하면 발언 입력칸이 표시됩니다.</div>`}</div>`}
          <div class="grid" style="grid-template-columns:1fr 1fr;margin-top:16px">
            <div class="field"><label>의결사항 <b>*</b></label><textarea placeholder="최종적으로 무엇을 의결했는지" oninput="setAgenda('${a.id}','decision',this.value)">${esc(a.decision)}</textarea></div>
            <div class="field">
              <label>후속조치</label>
              <textarea placeholder="담당·기한·다음 확인사항" oninput="setAgenda('${a.id}','followup',this.value)">${esc(a.followup)}</textarea>
              <label class="toggle" style="margin-top:8px"><input type="checkbox" ${a.showFollowup?"checked":""} onchange="setAgenda('${a.id}','showFollowup',this.checked)"> 출력물에 후속조치 포함</label>
            </div>
          </div>
          <div class="vote-box">
            <div class="field">
              <label>표결 <b>*</b> — 최초 미선택 상태에서 한 번 누르면 찬성, 이후에는 찬성 ↔ 반대로 변경</label>
              <div class="vote-actions">
                <button class="btn soft" type="button" onclick="setUnanimousVote('${a.id}','for')">만장일치 찬성</button>
              </div>
              <div class="small" style="margin:3px 0 8px">
                ${vote.unanimous ? `만장일치 · ${esc(vote.detail)}` : `찬성(${vote.forCount}) · 반대(${vote.againstCount}) · 미선택(${vote.incomplete})`}
              </div>
            </div>
            <div class="vote-chips">${chips||`<span class="small">회의 설정에서 참석자를 선택하면 표결 대상이 표시됩니다.</span>`}</div>
          </div>
        </div>
      </div>`;
  }).join("")+`<div class="agenda-bottom-actions"><button class="btn primary" type="button" onclick="addAgenda()">+ 다음 안건 추가</button></div>`;
  renderMetrics();
}

function voteCount(a,stateName){
  normalizeVotes(a);
  return Object.values(a.votes||{}).filter(s=>s===stateName).length;
}
function voteNames(a,stateName){
  normalizeVotes(a);
  return Object.entries(a.votes||{})
    .filter(([_,s])=>s===stateName)
    .map(([key])=>{
      const rep=currentRoster().find(r=>String(r.dong)===String(key) || r.name===key);
      return rep ? actorFullLabel(rep) : String(key);
    })
    .join(", ");
}
function votePeopleHtml(a){
  normalizeVotes(a);
  const people=currentAttendees()
    .map(rep=>{
      const stateName=(a.votes||{})[actorKey(rep)]||"";
      const label=stateName==="for"?"찬성":stateName==="against"?"반대":"미선택";
      const cls=stateName==="for"?"for":stateName==="against"?"against":"pending";
      return `<span class="vote-person ${cls}"><b>${esc(actorFullLabel(rep))}</b><small>${label}</small></span>`;
    })
    .join("");
  return people||"표결 대상 없음";
}
function voteStatus(a){
  normalizeVotes(a);
  const attendees=currentAttendees();
  const states=attendees.map(r=>a.votes[actorKey(r)]).filter(s=>s==="for" || s==="against");
  const forCount=states.filter(s=>s==="for").length;
  const againstCount=states.filter(s=>s==="against").length;
  const incomplete=Math.max(0,attendees.length-states.length);
  const unanimous=attendees.length>0 && incomplete===0 && (forCount===attendees.length || againstCount===attendees.length);
  const detail=unanimous
    ? `참석 동대표 ${attendees.length}명 전원 ${forCount===attendees.length?"찬성":"반대"}`
    : "";
  return {forCount,againstCount,incomplete,unanimous,detail};
}
function requireCompleteVotes(){
  const pending=state.agendas.filter(a=>!isAgendaComplete(a));
  if(pending.length){
    const message=`의결사항·표결이 비어 있는 안건 ${pending.length}건은 '의결 전(결과 미기입)'으로 표시됩니다.`;
    modalStatus(message,"warn");
    showToast(message,"warn");
  }
  return true;
}
function materialReferenceHtml(reference){
  const value=String(reference||"").trim();
  if(!value) return "";
  return /^https?:\/\//i.test(value)
    ? `<a href="${esc(value)}" target="_blank" rel="noopener noreferrer">${esc(value)}</a>`
    : esc(value);
}
function materialListHtml(a){
  normalizeRemarks(a);
  const items=a.materials.filter(m=>m.title.trim()||m.reference.trim()||m.note.trim()||m.fileName);
  if(!items.length) return "";
  return `<div class="materials-box">${items.map((m,i)=>`
    <div class="material-preview-row">
      <b>${i+1}. ${esc(m.title||m.fileName||"자료명 미입력")}</b>
      ${m.reference?`<div>참조: ${materialReferenceHtml(m.reference)}</div>`:""}
      ${m.note?`<div>${nl2br(m.note)}</div>`:""}
      ${m.fileName?`<div class="attachment-inline" data-att-key="${esc(m.attachmentKey||m.id)}" data-att-kind="${materialKind(m)}" data-att-name="${esc(m.fileName)}"><span class="attachment-inline-tag">첨부 ${esc(m.fileName)}${materialKind(m)==="file"?" — 화면에 표시할 수 없는 형식(⑧에서 내려받기로 확인)":""}</span></div>`:""}
    </div>`).join("")}</div>`;
}
// 미리보기 첨부 인라인 표시 (v73): 자료 목록의 이미지·PDF 원문을 화면에서 바로 펼친다.
// 화면 전용 — 인쇄·Word에는 기존처럼 안건 뒤 첨부 페이지로만 들어간다(중복 방지, CSS로 숨김).
const AttPreview=new Map(); // attachmentKey -> Promise<string[]>
function attPreviewInvalidate(key){
  const p=AttPreview.get(key);
  if(p){ p.then(urls=>(urls||[]).forEach(u=>{ if(String(u).startsWith("blob:")) URL.revokeObjectURL(u); })).catch(()=>{}); AttPreview.delete(key); }
}
function inlineAttachmentImages(key,kind,name){
  if(!AttPreview.has(key)){
    AttPreview.set(key,(async()=>{
      const blob=await getAttachment(key);
      if(!blob) return [];
      if(kind==="image") return [URL.createObjectURL(blob)];
      if(kind==="pdf") return await renderPdfMaterialPages({attachmentKey:key,fileName:name,fileType:"application/pdf"});
      return [];
    })().catch(err=>{ console.error(err); AttPreview.delete(key); return []; }));
  }
  return AttPreview.get(key);
}
function hydrateInlineAttachments(root){
  if(!root) return;
  root.querySelectorAll(".attachment-inline").forEach(async box=>{
    const kind=box.dataset.attKind;
    if(kind!=="image"&&kind!=="pdf") return;
    const imgs=await inlineAttachmentImages(box.dataset.attKey,kind,box.dataset.attName);
    if(!box.isConnected||!imgs.length) return;
    box.innerHTML=imgs.map((u,i)=>`<img src="${u}" alt="${esc(box.dataset.attName)} ${i+1}쪽" title="누르면 크게 보기" decoding="async">`).join("");
    box.querySelectorAll("img").forEach(img=>{ img.onclick=()=>openAttachmentLightbox(img.src,img.alt); });
  });
}
// 첨부 확대 보기 (v75): 인라인 첨부를 누르면 화면 전체로 크게. 그림을 다시 누르면 원본 크기(스크롤), 바깥·Esc로 닫기.
function openAttachmentLightbox(src,alt){
  const overlay=document.createElement("div");
  overlay.className="att-lightbox";
  overlay.innerHTML=`<img src="${src}" alt="${esc(alt)}" decoding="async"><div class="att-lightbox-hint">그림을 누르면 원본 크기 ↔ 화면 맞춤 · 바깥을 누르거나 Esc로 닫기</div>`;
  const close=()=>{ overlay.remove(); document.removeEventListener("keydown",onKey); };
  const onKey=e=>{ if(e.key==="Escape") close(); };
  overlay.onclick=close;
  const img=overlay.querySelector("img");
  img.onclick=e=>{ e.stopPropagation(); overlay.classList.toggle("full"); if(!overlay.classList.contains("full")) overlay.scrollTo(0,0); };
  document.addEventListener("keydown",onKey);
  document.body.appendChild(overlay);
}
function pageNumberHtml(current,total){
  return `<div class="page-number">${current} / ${total}</div>`;
}
function coverHtml(totalPages){
  const attendance=state.meeting.attendance||{};
  const rolePriority={"회장":0,"감사":1,"이사":2,"대표":3};

  const reps=currentRoster()
    .filter(r=>r.name.trim())
    .sort((a,b)=>{
      const aAttend=!!attendance[String(a.dong)];
      const bAttend=!!attendance[String(b.dong)];

      // 참석자는 항상 미참석자보다 먼저
      if(aAttend!==bAttend) return aAttend ? -1 : 1;

      // 참석자끼리는 회장 → 감사 → 이사 → 대표
      if(aAttend && bAttend){
        const ap=rolePriority[a.role] ?? 99;
        const bp=rolePriority[b.role] ?? 99;
        if(ap!==bp) return ap-bp;
        return Number(a.dong)-Number(b.dong);
      }

      // 미참석자는 직책과 무관하게 동 오름차순
      return Number(a.dong)-Number(b.dong);
    });

  const repRowHtml = (r)=>{
    const attended=!!attendance[String(r.dong)];
    return `
    <div class="cover-rep ${attended?"attended":"absent"}">
      <span>${seatLabel(r)}</span>
      <span>${esc(r.role||"대표")}</span>
      <span>${esc(r.name)}</span>
      <span class="signature-cell" aria-label="${attended?"서명란":"미참석"}"></span>
    </div>`;
  };

  // 왼쪽 열을 먼저 위→아래로 채운 뒤 오른쪽 열을 채움
  const splitIndex=Math.ceil(reps.length/2);
  const leftReps=reps.slice(0,splitIndex);
  const rightReps=reps.slice(splitIndex);

  const leftRows=leftReps.map(repRowHtml).join("");
  const rightRows=rightReps.map(repRowHtml).join("");
  const agendas=officialAgendaRows().map(row=>`<div class="row"><span>${row.label}</span><span>${esc(row.title)}</span></div>`).join("");
  const guests=(state.meeting.guests||[]).filter(g=>g.name.trim()||g.position.trim());
  const guestText=guests.length
    ? guests.map(g=>esc(guestCoverLabel(g))).join("<br>")
    : "없음";
  const audienceText=Number(state.meeting.audience?.count)>0?`입주민 총 ${Math.floor(Number(state.meeting.audience.count))}명`:"없음";
  const namedReps=reps.filter(r=>String(r.name||"").trim());
  const presentCount=namedReps.filter(r=>attendance[String(r.dong)]).length;
  const absentCount=namedReps.length-presentCount;
  const sequenceRows=sequenceItems().map((s,i)=>`<div><b>${i+1}.</b> ${esc(s)}</div>`).join("")||`<div style="color:#777">진행순서를 입력하세요.</div>`;
  return `<section class="paper cover-page">
    ${bodyMarkHtml()}<div class="doc-title">${docTitle()}</div>
    <table class="doc-table cover-meta-table">
      <colgroup><col style="width:12%"><col style="width:45%"><col style="width:11%"><col style="width:32%"></colgroup>
      <tr><th>회의명</th><td colspan="3">${esc(buildMeetingName())}</td></tr>
      <tr><th>일시</th><td>${esc(formattedMeetingDateTime())}</td><th>장소</th><td>${esc(state.meeting.place)}</td></tr>
    </table>
    <div class="section-band">참석자 명단<span class="band-sub">참석 ${presentCount} · 미참석 ${absentCount}</span></div>
    <div class="cover-reps column-first">
      <div class="cover-col">
        <div class="cover-rep" style="background:#fff;font-weight:900">
          <span>동</span><span>직책</span><span>성명</span><span style="text-align:center">서명</span>
        </div>
        ${leftRows||`<div style="padding:20px;color:#777">동대표 현황을 입력하세요.</div>`}
      </div>
      <div class="cover-col">
        <div class="cover-rep" style="background:#fff;font-weight:900">
          <span>동</span><span>직책</span><span>성명</span><span style="text-align:center">서명</span>
        </div>
        ${rightRows}
      </div>
    </div>
    <div class="section-band">배석자 · 참관 현황</div>
    <table class="doc-table cover-guest-table">
      <colgroup><col style="width:12%"><col style="width:45%"><col style="width:11%"><col style="width:32%"></colgroup>
      <tr><th>배석자</th><td>${guestText}</td><th>참관</th><td>${audienceText}</td></tr>
    </table>
    <div class="section-band">회의 진행순서</div>
    <div class="cover-sequence">${sequenceRows}</div>
    <div class="section-band">상정 안건</div>
    <div class="cover-agenda">${agendas||`<div class="row"><span>-</span><span>등록된 안건이 없습니다.</span></div>`}</div>
    ${pageNumberHtml(1,totalPages)}
  </section>`;
}
function agendaPageHtml(item,currentPage,totalPages){
  const a=item.agenda;
  const draftRibbon=item.draft?`<div class="draft-ribbon">미완성 초안 — 관리자에게만 보이며, 인쇄·게시에는 포함되지 않습니다 (의결·표결 미기입)</div>`:"";
  normalizeRemarks(a);
  const vote=voteStatus(a);
  const voteHtml=voteIsBlank(a)
    ? `<div class="vote-consensus" style="background:#f6f4ee;border-color:#ddd6c7"><b>표결 미기입</b><span>의결 전 상정 안건</span></div>`
    : `<div class="vote-tally"><span class="for">찬성 ${vote.forCount}</span><span class="against">반대 ${vote.againstCount}</span></div>
       <div class="vote-mixed-grid">${votePeopleHtml(a)}</div>
       ${vote.incomplete ? `<div class="vote-incomplete">미선택 ${vote.incomplete}명 · 표결 선택이 완료되지 않았습니다.</div>` : ""}`;
  const filledRemarks=Object.entries(a.remarks||{}).filter(([name,text])=>String(text||"").trim());
  const hasRemarks=!a.noRemarks && filledRemarks.length>0;
  const remarks=hasRemarks
    ? `<div class="section-band">주요 발언</div><table class="remark-table"><tbody>${
        filledRemarks.map(([key,text])=>{
          const label=remarkSpeakerLabel(key);
          return `<tr><td>${esc(label)}</td><td>${nl2br(text,{autoBullets:true})}</td></tr>`;
        }).join("")
      }</tbody></table>`
    : "";
  const materials=materialListHtml(a);
  return `<section class="paper${item.draft?" draft-page":""}">
    ${draftRibbon}
    <div class="agenda-document-head">
      <div class="agenda-meeting-name">${esc(buildMeetingName())}</div>
      <div class="agenda-page-title"><span class="agenda-page-num">${item.label}</span><span>${esc(item.title)}</span></div>
    </div>

    ${item.isOther?`<div class="other-subtitle"><small>기타안건 ${item.subIndex} / ${item.subTotal}</small>${esc(a.title||"소제목 미입력")}</div>`:""}

    ${String(a.summary||"").trim()?`<div class="section-band">안건 요지</div>
    <div class="summary-box">${nl2br(a.summary,{autoBullets:true})}</div>`:""}

    ${materials ? `<div class="${a.showMaterials?"":"screen-only-materials"}">
      <div class="section-band">회의자료 · 첨부자료${a.showMaterials?"":" (출력 제외)"}</div>
      ${materials}
    </div>` : ""}

    ${remarks}

    <div class="section-band">의결사항</div>
    <div class="decision-box${String(a.decision||"").trim()?"":" pending"}">${nl2br(decisionForOutput(a),{autoBullets:true})}</div>

    <div class="section-band">표결</div>
    <div class="vote-summary-list">${voteHtml}</div>

    ${a.showFollowup ? `<div class="section-band">후속조치</div><div class="follow-box">${nl2br(a.followup,{autoBullets:true})}</div>` : ""}
    ${pageNumberHtml(currentPage,totalPages)}
  </section>`;
}
function includedPdfMaterials(a){
  normalizeRemarks(a);
  return a.showMaterials?(a.materials||[]).filter(m=>m.fileName&&m.pageCount>0):[];
}
function attachmentPageHtml(item,material,pageIndex,currentPage,totalPages,imageUrl=""){
  return `<section class="paper attachment-page">
    <div class="attachment-head"><b>${esc(item.label)} · ${esc(material.fileName)}</b><span>첨부 ${pageIndex} / ${material.pageCount}</span></div>
    ${imageUrl?`<img src="${imageUrl}" alt="${esc(material.fileName)} ${pageIndex}쪽">`:`<div class="attachment-placeholder"><div><b>${esc(material.fileName)}</b><br>원문 ${pageIndex} / ${material.pageCount}쪽<br><span class="small">인쇄 시 이 위치에 원문 페이지가 포함됩니다.</span></div></div>`}
    ${pageNumberHtml(currentPage,totalPages)}
  </section>`;
}
function outputPagePlan(includeDrafts=false){
  const plan=[];
  outputAgendaItems(includeDrafts).forEach(item=>{
    plan.push({type:"agenda",item});
    includedPdfMaterials(item.agenda).forEach(material=>{
      for(let pageIndex=1;pageIndex<=material.pageCount;pageIndex++) plan.push({type:"attachment",item,material,pageIndex});
    });
  });
  return plan;
}
function renderPreview(){
  // 관리자 기기(비밀번호를 입력해 본 기기)는 미완성 안건도 미리보기에서 확인할 수 있다 (v70).
  // 인쇄·Word·DOCX·다른 방문자 화면에는 여전히 완성 안건만 나간다.
  const showDrafts=isAdminDevice();
  const plan=outputPagePlan(showDrafts);
  const totalPages=1+plan.length;
  const draftCount=plan.filter(e=>e.type==="agenda"&&e.item.draft).length;
  const pages=plan.map((entry,index)=>entry.type==="agenda"
    ? agendaPageHtml(entry.item,index+2,totalPages)
    : attachmentPageHtml(entry.item,entry.material,entry.pageIndex,index+2,totalPages)
  ).join("");
  const notice=showDrafts&&draftCount?`<div class="preview-admin-note">🔒 관리자 전용 미리보기 — 미완성 안건 ${draftCount}건(빨간 점선 표시)이 함께 보입니다. 다른 방문자 화면과 인쇄·Word 출력에는 의결·표결까지 완료된 안건만 나갑니다.</div>`:"";
  const shell=document.getElementById("previewShell");
  shell.innerHTML=notice+coverHtml(totalPages)+pages;
  hydrateInlineAttachments(shell); // 첨부 원문 인라인 표시 (v73)
  renderSourceBox(); // 원문 전문 (v62)
}
// 원문 전문 상자 (v62): 레코드에 `source`(옮겨 적은 공고 원문)가 있으면 미리보기 아래에 접이식으로 보여 준다.
//   state.source = {kind:"결과공고", noticeNo, postedFrom, postedTo, signed, signer, file, origin, text, notes}
function renderSourceBox(){
  const box=document.getElementById("sourceBox"); if(!box) return;
  const s=state && state.source;
  if(!s || !s.text){ box.style.display="none"; box.innerHTML=""; return; }
  const meta=[
    s.kind||"원문",
    s.noticeNo?("공고번호 "+s.noticeNo):"",
    (s.postedFrom||s.postedTo)?("게시 "+(s.postedFrom||"?")+" ~ "+(s.postedTo||"?")):"",
    s.signed?("공고일 "+s.signed):"",
    s.origin||""
  ].filter(Boolean).map(esc).join(" · ");
  box.style.display="";
  box.innerHTML=
    '<summary><b>📄 원문 전문</b> <span class="source-meta">'+meta+'</span></summary>'+
    '<pre class="source-text">'+esc(s.text)+'</pre>'+
    (s.file?'<div class="source-foot">원본 파일: '+esc(s.file)+(s.link?' · <a href="'+esc(s.link)+'" target="_blank" rel="noopener">원본 열기 ↗</a>':'')+'</div>':'')+
    (s.notes?'<div class="source-foot">※ '+esc(s.notes)+'</div>':'');
}

function showToast(message,type=""){
  const t=document.getElementById("toast");
  if(!t) return;
  t.textContent=message;
  t.className="toast show"+(type?` ${type}`:"");
  clearTimeout(showToast._timer);
  showToast._timer=setTimeout(()=>{t.className="toast"},3600);
}

function sanitizeFileName(name){
  return String(name||"산들마을_입주자대표회의_회의록").replace(/[\\/:*?"<>|]/g,"_");
}

function modalStatus(message,type=""){
  const el=document.getElementById("exportStatus");
  if(!el) return;
  if(!message){
    el.textContent="";
    el.className="export-status";
    return;
  }
  el.textContent=message;
  el.className="export-status show"+(type?` ${type}`:"");
}

function openExportModal(type){
  if(window.track) track("export_open",{type:String(type||"")});
  const backdrop=document.getElementById("exportModalBackdrop");
  const title=document.getElementById("exportModalTitle");
  const content=document.getElementById("exportModalContent");
  const actions=document.getElementById("exportModalActions");
  if(!backdrop||!title||!content||!actions) return;

  modalStatus("");
  backdrop.dataset.type=type;

  if(type==="backup"){
    title.textContent="회의록 백업 저장";
    content.innerHTML=`
      <p>현재 회의록 데이터를 <b>JSON 백업 파일</b>로 저장합니다.</p>
      <div class="export-modal-summary">
        포함 내용: 회의 기본정보 · 기수별 동대표 명단 · 참석현황 · 배석자 · 참관 인원 · 회의진행순서 · 안건 · 회의자료 기록과 첨부 원문 파일 · 주요 발언 · 표결 · 의결사항 · 후속조치
      </div>`;
    actions.innerHTML=`
      <button class="btn soft" onclick="closeExportModal()">취소</button>
      <button class="btn primary" onclick="saveBackupFromModal()">파일 저장</button>`;
  }else if(type==="word"){
    title.textContent="Word / 한글용 문서 저장";
    content.innerHTML=`
      <p>현재 회의록을 수정 가능한 <b>.docx 문서</b>로 저장합니다.</p>
      <div class="export-modal-summary">
        Word에서 수정하거나 한글에서 열어 HWP 형식으로 다시 저장할 수 있습니다.<br>
        ‘출력물에 회의자료 포함’을 선택한 PDF·이미지 원문도 해당 안건 뒤에 이어집니다.
      </div>`;
    actions.innerHTML=`
      <button class="btn soft" onclick="closeExportModal()">취소</button>
      <button class="btn primary" onclick="saveWordFromModal()">문서 생성 · 저장</button>`;
  }else{
    title.textContent="PDF · 인쇄";
    content.innerHTML=`
      <p>사용 목적에 맞는 출력 방식을 선택하세요.</p>
      <div class="export-modal-summary">
        <b>첨부 제외 출력</b> — 종이로 배포할 회의록 본문만 출력합니다.<br>
        <b>첨부 포함 출력</b> — 웹 게시용으로 회의록과 첨부 원문을 한 파일에 포함합니다.<br><br>
        인쇄창에서 프린터 대신 <b>PDF로 저장</b>을 선택할 수 있습니다.
      </div>`;
    actions.innerHTML=`
      <button class="btn soft" onclick="closeExportModal()">취소</button>
      <button class="btn" onclick="printFromModal(false)">첨부 제외 출력</button>
      <button class="btn gold" onclick="printFromModal(true)">첨부 포함 출력</button>`;
  }

  backdrop.classList.add("show");
}

function closeExportModal(){
  const backdrop=document.getElementById("exportModalBackdrop");
  if(backdrop) backdrop.classList.remove("show");
  modalStatus("");
}

function closeExportModalFromBackdrop(event){
  if(event.target && event.target.id==="exportModalBackdrop") closeExportModal();
}

async function writeBlobWithPicker(blob,fileName,description){
  // Chromium/Whale/Edge에서 지원할 경우 사용자가 누른 버튼 동작 안에서 직접 저장창 호출
  if(window.showSaveFilePicker){
    try{
      const ext=fileName.includes(".")?fileName.slice(fileName.lastIndexOf(".")):"";
      const mime=blob.type||"application/octet-stream";
      const handle=await window.showSaveFilePicker({
        suggestedName:fileName,
        types:[{description,accept:{[mime]:[ext||".bin"]}}]
      });
      const writable=await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return {ok:true,mode:"picker"};
    }catch(err){
      if(err && err.name==="AbortError") return {ok:false,cancelled:true};
      console.warn("showSaveFilePicker unavailable/blocked",err);
    }
  }

  // 일반 다운로드 fallback
  try{
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=fileName;
    a.style.display="none";
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      URL.revokeObjectURL(url);
      a.remove();
    },1800);
    return {ok:true,mode:"download"};
  }catch(err){
    console.error(err);
    return {ok:false,error:err};
  }
}

async function saveBackupFromModal(){
  try{
    persistOnly();
    modalStatus("백업 파일을 준비하는 중입니다…");
    const payload=JSON.parse(JSON.stringify(state));
    payload._attachments={};
    for(const agenda of state.agendas){
      normalizeRemarks(agenda);
      for(const material of agenda.materials){
        if(!material.fileName) continue;
        const stored=await getAttachment(material.attachmentKey||material.id);
        if(!stored) continue;
        const dataUrl=await new Promise((resolve,reject)=>{
          const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(stored);
        });
        payload._attachments[material.attachmentKey||material.id]={name:material.fileName,type:material.fileType||stored.type||"application/octet-stream",dataUrl};
      }
    }
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const fileName=`${sanitizeFileName(buildMeetingName())}_백업.json`;
    const result=await writeBlobWithPicker(blob,fileName,"회의록 백업");
    if(result.ok){
      modalStatus(
        result.mode==="picker"
          ? "백업 파일 저장이 완료되었습니다."
          : "다운로드가 시작되었습니다. 브라우저 다운로드 목록을 확인하세요."
      );
    }else if(result.cancelled){
      modalStatus("저장이 취소되었습니다.","warn");
    }else{
      modalStatus("현재 환경에서 파일 다운로드가 차단되었습니다. HTML 파일을 PC에 저장한 후 Chrome 또는 Whale에서 실행하세요.","error");
    }
  }catch(err){
    console.error(err);
    modalStatus("백업 저장 중 오류가 발생했습니다.","error");
  }
}

function printableDocumentHtml(content){
  const styles=Array.from(document.querySelectorAll("style")).map(s=>s.innerHTML).join("\n");
  return `<!doctype html>
  <html lang="ko">
  <head>
    <meta charset="utf-8">
    <title>${esc(buildMeetingName())}</title>
    <style>
      ${styles}
      html,body{margin:0;padding:0;background:#fff}
      body{font-family:"Malgun Gothic","Noto Sans KR",Arial,sans-serif}
      .sidebar,.topbar,.help,.toast,.print-helper,.export-modal-backdrop,.attachment-inline{display:none!important}
      .preview-shell{display:block}
      .paper{box-shadow:none;margin:0 auto;border-radius:0;page-break-inside:avoid;break-inside:avoid}
      @page{size:A4;margin:0}
      @media print{
        .paper{page-break-after:always;break-after:page}
        .paper:last-child{page-break-after:auto}
      }
    </style>
  </head>
  <body>${content}</body>
  </html>`;
}

async function renderPdfMaterialPages(material){
  const blob=await getAttachment(material.attachmentKey||material.id);
  if(!blob) throw new Error(`${material.fileName} 파일을 현재 브라우저에서 찾을 수 없습니다.`);
  if(materialKind(material)==="image"){
    // 이미지 1장 = 출력 1쪽. DOCX(ImageRun type:"jpg")와 인쇄가 같은 경로를 쓰므로 흰 배경 JPEG로 통일한다.
    modalStatus(`${material.fileName} 이미지를 인쇄용으로 변환하는 중입니다…`);
    const bitmapUrl=URL.createObjectURL(blob);
    try{
      const img=await new Promise((resolve,reject)=>{
        const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error(`${material.fileName} 이미지를 읽지 못했습니다.`));im.src=bitmapUrl;
      });
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,img.naturalWidth);canvas.height=Math.max(1,img.naturalHeight);
      const context=canvas.getContext("2d",{alpha:false});
      context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(img,0,0);
      return [canvas.toDataURL("image/jpeg",.92)];
    }finally{ URL.revokeObjectURL(bitmapUrl); }
  }
  const lib=await getPdfLibrary();
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const pdf=await lib.getDocument({data:bytes}).promise;
  const images=[];
  for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
    modalStatus(`${material.fileName} ${pageNo} / ${pdf.numPages}쪽을 인쇄용으로 변환하는 중입니다…`);
    const page=await pdf.getPage(pageNo);
    const viewport=page.getViewport({scale:1.8});
    const canvas=document.createElement("canvas");
    canvas.width=Math.ceil(viewport.width); canvas.height=Math.ceil(viewport.height);
    const context=canvas.getContext("2d",{alpha:false});
    context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);
    await page.render({canvasContext:context,viewport,intent:"print"}).promise; // rAF 미사용 — 숨김·백그라운드 탭에서도 렌더 진행 (v73)
    images.push(canvas.toDataURL("image/jpeg",.92));
    page.cleanup();
  }
  return images;
}

async function buildPrintableContent(includeAttachments=true){
  const plan=outputPagePlan().filter(entry=>includeAttachments||entry.type!=="attachment");
  const totalPages=1+plan.length;
  const imageCache=new Map();
  const parts=[coverHtml(totalPages)];
  for(let i=0;i<plan.length;i++){
    const entry=plan[i];
    if(entry.type==="agenda") parts.push(agendaPageHtml(entry.item,i+2,totalPages));
    else{
      const key=entry.material.id;
      if(!imageCache.has(key)) imageCache.set(key,await renderPdfMaterialPages(entry.material));
      const images=imageCache.get(key);
      parts.push(attachmentPageHtml(entry.item,entry.material,entry.pageIndex,i+2,totalPages,images[entry.pageIndex-1]||""));
    }
  }
  return parts.join("");
}

function wordDocumentHtml(){
  const attendance=state.meeting.attendance||{};
  const rolePriority={"회장":0,"감사":1,"이사":2,"대표":3};
  const reps=currentRoster().filter(r=>r.name.trim()).sort((a,b)=>{
    const aa=!!attendance[String(a.dong)], ba=!!attendance[String(b.dong)];
    if(aa!==ba) return aa?-1:1;
    if(aa&&ba){
      const ap=rolePriority[a.role]??99, bp=rolePriority[b.role]??99;
      if(ap!==bp) return ap-bp;
    }
    return Number(a.dong)-Number(b.dong);
  });
  const split=Math.ceil(reps.length/2);
  const left=reps.slice(0,split), right=reps.slice(split);
  const rowCount=Math.max(left.length,right.length,1);
  const repCells=r=>{
    if(!r) return `<td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>`;
    const attended=!!attendance[String(r.dong)];
    const cls=attended?"":" class=\"absent\"";
    return `<td${cls}>${seatLabel(r)}</td><td${cls}>${esc(r.role||"대표")}</td><td${cls}>${esc(r.name)}</td><td class="${attended?"signature":"absent"}">${attended?"<span class=\"sign-line\">&nbsp;</span>":"미참석"}</td>`;
  };
  const rosterRows=Array.from({length:rowCount},(_,i)=>`<tr>${repCells(left[i])}${repCells(right[i])}</tr>`).join("");
  const guests=(state.meeting.guests||[]).filter(g=>g.name.trim()||g.position.trim());
  const guestText=guests.length
    ? guests.map(g=>esc(guestCoverLabel(g))).join("<br>")
    : "없음";
  const audienceText=Number(state.meeting.audience?.count)>0
    ? `입주민 총 ${Math.floor(Number(state.meeting.audience.count))}명`
    : "없음";
  const sectionTitle=title=>`<table class="section-title"><tr><td>${esc(title)}</td></tr></table>`;
  const contentBox=(html,extra="")=>`<table class="content-box ${extra}"><tr><td>${html||"&nbsp;"}</td></tr></table>`;
  const sequenceRows=(state.meeting.sequence||[]).map((s,i)=>`<tr><th>${i+1}</th><td>${esc(s)}</td></tr>`).join("");
  const agendaRows=state.agendas.length
    ? state.agendas.map((a,i)=>`<tr><th>${agendaLabelAt(i)}</th><td>${esc(a.title||"")}</td></tr>`).join("")
    : `<tr><th>-</th><td>등록된 안건이 없습니다.</td></tr>`;

  const cover=`<div class="page Section1">
    ${bodyMarkHtml("word")}<div class="word-title">${docTitle()}</div>
    <table class="grid meta"><colgroup><col style="width:14%"><col style="width:41%"><col style="width:12%"><col style="width:33%"></colgroup>
      <tr><th>회의명</th><td colspan="3">${esc(buildMeetingName())}</td></tr>
      <tr><th>일시</th><td>${esc(formattedMeetingDateTime())}</td><th>장소</th><td>${esc(state.meeting.place)}</td></tr>
    </table>
    ${sectionTitle("참석자 명단")}
    <table class="grid roster"><colgroup><col style="width:7%"><col style="width:9%"><col style="width:20%"><col style="width:9%"><col style="width:7%"><col style="width:9%"><col style="width:20%"><col style="width:9%"></colgroup>
      <tr class="head"><th>동</th><th>직책</th><th>성명</th><th>서명</th><th>동</th><th>직책</th><th>성명</th><th>서명</th></tr>${rosterRows}
    </table>
    ${sectionTitle("배석자 · 참관 현황")}
    <table class="grid guests"><tr><th>배석자</th><th>참관</th></tr><tr><td>${guestText}</td><td>${audienceText}</td></tr></table>
    ${sectionTitle("회의 진행순서")}
    <table class="grid compact">${sequenceRows}</table>
    ${sectionTitle("상정 안건")}
    <table class="grid compact">${agendaRows}</table>
  </div>`;

  const agendaPages=state.agendas.map((a,idx)=>{
    normalizeRemarks(a);
    const vote=voteStatus(a);
    const filled=Object.entries(a.remarks||{}).filter(([_,text])=>String(text||"").trim());
    const remarkRows=a.noRemarks
      ? `<tr><td colspan="2" class="center muted">주요 발언 없음</td></tr>`
      : filled.length
        ? filled.map(([key,text])=>{
            return `<tr><th>${esc(remarkSpeakerLabel(key))}</th><td>${nl2br(text,{autoBullets:true})}</td></tr>`;
          }).join("")
        : `<tr><td colspan="2" class="center muted">주요 발언 기록 전</td></tr>`;
    const voteRows=voteIsBlank(a)
      ? `<tr><th>표결</th><td class="muted">미기입 — 의결 전 상정 안건</td></tr>`
      : vote.unanimous
      ? `<tr><th class="unanimous">만장일치</th><td>${esc(vote.detail)}</td></tr>`
      : `<tr><th>찬성(${vote.forCount})</th><td>${esc(voteNames(a,"for"))||"&nbsp;"}</td></tr>
         <tr><th>반대(${vote.againstCount})</th><td>${esc(voteNames(a,"against"))||"&nbsp;"}</td></tr>
         ${vote.incomplete?`<tr><th class="incomplete">미선택(${vote.incomplete})</th><td>표결 선택이 완료되지 않았습니다.</td></tr>`:""}`;
    return `<div class="word-page-break">&nbsp;</div><div class="page Section1">
      ${bodyMarkHtml("word")}<div class="word-title">${docTitle()}</div>
      <table class="grid agenda-title"><tr><th>${agendaLabelAt(idx)}</th><td>${esc(a.title)}</td></tr></table>
      ${String(a.summary||"").trim()?sectionTitle("안건 요지")+contentBox(nl2br(a.summary),"summary"):""}
      ${sectionTitle("주요 발언")}<table class="grid remarks">${remarkRows}</table>
      ${sectionTitle("의결사항")}${contentBox(nl2br(decisionForOutput(a)),"decision")}
      ${sectionTitle("표결")}<table class="grid votes">${voteRows}</table>
      ${sectionTitle("후속조치")}${contentBox(nl2br(a.followup),"followup")}
    </div>`;
  }).join("");

  return `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="ko">
  <head><meta charset="utf-8"><title>${esc(buildMeetingName())}</title>
  <style>
    @page Section1{size:595.3pt 841.9pt;margin:34pt 40pt 34pt 40pt;mso-header-margin:0;mso-footer-margin:0}
    div.Section1{page:Section1}
    body{font-family:"Malgun Gothic","맑은 고딕",Arial,sans-serif;color:#2f332f;font-size:9pt;margin:0}
    .page{page-break-inside:avoid;mso-break-inside:avoid}
    .word-page-break{height:0;line-height:0;font-size:0;page-break-before:always;mso-break-type:section-break}
    .word-title{font-size:18pt;font-weight:700;text-align:center;border-top:3px double #6f7f6b;border-bottom:1px solid #aeb8aa;padding:8pt 6pt;margin:0 0 16pt 0}
    table{border-collapse:collapse;width:100%;table-layout:fixed}
    .grid th,.grid td{border:1px solid #9d978c;padding:5pt 6pt;vertical-align:middle;line-height:1.35}
    .grid th{background:#f4f6f2;font-weight:700;text-align:left}
    .meta th,.agenda-title th{white-space:nowrap}.agenda-title td{font-weight:700}
    .section-title{margin-top:14pt;border-collapse:collapse}
    .section-title td{border-top:1px solid #9da79a;border-bottom:1px solid #cbd1c8;border-left:4px solid #7f927a;padding:5pt 7pt;font-weight:700}
    .roster th,.roster td{text-align:left;font-size:8.5pt}.roster .head th{text-align:center}
    .roster .absent{color:#888;background:#f3f2ee}.roster td.signature{text-align:center}.sign-line{display:inline-block;width:28pt;border-bottom:1px solid #8d887f}
    .guests th{width:50%}.guests td{vertical-align:top}
    .compact th{width:9%;text-align:center}.compact td{width:91%}
    .content-box td{border:1px solid #9d978c;border-top:0;padding:7pt;vertical-align:top;line-height:1.55;min-height:42pt}
    .remarks th{width:23%}.remarks td{width:77%;vertical-align:top}.center{text-align:center}.muted{color:#777;background:#faf8f2;padding:12pt!important}
    .votes th{width:18%;text-align:center}.votes .unanimous{background:#e8efe5}.votes .incomplete{background:#fff4d6}
    .word-footer{text-align:center;color:#777;font-size:8pt;margin-top:12pt}
  </style></head><body>${cover}${agendaPages}</body></html>`;
}

function xmlText(value){
  return String(value??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&apos;");
}

function wRun(text,{bold=false,size=18,color="2F332F"}={}){
  const body=String(text??"").split("\n").map((line,i)=>
    `${i?"<w:br/>":""}<w:t xml:space="preserve">${xmlText(line)}</w:t>`
  ).join("")||"<w:t xml:space=\"preserve\"> </w:t>";
  return `<w:r><w:rPr><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="맑은 고딕"/>${bold?"<w:b/>":""}<w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>${body}</w:r>`;
}

function wParagraph(text,opts={}){
  const align=opts.align?`<w:jc w:val="${opts.align}"/>`:"";
  const before=Number(opts.before||0), after=Number(opts.after??40);
  const line=Number(opts.line||260);
  const left=Number(opts.left||0), hanging=Number(opts.hanging||0);
  const indent=(left||hanging)
    ? `<w:ind${left?` w:left="${left}"`:""}${hanging?` w:hanging="${hanging}"`:""}/>`
    : "";
  const keepNext=opts.keepNext?"<w:keepNext/>":"";
  const pageBreak=opts.pageBreakBefore?"<w:pageBreakBefore/>":"";
  const borders=opts.borders||"";
  return `<w:p><w:pPr>${align}${indent}<w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="auto"/>${keepNext}${pageBreak}${borders}</w:pPr>${wRun(text,opts)}</w:p>`;
}

function wFormattedParagraphs(text,opts={}){
  return String(text??"").replace(/\r/g,"").split("\n").map(line=>{
    const parts=listLineParts(line);
    const isList=!!parts || (!!opts.autoBullets && !!line.trim());
    const outputLine=(!parts && opts.autoBullets && line.trim()) ? `- ${line.trimStart()}` : line;
    return wParagraph(outputLine||" ",{
      ...opts,
      left:isList?360:0,
      hanging:isList?240:0,
      after:line?25:60,
      line:opts.line||280
    });
  }).join("");
}

function wCell(text,{width=1000,span=1,shade="FFFFFF",bold=false,align="left",size=19,color="2F332F",borders="",formatLists=false,autoBullets=false}={}){
  const content=(formatLists||autoBullets)
    ? wFormattedParagraphs(text,{bold,align,size,color,line:280,autoBullets})
    : wParagraph(text,{bold,align,size,color,after:0,line:250});
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${span>1?`<w:gridSpan w:val="${span}"/>`:""}<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/><w:vAlign w:val="center"/>${borders}</w:tcPr>${content}</w:tc>`;
}

function wTable(rows,widths,{borderColor="9D978C",cellMargin=80,after=60}={}){
  const total=widths.reduce((sum,n)=>sum+n,0);
  const border=name=>`<w:${name} w:val="single" w:sz="5" w:space="0" w:color="${borderColor}"/>`;
  const grid=widths.map(w=>`<w:gridCol w:w="${w}"/>`).join("");
  const rowXml=rows.map(row=>`<w:tr><w:trPr><w:cantSplit/></w:trPr>${row.map(cell=>wCell(cell.text,{...cell,width:cell.width||widths[cell.index||0]})).join("")}</w:tr>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${border("top")}${border("left")}${border("bottom")}${border("right")}${border("insideH")}${border("insideV")}</w:tblBorders><w:tblCellMar><w:top w:w="${cellMargin}" w:type="dxa"/><w:left w:w="${cellMargin}" w:type="dxa"/><w:bottom w:w="${cellMargin}" w:type="dxa"/><w:right w:w="${cellMargin}" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rowXml}</w:tbl>${wParagraph("",{size:2,after})}`;
}

function wSectionTitle(title){
  const borders=`<w:pBdr><w:top w:val="single" w:sz="4" w:space="2" w:color="9DA79A"/><w:left w:val="single" w:sz="18" w:space="5" w:color="7F927A"/><w:bottom w:val="single" w:sz="4" w:space="2" w:color="CBD1C8"/></w:pBdr>`;
  return wParagraph(title,{bold:true,size:21,before:150,after:45,line:275,keepNext:true,borders});
}

function wContentBox(text,{autoBullets=false}={}){
  return wTable([[{text:text||" ",index:0,size:22,formatLists:true,autoBullets}]],[10160],{cellMargin:130,after:40});
}

function docxDocumentXml(){
  const attendance=state.meeting.attendance||{};
  const rolePriority={"회장":0,"감사":1,"이사":2,"대표":3};
  const reps=currentRoster().filter(r=>r.name.trim()).sort((a,b)=>{
    const aa=!!attendance[String(a.dong)], ba=!!attendance[String(b.dong)];
    if(aa!==ba) return aa?-1:1;
    if(aa&&ba){
      const ap=rolePriority[a.role]??99, bp=rolePriority[b.role]??99;
      if(ap!==bp) return ap-bp;
    }
    return Number(a.dong)-Number(b.dong);
  });
  const split=Math.ceil(reps.length/2);
  const left=reps.slice(0,split), right=reps.slice(split);
  const rosterWidths=[840,800,1380,2060,840,800,1380,2060];
  const rosterHead=["동","직책","성명","서명","동","직책","성명","서명"].map((text,index)=>({text,index,bold:true,align:"center",size:18,shade:"F4F6F2"}));
  const rosterRows=[rosterHead];
  for(let i=0;i<Math.max(left.length,right.length,1);i++){
    const cells=[];
    [left[i],right[i]].forEach((rep,side)=>{
      const start=side*4;
      if(!rep){
        for(let j=0;j<4;j++) cells.push({text:" ",index:start+j,size:18});
        return;
      }
      const attended=!!attendance[String(rep.dong)];
      const shade=attended?"FFFFFF":"F3F2EE";
      const color=attended?"2F332F":"888888";
      cells.push({text:`${seatLabel(rep)}`,index:start,size:18,shade,color,align:"center"});
      cells.push({text:rep.role||"대표",index:start+1,size:18,shade,color,align:"center"});
      cells.push({text:rep.name,index:start+2,size:18,shade,color,align:"center"});
      cells.push({text:attended?"─────":"미참석",index:start+3,size:17,shade,color,align:"center"});
    });
    rosterRows.push(cells);
  }
  const guests=(state.meeting.guests||[]).filter(g=>g.name.trim()||g.position.trim());
  const guestText=guests.length
    ? guests.map(guestCoverLabel).join("\n")
    : "없음";
  const audienceText=Number(state.meeting.audience?.count)>0
    ? `입주민 총 ${Math.floor(Number(state.meeting.audience.count))}명`
    : "없음";
  const titleBorders=`<w:pBdr><w:top w:val="double" w:sz="10" w:space="3" w:color="6F7F6B"/><w:bottom w:val="single" w:sz="5" w:space="3" w:color="AEB8AA"/></w:pBdr>`;
  const title=()=>wParagraph(docTitle(),{bold:true,size:34,align:"center",after:210,line:340,borders:titleBorders});
  let body=title();
  body+=wTable([
    [{text:"회의명",index:0,bold:true,shade:"F4F6F2",align:"center"},{text:buildMeetingName(),index:1,span:3,width:8738,bold:true,size:20}],
    [{text:"일시",index:0,bold:true,shade:"F4F6F2",align:"center"},{text:formattedMeetingDateTime(),index:1},{text:"장소",index:2,bold:true,shade:"F4F6F2",align:"center"},{text:state.meeting.place,index:3}]
  ],[1422,3860,1220,3658],{after:15});
  body+=wSectionTitle("참석자 명단");
  body+=wTable(rosterRows,rosterWidths,{cellMargin:55,after:10});
  body+=wSectionTitle("배석자 · 참관 현황");
  body+=wTable([
    [{text:"배석자",index:0,bold:true,shade:"F4F6F2"},{text:"참관",index:1,bold:true,shade:"F4F6F2"}],
    [{text:guestText,index:0,size:18},{text:audienceText,index:1,size:18}]
  ],[5080,5080],{cellMargin:65,after:10});
  body+=wSectionTitle("회의 진행순서");
  const sequenceRows=(state.meeting.sequence||[]).map((s,i)=>[
    {text:String(i+1),index:0,bold:true,align:"center",shade:"F4F6F2",size:18},
    {text:s,index:1,size:18}
  ]);
  body+=wTable(sequenceRows.length?sequenceRows:[[{text:"-",index:0},{text:" ",index:1}]],[720,9440],{cellMargin:55,after:10});
  body+=wSectionTitle("상정 안건");
  const agendaRows=state.agendas.length?state.agendas.map((a,i)=>[
    {text:agendaLabelAt(i),index:0,bold:true,align:"center",shade:"F4F6F2",size:18},
    {text:a.title||" ",index:1,size:18}
  ]):[[{text:"-",index:0},{text:"등록된 안건이 없습니다.",index:1}]];
  body+=wTable(agendaRows,[1080,9080],{cellMargin:55,after:10});

  state.agendas.forEach((a,idx)=>{
    normalizeRemarks(a);
    const vote=voteStatus(a);
    body+=`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    body+=wParagraph(buildMeetingName(),{size:15,color:"6F746C",align:"right",after:35});
    body+=wParagraph(`${agendaLabelAt(idx)}  ${a.title||"안건명 미입력"}`,{bold:true,size:30,align:"left",after:120,line:330,borders:titleBorders});
    if(String(a.summary||"").trim()) body+=wSectionTitle("안건 요지")+wContentBox(a.summary,{autoBullets:true});
    const printableMaterials=(a.materials||[]).filter(m=>m.title.trim()||m.reference.trim()||m.note.trim());
    if(a.showMaterials && printableMaterials.length){
      body+=wSectionTitle("회의자료 · 첨부자료");
      const materialRows=[
        [
          {text:"자료명",index:0,bold:true,align:"center",shade:"F4F6F2",size:18},
          {text:"링크 · 파일명 · 보관 위치",index:1,bold:true,align:"center",shade:"F4F6F2",size:18},
          {text:"검토 내용 · 비고",index:2,bold:true,align:"center",shade:"F4F6F2",size:18}
        ],
        ...printableMaterials.map(m=>[
          {text:m.title||"자료명 미입력",index:0,size:18},
          {text:m.reference||" ",index:1,size:17},
          {text:m.note||" ",index:2,size:18,formatLists:true}
        ])
      ];
      body+=wTable(materialRows,[2200,3400,4560],{cellMargin:65,after:10});
    }
    const filled=Object.entries(a.remarks||{}).filter(([_,text])=>String(text||"").trim());
    if(!a.noRemarks && filled.length){
      body+=wSectionTitle("주요 발언");
      const remarkRows=filled.map(([key,text])=>{
        return [
          {text:remarkSpeakerLabel(key),index:0,bold:true,shade:"F4F6F2",size:24},
          {text,index:1,size:24,formatLists:true,autoBullets:true}
        ];
      });
      body+=wTable(remarkRows,[2340,7820],{cellMargin:85,after:10});
    }
    body+=wSectionTitle("의결사항")+wContentBox(decisionForOutput(a));
    body+=wSectionTitle("표결");
    const voteRows=voteIsBlank(a)
      ? [[{text:"표결",index:0,bold:true,align:"center",shade:"F4F6F2"},{text:"미기입 — 의결 전 상정 안건",index:1}]]
      : vote.unanimous
      ? [[{text:"만장일치",index:0,bold:true,align:"center",shade:"E8EFE5"},{text:vote.detail,index:1}]]
      : [
          [{text:`찬성(${vote.forCount})`,index:0,bold:true,align:"center",shade:"F4F6F2"},{text:voteNames(a,"for")||" ",index:1}],
          [{text:`반대(${vote.againstCount})`,index:0,bold:true,align:"center",shade:"F4F6F2"},{text:voteNames(a,"against")||" ",index:1}],
          ...(vote.incomplete?[[{text:`미선택(${vote.incomplete})`,index:0,bold:true,align:"center",shade:"FFF4D6"},{text:"표결 선택이 완료되지 않았습니다.",index:1}]]:[])
        ];
    body+=wTable(voteRows,[1900,8260],{cellMargin:70,after:10});
    if(a.showFollowup) body+=wSectionTitle("후속조치")+wContentBox(a.followup||" ");
  });

  const sectPr=`<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="650" w:right="720" w:bottom="650" w:left="720" w:header="0" w:footer="300" w:gutter="0"/><w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}${sectPr}</w:body></w:document>`;
}

function crc32(bytes){
  if(!crc32.table){
    crc32.table=Array.from({length:256},(_,n)=>{
      let c=n;
      for(let k=0;k<8;k++) c=(c&1)?0xEDB88320^(c>>>1):c>>>1;
      return c>>>0;
    });
  }
  let crc=0xFFFFFFFF;
  for(const b of bytes) crc=crc32.table[(crc^b)&0xFF]^(crc>>>8);
  return (crc^0xFFFFFFFF)>>>0;
}

function write16(view,offset,value){view.setUint16(offset,value,true)}
function write32(view,offset,value){view.setUint32(offset,value>>>0,true)}

function zipStored(files){
  const encoder=new TextEncoder();
  const localParts=[], centralParts=[];
  let offset=0;
  const now=new Date();
  const dosTime=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1);
  const dosDate=((Math.max(now.getFullYear(),1980)-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
  files.forEach(file=>{
    const name=encoder.encode(file.name);
    const data=typeof file.data==="string"?encoder.encode(file.data):file.data;
    const crc=crc32(data);
    const local=new Uint8Array(30+name.length+data.length);
    const lv=new DataView(local.buffer);
    write32(lv,0,0x04034B50);write16(lv,4,20);write16(lv,6,0x0800);write16(lv,8,0);
    write16(lv,10,dosTime);write16(lv,12,dosDate);write32(lv,14,crc);write32(lv,18,data.length);write32(lv,22,data.length);
    write16(lv,26,name.length);write16(lv,28,0);local.set(name,30);local.set(data,30+name.length);
    localParts.push(local);
    const central=new Uint8Array(46+name.length);
    const cv=new DataView(central.buffer);
    write32(cv,0,0x02014B50);write16(cv,4,20);write16(cv,6,20);write16(cv,8,0x0800);write16(cv,10,0);
    write16(cv,12,dosTime);write16(cv,14,dosDate);write32(cv,16,crc);write32(cv,20,data.length);write32(cv,24,data.length);
    write16(cv,28,name.length);write16(cv,30,0);write16(cv,32,0);write16(cv,34,0);write16(cv,36,0);write32(cv,38,0);write32(cv,42,offset);
    central.set(name,46);centralParts.push(central);offset+=local.length;
  });
  const centralSize=centralParts.reduce((sum,p)=>sum+p.length,0);
  const end=new Uint8Array(22);const ev=new DataView(end.buffer);
  write32(ev,0,0x06054B50);write16(ev,4,0);write16(ev,6,0);write16(ev,8,files.length);write16(ev,10,files.length);
  write32(ev,12,centralSize);write32(ev,16,offset);write16(ev,20,0);
  const total=offset+centralSize+end.length;
  const out=new Uint8Array(total);let cursor=0;
  [...localParts,...centralParts,end].forEach(part=>{out.set(part,cursor);cursor+=part.length});
  return out;
}

async function buildDocxBlob(){
  const d=window.docx;
  if(!d) throw new Error("Word 문서 생성 도구를 불러오지 못했습니다.");
  const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,AlignmentType,VerticalAlign,BorderStyle,ShadingType,TableLayoutType,Footer,PageNumber,PageBreak,ImageRun}=d;
  const FONT="Malgun Gothic", INK="2F332F", LINE="9D978C", SAGE="7F927A", WIDTH=10160, BODY=26;
  const numberingConfigs=[];
  let numberingSequence=0;
  const run=(text,{bold=false,size=BODY,color=INK}={})=>new TextRun({text:String(text??" ").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,""),bold,size,color,font:FONT});
  const p=(text,opts={})=>new Paragraph({
    children:Array.isArray(text)?text:[run(text,{bold:opts.bold,size:opts.size||BODY,color:opts.color||INK})],
    alignment:opts.alignment||AlignmentType.LEFT,
    spacing:{before:opts.before||0,after:opts.after??45,line:opts.line||300},
    keepNext:!!opts.keepNext,
    border:opts.border,
    indent:opts.indent
  });
  const borders={top:{style:BorderStyle.SINGLE,size:5,color:LINE},bottom:{style:BorderStyle.SINGLE,size:5,color:LINE},left:{style:BorderStyle.SINGLE,size:5,color:LINE},right:{style:BorderStyle.SINGLE,size:5,color:LINE},insideHorizontal:{style:BorderStyle.SINGLE,size:5,color:LINE},insideVertical:{style:BorderStyle.SINGLE,size:5,color:LINE}};
  const cell=(children,width,{shade="FFFFFF",align=AlignmentType.LEFT,compact=false}={})=>new TableCell({
    children:Array.isArray(children)?children:(typeof children==="string"||typeof children==="number"?[p(children,{size:BODY,alignment:align,after:0,line:compact?260:300})]:[children]),width:{size:width,type:WidthType.DXA},verticalAlign:VerticalAlign.CENTER,
    shading:{fill:shade,type:ShadingType.CLEAR},margins:{top:compact?35:70,bottom:compact?35:70,left:90,right:90}
  });
  const table=(rows,widths,opts={})=>new Table({rows:rows.map(row=>new TableRow({cantSplit:true,children:row.map((value,i)=>value instanceof TableCell?value:cell(value,widths[i],opts.cell||{}))})),width:{size:widths.reduce((a,b)=>a+b,0),type:WidthType.DXA},columnWidths:widths,borders,layout:TableLayoutType.FIXED,margins:{top:0,bottom:0,left:0,right:0}});
  const sectionTitle=title=>p(title,{bold:true,size:BODY,before:110,after:35,line:310,keepNext:true,border:{top:{style:BorderStyle.SINGLE,size:4,color:"9DA79A",space:2},bottom:{style:BorderStyle.SINGLE,size:4,color:"CBD1C8",space:2},left:{style:BorderStyle.SINGLE,size:18,color:SAGE,space:5}}});
  const formatted=(text,{autoBullets=false,size=BODY}={})=>{
    const paragraphs=[];
    const reference=`minutes-list-${++numberingSequence}`;
    numberingConfigs.push({reference,levels:[
      {level:0,format:"bullet",text:"-",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:360,hanging:240}},run:{font:FONT,size}}},
      {level:1,format:"decimal",text:"%1)",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:540,hanging:240}},run:{font:FONT,size}}},
      {level:2,format:"lowerLetter",text:"%2)",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:720,hanging:240}},run:{font:FONT,size}}}
    ]});
    String(text??"").replace(/\r/g,"").split("\n").forEach(line=>{
      if(!line.trim()){paragraphs.push(p(" ",{size,after:35}));return;}
      const parts=listLineParts(line);
      const level=parts?parts.level||0:0;
      const body=parts?parts.text:line.trimStart();
      if(parts||autoBullets){
        paragraphs.push(new Paragraph({children:[run(body,{size})],numbering:{reference,level},spacing:{after:25,line:300}}));
      }else paragraphs.push(p(line,{size,after:25,line:300}));
    });
    return paragraphs;
  };
  const contentBox=(text,autoBullets=true)=>table([[cell(formatted(text,{autoBullets,size:BODY}),WIDTH)]],[WIDTH]);
  const titleBorders={top:{style:BorderStyle.DOUBLE,size:10,color:"6F7F6B",space:3},bottom:{style:BorderStyle.SINGLE,size:5,color:"AEB8AA",space:3}};
  const pageBreak=()=>p([new PageBreak()],{after:0});
  const attendance=state.meeting.attendance||{};
  const rolePriority={"회장":0,"감사":1,"이사":2,"대표":3};
  const reps=currentRoster().filter(r=>r.name.trim()).sort((a,b)=>{
    const aa=!!attendance[String(a.dong)],bb=!!attendance[String(b.dong)];
    if(aa!==bb)return aa?-1:1;if(aa&&bb){const ap=rolePriority[a.role]??99,bp=rolePriority[b.role]??99;if(ap!==bp)return ap-bp;}return Number(a.dong)-Number(b.dong);
  });
  const split=Math.ceil(reps.length/2),left=reps.slice(0,split),right=reps.slice(split);
  const rosterWidths=[840,800,1380,2060,840,800,1380,2060];
  const rosterRows=[["동","직책","성명","서명","동","직책","성명","서명"].map((v,i)=>cell(p(v,{bold:true,size:24,alignment:AlignmentType.CENTER,after:0,line:280}),rosterWidths[i],{compact:true}))];
  for(let i=0;i<Math.max(left.length,right.length,1);i++){
    const row=[];[left[i],right[i]].forEach((rep,side)=>{
      const values=rep?[`${seatLabel(rep)}`,rep.role||"대표",rep.name,attendance[String(rep.dong)]?"":"미참석"]:[" "," "," "," "];
      values.forEach((v,j)=>row.push(cell(p(v,{size:24,alignment:AlignmentType.CENTER,after:0,line:280,color:rep&&!attendance[String(rep.dong)]?"888888":INK}),rosterWidths[side*4+j],{shade:"FFFFFF",compact:true})));
    });rosterRows.push(row);
  }
  const guests=(state.meeting.guests||[]).filter(g=>g.name.trim()||g.position.trim());
  const guestText=guests.length?guests.map(guestCoverLabel).join("\n"):"없음";
  const audienceText=Number(state.meeting.audience?.count)>0?`입주민 총 ${Math.floor(Number(state.meeting.audience.count))}명`:"없음";
  const sequenceData=sequenceItems().length?sequenceItems():["-"];
  const sequenceTable=sequenceIsStacked(sequenceData)
    ? table(sequenceData.map((s,i)=>[cell(p(String(i+1).padStart(2,"0"),{size:20,color:"647660",alignment:AlignmentType.CENTER,after:0}),720,{compact:true}),cell(p(s,{size:24,after:0,line:280}),9440,{compact:true})]),[720,9440])
    : table([[cell(p(sequenceData.flatMap((s,i)=>[
        run(`${String(i+1).padStart(2,"0")}  `,{size:20,color:"647660"}),
        run(s,{size:24}),
        ...(i<sequenceData.length-1?[run("     →     ",{size:22,color:"999B95"})]:[])
      ]),{alignment:AlignmentType.CENTER,after:0,line:280}),10160,{compact:true})]],[10160]);
  const children=[];
  children.push(p(docTitle(),{bold:true,size:40,alignment:AlignmentType.CENTER,after:120,line:390,border:titleBorders}));
  children.push(table([
    [cell(p("회의명",{bold:true,size:24,alignment:AlignmentType.CENTER,after:0,line:280}),1422,{compact:true}),new TableCell({children:[p(buildMeetingName(),{bold:true,size:24,after:0,line:280})],columnSpan:3,width:{size:8738,type:WidthType.DXA},verticalAlign:VerticalAlign.CENTER,margins:{top:45,bottom:45,left:90,right:90}})],
    [cell(p("일시",{bold:true,size:24,alignment:AlignmentType.CENTER,after:0,line:280}),1422,{compact:true}),cell(p(formattedMeetingDateTime(),{size:24,after:0,line:280}),3860,{compact:true}),cell(p("장소",{bold:true,size:24,alignment:AlignmentType.CENTER,after:0,line:280}),1220,{compact:true}),cell(p(state.meeting.place,{size:24,after:0,line:280}),3658,{compact:true})]
  ],[1422,3860,1220,3658]));
  children.push(sectionTitle("회의 진행순서"),sequenceTable);
  children.push(sectionTitle("참석자 명단"),table(rosterRows,rosterWidths));
  children.push(sectionTitle("배석자 · 참관 현황"),table([
    [cell(p("배석자",{bold:true,size:24,alignment:AlignmentType.CENTER,after:0}),1220,{compact:true}),cell(formatted(guestText,{size:24}),5580,{compact:true}),cell(p("참관",{bold:true,size:24,alignment:AlignmentType.CENTER,after:0}),1840,{compact:true}),cell(p(audienceText,{size:24,alignment:AlignmentType.CENTER,after:0}),1520,{compact:true})]
  ],[1220,5580,1840,1520]));
  children.push(sectionTitle("상정 안건"));
  const agendaRows=officialAgendaRows();
  children.push(table(agendaRows.length?agendaRows.map(row=>[cell(p(row.label,{bold:true,size:24,alignment:AlignmentType.CENTER,after:0,line:280}),1080,{compact:true}),cell(p(row.title||" ",{size:24,after:0,line:280}),9080,{compact:true})]):[[cell("-",1080,{compact:true}),cell("등록된 안건이 없습니다.",9080,{compact:true})]],[1080,9080]));

  for(const item of outputAgendaItems()){
    const a=item.agenda;normalizeRemarks(a);const vote=voteStatus(a);
    children.push(pageBreak(),p(buildMeetingName(),{size:20,color:"6F746C",alignment:AlignmentType.RIGHT,after:30}));
    children.push(p([run(item.label,{bold:true,size:26,color:"647660"}),run(`  ${item.title}`,{bold:true,size:34})],{after:85,line:360,border:titleBorders}));
    if(item.isOther)children.push(p(`기타안건 ${item.subIndex} / ${item.subTotal}  ${a.title||"소제목 미입력"}`,{bold:true,size:28,after:60,border:{bottom:{style:BorderStyle.SINGLE,size:4,color:"C8C2B6",space:3}}}));
    if(String(a.summary||"").trim()) children.push(sectionTitle("안건 요지"),contentBox(a.summary,true));
    const printableMaterials=(a.materials||[]).filter(m=>m.title.trim()||m.reference.trim()||m.note.trim()||m.fileName);
    if(a.showMaterials&&printableMaterials.length){
      children.push(sectionTitle("회의자료 · 첨부자료"));
      const rows=[["자료명","링크 · 파일명 · 보관 위치","검토 내용 · 비고"].map((v,i)=>cell(p(v,{bold:true,size:26,alignment:AlignmentType.CENTER,after:0}),[2200,3400,4560][i]))];
      printableMaterials.forEach(m=>rows.push([cell(m.title||m.fileName||"자료명 미입력",2200),cell([m.reference,m.fileName].filter(Boolean).join("\n")||" ",3400),cell(formatted(m.note,{size:26}),4560)]));
      children.push(table(rows,[2200,3400,4560]));
    }
    const filled=Object.entries(a.remarks||{}).filter(([_,text])=>String(text||"").trim());
    if(!a.noRemarks&&filled.length){
      children.push(sectionTitle("주요 발언"));
      children.push(table(filled.map(([key,text])=>[cell(p(remarkSpeakerLabel(key),{bold:true,size:24,alignment:AlignmentType.CENTER,after:0,line:280}),2800),cell(formatted(text,{autoBullets:true,size:24}),7360)]),[2800,7360]));
    }
    children.push(sectionTitle("의결사항"),contentBox(decisionForOutput(a),true),sectionTitle("표결"));
    if(voteIsBlank(a)){
      children.push(contentBox("표결 미기입 — 의결 전 상정 안건",true));
    }else{
      children.push(p([
        run(`찬성 ${vote.forCount}`,{bold:true,size:25,color:"2F5128"}),
        run(`   ·   반대 ${vote.againstCount}`,{bold:true,size:25,color:"8A2A20"})
      ],{after:45,line:290}));
      const personRows=currentAttendees().map(rep=>{
        const stateName=(a.votes||{})[actorKey(rep)]||"";
        const label=stateName==="for"?"찬성":stateName==="against"?"반대":"미선택";
        const shade=stateName==="for"?"E6F0E1":stateName==="against"?"FDE9E6":"FFF4D6";
        return [cell(actorFullLabel(rep),8160,{compact:true}),cell(p(label,{bold:true,size:23,alignment:AlignmentType.CENTER,after:0}),2000,{shade,compact:true})];
      });
      children.push(table(personRows,[8160,2000]));
    }
    if(a.showFollowup)children.push(sectionTitle("후속조치"),contentBox(a.followup,true));
    for(const material of includedPdfMaterials(a)){
      const images=await renderPdfMaterialPages(material);
      for(let i=0;i<images.length;i++){
        const bytes=Uint8Array.from(atob(images[i].split(",")[1]),c=>c.charCodeAt(0));
        // 사진 등 임의 비율 이미지가 늘어나지 않도록 640×900 안에 비율 유지로 맞춘다 (v70)
        const dims=await new Promise(resolve=>{const im=new Image();im.onload=()=>resolve({w:im.naturalWidth||640,h:im.naturalHeight||900});im.onerror=()=>resolve({w:640,h:900});im.src=images[i];});
        const fit=Math.min(640/dims.w,900/dims.h);
        const w=Math.max(1,Math.round(dims.w*fit)),h=Math.max(1,Math.round(dims.h*fit));
        children.push(pageBreak(),p(`${item.label} · ${material.fileName} · ${i+1} / ${images.length}쪽`,{bold:true,size:18,color:"666666",after:28}),new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new ImageRun({data:bytes,type:"jpg",transformation:{width:w,height:h}})]}));
      }
    }
  }
  const footer=new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[run("",{size:16,color:"77766F"}),new TextRun({children:[PageNumber.CURRENT],font:FONT,size:16,color:"77766F"}),run(" / ",{size:16,color:"77766F"}),new TextRun({children:[PageNumber.TOTAL_PAGES],font:FONT,size:16,color:"77766F"})]})]});
  const doc=new Document({
    creator:"산들마을 입주자대표회의",title:buildMeetingName(),
    numbering:{config:numberingConfigs},
    styles:{default:{document:{run:{font:FONT,size:BODY,color:INK},paragraph:{spacing:{after:45,line:320}}}}},
    sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:620,right:720,bottom:620,left:720,header:0,footer:300}}},footers:{default:footer},children}]
  });
  return await Packer.toBlob(doc);
}

async function saveWordFromModal(){
  if(!requireCompleteVotes()) return;
  try{
    modalStatus("Word/한글용 문서를 생성하는 중입니다…");
    const blob=await buildDocxBlob();
    const fileName=`${sanitizeFileName(buildMeetingName())}.docx`;
    const result=await writeBlobWithPicker(blob,fileName,"Word / 한글 편집 문서");
    if(result.ok){
      modalStatus(
        result.mode==="picker"
          ? "문서 저장이 완료되었습니다."
          : "문서 다운로드가 시작되었습니다. 다운로드 목록을 확인하세요."
      );
    }else if(result.cancelled){
      modalStatus("저장이 취소되었습니다.","warn");
    }else{
      modalStatus("현재 환경에서 문서 다운로드가 차단되었습니다. HTML 파일을 PC에 저장한 후 Chrome 또는 Whale에서 실행하세요.","error");
    }
  }catch(err){
    console.error(err);
    modalStatus("Word/한글용 문서 생성 중 오류가 발생했습니다.","error");
  }
}

function goPreview(){
  const previewBtn=document.querySelector('[data-view="previewView"]');
  if(previewBtn) previewBtn.click();
  renderPreview();
}

async function printFromModal(includeAttachments=true){
  if(!requireCompleteVotes()) return;
  const printWindow=window.open("","_blank","width=980,height=760");
  if(!printWindow){
    closeExportModal();
    goPreview();
    showToast("인쇄 전용 창이 차단되었습니다. 팝업을 허용한 후 다시 시도하세요.","warn");
    return;
  }
  try{
    const preparingText=includeAttachments?"회의록과 첨부 원문을 준비하는 중입니다…":"회의록을 준비하는 중입니다…";
    printWindow.document.write(`<!doctype html><meta charset="utf-8"><title>인쇄 준비</title><body style="font-family:Malgun Gothic;padding:30px">${preparingText}</body>`);
    const content=await buildPrintableContent(includeAttachments);
    printWindow.document.open();
    printWindow.document.write(printableDocumentHtml(content));
    printWindow.document.close();
    closeExportModal();
    setTimeout(()=>{
      printWindow.focus();
      printWindow.print();
    },500);
  }catch(err){
    console.error(err);
    printWindow.close();
    modalStatus(err?.message||"인쇄 전용 화면을 열 수 없습니다.","error");
  }
}

function printMinutes(){
  openExportModal("pdf");
}
document.getElementById("restoreInput").addEventListener("change",e=>{
  const input=e.target;
  const file=input.files && input.files[0];
  if(!file) return;

  const reader=new FileReader();
  reader.onload=async()=>{
    try{
      const parsed=JSON.parse(String(reader.result||""));
      const attachments=parsed._attachments||{};
      delete parsed._attachments;
      state=migrateState(parsed);
      for(const [key,item] of Object.entries(attachments)){
        if(!item?.dataUrl) continue;
        const blob=await (await fetch(item.dataUrl)).blob();
        await putAttachment(key,blob);
      }
      persistOnly();
      showToast("백업을 불러왔습니다. 화면을 다시 표시합니다.");
      setTimeout(()=>location.reload(),450);
    }catch(err){
      console.error(err);
      showToast("백업 파일 형식이 올바르지 않습니다.","error");
      input.value="";
    }
  };
  reader.onerror=()=>{
    showToast("백업 파일을 읽을 수 없습니다.","error");
    input.value="";
  };
  reader.readAsText(file,"utf-8");
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape") closeExportModal();
});

ensureRoster(state.meeting.termNo);ensureRoster(state.rosterTermNo||state.meeting.termNo);
initMeetingControls();renderMeetingControls();renderRepMaster();renderAttendance();renderAgendas();renderMetrics();renderPreview();
