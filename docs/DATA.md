# 데이터 규칙 (DATA)

## 1. 회의록 레코드
- 클라우드 레코드 = `{id, name, date, updatedAt, json}`; `json`은 앱 상태 전체:
  `meeting{body("입대의"|"임차"), termNo, year, month, type(정기|임시), date, time, place, name, attendance{동/번호:true}, guests[], audience, sequence[]}`,
  `rosterTermNo, rosterBody, rosters{"5":[...], "t6":[...]}`, `agendas[]`, `cloudId`.
- **id 규칙**: 입대의 `m_YYYY_MM[a|s]_v1` (같은 달 2건이면 `a`=앞 회의, `s`=임시), 임차 `t_YYYY_MM[s|s2]_v1`. 앱에서 새로 만든 회의록은 `m_<랜덤>`. 예외: 2025.12 정기회의는 `t_2025_12b_v1` — 기본 id를 12.1 통합회의(임시)가 먼저 사용 중이라 뒤 회의에 `b`를 붙임(참조 깨짐 방지 위해 재키하지 않음).
- **이름 규칙**: `제N기 YYYY년MM월 [임시 ]입주자대표회의` / `…임차인대표회의` — ② 회의체 필터가 이름의 "임차인대표회의"로 판별하므로 임차 이름엔 반드시 포함.
- 안건: `{id, title, summary, decision, votes{동:'for'|'against'}, remarks{}, noRemarks, isOther, tags[], followup, showFollowup, materials[]}`
  - `tags`가 비어 있으면 안건명 기준 자동 분류(`window.autoTags`), 채우면 그 값이 우선(주제별 보기·요약 모두).
  - 회의 전 상정 단계: 안건명만 있어도 미리보기·출력에 실리고 "의결 전(결과 미기입)"으로 표시(v58).
- 명단 키: 입대의 `"N"`(동 201~216 키), 임차 `"tN"`(번호 1~16 키 + `unit`에 동). 임차 6기는 번호 = 선거구 번호(2·3·4·5·6·9).

## 2. 시스템 레코드 (목록·주제 집계에서 제외, id 접두어 `topic_summaries|roster_history`)
- `topic_summaries_v1`: `{version, topics:{tag|__all__|__tenant__:{text, basedOn[key#hash], count, updatedAt, by}}}`.
  45,000자를 넘으면 `topic_summaries_v1_p1..pN` 조각 + 본 레코드 `{chunked:true, parts:N}`.
- `roster_history_v1`: `{terms:{"4"|"5"|"t6":[{id,date,dong,name,role,fromRole,event(취임|사퇴|선출…),note,countTerm}]}}`.
- 임기 회차 = 전체 회의록의 `rosters` 키 색인(`Topic.termsOf`) + 이력(취임/선출 추가, `countTerm:false` 제외).

## 3. 정적 파일
- 정적 사본(v83, 연도 샤딩): `data-index.json` = `{generatedAt, years:[{year,file,count,updatedAt}]}`(no-cache로 읽는 목차) + `data-YYYY.json` = `{generatedAt, items:[{id,name,date,updatedAt,json}]}`(`?v=<그 해 최신 updatedAt>` 캐시 키로 읽음 — 안 바뀐 연도는 브라우저 캐시 재사용, 날짜 없는 레코드는 `data-etc.json`). `scripts/build-data.mjs`가 생성, 앱은 localStorage 사본 + 정적 사본으로 즉시 그리고 목록(updatedAt)과 대조해 바뀐 것만 개별로 받는다. 구형 단일 `data.json`은 v83부터 동결(폴백용으로 파일만 유지). 시스템 레코드는 `system-backup.json`으로 매일 백업(v82).
  수동 재발행: `scripts/build-data.mjs` 첫 줄 주석을 바꿔 푸시(워크플로 트리거) 또는 Actions에서 `refresh-data` 실행.
- `haja.json`: 하자판결금 — `participants{동:[호]}`(370), `pendingByRound{"4","5","6"}`(미수령 명단), `receivedAsOf6`, `rounds`, `documents`, `periods`.
  새 차수: 미수령 명단을 `pendingByRound["N"]`에 추가하고 `asOf`·`totals`·`rounds`·`periods` 갱신, 앱 `Haja` 로직의 구간 규칙 확장.

