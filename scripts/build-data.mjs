// 정적 사본 재생성 스크립트 (GitHub Actions `refresh-data`, 로컬은 `node scripts/build-data.mjs`)
//
// 만드는 것
//   data-index.json  = { generatedAt, years:[{year, file, count, updatedAt}] } — 앱이 no-cache로 읽는 작은 목차
//   data-YYYY.json   = { generatedAt, items:[{id,name,date,updatedAt,json}] } — 앱이 ?v=<updatedAt> 캐시 키로 읽음
//   system-backup.json = 시스템 레코드(요약·명단이력·공고·점검, 조각 포함) 백업.
//     ⚠ 2026-09-02부터 **Archive 공개 화면이 이 파일을 읽는다**(주제 흐름 요약을 주제 화면에 보여준다).
//     Main 저장소 archive-v1/shared/topic-summary.js 가 `topic_summaries_v1_p*` 조각을 번호순으로
//     이어 붙여 파싱한다. **id 규칙이나 조각 방식을 바꾸면 그 화면이 조용히 빈다.** 함께 고칠 것.
//   data-health.json = 유실 감지용 숫자 요약
//   예전 단일 data.json은 v83부터 동결(옛 클라이언트 폴백용으로 파일만 남김).
//
// [2026-09-01] 연도별로 쪼갠다 (사용자 요청: "백업도 연도별로 쪼개줘, 실패하는 일을 줄이고 싶다")
//   예전에는 매번 239건을 전부 받아 10~15분이 걸렸다. 그 사이 누가 한 번만 push해도
//   마지막 git push가 거부돼 그날 백업이 통째로 실패했다(run #29).
//   이제 목록의 updatedAt만 보고 **바뀐 연도만** 받는다. 평소에는 받을 것이 없어 수십 초에 끝난다.
//   한 연도가 실패해도 그 연도의 기존 파일을 그대로 두고 나머지 연도는 저장한다.
//
//   FULL=1        모든 연도를 강제로 다시 받는다(데이터 보정 직후 등).
//   ALLOW_SHRINK=1 건수가 줄어드는 것을 허용한다(정말로 지웠을 때만).
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const URL = "https://script.google.com/macros/s/AKfycbyhpE-DB5WAAEx7uqTCPwU-e0sPKuupkYN3YoQWALiFWe0IHFNh1y91e1VNtDmMxxoxLA/exec";
const TOKEN = "ITDXaUBDTmrz6DbQ3tv9R";
const SYS_OUT = "system-backup.json";
const IDX_OUT = "data-index.json";
const HEALTH_OUT = "data-health.json";
const FULL = process.env.FULL === "1";

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
function readJson(file) {
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; }
}
// 연도 키. 목록의 date로 정한다(2026-09-01 복구 이후 모든 회의가 date를 갖는다).
function yearOf(dateLike) {
  const s = String(dateLike || "");
  if (/^\d{4}/.test(s)) return s.slice(0, 4);
  const d = new Date(s);
  return isNaN(d) ? "etc" : String(d.getFullYear());
}

const list = await api({ action: "list" });
if (!list || !list.ok) throw new Error("list failed: " + JSON.stringify(list).slice(0, 200));

// ── 1. 목록을 연도별로 나눈다 (아직 본문은 받지 않는다) ──────────────
const 목록별연도 = new Map();   // year -> [listItem]
const 시스템목록 = [];
for (const it of list.items || []) {
  if (!it || !it.id) continue;
  if (isSystemRecord(it.id)) { 시스템목록.push(it); continue; }
  const y = yearOf(it.date);
  if (!목록별연도.has(y)) 목록별연도.set(y, []);
  목록별연도.get(y).push(it);
}

const 이전목차 = readJson(IDX_OUT);
const 이전연도 = new Map((이전목차?.years || []).map((y) => [String(y.year), y]));

// ── 2. 바뀐 연도만 고른다 ────────────────────────────────────────
// 그 해 레코드 수와 최신 updatedAt이 목차와 같으면 내용도 같다고 본다.
// 저장은 항상 updatedAt을 새로 찍으므로, 무엇 하나라도 바뀌면 최신값이 달라진다.
const 받을연도 = [];
const 그대로둘연도 = [];
for (const [y, its] of 목록별연도) {
  const 최신 = its.reduce((m, it) => (String(it.updatedAt) > m ? String(it.updatedAt) : m), "");
  const 옛 = 이전연도.get(y);
  const 파일있음 = existsSync(`data-${y}.json`);
  if (!FULL && 옛 && 파일있음 && 옛.count === its.length && String(옛.updatedAt) === 최신) 그대로둘연도.push(y);
  else 받을연도.push(y);
}
console.log(
  `연도 ${목록별연도.size}개 — 받을 연도 ${받을연도.length}개[${받을연도.join(",")}], ` +
  `그대로 둘 연도 ${그대로둘연도.length}개` + (FULL ? " (FULL=1: 전부 다시 받음)" : "")
);

