// data.json 재생성 스크립트 (v82: 시스템 레코드도 system-backup.json으로 백업 — 클라우드 시트가 유일 사본이던 공백 해소) (GitHub Actions `refresh-data`에서 실행, 로컬에서는 `node scripts/build-data.mjs`)
// 클라우드(Apps Script)의 회의록 전체를 받아 정적 사본 data.json으로 저장한다.
// 형식: { generatedAt, items: [{ id, name, date(YYYY-MM-DD), updatedAt, json }] } — 앱의 StaticData가 그대로 읽는다.
// 시스템 레코드(요약·명단이력·공고·점검, 조각 포함)는 system-backup.json에 따로 저장 — 앱은 읽지 않는 순수 백업(매일 크론으로 깃에 판본이 남는다).
// 항목 내용이 이전과 같으면 파일을 건드리지 않는다(불필요한 커밋 방지).
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

let prev = null;
if (existsSync(OUT)) { try { prev = JSON.parse(readFileSync(OUT, "utf8")).items; } catch {} }
if (prev && JSON.stringify(prev) === JSON.stringify(items)) {
  console.log(`data.json 변경 없음 (${items.length}건)`);
  process.exit(0);
}
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), items }) + "\n");
console.log(`data.json 갱신: ${items.length}건`);
