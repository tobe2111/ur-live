# 프랜차이즈 원부 저장 0 — 원인과 수리 (2026-11-23)

- 라이브: `ads_franchise_stats` = 100회 실행 · 회당 600건 발견 · `total_saved` 0 · `diag.save_error` = `batch: ALL_REJECTED {"KEYWORD_ECHO":100}`.
- 원인: 수집 키워드를 `g(it, 'brandMngtNo', 'jnghdMngtNo', 'brandNm')` 로 만들었는데 실제 응답 칸은 `brandMnno`·`jnghdqrtrsMnno` 다. 못 찾아 **브랜드명**으로 폴백 → "상호 = 키워드" → 분류기의 키워드 메아리 규칙이 전부 거절.
- 수리: `franchiseKeyword()` — 관리번호(실제 칸 이름 포함) → 없으면 고정값 `'franchise'`. 상호로는 폴백하지 않는다. 대표자(`jnghdqrtrsRprsvNm`)·주력상품(`majrGdsNm`) 칸도 실제 이름 추가.
- 이어받는 첫 액션: 다음 실행(3일 간격) 뒤 `ads_franchise_stats.total_saved > 0` 이고 `save_error` 가 사라졌는지.
- 틀린 판단: 11-02 에 "라이브에서만 실패 → 한도·바인딩·스키마 차이" 로 봤다. 실제로는 **응답 칸 이름**이 달랐다 — 실패 원문을 남기게 한 뒤에야 보였다.
- 같이 본 것: 위생 스윕 v4 완주(`done:true`, 3,319건) · 시트 안내 탭 v3 세 시트 기록 · 시트 `marked`/`unmarked` 0(숨긴 줄 아직 없음) · 레인 정지 해제.