## 4. 적재 규칙 (원문 → 레코드)
- 결과공고만 있는 회의: 안건명 + 의결사항(원문 그대로), `summary`에는 비고 한 줄(`※ 원문(결과공고)에 표결 기록 없음 — 참석자 전원 찬성으로 기재`), 참석자 전원 `for`.
- 상세 회의록(서명란) 있는 회의: 발언 내용 → `summary`, 의결 → `decision`, 서명 = 찬성, 반대 표시 있으면 `against`; 비고 `※ 회의록 서명란 기준 표결`.
- 판독 불명 숫자는 `?`로 남기고, 추정은 "(추정)"을 붙인다. 카페 댓글 등 비공식 정보는 레코드에 넣지 않고 문서/메모에만 남긴다.
- 명단은 그 회의 시점의 구성(구성현황 공고 기준)으로 넣고, 변동은 `roster_history_v1`에 날짜·사유와 함께.

## 5. 요약(주제 흐름 요약) 작성 규칙
- 키마다 `## 요점`(3~5줄) → `## 시간 흐름`(회의 1건 = `- YY.MM 정기|임시: …` 1줄, 임차는 `YY.MM 임차:`) → `- 현재 상태: …`.
- `__all__`은 연도/기수별 `## 소제목` 구간으로, `__tenant__`는 임차만.
- 집계 문장으로 여러 회의를 한 줄에 묶지 않는다(연도 묶음 건수가 어긋남).
- 갱신은 `TopicSummaries.stale()` → `dump(tag, true)`(새/변경만) → 기존 글에 끼워 넣기 → `save()` → `stale()` 0 확인.
- **주의**: `save()`는 저장하는 키의 `basedOn`을 "현재 안건 전체"로 재기록한다 — 일부 안건만 반영하고 저장하면 나머지 미반영분도 반영된 것처럼 표시되므로, 키를 저장할 때는 그 키의 stale(added/changed) 안건을 전부 본문에 반영한 뒤 저장할 것.

## 6. 한계·주의
- Google 시트 셀 50,000자: 레코드 JSON이 이를 넘으면 저장이 "Failed to fetch"로 실패한다.
- 기록 범위의 "빈 달"은 회의일 기준(임시만 있는 달도 채워짐).
- 1차 하자판결금 안내문(2025.02.04) 첨부 명단은 370세대 전체가 아니라 일부라 쓰지 않음.

## 7. 원문 전문(`source`) — 2026-08-24부터 모든 적재에 포함
- 레코드 `json.source = {kind:"결과공고"|"회의록"|"공고", noticeNo, postedFrom, postedTo, signed, signer, file, origin, link, text, notes}`.
  `text`는 PDF(카페 캡처)를 읽어 **원문 그대로 옮겨 적은 전문**(표 구조는 "항목: 내용" 줄로 펴서, 줄바꿈 유지, 오탈자도 원문대로). `notes`는 적재자가 남기는 비고(추정·미확인 사항).
- 미리보기(①) 맨 아래 "📄 원문 전문" 접이식 상자로 보이고, 인쇄·Word에는 들어가지 않는다. 앱은 `source`를 건드리지 않고 그대로 저장한다(`migrateState`가 모르는 키를 보존).
- 원본 PDF는 사용자 드라이브(`산들마을 기록/`)에 두고 `file`(파일명)과 `link`(드라이브 링크, 있으면)로 가리킨다. 깃에는 올리지 않는다.
- **적재 절차(v81부터, 다른 PC에서도 동일)**: ① PDF를 로컬 서버로 서빙 + pdf.js로 페이지를 JPEG로 렌더(숨은 탭이면 `intent:"print"`; 스캔 PDF는 내장 JPEG를 바로 추출해도 됨) → ② 페이지 이미지를 읽어 안건·의결·명단·원문 전문을 옮김 → ③ **`scripts/import/importer.js`를 앱 페이지에 script 태그로 로드하고, 데이터 스크립트는 JOB 객체(meetings/notices/checks)만 정의해 `await SandleImporter.run(JOB)`** — 저장·재조회 대조·목록 대조 검증까지 한 단계로 실행되고 실패 시 throw → ④ "검증 실패" 없이 끝났을 때만 완료로 기록 → ⑤ 요약 갱신("요약 갱신해줘") → ⑥ CHANGELOG/PLAN/DATA 갱신. 스크립트는 저장소 `scripts/import/`에 남긴다.
  (교훈 2026-08-31: 구식 콘솔 붙여넣기 방식의 tenant_2022.js가 혼입 줄 SyntaxError로 통째로 미실행이었는데 기록만 남았음 — run()의 자동 검증 없이 적재 완료로 적지 말 것.)
