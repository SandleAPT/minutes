// 정적 사본 재생성 스크립트 (2026-08-31 3차: 임차 3기 2020.12~2021 10건 적재 반영 — data-2020/2021.json 신규) (v83: 연도 샤딩 — data-index.json + data-YYYY.json) (GitHub Actions `refresh-data`에서 실행, 로컬에서는 `node scripts/build-data.mjs`)
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
// [2026-09-01] 예전에는 get이 실패하면 경고만 찍고 그 레코드를 빼고 저장했다.
// 그러면 Apps Script가 잠깐 느려진 것만으로 회의록이 백업에서 조용히 사라진다.
// 백업은 '일부라도 남기는 것'보다 '틀린 걸 남기지 않는 것'이 중요하므로, 한 건이라도
// 못 받으면 아무것도 쓰지 않고 실패한다. 다음 크론이나 수동 실행에서 다시 만들면 된다.
for (const it of list.items || []) {                 // 순차 호출 (Apps Script 동시 실행 제한 배려)
  if (!it || !it.id) continue;
  if (isSystemRecord(it.id)) {                        // 시스템 레코드는 앱이 클라우드에서 직접 읽지만, 백업으로는 남긴다
    const rs = await api({ action: "get", id: it.id });
    if (!rs || !rs.ok || !rs.item) throw new Error(`시스템 레코드 조회 실패: ${it.id} — 불완전한 백업을 쓰지 않고 중단한다`);
    sysItems.push({ id: rs.item.id, name: rs.item.name || "", updatedAt: rs.item.updatedAt || "", json: rs.item.json || "" });
    continue;
  }
  const r = await api({ action: "get", id: it.id });
  if (!r || !r.ok || !r.item) throw new Error(`회의록 조회 실패: ${it.id} — 불완전한 백업을 쓰지 않고 중단한다`);
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

/* ── 줄어듦 방지 ──────────────────────────────────────────────
 * 백업이 백업 구실을 하려면, 나쁜 실행이 좋은 사본을 덮어쓰지 못해야 한다.
 * 회의는 지우는 일이 거의 없으므로 건수가 줄었다면 사고를 의심하는 것이 맞다.
 * 정말로 지운 뒤 다시 만들 때는 ALLOW_SHRINK=1 로 실행한다.
 */
const 이전목차 = existsSync("data-index.json")
  ? (() => { try { return JSON.parse(readFileSync("data-index.json", "utf8")); } catch { return null; } })()
  : null;
const 이전총계 = 이전목차 ? (이전목차.years || []).reduce((n, y) => n + (y.count || 0), 0) : 0;
if (이전총계 && items.length < 이전총계 && process.env.ALLOW_SHRINK !== "1") {
  throw new Error(
    `회의 건수가 줄었다: ${이전총계} → ${items.length} (${이전총계 - items.length}건 감소). ` +
    `사고일 수 있어 사본을 쓰지 않는다. 의도한 삭제라면 ALLOW_SHRINK=1 로 실행할 것.`
  );
}
const 이전시스템 = existsSync(SYS_OUT)
  ? (() => { try { return JSON.parse(readFileSync(SYS_OUT, "utf8")).items || []; } catch { return []; } })()
  : [];
for (const 옛 of 이전시스템) {
  const 새 = sysItems.find((x) => x.id === 옛.id);
  if (!새) throw new Error(`시스템 레코드가 사라졌다: ${옛.id} — 사본을 쓰지 않는다`);
  // 조각 하나가 통째로 비면 앞선 백업이 유일한 사본이 된다. 덮어쓰기 전에 멈춘다.
  if (String(새.json || "").length === 0 && String(옛.json || "").length > 0) {
    throw new Error(`시스템 레코드 내용이 비었다: ${옛.id} — 사본을 쓰지 않는다`);
  }
}

const prevSys = 이전시스템.length ? 이전시스템 : null;
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

/* ── 건강 요약 ───────────────────────────────────────────────
 * 2026-09-01 사고(회의 64건의 date 열이 지워졌는데 화면에는 8건만 티가 났다)의 교훈.
 * 숫자로 남겨두면 다음에 같은 일이 생겼을 때 깃 diff에서 바로 보인다.
 * generatedAt은 넣지 않는다 — 매일 값이 달라져 의미 없는 커밋이 쌓인다.
 */
const 건강 = { 총: items.length, 날짜없음: 0, 안건없음: 0, 원문없음: 0, 회의정보없음: 0, 명단없음: 0 };
for (const it of items) {
  if (!it.date) 건강.날짜없음++;
  let st = null;
  try { st = JSON.parse(it.json || "{}"); } catch { 건강.회의정보없음++; continue; }
  if (!st.meeting) 건강.회의정보없음++;
  if (!Array.isArray(st.agendas) || !st.agendas.length) 건강.안건없음++;
  if (!String(st.source || "").trim()) 건강.원문없음++;
  if (!st.rosters || !Object.keys(st.rosters).length) 건강.명단없음++;
}
const HEALTH_OUT = "data-health.json";
let 이전건강 = null;
if (existsSync(HEALTH_OUT)) { try { 이전건강 = JSON.parse(readFileSync(HEALTH_OUT, "utf8")); } catch {} }
if (!(이전건강 && JSON.stringify(이전건강) === JSON.stringify(건강))) {
  writeFileSync(HEALTH_OUT, JSON.stringify(건강, null, 2) + "\n");
  console.log("data-health.json 갱신:", JSON.stringify(건강));
} else {
  console.log("건강 요약 변경 없음:", JSON.stringify(건강));
}
// 예전 단일 data.json(OUT)은 v83부터 동결 — 파일은 옛 클라이언트 폴백용으로 남긴다.