// ── 3. 바뀐 연도만 본문을 받는다. 한 연도가 실패해도 나머지는 계속한다 ──
const now = new Date().toISOString();
const 연도별항목 = new Map();     // year -> items (새로 받은 것 + 그대로 둔 것)
const 실패연도 = [];

for (const y of 그대로둘연도) {
  const 기존 = readJson(`data-${y}.json`);
  if (기존?.items) { 연도별항목.set(y, 기존.items); continue; }
  받을연도.push(y);               // 파일을 못 읽으면 다시 받는다
  console.warn(`data-${y}.json 을 읽지 못해 다시 받는다`);
}

for (const y of 받을연도) {
  const its = 목록별연도.get(y) || [];
  try {
    const 받은것 = [];
    for (const it of its) {       // 순차 호출 (Apps Script 동시 실행 제한 배려)
      const r = await api({ action: "get", id: it.id });
      // 한 건이라도 못 받으면 이 연도는 건드리지 않는다. 예전에는 경고만 찍고
      // 그 회의를 뺀 채 저장해, 잠깐의 지연으로 회의록이 조용히 사라질 수 있었다.
      if (!r || !r.ok || !r.item) throw new Error(`조회 실패: ${it.id}`);
      let date = "";
      try { const st = JSON.parse(r.item.json || "{}"); date = (st.meeting && st.meeting.date) || ""; } catch {}
      if (!date && it.date) { const d = new Date(it.date); if (!isNaN(d)) date = d.toISOString().slice(0, 10); }
      // 회의록 안의 날짜가 목록 날짜와 다른 해를 가리키면, 이 회의는 다른 연도 파일에
      // 들어가야 한다. 부분 갱신으로는 처리할 수 없으니 전체 재생성을 요구한다.
      if (date && yearOf(date) !== y) {
        throw new Error(`${it.id}: 목록 날짜(${y})와 회의 날짜(${yearOf(date)})가 다르다 — FULL=1 로 전체 재생성 필요`);
      }
      받은것.push({
        id: r.item.id,
        name: r.item.name || it.name || "",
        date,
        updatedAt: r.item.updatedAt || it.updatedAt || "",
        json: r.item.json || "",
      });
    }
    const 옛 = 이전연도.get(y);
    if (옛 && 받은것.length < 옛.count && process.env.ALLOW_SHRINK !== "1") {
      throw new Error(`건수가 줄었다: ${옛.count} → ${받은것.length}. 의도한 삭제라면 ALLOW_SHRINK=1`);
    }
    연도별항목.set(y, 받은것);
    console.log(`${y}년 ${받은것.length}건 받음`);
  } catch (e) {
    // 이 연도만 포기한다. 기존 파일은 그대로 두고 다음 연도로 넘어간다.
    실패연도.push({ year: y, 이유: e.message });
    const 기존 = readJson(`data-${y}.json`);
    if (기존?.items) 연도별항목.set(y, 기존.items);
    console.error(`${y}년 실패 — 기존 파일 유지: ${e.message}`);
  }
}

// ── 4. 시스템 레코드 (15건 남짓이라 통째로 다룬다) ──────────────────
const 이전시스템 = readJson(SYS_OUT)?.items || [];
const 시스템최신 = 시스템목록.reduce((m, it) => (String(it.updatedAt) > m ? String(it.updatedAt) : m), "");
const 이전시스템최신 = 이전시스템.reduce((m, it) => (String(it.updatedAt) > m ? String(it.updatedAt) : m), "");
let sysItems = 이전시스템;
if (FULL || 시스템목록.length !== 이전시스템.length || 시스템최신 !== 이전시스템최신) {
  const 받은것 = [];
  for (const it of 시스템목록) {
    const rs = await api({ action: "get", id: it.id });
    if (!rs || !rs.ok || !rs.item) throw new Error(`시스템 레코드 조회 실패: ${it.id} — 사본을 쓰지 않는다`);
    받은것.push({ id: rs.item.id, name: rs.item.name || "", updatedAt: rs.item.updatedAt || "", json: rs.item.json || "" });
  }
  받은것.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  for (const 옛 of 이전시스템) {
    const 새 = 받은것.find((x) => x.id === 옛.id);
    if (!새) throw new Error(`시스템 레코드가 사라졌다: ${옛.id} — 사본을 쓰지 않는다`);
    // 조각 하나가 통째로 비면 앞선 백업이 유일한 사본이 된다. 덮어쓰기 전에 멈춘다.
    if (String(새.json || "").length === 0 && String(옛.json || "").length > 0) {
      throw new Error(`시스템 레코드 내용이 비었다: ${옛.id} — 사본을 쓰지 않는다`);
    }
  }
  sysItems = 받은것;
  if (JSON.stringify(이전시스템) !== JSON.stringify(sysItems)) {
    writeFileSync(SYS_OUT, JSON.stringify({ generatedAt: now, items: sysItems }) + "\n");
    console.log(`system-backup.json 갱신: ${sysItems.length}건`);
  } else console.log(`system-backup.json 변경 없음 (${sysItems.length}건)`);
} else {
  console.log(`시스템 레코드 변경 없음 — 받지 않음 (${이전시스템.length}건)`);
}

