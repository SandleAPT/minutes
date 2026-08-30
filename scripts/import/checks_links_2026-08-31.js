// 절차 점검 연관 링크 (2026-08-31, v86과 함께) — 사용자 요청: "연계된 게 있으면 그렇게 표기되면 좋겠다"
// related에 type:'check' 항목을 추가해 점검 카드끼리 서로 연결(카드의 '관련 기록' 칩 → 대상 카드로 이동).
// 6기 선관위 사슬: c_ec6_formation ↔ c_ec_candidate·c_ec_chair·c_t6_schedule + LH 조사(tenant-election-qualification)
// 기수 공통: c_ec_recruit_notice(4·5·6기), c_ec5_transition·c_t5_term(5기), c_term_limit(4→5→6기)
// 실행: importer.js 로드 후 이 스크립트 로드 → await SandleImporter.run(LINKS_JOB)
var LINKS_JOB = {
  label: "절차 점검 연관 링크",
  checks: [
    { id: "c_ec6_formation", addRelated: [
      { type: "check", id: "c_ec_candidate", label: "규약 대조: 선관위원의 후보 등록(김영자)" },
      { type: "check", id: "c_ec_chair", label: "규약 대조: 위원장 사퇴 후 구성원 수" },
      { type: "check", id: "c_t6_schedule", label: "규약 대조: 6기 선거 공고~투표 하루" },
      { type: "check", id: "c_ec_recruit_notice", label: "규약 대조: 모집 공고 7일 요건(전 기수)" },
      { type: "check", id: "tenant-election-qualification", label: "조사: LH 재확인(선관위원 인정 여부)" }
    ]},
    { id: "c_ec_candidate", addRelated: [
      { type: "check", id: "c_ec6_formation", label: "규약 대조: 6기 선관위 구성 절차" },
      { type: "check", id: "tenant-election-qualification", label: "조사: LH 재확인(선관위원 인정 여부)" }
    ]},
    { id: "c_ec_chair", addRelated: [
      { type: "check", id: "c_ec6_formation", label: "규약 대조: 6기 선관위 구성 절차" }
    ]},
    { id: "c_t6_schedule", addRelated: [
      { type: "check", id: "c_ec6_formation", label: "규약 대조: 6기 선관위 구성 절차" },
      { type: "check", id: "c_term_limit", label: "규약 대조: 중임 제한과 3기수 연속 재임" }
    ]},
    { id: "c_ec_recruit_notice", addRelated: [
      { type: "check", id: "c_ec6_formation", label: "규약 대조: 6기 선관위 구성 절차" },
      { type: "check", id: "c_ec5_transition", label: "규약 대조: 5기 선관위(4명 구성 등)" }
    ]},
    { id: "c_t5_term", addRelated: [
      { type: "check", id: "c_ec5_transition", label: "규약 대조: 5기 선관위원장 대표 전환" },
      { type: "check", id: "tenant-election-delay", label: "조사: 6기 선거 지연·임기 공백" }
    ]},
    { id: "c_ec5_transition", addRelated: [
      { type: "check", id: "c_t5_term", label: "규약 대조: 5기 임기 기록 불일치" },
      { type: "check", id: "c_ec_recruit_notice", label: "규약 대조: 모집 공고 7일 요건(전 기수)" }
    ]},
    { id: "c_term_limit", addRelated: [
      { type: "check", id: "c_t6_schedule", label: "규약 대조: 6기 선거 공고~투표 하루" }
    ]}
  ]
};
console.log("LINKS_JOB ready — await SandleImporter.run(LINKS_JOB)");