- 임차 명단 좌석 = 선거구 번호(당선인 공고 기준). 선거구를 모르는 사람은 1번 칸에 두고 `notes`에 적는다(예: 제4기 김아도 감사).

## 8-0. 카페 게시판 대조 진행 현황 (이어서 할 때 여기부터)
- **임차 게시판**(관리사무소, 회의록·공고): 30개씩 보기 기준 **1~6페이지 대조·적재 완전 완료(미수집 0, 4기 선거 공고 세트 완성)**. **7페이지 대조·적재 완전 완료(2026-08-31, v88)** — 범위 index 23777~**20013**(2019.03.20~2020.12.21). 회의 12건(t_2019_03~t_2020_11, 2기 9건+3기 3건)·선관위 공고 2건(21456 모집·21486 회의결과) 적재, 미수집 0. 게시판 공백(게시 자체가 없는 것): 2기 18차 임시 결과(개최 22062만 — 코로나 시기), 3기 2020.9~10월, 2019.7월 결과, **3기 동대표 선거·선관위 구성 공고 일체**(c_t3_election), 3기 보궐(구자선·신명순 합류) 공고. 핵심 발견: 진세택 2기(2019)부터 회장, 2019년 임차 654세대(화재보험 공고). **8페이지 대조·적재 완전 완료(2026-08-31, v89)** — 범위 index 19952~**16288**(2017.11.16~2019.03.12). 회의 13건(1기 t_2017_11·t_2017_12·t_2018_02 + 2기 t_2018_03(유회)~t_2019_01) + 2기 후보 공고 1건(보관함 48건, 클라우드 143건), 미수집 0. 기존 2기 레코드 9건 좌석 재키(→선거구 1·3·4·5·6·7·9, `_rekeyed_t2` 플래그). 게시판 공백: 2019.2월 결과공고, 2기 선거의 선출·당선인·선관위 구성 공고(후보 공고 17208만 존재 — c_t3_election을 2·3기로 확장), 2기 한경열·윤정희 합류 공고. 핵심: 진세택 1기 부회장→2~6기 회장(1~6기 연속), 2017.11 규약 개정으로 선거구 10→9. 남은 페이지: **9**(16288 이전, 1기 초기 구간). ⚠ 주제 요약에 2017~2019.01 신규 안건(약 63건) 미반영 — 다음 "요약 갱신해줘" 때. 주제 요약도 반영 완료(2026-08-31: 18키 갱신, 조각 4개 — 전체 2019.03~2026.08, 안건 546건, stale 0; 태그 표준 재적용 4건: 재활용·광고→잡수입·예산, 열교환기→전기·설비). 게시 안 된 것으로 보이는 것: 커뮤니티센터 2차 투표 실시 공고, 6기 선관위원 보궐 선출 결과 공고, 2021년 2·6·9·10월 임차 결과공고. 미확인: 30798(6기 1차 선출공고) 첨부 4건 중 3건.
- **입대의 게시판**: 대조 미시작(입대의 회의록은 2024.01부터만 적재돼 있음 — 2023년 이전과 2020~2022년 결과공고 대조 필요).
- 갱신일 2026-08-31. 페이지를 더 볼 때마다 이 절의 index·페이지를 갱신할 것.

