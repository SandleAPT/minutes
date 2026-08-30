// data.json 재생성 스크립트 (2026-08-31: 2025.12.30 정기회의 t_2025_12b_v1 적재 후 재발행) (GitHub Actions `refresh-data`에서 실행, 로컬에서는 `node scripts/build-data.mjs`) (re: 2026-08-26 임차 2023·2024 적재 반영)
// 클라우드(Apps Script)의 회의록 전체를 받아 정적 사본 data.json으로 저장한다.
// 형식: { generatedAt, items: [{ id, name, date(YYYY-MM-DD), updatedAt, json }] } — 앱의 StaticData가 그대로 읽는다.
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
for (const it of list.items || []) {                 // 순차 호출 (Apps Script 동시 실행 제한 배려)
  if (!it || !it.id || isSystemRecord(it.id)) continue; // 시스템 레코드(주제 흐름 요약)는 앱이 클라우드에서 직접 읽음
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

let prev = null;
if (existsSync(OUT)) { try { prev = JSON.parse(readFileSync(OUT, "utf8")).items; } catch {} }
if (prev && JSON.stringify(prev) === JSON.stringify(items)) {
  console.log(`data.json 변경 없음 (${items.length}건)`);
  process.exit(0);
}
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), items }) + "\n");
console.log(`data.json 갱신: ${items.length}건`);
