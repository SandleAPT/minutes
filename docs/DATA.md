# 데이터 규칙 (DATA)

## 1. 회의록 레코드
- 클라우드 레코드 = `{id, name, date, updatedAt, json}`; `json`은 앱 상태 전체:
  `meeting{body("입대의"|"임차"), termNo, year, month, type(정기|임시), date, time, place, name, attendance{동/번호:true}, guests[], audience, sequence[]}`,
  `rosterTermNo, rosterBody, rosters{"5":[...], "t6":[...]}`, `agendas[]`, `cloudId`.
- **id 규칙**: 입대의 `m_YYYY_MM[a|s]_v1` (같은 달 2건이면 `a`=앞 회의, `s`=임시), 임차 `t_YYYY_MM[s|s2]_v1`. 앱에서 새로 만든 회의록은 `m_<랜덤>`.
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
