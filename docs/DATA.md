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
- `data.json`: `{generatedAt, items:[{id,name,date,updatedAt,json}]}` — `scripts/build-data.mjs`가 클라우드 전체를 받아 생성. 앱은 localStorage 사본 + data.json으로 즉시 그리고, 목록(updatedAt)과 대조해 바뀐 것만 개별로 받는다.
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

## 6. 한계·주의
- Google 시트 셀 50,000자: 레코드 JSON이 이를 넘으면 저장이 "Failed to fetch"로 실패한다.
- 기록 범위의 "빈 달"은 회의일 기준(임시만 있는 달도 채워짐).
- 1차 하자판결금 안내문(2025.02.04) 첨부 명단은 370세대 전체가 아니라 일부라 쓰지 않음.

## 7. 원문 전문(`source`) — 2026-08-24부터 모든 적재에 포함
- 레코드 `json.source = {kind:"결과공고"|"회의록"|"공고", noticeNo, postedFrom, postedTo, signed, signer, file, origin, link, text, notes}`.
  `text`는 PDF(카페 캡처)를 읽어 **원문 그대로 옮겨 적은 전문**(표 구조는 "항목: 내용" 줄로 펴서, 줄바꿈 유지, 오탈자도 원문대로). `notes`는 적재자가 남기는 비고(추정·미확인 사항).
- 미리보기(①) 맨 아래 "📄 원문 전문" 접이식 상자로 보이고, 인쇄·Word에는 들어가지 않는다. 앱은 `source`를 건드리지 않고 그대로 저장한다(`migrateState`가 모르는 키를 보존).
- 원본 PDF는 사용자 드라이브(`산들마을 기록/`)에 두고 `file`(파일명)과 `link`(드라이브 링크, 있으면)로 가리킨다. 깃에는 올리지 않는다.
- **적재 절차(다른 PC에서도 동일)**: ① PDF를 로컬 서버로 서빙 + pdf.js로 페이지를 JPEG로 렌더(숨은 탭이면 `intent:"print"`) → ② 페이지 이미지를 읽어 안건·의결·명단·원문 전문을 옮김 → ③ `scripts/import/*.js`처럼 `mk(spec)`으로 레코드를 만들고, 관리자 키(`sandle_admin_key`)가 있는 브라우저에서 GAS `action:"save"`로 저장 → ④ `action:"get"`으로 검증 → ⑤ 요약 갱신("요약 갱신해줘") → ⑥ CHANGELOG/PLAN/DATA 갱신. 스크립트는 저장소 `scripts/import/`에 남긴다.
- 임차 명단 좌석 = 선거구 번호(당선인 공고 기준). 선거구를 모르는 사람은 1번 칸에 두고 `notes`에 적는다(예: 제4기 김아도 감사).

## 8. 공고·기록 보관함 / 절차 점검 (v65, 2026-08-24)
- 시스템 레코드 2개(목록·주제 집계·data.json 제외): `notices_v1` = {version, items:[{id(n_YYYYMMDD_slug), date(공고일), body(임차|입대의|선관위(임차)|관리사무소), kind(당선인공고|선거공고|사퇴공고|안내|결과공고|기타), title, noticeNo, postRange, summary, facts[], tags[], file, link(드라이브), related[{type:notice|minutes,id,label}], text(원문 전문), notes}]}, `checks_v1` = {version, items:[{id(c_slug), title, status(확인중|질의함|해소|문제없음), opened, facts[], rules[{ref,text,verified}], question, memo, related[], updatedAt}]}.
- ⑤ 공고·기록 화면(`noticeView`)의 `Notices` 모듈이 GAS에서 읽어 표시(localStorage `sandle_notices_cache_v1` 사본). 적재·갱신은 `scripts/import/notices_*.js` 방식.
- **절차 점검 원칙**: 사실(공고·회의록 기재)과 규정 조문만 싣고 특정인에 대한 판단·평가는 싣지 않는다. `rules[].verified`는 조문 원문을 확인한 뒤에만 true. `memo`는 관리자 키 있는 화면에서만 보이지만 **저장소 자체는 비공개가 아니므로**(GAS 토큰이 공개 HTML에 있음) 민감한 내용은 넣지 않는다 — 진짜 비공개가 필요하면 GAS에 읽기 제한을 추가해야 한다.
- 개인정보: 공고 원문의 성별·나이 등은 전문에서 생략하고 생략 사실을 남긴다. 이름·동호수는 공고에 이미 공개된 범위만.
- **관리규약 전문(`rules.json`, v66)**: 정적 파일. `{title, effective, source, transcribed, preamble, chapters[{no,title,articles[{no,title,text}]}], appendices([별표]), forms([별지 서식 — 명칭·용도만)}`. 2024.10.30 최종본 PDF(이미지)를 전사한 사본 — 효력은 원본에 있음 표기. ⑤ 관리규약 탭에서 검색(부분일치·하이라이트) 제공. 재전사 절차: PDF를 pdf.js로 페이지 렌더 → 보조 에이전트 분담 전사(scratchpad rules_part*.txt) → `mkrules.pl` 파서로 JSON 생성.
- **임대주택 관리규약(`trules.json`, v67)**: 같은 구조, 2020.4.18 개정본(공공주택특별법 제50조). 규약 탭 문서 전환(RULE_DOCS). 원문 특이점: 제42·43조 결번, 본문에 제72조 없음(목차엔 있음), 부칙은 2020.4.18 단일 블록.
- **⑤ 잠금(v66)**: 공고·안내/절차 점검 탭은 관리자 비밀번호 확인 후 표시. 검증은 GAS에 존재하지 않는 id의 delete 요청(키 맞음 → {ok:true,deleted:false}, 틀림 → admin_required) — 데이터 무변경. 이 잠금은 화면 가림이며 GAS 데이터 자체는 토큰만으로 읽힘(완전 비공개는 GAS 수정 필요).