// ── 5. 전체 건수 안전장치 ──────────────────────────────────────
const 전체항목 = [...연도별항목.values()].flat();
const 이전총계 = [...이전연도.values()].reduce((n, y) => n + (y.count || 0), 0);
if (이전총계 && 전체항목.length < 이전총계 && process.env.ALLOW_SHRINK !== "1") {
  throw new Error(
    `회의 건수가 줄었다: ${이전총계} → ${전체항목.length}. 사본을 쓰지 않는다. ` +
    `의도한 삭제라면 ALLOW_SHRINK=1 로 실행할 것.`
  );
}

// ── 6. 파일 쓰기 (내용이 같으면 건드리지 않아 불필요한 커밋을 막는다) ──
const yearsMeta = [];
let changedFiles = 0;
for (const y of [...연도별항목.keys()].sort()) {
  const yearItems = (연도별항목.get(y) || []).slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.updatedAt).localeCompare(String(b.updatedAt)));
  const file = `data-${y}.json`;
  const maxUpdated = yearItems.reduce((m, it) => (String(it.updatedAt) > m ? String(it.updatedAt) : m), "");
  yearsMeta.push({ year: y, file, count: yearItems.length, updatedAt: maxUpdated });
  const prevY = readJson(file)?.items;
  if (prevY && JSON.stringify(prevY) === JSON.stringify(yearItems)) continue;
  writeFileSync(file, JSON.stringify({ generatedAt: now, items: yearItems }) + "\n");
  changedFiles++;
  console.log(`${file} 갱신: ${yearItems.length}건`);
}
if (!(이전목차?.years && JSON.stringify(이전목차.years) === JSON.stringify(yearsMeta))) {
  writeFileSync(IDX_OUT, JSON.stringify({ generatedAt: now, years: yearsMeta }) + "\n");
  changedFiles++;
  console.log(`${IDX_OUT} 갱신: ${yearsMeta.length}개 연도, 총 ${전체항목.length}건`);
}
if (!changedFiles) console.log(`변경 없음 (${전체항목.length}건, ${yearsMeta.length}개 연도)`);

/* ── 7. 건강 요약 ────────────────────────────────────────────
 * 2026-09-01 사고(회의 64건의 date 열이 지워졌는데 화면에는 8건만 티가 났다)의 교훈.
 * 숫자로 남겨두면 다음에 같은 일이 생겼을 때 깃 diff에서 바로 보인다.
 * generatedAt은 넣지 않는다 — 매일 값이 달라져 의미 없는 커밋이 쌓인다.
 */
const 건강 = { 총: 전체항목.length, 날짜없음: 0, 안건없음: 0, 원문없음: 0, 회의정보없음: 0, 명단없음: 0 };
for (const it of 전체항목) {
  if (!it.date) 건강.날짜없음++;
  let st = null;
  try { st = JSON.parse(it.json || "{}"); } catch { 건강.회의정보없음++; continue; }
  if (!st.meeting) 건강.회의정보없음++;
  if (!Array.isArray(st.agendas) || !st.agendas.length) 건강.안건없음++;
  if (!String(st.source || "").trim()) 건강.원문없음++;
  if (!st.rosters || !Object.keys(st.rosters).length) 건강.명단없음++;
}
const 이전건강 = readJson(HEALTH_OUT);
if (!(이전건강 && JSON.stringify(이전건강) === JSON.stringify(건강))) {
  writeFileSync(HEALTH_OUT, JSON.stringify(건강, null, 2) + "\n");
  console.log("data-health.json 갱신:", JSON.stringify(건강));
} else console.log("건강 요약 변경 없음:", JSON.stringify(건강));

// ── 8. 실패한 연도가 있으면 알린다 (좋은 연도는 이미 저장됐다) ────────
if (실패연도.length) {
  console.error("\n실패한 연도:");
  실패연도.forEach((f) => console.error(`  ${f.year}: ${f.이유}`));
  throw new Error(`${실패연도.length}개 연도 실패 — 나머지 연도는 저장됐다. 다음 실행에서 다시 시도한다.`);
}