## 8. 공고·기록 보관함 / 절차 점검 (v65, 2026-08-24)
- 시스템 레코드 2개(목록·주제 집계·data.json 제외): `notices_v1` = {version, items:[{id(n_YYYYMMDD_slug), date(공고일), body(임차|입대의|선관위(임차)|관리사무소), kind(당선인공고|선거공고|사퇴공고|안내|결과공고|기타), title, noticeNo, postRange, summary, facts[], tags[], file, link(드라이브), related[{type:notice|minutes,id,label}], text(원문 전문), notes}]}, `checks_v1` = {version, items:[{id(c_slug), title, status(확인중|질의함|해소|문제없음), opened, facts[], rules[{ref,text,verified}], question, memo, related[], updatedAt}]}.
- **한도 대응(v81)**: `notices_v1`·`checks_v1`은 JSON이 45,000자를 넘으면 주제 요약과 같은 조각 방식 — 본 레코드 `{version, chunked:true, parts:N, totalLen, updatedAt}` + `notices_v1_p1..pN`(원문 슬라이스) — 으로 저장한다. 저장은 `importer.js`의 `saveFull()`이 자동 분할·잉여 조각 삭제까지 처리하고, 앱(`notices.js getRec`)은 조각을 이어 붙여 읽는다. items를 직접 수정할 때도 반드시 `SandleImporter.getFull()/saveFull()`을 쓸 것(단일 레코드 가정 금지).
- ⑤ 공고·기록 화면(`noticeView`)의 `Notices` 모듈이 GAS에서 읽어 표시(localStorage `sandle_notices_cache_v1` 사본). 적재·갱신은 `scripts/import/notices_*.js` 방식.
- **공고 분류 기준(2026-08-31 전수 정리 — 새 공고 적재 시 반드시 이 값만 사용)**: `body`(명의) = `관리사무소` | `선관위(임차)` | `임차`(임차인대표회의) — "선관위" 단독 표기 금지. `kind` = `선관위 모집`(위원 모집·추가 위촉) | `위원공고`(위원 명단·구성) | `선관위 회의`(선관위 회의 결과 공고) | `선거공고`(선출 공고·후보자 등록·투표 안내·찬반투표 안내) | `당선인공고` | `사퇴공고` | `투표결과`(집계표) | `안내`(소집·총회·부과 등 그 외). 필터 버튼은 값에서 자동 생성되므로 표기가 하나라도 어긋나면 유령 버튼이 생긴다.
- **절차 점검 원칙**: 사실(공고·회의록 기재)과 규정 조문만 싣고 특정인에 대한 판단·평가는 싣지 않는다. `rules[].verified`는 조문 원문을 확인한 뒤에만 true. `memo`는 관리자 키 있는 화면에서만 보이지만 **저장소 자체는 비공개가 아니므로**(GAS 토큰이 공개 HTML에 있음) 민감한 내용은 넣지 않는다 — 진짜 비공개가 필요하면 GAS에 읽기 제한을 추가해야 한다.
- 개인정보: 공고 원문의 성별·나이 등은 전문에서 생략하고 생략 사실을 남긴다. 이름·동호수는 공고에 이미 공개된 범위만.
- **관리규약 전문(`rules.json`, v66)**: 정적 파일. `{title, effective, source, transcribed, preamble, chapters[{no,title,articles[{no,title,text}]}], appendices([별표]), forms([별지 서식 — 명칭·용도만)}`. 2024.10.30 최종본 PDF(이미지)를 전사한 사본 — 효력은 원본에 있음 표기. ⑤ 관리규약 탭에서 검색(부분일치·하이라이트) 제공. 재전사 절차: PDF를 pdf.js로 페이지 렌더 → 보조 에이전트 분담 전사(scratchpad rules_part*.txt) → `mkrules.pl` 파서로 JSON 생성.
- **임대주택 관리규약(`trules.json`, v67)**: 같은 구조, 2020.4.18 개정본(공공주택특별법 제50조). 규약 탭 문서 전환(RULE_DOCS). 원문 특이점: 제42·43조 결번, 본문에 제72조 없음(목차엔 있음), 부칙은 2020.4.18 단일 블록.
- **⑤ 잠금(v66)**: 공고·안내/절차 점검 탭은 관리자 비밀번호 확인 후 표시. 검증은 GAS에 존재하지 않는 id의 delete 요청(키 맞음 → {ok:true,deleted:false}, 틀림 → admin_required) — 데이터 무변경. 이 잠금은 화면 가림이며 GAS 데이터 자체는 토큰만으로 읽힘(완전 비공개는 GAS 수정 필요).
