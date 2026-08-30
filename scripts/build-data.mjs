// 정적 사본 재생성 스크립트 (v83: 연도 샤딩 — data-index.json + data-YYYY.json) (GitHub Actions `refresh-data`에서 실행, 로컬에서는 `node scripts/build-data.mjs`)
// 클라우드(Apps Script)의 회의록 전체를 받아 연도별 정적 사본으로 저장한다:
//   data-index.json = { generatedAt, years:[{year, file, count, updatedAt(그 해 최신 updatedAt)}] } — 앱이 no-cache로 읽는 작은 목차
//   data-YYYY.json  = { generatedAt, items:[{id,name,date,updatedAt,json}] } — 앱이 ?v=<updatedAt> 캐시 키로 읽음(안 바뀐 연도는 브라우저 캐시 재사용)
// 예전 단일 data.json은 v83부터 갱신하지 않고 동결(옛 캐시 클라이언트 폴백용으로 파일만 남김).
// 시스템 레코드(요약·명단이력·공고·점검, 조각 포함)는 system-backup.json에 따로 저장 — 앱은 읽지 않는 순수 백업(매일 크론으로 깃에 판본이 남는다).
// 각 파일은 항목 내용이 이전과 같으면 건드리지 않는다(불필요한 커밋 방지).
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const URL = "https://script.google.com/macros/s/AKfycbyhpE-DB5WAAEx7uqTCPwU-e0sPKuupkYN3YoQWALiFWe0IHFNh1y91e1VNtDmMxxoxLA/exec";
const TOKEN = "ITDXaUBDTmrz6DbQ3tv9R";
const OUT = "data.json";

async function api(params, tries = 3) {
  const q = new URLSearchParams({ ...params, token: TOKEN });
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(`${URL}?${q}`, { redirect: "follow" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === tries) throw e;
      await new Promise((res) => setTimeout(res, 1500 * i));
    }
  }
}

function isSystemRecord(id) { return /^(topic_summaries|roster_history|notices_v1|checks_v1)/.test(String(id || "")); }

const list = await api({ action: "list" });
if (!list || !list.ok) throw new Error("list failed: " + JSON.stringify(list).slice(0, 200));

const items = [];
const sysItems = [];
for (const it of list.items || []) {                 // 순차 호출 (Apps Script 동시 실행 제한 배려)
  if (!it || !it.id) continue;
  if (isSystemRecord(it.id)) {                        // 시스템 레코드는 앱이 클라우드에서 직접 읽지만, 백업으로는 남긴다
    const rs = await api({ action: "get", id: it.id });
    if (rs && rs.ok && rs.item) sysItems.push({ id: rs.item.id, name: rs.item.name || "", updatedAt: rs.item.updatedAt || "", json: rs.item.json || "" });
    else console.warn("skip (sys get failed):", it.id);
    continue;
  }
  const r = await api({ action: "get", id: it.id });
  if (!r || !r.ok || !r.item) { console.warn("skip (get failed):", it.id); continue; }
  let date = "";
  try { const st = JSON.parse(r.item.json || "{}"); date = (st.meeting && st.meeting.date) || ""; } catch {}
  if (!date && it.date) { const d = new Date(it.date); if (!isNaN(d)) date = d.toISOString().slice(0, 10); }
  items.push({
    id: r.item.id,
    name: r.item.name || it.name || "",
    date,
    updatedAt: r.item.updatedAt || it.updatedAt || "",
    json: r.item.json || "",
  });
}
items.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.updatedAt).localeCompare(String(b.updatedAt)));

sysItems.sort((a, b) => String(a.id).localeCompare(String(b.id)));

const SYS_OUT = "system-backup.json";
let prevSys = null;
if (existsSync(SYS_OUT)) { try { prevSys = JSON.parse(readFileSync(SYS_OUT, "utf8")).items; } catch {} }
if (!(prevSys && JSON.stringify(prevSys) === JSON.stringify(sysItems))) {
  writeFileSync(SYS_OUT, JSON.stringify({ generatedAt: new Date().toISOString(), items: sysItems }) + "\n");
  console.log(`system-backup.json 갱신: ${sysItems.length}건`);
} else {
  console.log(`system-backup.json 변경 없음 (${sysItems.length}건)`);
}

// ---- 연도 샤딩 (v83) ----
const byYear = new Map();
for (const it of items) {
  const y = /^\d{4}/.test(it.date || "") ? it.date.slice(0, 4) : "etc"; // 날짜 없는 레코드는 data-etc.json
  if (!byYear.has(y)) byYear.set(y, []);
  byYear.get(y).push(it);
}
const now = new Date().toISOString();
const yearsMeta = [];
let changedFiles = 0;
for (const [y, yearItems] of [...byYear.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const file = `data-${y}.json`;
  const maxUpdated = yearItems.reduce((m, it) => (String(it.updatedAt) > m ? String(it.updatedAt) : m), "");
  yearsMeta.push({ year: y, file, count: yearItems.length, updatedAt: maxUpdated });
  let prevY = null;
  if (existsSync(file)) { try { prevY = JSON.parse(readFileSync(file, "utf8")).items; } catch {} }
  if (prevY && JSON.stringify(prevY) === JSON.stringify(yearItems)) continue;
  writeFileSync(file, JSON.stringify({ generatedAt: now, items: yearItems }) + "\n");
  changedFiles++;
  console.log(`${file} 갱신: ${yearItems.length}건`);
}
const index = { generatedAt: now, years: yearsMeta };
let prevIdx = null;
if (existsSync("data-index.json")) { try { prevIdx = JSON.parse(readFileSync("data-index.json", "utf8")).years; } catch {} }
if (!(prevIdx && JSON.stringify(prevIdx) === JSON.stringify(yearsMeta))) {
  writeFileSync("data-index.json", JSON.stringify(index) + "\n");
  changedFiles++;
  console.log(`data-index.json 갱신: ${yearsMeta.length}개 연도, 총 ${items.length}건`);
}
if (!changedFiles) console.log(`연도 사본 변경 없음 (${items.length}건, ${yearsMeta.length}개 연도)`);
// 예전 단일 data.json(OUT)은 v83부터 동결 — 파일은 옛 클라이언트 폴백용으로 남긴다.
