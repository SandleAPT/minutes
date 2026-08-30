# 성장 대비 설계 점검 (SCALING)

2026-08-31 전면 점검. 목표: **데이터가 지금의 30배 이상이 되어도 저장·표시가 터지지 않게**.
실측치는 이 날 기준(클라우드 104 레코드, 회의록 97건). 다음 점검 때 이 표의 수치를 갱신할 것.

## 1. 한도와 현재 위치

| 항목 | 한도 | 현재 실측 | 30배 시 | 상태 |
|---|---|---|---|---|
| 회의록 레코드 1건(json) | 시트 셀 50,000자 | 최대 11,875자(m_mt0ishg2go323) | 건당 크기는 불변 | ✅ 여유. v82 저장 가드(49K 차단·42K 경고) |
| `notices_v1` | 〃 | **39,833자** ← 임계 근접 | 수백 건 | ✅ v81 자동 조각(45K 초과 시 `_pN`) |
| `checks_v1` | 〃 | 6,111자 | 수십 건 | ✅ 〃 |
| `topic_summaries_v1` | 〃 | 91,085자(조각 3개) | 계속 성장 | ✅ 조각(v52부터). 편집 부담은 §3-④ |
| `roster_history_v1` | 〃 | 14,379자 | ~40건/2년 증가 | ✅ v82 Cloud.get/saveSystemRecord 조각 지원 |
| `data.json` | 파일·파싱 | 647KB(97건) | **~20MB** | ⚠️ §3-③ 연도 샤딩 필요 |
| `action=list` 응답 | 응답·시간 | ~15KB(104건) | ~450KB | ⚠️ §3-⑤ since 파라미터 |
| localStorage 캐시(recMap 등) | ~5MB | 수백 KB | 초과 | ✅ try/catch로 캐시 없이 동작(성능만 저하) |
| 첨부파일 | — | IndexedDB(기기 로컬) | — | ℹ️ 클라우드 레코드에는 메타만. 기기 간 이동은 백업 파일로(설계상 의도) |
| 구글시트 전체 | 1,000만 셀 | 레코드당 1행 | ~3천 행 | ✅ 여유 |

## 2. 이번에 넣은 안전장치 (v81~v82)

- **자동 조각 저장 규격 통일** — `{version, chunked:true, parts:N, totalLen, updatedAt}` 본 레코드 + `id_p1..pN`(원문 슬라이스, 45,000자 단위). 주제 요약(v52)·notices/checks(v81 `notices.js`+`importer.js`)·**모든 시스템 레코드(v82 `Cloud.getSystemRecord/saveSystemRecord`)** 가 같은 규격. 조각이 줄면 잉여 조각 자동 삭제.
- **회의록 저장 가드(v82 cloud.js)** — 49,000자 초과 시 저장 전 차단+안내(이전엔 "Failed to fetch"로 원인 불명 실패), 42,000자부터 경고 토스트.
- **공통 임포터(v81 `scripts/import/importer.js`)** — 적재는 `SandleImporter.run(JOB)` 하나로: 저장→재조회 대조→목록 대조, 실패 시 throw. 회의록 49K 가드 포함. (배경: tenant_2022.js가 SyntaxError로 미실행인데 기록만 남았던 사고)
- **시스템 레코드 백업(v82 build-data.mjs)** — 요약·명단이력·공고·점검(조각 포함)을 `system-backup.json`으로 매일 깃에 저장. 이전에는 **구글시트가 유일 사본**이었음(시트 훼손 = 영구 유실). 복원: system-backup.json의 해당 item.json을 `SandleImporter.saveFull`/GAS save로 되올리면 됨.

## 3. 남은 과제 (우선순위순)

1. **③ data.json 연도 샤딩** — `data-index.json`(id·updatedAt 목록) + `data-YYYY.json`으로 분할, 앱 StaticData는 인덱스→필요 연도만 로드(최근 연도 우선). 회의록이 ~300건(≈2MB)을 넘기 전에. 앱·워크플로 동시 변경이라 별도 세션 권장.
2. **⑤ 목록 동기화 경량화** — GAS에 `action=list&since=<ISO>` 추가해 변경분만 대조. ③과 함께.
3. **④ 요약 연도별 키** — `__all__`이 계속 자라 편집·검토가 무거워짐. `__all_2022__`처럼 연도(또는 기수) 키로 나누고 화면에서 이어 붙이기. 저장 자체는 조각이 감당하므로 급하지 않음.
4. **GAS 소스 저장소 반영** — Apps Script 코드가 깃에 없음(구글 계정 안에만). `scripts/gas/Code.gs`로 사본을 두고 수정 시 함께 갱신. 저장 경합 방지용 `LockService` 사용 여부도 이때 확인.
5. **레코드 자체의 조각화(예비)** — 상세 회의록+원문 전문이 49K를 넘는 날이 오면, 시스템 레코드와 같은 조각 규격을 회의록 레코드에도 적용(앱 read 경로는 getSystemRecord와 동일 패턴). 현재 최대 11.9K라 당장은 불필요.

## 4. 운영 수칙

- 적재는 반드시 `importer.js`의 `run()` — "검증 실패" 없이 끝났을 때만 완료로 기록(DATA.md §7).
- 시스템 레코드를 손으로 고칠 때도 `SandleImporter.getFull/saveFull` 사용(단일 레코드 가정 금지, DATA.md §8).
- 새 저장 경로를 만들면 이 문서 §1 표에 한도·실측을 추가하고, 45K 조각 규격을 따를 것.
- 파일명은 `_`로 시작하지 말 것(GitHub Pages/Jekyll이 제외해 404).
